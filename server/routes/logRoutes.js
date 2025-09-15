const express = require("express");
const Alert = require("../models/Alert");

const router = express.Router();

router.post("/filebeat",async (req, res) => {
    try {
        
        console.log('filebeat sent');
        console.log("Headers -----------------------------------");
        console.log(req.headers);
        console.log("Body -----------------------------------");
        console.log(req.body);
        Alert.create({
            timestamp: req.body["@timestamp"],
            src_ip: req.body.source.ip,
            src_port: req.body.source.port,
            dest_ip: req.body.destination.ip,
            dest_port: req.body.destination.port,
            signature: req.body.signature,
            severity: req.body.severity,
            protocol: req.body.protocol
        })
        res.json("ok")
    } catch (error) {
        res.status(500).json("Server Error")
    }
})

router.get("/", async (req, res) => {
    try {
        const alerts = await Alert.findAll()
        res.json(alerts)
    } catch (error) {
        res.status(500).json("server error")
        console.log(error);
    }
})

module.exports = router;