const express = require("express");
const Alert = require("../models/Alert");
const { broadcast } = require("../util/websocket");
const { Op, col, literal, fn, where } = require("sequelize");

const router = express.Router();

router.post("/filebeat", async (req, res) => {
    try {

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
        broadcast({ type: "new_alert", data: alert })
        res.json("ok")
    } catch (error) {
        console.log(error.name)
        if (error.name === 'TypeError') {
            console.error("Validation Error:", error.message);
            return res.status(400).json({ error: "Invalid Data Format" }); // Logstash drops it. Safe.
        }

        console.log(error)
        res.status(500).json("Server Error")
    }
})

router.get("/", async (req, res) => {
    try {
        const page = req.query.page ?? 1
        const search = req.query.search ?? ""
        const noItems = 7
        const alerts = await Alert.findAll({
            where: {
                [Op.or]: [
                    where(
                        literal("src_ip || ':' || src_port"),
                        { [Op.like]: `%${search}%` }
                    ),
                    where(
                        literal("dest_ip || ':' || dest_port"),
                        { [Op.like]: `%${search}%` }
                    ),
                    { protocol: { [Op.like]: `%${search}%` } }
                ]
            },
            order: [['createdAt', 'DESC']],
            limit: noItems,
            offset: (page - 1) * noItems
        })
        const alertCount = await Alert.count({where: {
                [Op.or]: [
                    where(
                        literal("src_ip || ':' || src_port"),
                        { [Op.like]: `%${search}%` }
                    ),
                    where(
                        literal("dest_ip || ':' || dest_port"),
                        { [Op.like]: `%${search}%` }
                    ),
                    { protocol: { [Op.like]: `%${search}%` } }
                ]
            }})
        res.json({ alerts, alertCount, noItems })
    } catch (error) {
        res.status(500).json("server error")
        console.log(error);
    }
})

module.exports = router;