const express = require("express");
const { Op } = require("sequelize");
const Incident = require("../models/Incident");
const IncidentEvent = require("../models/IncidentEvent");
const Evidence = require("../models/Evidence");
const Alert = require("../models/Alert");
const soarEngine = require("../services/soar/engine");
const IOC = require("../models/IOC");

const router = express.Router();

// ── Helper: Create a timeline event for an incident ──────────────────────────
async function logEvent(incidentId, type, actor, message, details = null, actorId = null) {
    return IncidentEvent.create({
        incidentId,
        type,
        actor,
        actorId,
        message,
        details,
    });
}

// ── Helper: SLA calculation based on severity ────────────────────────────────
function calculateSLA(severity) {
    const slaHours = {
        critical: 1,
        high: 4,
        medium: 24,
        low: 72,
        info: 168,
    };
    const hours = slaHours[severity] || 24;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ── Helper: Generate incident ID string ──────────────────────────────────────
function formatIncidentId(id) {
    return `INC-${String(id).padStart(5, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /incidents — List all incidents with filters and pagination
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/", async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            severity,
            priority,
            assignee,
            category,
            search,
            sortBy = "createdAt",
            sortOrder = "DESC",
        } = req.query;

        const where = {};

        if (status) {
            if (status === "active") {
                where.status = { [Op.notIn]: ["closed", "remediated"] };
            } else {
                where.status = status;
            }
        }
        if (severity) where.severity = severity;
        if (priority) where.priority = priority;
        if (assignee) where.assignee = assignee;
        if (category) where.category = category;
        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
            ];
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { count, rows } = await Incident.findAndCountAll({
            where,
            order: [[sortBy, sortOrder]],
            limit: parseInt(limit),
            offset,
        });

        res.json({
            incidents: rows,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit)),
        });
    } catch (error) {
        console.error("[Incidents] List error:", error);
        res.status(500).json({ error: "Failed to fetch incidents" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /incidents/stats — Dashboard statistics
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/stats", async (req, res) => {
    try {
        const [
            total,
            openCount,
            triagingCount,
            investigatingCount,
            containingCount,
            remediatedCount,
            closedCount,
            criticalCount,
            highCount,
            breachedSLA,
        ] = await Promise.all([
            Incident.count(),
            Incident.count({ where: { status: "open" } }),
            Incident.count({ where: { status: "triaging" } }),
            Incident.count({ where: { status: "investigating" } }),
            Incident.count({ where: { status: "containing" } }),
            Incident.count({ where: { status: "remediated" } }),
            Incident.count({ where: { status: "closed" } }),
            Incident.count({ where: { severity: "critical", status: { [Op.notIn]: ["closed", "remediated"] } } }),
            Incident.count({ where: { severity: "high", status: { [Op.notIn]: ["closed", "remediated"] } } }),
            Incident.count({
                where: {
                    slaDeadline: { [Op.lt]: new Date() },
                    status: { [Op.notIn]: ["closed", "remediated"] },
                },
            }),
        ]);

        // MTTR calculation (mean time to resolve) — only for resolved incidents
        const resolvedIncidents = await Incident.findAll({
            where: { resolvedAt: { [Op.ne]: null } },
            attributes: ["createdAt", "resolvedAt"],
            limit: 100,
            order: [["resolvedAt", "DESC"]],
        });

        let mttrMinutes = 0;
        if (resolvedIncidents.length > 0) {
            const totalMs = resolvedIncidents.reduce((acc, r) => {
                return acc + (new Date(r.resolvedAt) - new Date(r.createdAt));
            }, 0);
            mttrMinutes = Math.round(totalMs / resolvedIncidents.length / 60000);
        }

        res.json({
            total,
            open: openCount,
            triaging: triagingCount,
            investigating: investigatingCount,
            containing: containingCount,
            remediated: remediatedCount,
            closed: closedCount,
            active: openCount + triagingCount + investigatingCount + containingCount,
            critical: criticalCount,
            high: highCount,
            breachedSLA,
            mttrMinutes,
        });
    } catch (error) {
        console.error("[Incidents] Stats error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /incidents/:id — Get single incident with timeline and evidence
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/:id", async (req, res) => {
    try {
        const incident = await Incident.findByPk(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        const [timeline, evidence] = await Promise.all([
            IncidentEvent.findAll({
                where: { incidentId: incident.id },
                order: [["createdAt", "DESC"]],
            }),
            Evidence.findAll({
                where: { incidentId: incident.id },
                order: [["createdAt", "DESC"]],
            }),
        ]);

        res.json({
            incident,
            timeline,
            evidence,
            incidentRef: formatIncidentId(incident.id),
        });
    } catch (error) {
        console.error("[Incidents] Get error:", error);
        res.status(500).json({ error: "Failed to fetch incident" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /incidents — Create a new incident
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/", async (req, res) => {
    try {
        const {
            title,
            description,
            severity = "medium",
            priority,
            category,
            assignee,
            assigneeId,
            source = "manual",
            sourceRef,
            tags = [],
            tlp = "amber",
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: "Title is required" });
        }

        // Auto-calculate priority from severity if not provided
        const autoPriority = priority || {
            critical: "P1",
            high: "P2",
            medium: "P3",
            low: "P4",
            info: "P4",
        }[severity] || "P3";

        const incident = await Incident.create({
            title: title.trim(),
            description: description?.trim() || null,
            severity,
            priority: autoPriority,
            category: category || null,
            assignee: assignee || null,
            assigneeId: assigneeId || null,
            source,
            sourceRef: sourceRef || null,
            tags,
            tlp,
            slaDeadline: calculateSLA(severity),
        });

        // Log creation event
        await logEvent(
            incident.id,
            "created",
            assignee || "system",
            `Incident created: ${title}`,
            { severity, priority: autoPriority, source },
            assigneeId || null
        );

        // If assigned, log assignment
        if (assignee) {
            await logEvent(
                incident.id,
                "assigned",
                "system",
                `Assigned to ${assignee}`,
                { assignee },
            );
        }

        const { broadcast } = require("../util/websocket");
        broadcast({ type: "new_incident", data: incident });

        // SOAR: Trigger automated playbooks
        soarEngine.triggerOnIncident(incident);

        res.status(201).json({
            incident,
            incidentRef: formatIncidentId(incident.id),
        });
    } catch (error) {
        console.error("[Incidents] Create error:", error);
        res.status(500).json({ error: "Failed to create incident", details: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /incidents/:id — Update incident fields
// ═══════════════════════════════════════════════════════════════════════════════
router.patch("/:id", async (req, res) => {
    try {
        const incident = await Incident.findByPk(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        const { title, description, severity, priority, category, assignee, assigneeId, tags, tlp } = req.body;
        const actor = req.body.actor || "analyst";
        const actorId = req.body.actorId || null;

        // Track what changed for timeline events
        const changes = [];

        if (title !== undefined && title !== incident.title) {
            changes.push({ field: "title", from: incident.title, to: title });
            incident.title = title;
        }
        if (description !== undefined) {
            incident.description = description;
        }
        if (severity !== undefined && severity !== incident.severity) {
            changes.push({ field: "severity", from: incident.severity, to: severity });
            incident.severity = severity;
            // Recalculate SLA if severity escalated
            if (["critical", "high"].includes(severity) && !["critical", "high"].includes(incident.severity)) {
                incident.slaDeadline = calculateSLA(severity);
            }
        }
        if (priority !== undefined && priority !== incident.priority) {
            changes.push({ field: "priority", from: incident.priority, to: priority });
            incident.priority = priority;
        }
        if (category !== undefined) {
            incident.category = category;
        }
        if (assignee !== undefined && assignee !== incident.assignee) {
            const oldAssignee = incident.assignee;
            incident.assignee = assignee || null;
            incident.assigneeId = assigneeId || null;
            if (assignee) {
                await logEvent(incident.id, "assigned", actor, `Reassigned from ${oldAssignee || "unassigned"} to ${assignee}`, { from: oldAssignee, to: assignee }, actorId);
            } else {
                await logEvent(incident.id, "unassigned", actor, `Unassigned from ${oldAssignee}`, { from: oldAssignee }, actorId);
            }
        }
        if (tags !== undefined) {
            incident.tags = tags;
        }
        if (tlp !== undefined) {
            incident.tlp = tlp;
        }

        await incident.save();

        // Log field changes
        for (const change of changes) {
            const eventType = change.field === "severity" ? "severity_change" : change.field === "priority" ? "priority_change" : "status_change";
            await logEvent(incident.id, eventType, actor, `${change.field} changed from ${change.from} to ${change.to}`, change, actorId);
        }

        res.json({ incident, incidentRef: formatIncidentId(incident.id) });
    } catch (error) {
        console.error("[Incidents] Update error:", error);
        res.status(500).json({ error: "Failed to update incident", details: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /incidents/:id/status — Transition incident status
// ═══════════════════════════════════════════════════════════════════════════════
router.patch("/:id/status", async (req, res) => {
    try {
        const incident = await Incident.findByPk(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        const { status, actor = "analyst", actorId = null, reason } = req.body;

        // Valid transitions
        const validTransitions = {
            open: ["triaging", "investigating", "closed"],
            triaging: ["investigating", "open", "closed"],
            investigating: ["containing", "triaging", "remediated", "closed"],
            containing: ["remediated", "investigating", "closed"],
            remediated: ["closed", "investigating"],
            closed: ["open"], // reopen
        };

        const allowed = validTransitions[incident.status] || [];
        if (!allowed.includes(status)) {
            return res.status(400).json({
                error: `Cannot transition from '${incident.status}' to '${status}'`,
                allowed,
            });
        }

        const oldStatus = incident.status;
        incident.status = status;

        // Track resolution timestamps
        if (status === "remediated" && !incident.resolvedAt) {
            incident.resolvedAt = new Date();
        }
        if (status === "closed") {
            incident.closedAt = new Date();
            if (!incident.resolvedAt) incident.resolvedAt = new Date();
        }
        if (status === "open" && oldStatus === "closed") {
            // Reopening — clear close/resolve timestamps
            incident.closedAt = null;
            incident.resolvedAt = null;
        }

        await incident.save();

        const eventType = status === "open" && oldStatus === "closed" ? "reopened" : status === "closed" ? "closed" : "status_change";
        await logEvent(
            incident.id,
            eventType,
            actor,
            `Status changed: ${oldStatus} → ${status}${reason ? ` — ${reason}` : ""}`,
            { from: oldStatus, to: status, reason },
            actorId
        );

        res.json({ incident, incidentRef: formatIncidentId(incident.id) });
    } catch (error) {
        console.error("[Incidents] Status change error:", error);
        res.status(500).json({ error: "Failed to update status" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /incidents/:id/comment — Add a comment to the timeline
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/:id/comment", async (req, res) => {
    try {
        const incident = await Incident.findByPk(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        const { message, actor = "analyst", actorId = null } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: "Comment message is required" });
        }

        const event = await logEvent(
            incident.id,
            "comment",
            actor,
            message.trim(),
            null,
            actorId
        );

        res.status(201).json(event);
    } catch (error) {
        console.error("[Incidents] Comment error:", error);
        res.status(500).json({ error: "Failed to add comment" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /incidents/:id/evidence — Attach evidence to an incident
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/:id/evidence", async (req, res) => {
    try {
        const incident = await Incident.findByPk(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        const { type, referenceId, title, content, metadata, addedBy = "analyst" } = req.body;

        if (!type || !title) {
            return res.status(400).json({ error: "Evidence type and title are required" });
        }

        const evidence = await Evidence.create({
            incidentId: incident.id,
            type,
            referenceId: referenceId || null,
            title,
            content: content || null,
            metadata: metadata || null,
            addedBy,
        });

        // Log the evidence addition
        await logEvent(
            incident.id,
            "evidence_added",
            addedBy,
            `Evidence added: [${type}] ${title}`,
            { evidenceId: evidence.id, type, title },
        );

        res.status(201).json(evidence);
    } catch (error) {
        console.error("[Incidents] Evidence add error:", error);
        res.status(500).json({ error: "Failed to add evidence" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /incidents/:id/evidence/:evidenceId — Remove evidence
// ═══════════════════════════════════════════════════════════════════════════════
router.delete("/:id/evidence/:evidenceId", async (req, res) => {
    try {
        const evidence = await Evidence.findOne({
            where: { id: req.params.evidenceId, incidentId: req.params.id },
        });
        if (!evidence) {
            return res.status(404).json({ error: "Evidence not found" });
        }

        await logEvent(
            parseInt(req.params.id),
            "evidence_removed",
            req.body.actor || "analyst",
            `Evidence removed: [${evidence.type}] ${evidence.title}`,
            { evidenceId: evidence.id },
        );

        await evidence.destroy();
        res.json({ success: true });
    } catch (error) {
        console.error("[Incidents] Evidence remove error:", error);
        res.status(500).json({ error: "Failed to remove evidence" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /incidents/:id/timeline — Get timeline events for an incident
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/:id/timeline", async (req, res) => {
    try {
        const events = await IncidentEvent.findAll({
            where: { incidentId: req.params.id },
            order: [["createdAt", "DESC"]],
        });
        res.json(events);
    } catch (error) {
        console.error("[Incidents] Timeline error:", error);
        res.status(500).json({ error: "Failed to fetch timeline" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /incidents/from-alert/:alertId — Create incident from a Suricata alert
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/from-alert/:alertId", async (req, res) => {
    try {
        const alert = await Alert.findByPk(req.params.alertId);
        if (!alert) {
            return res.status(404).json({ error: "Alert not found" });
        }

        // Map Suricata severity (1=high, 2=medium, 3=low) to incident severity
        const severityMap = { 1: "critical", 2: "high", 3: "medium" };
        const severity = severityMap[alert.severity] || "medium";

        const incident = await Incident.create({
            title: alert.signature || `Alert from ${alert.src_ip}`,
            description: `Auto-created from Suricata alert.\n\nSource: ${alert.src_ip}:${alert.src_port}\nDestination: ${alert.dest_ip}:${alert.dest_port}\nProtocol: ${alert.protocol}\nSignature: ${alert.signature}`,
            severity,
            priority: severity === "critical" ? "P1" : severity === "high" ? "P2" : "P3",
            source: "suricata",
            sourceRef: `alert-${alert.id}`,
            slaDeadline: calculateSLA(severity),
        });

        // Auto-attach alert as evidence
        await Evidence.create({
            incidentId: incident.id,
            type: "alert",
            referenceId: alert.id,
            title: alert.signature || "Suricata Alert",
            content: JSON.stringify({
                src_ip: alert.src_ip,
                src_port: alert.src_port,
                dest_ip: alert.dest_ip,
                dest_port: alert.dest_port,
                protocol: alert.protocol,
                severity: alert.severity,
                timestamp: alert.timestamp,
            }),
            addedBy: "system",
        });

        await logEvent(incident.id, "created", "system", `Incident created from Suricata alert #${alert.id}`, { alertId: alert.id, signature: alert.signature });
        await logEvent(incident.id, "evidence_added", "system", `Alert #${alert.id} attached as evidence`);

        res.status(201).json({
            incident,
            incidentRef: formatIncidentId(incident.id),
        });
    } catch (error) {
        console.error("[Incidents] From alert error:", error);
        res.status(500).json({ error: "Failed to create incident from alert" });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /incidents/:id — Delete an incident (admin only in practice)
// ═══════════════════════════════════════════════════════════════════════════════
router.delete("/:id", async (req, res) => {
    try {
        const incident = await Incident.findByPk(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        // Delete related events and evidence
        await IncidentEvent.destroy({ where: { incidentId: incident.id } });
        await Evidence.destroy({ where: { incidentId: incident.id } });
        await incident.destroy();

        res.json({ success: true, message: `Incident ${formatIncidentId(parseInt(req.params.id))} deleted` });
    } catch (error) {
        console.error("[Incidents] Delete error:", error);
        res.status(500).json({ error: "Failed to delete incident" });
    }
});

module.exports = router;
