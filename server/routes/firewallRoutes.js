const express = require("express");
const { exec } = require('child_process')
const { stderr, stdout } = require('process');

const router = express.Router();


const runAsNodeUser = (command, res, successMessage) => {
    const fullCmd = `sudo -u nodeuser sudo ${command}`;
    exec(fullCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${stderr}`);
            return res.status(500).json({ error: stderr });
        }
        res.json({ message: successMessage, output: stdout });
    });
};

router.post('/add-rule', (req, res) => {
    const {
        chain,            // INPUT / OUTPUT / FORWARD
        action,           // ACCEPT / DROP / REJECT / LOG
        protocol,         // tcp / udp / icmp / all
        srcIP,            // optional
        dstIP,            // optional
        srcPort,          // optional
        dstPort,          // optional
        inInterface,      // optional (for INPUT/FORWARD)
        outInterface,     // optional (for OUTPUT/FORWARD)
        logEnabled,       // boolean
        description       // optional string for logging
    } = req.body;

    // Base command
    let cmd = `/usr/sbin/iptables -A ${ chain }`;

    // Add protocol
    if (protocol && protocol !== 'all') cmd += ` -p ${protocol}`;

    // Add optional IPs
    if (srcIP && srcIP.trim() !== '') cmd += ` -s ${srcIP}`;
    if (dstIP && dstIP.trim() !== '') cmd += ` -d ${dstIP}`;

    // Add optional interfaces
    if (inInterface && inInterface.trim() !== '') cmd += ` -i ${inInterface}`;
    if (outInterface && outInterface.trim() !== '') cmd += ` -o ${outInterface}`;

    // Add optional ports (only valid with tcp/udp)
    if ((protocol === 'tcp' || protocol === 'udp')) {
        if (srcPort && srcPort.trim() !== '') cmd += ` --sport ${srcPort}`;
        if (dstPort && dstPort.trim() !== '') cmd += ` --dport ${dstPort}`;
    }

    // Logging prefix if enabled
    if (logEnabled) {
        const prefix = description ? description.replace(/[^a-zA-Z0-9_-]/g, '_') : 'DeepGuard_Log';
        cmd += ` -j LOG --log-prefix "${prefix} "`;
    }

    // Final action
    cmd += ` -j ${action}`;

    console.log(cmd);

    // Run as nodeuser
    runAsNodeUser(cmd, res,`Rule added successfully: ${ cmd }`);
});



router.get('/list', (req, res) => {
    const cmd = "iptables -L INPUT -n --line-numbers";
    runAsNodeUser(cmd, res, 'Rules listed successfully');
});


module.exports = router;