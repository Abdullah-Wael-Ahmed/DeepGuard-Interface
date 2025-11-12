import {exec} from 'child_process'
import { stderr, stdout } from 'process';
const express = require("express")

const router = express.Router();

router.get("/list", (req, res) => {
    exec('sudo iptables -L -n --line-numbers', (error, stdout, stderr) => {
        if (error) return res.status(500).json({error: stderr});
        res.json({rules: stdout})
    })
})

export default router;