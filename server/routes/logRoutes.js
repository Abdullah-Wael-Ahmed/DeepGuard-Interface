const express = require("express");
const Alert = require("../models/Alert");
const { broadcast } = require("../util/websocket");

const router = express.Router();

router.post("/filebeat",async (req, res) => {
    try {
        
        console.log('filebeat sent');
        console.log("Headers -----------------------------------");
        console.log(req.headers);
        console.log("Body -----------------------------------");
        console.log(req.body);
        const alert = await Alert.create({
            timestamp: req.body["@timestamp"],
            src_ip: req.body.source.ip,
            src_port: req.body.source.port,
            dest_ip: req.body.destination.ip,
            dest_port: req.body.destination.port,
            signature: req.body.signature,
            severity: req.body.severity,
            protocol: req.body.protocol
        })
        broadcast({type: "new_alert", data: alert})
        res.json("ok")
    } catch (error) {
        res.status(500).json("Server Error")
    }
})

router.get("/", async (req, res) => {
    try {
        const page = req.query.page ?? 1
        const noItems = 7
        const alerts = await Alert.findAll({
            order: [['createdAt', 'DESC']],
            limit: noItems,
            offset: (page - 1) * noItems
        })
        const alertCount = await Alert.count()
        res.json({alerts, alertCount})
    } catch (error) {
        res.status(500).json("server error")
        console.log(error);
    }
})

module.exports = router;