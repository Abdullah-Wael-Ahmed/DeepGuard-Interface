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
        // 1. Calculate the time 24 hours ago
        const oneDayAgo = new Date(new Date() - 24 * 60 * 60 * 1000);

        const data = await ZeekConnection.findAll({
            attributes: [
                [fn("strftime", "%Y-%m-%d %H:00:00", col("timestamp")), "time"],
                [fn("COUNT", col("id")), "count"],
            ],
            // 2. ADD THIS WHERE CLAUSE
            where: {
                timestamp: {
                    [Op.gte]: oneDayAgo // "Greater Than or Equal to" 24 hours ago
                }
            },
            group: [literal("strftime('%Y-%m-%d %H:00:00', timestamp)")],
            order: [[literal("time"), "ASC"]],
            // Limit is optional now because the time filter constrains it, 
            // but keeping it is safe.
            limit: 24, 
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
        const data = req.body;

        console.log("zeek conn ---------------------------------")
        console.log(req.body)
        console.log('---------------------------------------------')

        // Convert Zeek ts (Unix timestamp in seconds) to JS Date
        const timestamp = data.ts ? new Date(data.ts * 1000) : new Date();

        // Create new connection in DB
        await ZeekConnection.create({
            timestamp: timestamp,
            uid: data.uid,                      // Note: Ensure this isn't pruned in Logstash!

            // Map Logstash [source][ip] -> DB id_orig_h
            id_orig_h: data.source?.ip,
            id_orig_p: data.source?.port,

            // Map Logstash [destination][ip] -> DB id_resp_h
            id_resp_h: data.destination?.ip,
            id_resp_p: data.destination?.port,

            proto: data.protocol,               // Renamed from 'proto'
            service: data.app_protocol,         // Renamed from 'service'

            duration: data.duration,            // Kept as is

            orig_bytes: data.bytes_sent,        // Renamed from 'orig_bytes'
            resp_bytes: data.bytes_received,    // Renamed from 'resp_bytes'

            conn_state: data.conn_state         // Note: Ensure this isn't pruned!
        });
        res.json({ status: "ok" });
    } catch (error) {
        console.log(error)
        res.status(500).json(error);
    }
});

router.post("/ingest/dns", async (req, res) => {
    try {
        const data = req.body;

        console.log("zeek dns------------------------------")
        console.log(req.body)
        console.log("--------------------------------------")

        // 1. Handle Timestamp
        const timestamp = data["@timestamp"] ? new Date(data["@timestamp"]) : new Date();

        // 2. Create DNS Record
        await ZeekDNS.create({
            timestamp: timestamp,
            uid: data.uid,                   // Requires 'uid' in Logstash prune whitelist!
            
            // Map Logstash [source][ip] -> DB id_orig_h
            id_orig_h: data.source?.ip,
            id_orig_p: data.source?.port,

            // Map Logstash [dns_query] -> DB query
            query: data.dns_query,           
            
            // Map Logstash [dns_qtype] -> DB qtype_name
            qtype_name: data.dns_qtype,      
            
            // Map Logstash [dns_rcode] -> DB rcode_name
            rcode_name: data.dns_rcode       
        });

        res.json({ status: "ok" });
    } catch (error) {
        console.error("Zeek DNS Ingest Error:", error);
        res.status(500).json(error);
    }
});

module.exports = router;
