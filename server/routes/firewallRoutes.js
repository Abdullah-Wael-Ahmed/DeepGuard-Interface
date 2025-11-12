const express = require("express");
const { exec } = require('child_process')
const { stderr, stdout } = require('process');

const router = express.Router();


const runAsNodeUser = (command, res, successMessage) => {
    const fullCmd = `su nodeuser ${command}`;
    exec(fullCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${stderr}`);
            return res.status(500).json({ error: stderr });
        }
        res.json({ message: successMessage, output: stdout });
    });
};


router.get('/list', (req, res) => {
    const cmd = "/usr/sbin/iptables -L -n --line-numbers";
    runAsNodeUser(cmd, res, 'Rules listed successfully');
});


module.exports = router;