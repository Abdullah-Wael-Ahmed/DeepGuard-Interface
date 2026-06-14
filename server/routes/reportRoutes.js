const express = require("express");
const reportService = require("../services/reportService");
const pdfService = require("../services/pdfService");

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

/**
 * Trigger PDF generation via Puppeteer
 * GET /api/reports/export/pdf?template=executive&hours=24&ip=...
 */
router.get("/export/pdf", async (req, res) => {
    try {
        const { template, hours, ip } = req.query;
        
        // internal frontend URL inside Docker network
        const baseUrl = process.env.FRONTEND_INTERNAL_URL || "http://frontend:3000";
        const printUrl = `${baseUrl}/reports/print/${template}?hours=${hours || 24}${ip ? `&ip=${ip}` : ""}`;

        console.log(`[PDF] Generating report for: ${printUrl}`);
        
        const pdfBuffer = await pdfService.generateFromUrl(printUrl, `DeepGuard_${template}_Report`);

        res.contentType("application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=DeepGuard_${template}_Report.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error("Error exporting PDF:", error);
        res.status(500).json({ error: "Failed to export PDF" });
    }
});

module.exports = router;
