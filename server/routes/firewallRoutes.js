const express = require("express");
const { exec } = require('child_process')
const { stderr, stdout } = require('process');

const router = express.Router();


const runAsNodeUser = (command, res, successMessage, operation = "") => {
    const fullCmd = `sudo ${command}`;
    exec(fullCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${stderr}`);
            return res.status(500).json({ error: stderr });
        }
        if (operation == "list") {
            res.json({ message: successMessage, output: parseIptablesOutput(stdout) });
        } else {
            res.json({ message: successMessage, output: stdout });
        }
    });
};

const execPromise = (command) => {
    return new Promise((resolve, reject) => {
        // We use just 'sudo' here assuming the app runs as 'nodeuser'
        // If the app runs as root, you don't need sudo.
        // If app runs as 'nodeuser', sudo allows it to run root commands.
        const fullCmd = `sudo iptables ${command}`;

        console.log(`Executing: ${fullCmd}`); // Debugging

        exec(fullCmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Exec Error: ${stderr}`);
                return reject(stderr || error.message);
            }
            resolve(stdout);
        });
    });
};

router.post('/add-rule', async (req, res) => {
    const {
        chain, action, protocol, srcIp, destIp,
        srcPort, dstPort, inInterface, outInterface,
        logEnabled, description
    } = req.body;

    try {
        // 1. Construct the criteria string (reusable parts)
        let criteria = `-A ${chain}`;

        // test

        if (protocol && protocol !== 'all'){
            const safeprotocol = protocol.replace(/["`$]/g, '');
            criteria += ` -p ${safeprotocol}`;
        }
        if (srcIp?.trim()){
            const safesrcIp = srcIp.replace(/["`$]/g, '');
            criteria += ` -s ${safesrcIp}`;
        }
        if (destIp?.trim()){
            const safedestIp = destIp.replace(/["`$]/g, '');
            criteria += ` -d ${safedestIp}`;
        }
        if (inInterface?.trim()) {
            const safeinInterface = inInterface.replace(/["`$]/g, '');
            criteria += ` -i ${safeinInterface}`;
        };
        if (outInterface?.trim()) {
            const safeoutInterface = outInterface.replace(/["`$]/g, '');
            criteria += ` -o ${safeoutInterface}`;
        }
        if (description && description.trim()) {
            // Sanitize to prevent breaking the command with quotes
            const safeDesc = description.replace(/["`$]/g, '');
            criteria += ` -m comment --comment "${safeDesc}"`;
        }

        if ((protocol === 'tcp' || protocol === 'udp')) {
            if (srcPort?.trim()) criteria += ` --sport ${srcPort}`;
            if (dstPort?.trim()) criteria += ` --dport ${dstPort}`;
        }

        // 2. Execute Logic
        // If logging is enabled, we need to run TWO commands.
        if (logEnabled) {
            const prefix = description ? description.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 29) : 'DeepGuard_Log';
            // iptables log-prefix is limited to 29 chars
            const logCmd = `${criteria} -j LOG --log-prefix "${prefix} "`;
            await execPromise(logCmd);
        }

        // 3. Add the actual action rule
        const actionCmd = `${criteria} -j ${action}`;
        await execPromise(actionCmd);

        res.json({ message: "Rule(s) added successfully", command: actionCmd });

    } catch (error) {
        console.log(error)
        res.status(500).json({ error: "Failed to add rule", details: error });
    }
});

router.delete('/delete-rule', async (req, res) => {
    const { chain, ruleNum } = req.query;

    // 1. Basic Validation
    if (!chain || !ruleNum) {
        return res.status(400).json({
            error: "Missing required fields: 'chain' and 'ruleNum' are required."
        });
    }

    // 2. Security Check (Prevent Command Injection)
    // Ensure ruleNum is actually a number
    if (!/^\d+$/.test(ruleNum)) {
        return res.status(400).json({
            error: "Invalid Rule Number. Must be an integer."
        });
    }

    // Ensure chain is a valid standard chain or alphanumeric (for custom chains)
    if (!/^[a-zA-Z0-9_-]+$/.test(chain)) {
        return res.status(400).json({
            error: "Invalid Chain name."
        });
    }

    try {
        // 3. Construct the delete command
        // usage: -D <CHAIN> <NUM>
        const cmd = `-D ${chain} ${ruleNum}`;

        // 4. Execute using your existing promise helper
        await execPromise(cmd);

        res.json({
            message: `Successfully deleted rule #${ruleNum} from chain ${chain}`
        });

    } catch (error) {
        console.error("Delete Error:", error);

        // Handle specific iptables errors (like rule does not exist)
        if (error.toString().includes("Bad rule") || error.toString().includes("Index of deletion")) {
            return res.status(404).json({ error: "Rule not found or index out of range." });
        }

        res.status(500).json({
            error: "Failed to delete rule",
            details: error.toString()
        });
    }
});

router.get('/list', (req, res) => {
    const cmd = "iptables -L INPUT --line-numbers";
    runAsNodeUser(cmd, res, 'Rules listed successfully', 'list');
});

function parseIptablesOutput(output) {
    const lines = output.trim().split('\n');

    const rules = [];
    let chainName = '';
    let startIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detect chain
        if (line.startsWith('Chain ')) {
            chainName = line.split(' ')[1];
            continue;
        }

        // Skip header
        if (line.startsWith('num')) {
            startIndex = i + 1;
            continue;
        }

        // Skip lines before header
        if (startIndex === -1) continue;

        // Parse rule lines
        // Splitting by whitespace handles the fixed columns
        const parts = line.split(/\s+/);

        if (parts.length >= 6) {
            const [num, target, prot, opt, source, destination, ...rest] = parts;

            // Rejoin the remaining parts to get the full "extra" string
            const rawExtra = rest.join(' ');

            // REGEX: Extract text between /* and */
            // iptables formats comments like: ... tcp dpt:80 /* My Description */
            const commentMatch = rawExtra.match(/\/\*\s*(.*?)\s*\*\//);
            const description = commentMatch ? commentMatch[1] : '';

            rules.push({
                chain: chainName,
                num: Number(num),
                target,
                prot,
                opt,
                source,
                destination,
                description: description, // <--- Now available in your frontend
                extra: rawExtra 
            });
        }
    }

    return rules;
}

router.get('/debug-user', (req, res) => {
    exec('whoami && id', (err, stdout) => {
        res.json({
            runningAs: stdout.trim(),
            note: "This is the user that needs NOPASSWD in /etc/sudoers"
        });
    });
});


module.exports = router;