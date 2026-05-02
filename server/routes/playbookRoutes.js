const express = require("express");
const Playbook = require("../models/Playbook");
const PlaybookExecution = require("../models/PlaybookExecution");
const playbookEngine = require("../services/playbookEngine");

const router = express.Router();

// List all playbooks
router.get("/", async (req, res) => {
    try {
        const playbooks = await Playbook.findAll({
            attributes: ['id', 'name', 'description', 'status', 'triggerType', 'updatedAt'],
            order: [['updatedAt', 'DESC']]
        });
        res.json(playbooks);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Get specific playbook (with nodes/edges)
router.get("/:id", async (req, res) => {
    try {
        const playbook = await Playbook.findByPk(req.params.id);
        if (!playbook) return res.status(404).json({ error: "Playbook not found" });
        res.json(playbook);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Create new playbook
router.post("/", async (req, res) => {
    try {
        const pb = await Playbook.create(req.body);
        res.status(201).json(pb);
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: "Invalid playbook data" });
    }
});

// Update playbook (save nodes/edges)
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
            triggerConditions: req.body.triggerConditions
        });
        
        res.json(playbook);
    } catch (error) {
        console.error("PUT Error:", error);
        res.status(400).json({ error: "Invalid update payload" });
    }
});

// Delete playbook
router.delete("/:id", async (req, res) => {
    try {
        await Playbook.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Manually trigger playbook execution
router.post("/:id/execute", async (req, res) => {
    try {
        const contextData = req.body || {};
        const execution = await playbookEngine.runPlaybook(req.params.id, 'manual', contextData);
        
        if (!execution) return res.status(400).json({ error: "Playbook not found or disabled" });
        
        res.json(execution);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Execution failed" });
    }
});

// Get execution history
router.get("/:id/executions", async (req, res) => {
    try {
        const execs = await PlaybookExecution.findAll({
            where: { playbookId: req.params.id },
            order: [['createdAt', 'DESC']],
            limit: 20
        });
        res.json(execs);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
