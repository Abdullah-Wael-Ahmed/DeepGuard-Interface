const express = require("express");
const axios = require("axios");

const router = express.Router();

const ANOMALY_BASE = "http://deepguard-anomaly:5001";

// Proxy: GET /anomaly/health → anomaly detector /health
router.get("/health", async (req, res) => {
    try {
        const { data } = await axios.get(`${ANOMALY_BASE}/health`);
        res.json(data);
    } catch (error) {
        console.error("Anomaly health proxy error:", error.message);
        res.status(502).json({ error: "Anomaly detector unreachable" });
    }
});

// Proxy: GET /anomaly/stats → anomaly detector /stats
router.get("/stats", async (req, res) => {
    try {
        const { data } = await axios.get(`${ANOMALY_BASE}/stats`);
        res.json(data);
    } catch (error) {
        console.error("Anomaly stats proxy error:", error.message);
        res.status(502).json({ error: "Anomaly detector unreachable" });
    }
});

// Proxy: GET /anomaly/results → anomaly detector /results
router.get("/results", async (req, res) => {
    try {
        const { data } = await axios.get(`${ANOMALY_BASE}/results`);
        res.json(data);
    } catch (error) {
        console.error("Anomaly results proxy error:", error.message);
        res.status(502).json({ error: "Anomaly detector unreachable" });
    }
});

module.exports = router;
