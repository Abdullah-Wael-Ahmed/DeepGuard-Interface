/**
 * DeepGuard SOAR — Playbook Routes v2
 *
 * Expanded routes with:
 *  - Full CRUD for playbooks
 *  - Execution with the new SOAR engine
 *  - Execution history (global + per-playbook)
 *  - Approval workflow endpoints
 *  - Seed pre-built templates
 *  - List available action types
 *  - Rollback execution
 */

const express = require("express");
const { Op } = require("sequelize");
const Playbook = require("../models/Playbook");
const PlaybookExecution = require("../models/PlaybookExecution");
const soarEngine = require("../services/soar/engine");
const { listActions } = require("../services/soar/actionPlugins");
const { seedPlaybooks } = require("../services/soar/playbookTemplates");

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// GET /playbooks — List all playbooks
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/", async (req, res) => {
    try {
        const playbooks = await Playbook.findAll({
            attributes: ["id", "name", "description", "status", "triggerType", "author", "updatedAt", "createdAt"],
            order: [["updatedAt", "DESC"]]
        });
        res.json(playbooks);
    } catch (error) {
        console.error("[SOAR Routes] List error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /playbooks/actions — List available action types (for frontend dropdown)
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/actions", (req, res) => {
    res.json(listActions());
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /playbooks/executions — Global execution history (all playbooks)
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/executions", async (req, res) => {
    try {
        const { status, limit = 50, page = 1 } = req.query;
        const where = {};
        if (status) where.status = status;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { count, rows } = await PlaybookExecution.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit: parseInt(limit),
            offset
        });

        // Enrich with playbook names
        const playbookIds = [...new Set(rows.map(r => r.playbookId))];
        const playbooks = await Playbook.findAll({
            where: { id: playbookIds },
            attributes: ["id", "name"]
        });
        const nameMap = Object.fromEntries(playbooks.map(p => [p.id, p.name]));

        const enriched = rows.map(r => ({
            ...r.toJSON(),
            playbookName: nameMap[r.playbookId] || `Deleted Playbook #${r.playbookId}`
        }));

        res.json({
            executions: enriched,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit))
        });
    } catch (error) {
        console.error("[SOAR Routes] Executions list error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /playbooks/stats — SOAR dashboard statistics
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/stats", async (req, res) => {
    try {
        const [
            totalPlaybooks,
            activePlaybooks,
            totalExecutions,
            successCount,
            failedCount,
            awaitingApproval,
        ] = await Promise.all([
            Playbook.count(),
            Playbook.count({ where: { status: "active" } }),
            PlaybookExecution.count(),
            PlaybookExecution.count({ where: { status: "success" } }),
            PlaybookExecution.count({ where: { status: "failed" } }),
            PlaybookExecution.count({ where: { status: "awaiting_approval" } }),
        ]);

        // Last 24h executions
        const last24h = await PlaybookExecution.count({
            where: { createdAt: { [Op.gte]: new Date(Date.now() - 86400000) } }
        });

        res.json({
            totalPlaybooks,
            activePlaybooks,
            totalExecutions,
            successCount,
            failedCount,
            awaitingApproval,
            last24h,
            successRate: totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 0
        });
    } catch (error) {
        console.error("[SOAR Routes] Stats error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /playbooks/seed — Seed pre-built playbook templates
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/seed", async (req, res) => {
    try {
        const result = await seedPlaybooks();
        res.json({ message: "Playbook templates seeded", ...result });
    } catch (error) {
        console.error("[SOAR Routes] Seed error:", error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /playbooks/:id — Get specific playbook (with nodes/edges)
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/:id", async (req, res) => {
    try {
        const playbook = await Playbook.findByPk(req.params.id);
        if (!playbook) return res.status(404).json({ error: "Playbook not found" });
        res.json(playbook);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /playbooks — Create new playbook
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/", async (req, res) => {
    try {
        const pb = await Playbook.create(req.body);
        res.status(201).json(pb);
    } catch (error) {
        console.error("[SOAR Routes] Create error:", error);
        res.status(400).json({ error: error.message, stack: error.stack });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /playbooks/:id — Update playbook (save nodes/edges)
// ═══════════════════════════════════════════════════════════════════════════════
router.put("/:id", async (req, res) => {
    try {
        const playbook = await Playbook.findByPk(req.params.id);
        if (!playbook) return res.status(404).json({ error: "Playbook not found" });

        await playbook.update({
            name: req.body.name,
            description: req.body.description,
            status: req.body.status,
            nodes: req.body.nodes,
            edges: req.body.edges,
            triggerType: req.body.triggerType,
            triggerConditions: req.body.triggerConditions,
            mitreTags: req.body.mitreTags
        });

        res.json(playbook);
    } catch (error) {
        console.error("[SOAR Routes] Update error:", error);
        res.status(400).json({ error: error.message, stack: error.stack });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /playbooks/:id — Delete playbook
// ═══════════════════════════════════════════════════════════════════════════════
router.delete("/:id", async (req, res) => {
    try {
        await PlaybookExecution.destroy({ where: { playbookId: req.params.id } });
        await Playbook.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /playbooks/:id/execute — Manually trigger playbook execution
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/:id/execute", async (req, res) => {
    try {
        const contextData = req.body || {};
        const execution = await soarEngine.runPlaybook(parseInt(req.params.id), "manual", contextData);

        if (!execution) return res.status(400).json({ error: "Playbook not found or disabled" });

        res.json(execution);
    } catch (error) {
        console.error("[SOAR Routes] Execute error:", error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /playbooks/:id/executions — Execution history for a specific playbook
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/:id/executions", async (req, res) => {
    try {
        const execs = await PlaybookExecution.findAll({
            where: { playbookId: req.params.id },
            order: [["createdAt", "DESC"]],
            limit: parseInt(req.query.limit) || 30
        });
        res.json(execs);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /playbooks/executions/:execId/approve — Approve a paused execution
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/executions/:execId/approve", async (req, res) => {
    try {
        const { approved = true, approver = "analyst" } = req.body;
        const result = await soarEngine.resumeExecution(parseInt(req.params.execId), approved, approver);
        res.json(result);
    } catch (error) {
        console.error("[SOAR Routes] Approve error:", error);
        res.status(500).json({ error: "Failed to process approval" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /playbooks/executions/pending — Get all executions awaiting approval
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/executions/pending", async (req, res) => {
    try {
        const pending = await PlaybookExecution.findAll({
            where: { status: "awaiting_approval" },
            order: [["createdAt", "DESC"]]
        });

        // Enrich with playbook names
        const playbookIds = [...new Set(pending.map(p => p.playbookId))];
        const playbooks = await Playbook.findAll({
            where: { id: playbookIds },
            attributes: ["id", "name"]
        });
        const nameMap = Object.fromEntries(playbooks.map(p => [p.id, p.name]));

        const enriched = pending.map(p => ({
            ...p.toJSON(),
            playbookName: nameMap[p.playbookId] || `Playbook #${p.playbookId}`
        }));

        res.json(enriched);
    } catch (error) {
        console.error("[SOAR Routes] Pending error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /playbooks/executions/:execId/rollback/:stepId — Rollback a specific step
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/executions/:execId/rollback/:stepId", async (req, res) => {
    try {
        const execution = await PlaybookExecution.findByPk(req.params.execId);
        if (!execution) return res.status(404).json({ error: "Execution not found" });

        const { actionType, rollbackData } = req.body;
        
        const { getAction } = require("../services/soar/actionPlugins");
        const plugin = getAction(actionType);
        if (!plugin) return res.status(400).json({ error: "Unknown action plugin" });

        const result = await plugin.rollback(rollbackData);
        
        const logs = execution.logs || [];
        logs.push({ timestamp: new Date().toISOString(), level: "info", message: `Manual rollback triggered for ${actionType}`, result });
        execution.logs = logs;
        await execution.save();

        res.json({ success: true, result });
    } catch (error) {
        console.error("[SOAR Routes] Rollback error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
