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
        if (operation == "list"){
            res.json({ message: successMessage, output: parseIptablesOutput(stdout) });
        }else {
            res.json({ message: successMessage, output: stdout });
        }
    });
};

const execPromise = (command) => {
    return new Promise((resolve, reject) => {
        // We use just 'sudo' here assuming the app runs as 'nodeuser'
        // If the app runs as root, you don't need sudo.
        // If app runs as 'nodeuser', sudo allows it to run root commands.
        const fullCmd = `sudo /usr/sbin/iptables ${command}`; 
        
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

        if (protocol && protocol !== 'all') criteria += ` -p ${protocol}`;
        if (srcIp?.trim()) criteria += ` -s ${srcIp}`;
        if (destIp?.trim()) criteria += ` -d ${destIp}`;
        if (inInterface?.trim()) criteria += ` -i ${inInterface}`;
        if (outInterface?.trim()) criteria += ` -o ${outInterface}`;

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


router.get('/list', async (req, res) => {
    const cmd = "iptables -L INPUT --line-numbers -n";
    const results = await execPromise(cmd);
    return res.json({ message: successMessage, output: parseIptablesOutput(results) })
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

        // Parse rule lines (expected columns: num, target, prot, opt, source, destination, [rest])
        const parts = line.split(/\s+/);

        // The output may have variable spacing, so we normalize
        if (parts.length >= 6) {
            const [num, target, prot, opt, source, destination, ...rest] = parts;

            rules.push({
                chain: chainName,
                num: Number(num),
                target,
                prot,
                opt,
                source,
                destination,
                extra: rest.join(' ') || ''
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