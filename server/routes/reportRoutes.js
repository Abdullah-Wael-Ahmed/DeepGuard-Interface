const express = require("express");
const reportService = require("../services/reportService");

const router = express.Router();

// GET /api/reports/executive?hours=24
router.get("/executive", async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const data = await reportService.getExecutiveSummary(hours);
        res.json(data);
    } catch (error) {
        console.error("Error generating executive report:", error);
        res.status(500).json({ error: "Failed to generate report data" });
    }
});

// GET /api/reports/endpoint-health?hours=24
router.get("/endpoint-health", async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const data = await reportService.getEndpointHealth(hours);
        res.json(data);
    } catch (error) {
        console.error("Error generating endpoint health report:", error);
        res.status(500).json({ error: "Failed to generate report data" });
    }
});

// POST /api/reports/postmortem
// Using POST so we can pass an IP in the body, or keep it flexible
router.post("/postmortem", async (req, res) => {
    try {
        const hours = parseInt(req.body.hours) || parseInt(req.query.hours) || 24;
        const ip = req.body.ip || null;
        const data = await reportService.getIncidentPostMortem(ip, hours);
        res.json(data);
    } catch (error) {
        console.error("Error generating incident post-mortem report:", error);
        res.status(500).json({ error: "Failed to generate report data" });
    }
});

// GET /api/reports/ai-anomalies?hours=24
router.get("/ai-anomalies", async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const data = await reportService.getAiAnomaliesReport(hours);
        res.json(data);
    } catch (error) {
        console.error("Error generating AI anomalies report:", error);
        res.status(500).json({ error: "Failed to generate report data" });
    }
});

module.exports = router;
