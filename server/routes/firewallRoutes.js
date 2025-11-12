const express = require("express");
const {exec} =  require('child_process')
const { stderr, stdout } =  require('process');

const router = express.Router();

router.get("/list", (req, res) => {
    exec('sudo iptables -L -n --line-numbers', (error, stdout, stderr) => {
        if (error) return res.status(500).json({error: stderr});
        res.json({rules: stdout})
    })
})

export default router;