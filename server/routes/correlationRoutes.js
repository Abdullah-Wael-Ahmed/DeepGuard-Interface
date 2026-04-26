const express = require("express");
const CorrelationRule = require("../models/CorrelationRule");
const correlationEngine = require("../services/correlationEngine");

const router = express.Router();

router.get("/rules", async (req, res) => {
    try {
        const rules = await CorrelationRule.findAll({ order: [['createdAt', 'DESC']] });
        res.json(rules);
    } catch (error) {
        console.error("Error fetching rules:", error);
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/rules", async (req, res) => {
    try {
        const rule = await CorrelationRule.create(req.body);
        await correlationEngine.reloadRules();
        res.status(201).json(rule);
    } catch (error) {
        console.error("Error creating rule:", error);
        res.status(400).json({ error: "Invalid rule configuration" });
    }
});

router.patch("/rules/:id", async (req, res) => {
    try {
        const rule = await CorrelationRule.findByPk(req.params.id);
        if (!rule) return res.status(404).json({ error: "Rule not found" });

        await rule.update(req.body);
        await correlationEngine.reloadRules();
        res.json(rule);
    } catch (error) {
        res.status(400).json({ error: "Invalid update" });
    }
});

router.delete("/rules/:id", async (req, res) => {
    try {
        const rule = await CorrelationRule.findByPk(req.params.id);
        if (!rule) return res.status(404).json({ error: "Rule not found" });

        await rule.destroy();
        await correlationEngine.reloadRules();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/rules/:id/toggle", async (req, res) => {
    try {
        const rule = await CorrelationRule.findByPk(req.params.id);
        if (!rule) return res.status(404).json({ error: "Rule not found" });

        rule.enabled = !rule.enabled;
        await rule.save();
        await correlationEngine.reloadRules();
        
        res.json(rule);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Seed default rules (for dev/demo)
router.post("/seed", async (req, res) => {
    try {
        const existing = await CorrelationRule.count();
        if (existing > 0) return res.json({ message: "Rules already seeded" });

        const defaultRules = [
            {
                name: "High Frequency Port Scan",
                description: "Detects more than 20 unique destination ports targeted by a single source IP within 60 seconds.",
                severity: "high",
                ruleType: "unique_threshold",
                conditions: {
                    eventType: "suricata_alert",
                    groupBy: "src_ip",
                    uniqueField: "dest_port",
                    threshold: 20
                },
                windowSeconds: 60,
                category: "port_scan",
                cooldownSeconds: 300
            },
            {
                name: "Brute Force Attack Detected",
                description: "Multiple Suricata alerts from the same source IP in a short window.",
                severity: "critical",
                ruleType: "threshold",
                conditions: {
                    eventType: "suricata_alert",
                    filter: { },
                    threshold: 50
                },
                windowSeconds: 60,
                category: "brute_force",
                cooldownSeconds: 600
            }
        ];

        await CorrelationRule.bulkCreate(defaultRules);
        await correlationEngine.reloadRules();
        res.json({ message: "Rules seeded successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Seed error" });
    }
});

module.exports = router;
