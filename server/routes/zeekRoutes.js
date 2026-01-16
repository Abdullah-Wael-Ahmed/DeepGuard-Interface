const express = require("express");
const { Op, fn, col, literal } = require("sequelize");
const ZeekConnection = require("../models/ZeekConnection");
const ZeekDNS = require("../models/ZeekDNS");

const router = express.Router();

// Get summary stats
router.get("/stats", async (req, res) => {
    try {
        const totalConnections = await ZeekConnection.count();

        // Efficiently count unique IPs
        const uniqueSourceIps = await ZeekConnection.aggregate('id_orig_h', 'count', { distinct: true });
        const uniqueDestIps = await ZeekConnection.aggregate('id_resp_h', 'count', { distinct: true });

        const dnsQueryCount = await ZeekDNS.count();

        const avgDurationResult = await ZeekConnection.findOne({
            attributes: [[fn("AVG", col("duration")), "avgDuration"]],
        });
        const avgDuration = avgDurationResult?.getDataValue("avgDuration") || 0;

        res.json({
            totalConnections,
            uniqueSourceIps,
            uniqueDestIps,
            dnsQueryCount,
            avgDuration: parseFloat(avgDuration.toFixed(4)),
        });
    } catch (error) {
        console.error("Stats error:", error);
        res.status(500).json({ error: "Server Error" });
    }
});

// Line chart: Connections over time (last 24h, hourly buckets)
router.get("/connections-over-time", async (req, res) => {
    try {
        const data = await ZeekConnection.findAll({
            attributes: [
                [fn("strftime", "%Y-%m-%d %H:00:00", col("timestamp")), "time"],
                [fn("COUNT", col("id")), "count"],
            ],
            group: [literal("strftime('%Y-%m-%d %H:00:00', timestamp)")],
            order: [[literal("time"), "ASC"]],
            limit: 24, // simplified for demo
        });
        res.json(data);
    } catch (error) {
        console.error("Connections over time error:", error);
        res.status(500).json({ error: "Server Error" });
    }
});

// Bar chart: Top Source IPs
router.get("/top-sources", async (req, res) => {
    try {
        const data = await ZeekConnection.findAll({
            attributes: [
                "id_orig_h",
                [fn("COUNT", col("id")), "count"],
            ],
            group: ["id_orig_h"],
            order: [[literal("count"), "DESC"]],
            limit: 10,
        });
        res.json(data);
    } catch (error) {
        console.error("Top sources error:", error);
        res.status(500).json({ error: "Server Error" });
    }
});

// Pie chart: Protocols
router.get("/protocols", async (req, res) => {
    try {
        const data = await ZeekConnection.findAll({
            attributes: [
                "proto",
                [fn("COUNT", col("id")), "count"],
            ],
            group: ["proto"],
        });
        res.json(data);
    } catch (error) {
        console.error("Protocol error:", error);
        res.status(500).json({ error: "Server Error" });
    }
});

// Bar chart: Top Domains
router.get("/top-domains", async (req, res) => {
    try {
        const data = await ZeekDNS.findAll({
            attributes: [
                "query",
                [fn("COUNT", col("id")), "count"],
            ],
            where: {
                query: { [Op.ne]: null }
            },
            group: ["query"],
            order: [[literal("count"), "DESC"]],
            limit: 10,
        });
        res.json(data);
    } catch (error) {
        console.error("Top domains error:", error);
        res.status(500).json({ error: "Server Error" });
    }
});

// Histogram approximation: Durations
router.get("/durations", async (req, res) => {
    try {
        // Determine buckets purely in JS to avoid complex SQLite math
        const connections = await ZeekConnection.findAll({
            attributes: ["duration"],
            limit: 1000, // sample size
            order: [["timestamp", "DESC"]]
        });

        const durations = connections.map(c => c.duration);
        // Simple binning logic could go here, or send raw list for frontend to bin
        res.json(durations);
    } catch (error) {
        console.error("Duration error:", error);
        res.status(500).json({ error: "Server Error" });
    }
});

// Recent Connections Table
router.get("/recent-connections", async (req, res) => {
    try {
        const data = await ZeekConnection.findAll({
            order: [["timestamp", "DESC"]],
            limit: 50,
        });
        res.json(data);
    } catch (error) {
        console.error("Recent connections error:", error);
        res.status(500).json({ error: "Server Error" });
    }
});

// DNS Activity Table
router.get("/dns-activity", async (req, res) => {
    try {
        const data = await ZeekDNS.findAll({
            order: [["timestamp", "DESC"]],
            limit: 50,
        });
        res.json(data);
    } catch (error) {
        console.error("DNS activity error:", error);
        res.status(500).json({ error: "Server Error" });
    }
});

// Ingest Endpoints (Mock/Real ingestion)
router.post("/ingest/conn", async (req, res) => {
    try {
        console.log("zeek conn ----------------------------------------")
        console.log(req.body)
        console.log("--------------------------------------------------")
        await ZeekConnection.create(req.body);
        res.json({ status: "ok" });
    } catch (error) {
        res.status(500).json(error);
    }
});

router.post("/ingest/dns", async (req, res) => {
    try {
        console.log("zeek dns ----------------------------------------")
        console.log(req.body)
        console.log("--------------------------------------------------\n")
        await ZeekDNS.create(req.body);
        res.json({ status: "ok" });
    } catch (error) {
        res.status(500).json(error);
    }
});

module.exports = router;
