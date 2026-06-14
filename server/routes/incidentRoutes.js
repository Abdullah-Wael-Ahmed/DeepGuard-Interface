const express = require("express");
const { Op } = require("sequelize");
const Incident = require("../models/Incident");
const IncidentEvent = require("../models/IncidentEvent");
const Evidence = require("../models/Evidence");
const Alert = require("../models/Alert");
const soarEngine = require("../services/soar/engine");
const IOC = require("../models/IOC");
const { requireAdminOrOperator } = require("../middleware/authorize");

const router = express.Router();

// ── Middleware: Granular Incident Write Guard for Analysts ───────────────────
async function requireIncidentWriteAccess(req, res, next) {
    try {
        if (req.userRole === 'admin' || req.userRole === 'operator') {
            return next();
        }
        if (req.userRole === 'analyst') {
            const incident = await Incident.findByPk(req.params.id);
            if (!incident) {
                return res.status(404).json({ error: "Incident not found" });
            }
            if (incident.assigneeId === req.userId) {
                req.incident = incident;
                return next();
            }
            return res.status(403).json({ error: "Forbidden: You are not assigned to this incident" });
        }
        return res.status(403).json({ error: "Forbidden: Unauthorized role" });
    } catch (error) {
        console.error("[Auth Middleware] Error checking write access:", error);
        res.status(500).json({ error: "Internal server error during authorization checks" });
    }
}

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
            mitreTechnique,
            falsePositive,
            sortBy = "createdAt",
            sortOrder = "DESC",
        } = req.query;

        const where = {};

        // If user is an analyst, they can only view incidents assigned to them
        if (req.userRole === 'analyst') {
            where.assigneeId = req.userId;
        }

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
        if (mitreTechnique) where.mitreTechnique = mitreTechnique;
        if (falsePositive !== undefined) {
            where.falsePositive = falsePositive === "true";
        }
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
        const where = {};
        if (req.userRole === 'analyst') {
            where.assigneeId = req.userId;
        }

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
            Incident.count({ where }),
            Incident.count({ where: { ...where, status: "open" } }),
            Incident.count({ where: { ...where, status: "triaging" } }),
            Incident.count({ where: { ...where, status: "investigating" } }),
            Incident.count({ where: { ...where, status: "containing" } }),
            Incident.count({ where: { ...where, status: "remediated" } }),
            Incident.count({ where: { ...where, status: "closed" } }),
            Incident.count({ where: { ...where, severity: "critical", status: { [Op.notIn]: ["closed", "remediated"] } } }),
            Incident.count({ where: { ...where, severity: "high", status: { [Op.notIn]: ["closed", "remediated"] } } }),
            Incident.count({
                where: {
                    ...where,
                    slaDeadline: { [Op.lt]: new Date() },
                    status: { [Op.notIn]: ["closed", "remediated"] },
                },
            }),
        ]);

        // MTTR calculation (mean time to resolve) — only for resolved incidents
        const resolvedIncidents = await Incident.findAll({
            where: { ...where, resolvedAt: { [Op.ne]: null } },
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
// POST /incidents/bulk — Bulk update incidents (Admin/Operator only)
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/bulk", requireAdminOrOperator, async (req, res) => {
    try {
        const { incidentIds, status, assignee, assigneeId, severity, priority } = req.body || {};
        
        if (!incidentIds || !Array.isArray(incidentIds) || incidentIds.length === 0) {
            return res.status(400).json({ error: "An array of incidentIds is required" });
        }

        const updates = {};

        if (status !== undefined) {
            updates.status = status;
            if (status === "closed") {
                updates.closedAt = new Date();
                updates.resolvedAt = new Date();
            } else if (status === "remediated") {
                updates.resolvedAt = new Date();
            }
        }
        if (assignee !== undefined) {
            updates.assignee = assignee || null;
            updates.assigneeId = assigneeId || null;
        }
        if (severity !== undefined) {
            updates.severity = severity;
        }
        if (priority !== undefined) {
            updates.priority = priority;
        }

        await Incident.update(updates, {
            where: { id: { [Op.in]: incidentIds } }
        });

        // Log timeline events for all updated incidents
        const actor = req.body?.actor || "system";
        const actorId = req.body?.actorId || null;
        
        for (const id of incidentIds) {
            let msg = `Bulk update applied: `;
            const details = {};
            if (status !== undefined) {
                msg += `status set to ${status}. `;
                details.status = status;
            }
            if (assignee !== undefined) {
                msg += `assignee set to ${assignee || 'unassigned'}. `;
                details.assignee = assignee;
            }
            if (severity !== undefined) {
                msg += `severity set to ${severity}. `;
                details.severity = severity;
            }
            await logEvent(id, "bulk_update", actor, msg.trim(), details, actorId);
        }

        res.json({ success: true, count: incidentIds.length });
    } catch (error) {
        console.error("[Incidents] Bulk update error:", error);
        res.status(500).json({ error: "Failed to apply bulk updates", details: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /incidents/merge — Merge duplicate incidents (Admin/Operator only)
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/merge", requireAdminOrOperator, async (req, res) => {
    try {
        const { primaryId, childIds, reason } = req.body || {};

        if (!primaryId || !childIds || !Array.isArray(childIds) || childIds.length === 0) {
            return res.status(400).json({ error: "primaryId and childIds (array) are required" });
        }

        if (childIds.includes(primaryId)) {
            return res.status(400).json({ error: "Primary incident cannot be merged into itself" });
        }

        const primary = await Incident.findByPk(primaryId);
        if (!primary) {
            return res.status(404).json({ error: "Primary incident not found" });
        }

        const children = await Incident.findAll({
            where: { id: { [Op.in]: childIds } }
        });

        if (children.length === 0) {
            return res.status(404).json({ error: "No child incidents found to merge" });
        }

        const actor = req.body?.actor || "system";
        const actorId = req.body?.actorId || null;

        // Perform merge
        for (const child of children) {
            // Close the child incident
            child.status = "closed";
            child.closedAt = new Date();
            if (!child.resolvedAt) child.resolvedAt = new Date();
            await child.save();

            const childRef = formatIncidentId(child.id);
            const primaryRef = formatIncidentId(primary.id);

            // 1. Log merge event in child timeline
            await logEvent(
                child.id,
                "merged",
                actor,
                `Incident merged into primary incident ${primaryRef}. Reason: ${reason || 'Duplicate'}`,
                { primaryId: primary.id, reason },
                actorId
            );

            // 2. Log merge event in primary timeline
            await logEvent(
                primary.id,
                "merged",
                actor,
                `Incident ${childRef} merged into this incident. Reason: ${reason || 'Duplicate'}`,
                { childId: child.id, reason },
                actorId
            );

            // 3. Move/Copy timeline events of child to primary
            const childEvents = await IncidentEvent.findAll({
                where: { incidentId: child.id }
            });
            for (const event of childEvents) {
                if (event.type !== "created") { // Avoid double created events
                    await IncidentEvent.create({
                        incidentId: primary.id,
                        type: event.type,
                        actor: event.actor,
                        actorId: event.actorId,
                        message: `[Merged from ${childRef}] ${event.message}`,
                        details: event.details
                    });
                }
            }

            // 4. Move/Copy evidence logs of child to primary
            const childEvidence = await Evidence.findAll({
                where: { incidentId: child.id }
            });
            for (const ev of childEvidence) {
                await Evidence.create({
                    incidentId: primary.id,
                    type: ev.type,
                    referenceId: ev.referenceId,
                    title: `[Merged from ${childRef}] ${ev.title}`,
                    content: ev.content,
                    metadata: ev.metadata,
                    addedBy: ev.addedBy
                });
            }
        }

        res.json({ success: true, mergedCount: children.length });
    } catch (error) {
        console.error("[Incidents] Merge error:", error);
        res.status(500).json({ error: "Failed to merge incidents", details: error.message });
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

        // Restriction: Analysts can only view their assigned incidents
        if (req.userRole === 'analyst' && incident.assigneeId !== req.userId) {
            return res.status(403).json({ error: "Access denied: You are not assigned to this incident" });
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
router.post("/", requireAdminOrOperator, async (req, res) => {
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
        } = req.body || {};

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
router.patch("/:id", requireIncidentWriteAccess, async (req, res) => {
    try {
        const incident = req.incident || await Incident.findByPk(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        const { title, description, severity, priority, category, assignee, assigneeId, tags, tlp, mitreTechnique, falsePositive, falsePositiveReason, escalationReason } = req.body || {};
        const actor = req.body?.actor || "analyst";
        const actorId = req.body?.actorId || null;

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
        if (mitreTechnique !== undefined && mitreTechnique !== incident.mitreTechnique) {
            changes.push({ field: "mitreTechnique", from: incident.mitreTechnique, to: mitreTechnique });
            incident.mitreTechnique = mitreTechnique;
        }
        if (falsePositive !== undefined && falsePositive !== incident.falsePositive) {
            changes.push({ field: "falsePositive", from: incident.falsePositive, to: falsePositive });
            incident.falsePositive = falsePositive;
            if (falsePositive) {
                incident.status = "closed";
                incident.closedAt = new Date();
                if (!incident.resolvedAt) incident.resolvedAt = new Date();
            }
        }
        if (falsePositiveReason !== undefined) {
            incident.falsePositiveReason = falsePositiveReason;
        }
        if (escalationReason !== undefined && escalationReason !== incident.escalationReason) {
            changes.push({ field: "escalationReason", from: incident.escalationReason, to: escalationReason });
            incident.escalationReason = escalationReason;
            await logEvent(incident.id, "escalated", actor, `Incident escalated: ${escalationReason}`, { reason: escalationReason }, actorId);
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
router.patch("/:id/status", requireIncidentWriteAccess, async (req, res) => {
    try {
        const incident = req.incident || await Incident.findByPk(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        const { status, actor = "analyst", actorId = null, reason } = req.body || {};

        if (status === "closed" && (!reason || !reason.trim())) {
            return res.status(400).json({ error: "A closure reason/justification is required to close an incident." });
        }

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
router.post("/:id/comment", requireIncidentWriteAccess, async (req, res) => {
    try {
        const incident = req.incident || await Incident.findByPk(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        const { message, actor = "analyst", actorId = null } = req.body || {};

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
router.post("/:id/evidence", requireIncidentWriteAccess, async (req, res) => {
    try {
        const incident = req.incident || await Incident.findByPk(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        const { type, referenceId, title, content, metadata, addedBy = "analyst" } = req.body || {};

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
router.delete("/:id/evidence/:evidenceId", requireIncidentWriteAccess, async (req, res) => {
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
            req.body?.actor || "analyst",
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
        const incident = await Incident.findByPk(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }
        if (req.userRole === 'analyst' && incident.assigneeId !== req.userId) {
            return res.status(403).json({ error: "Access denied: You are not assigned to this incident" });
        }
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
router.delete("/:id", requireAdminOrOperator, async (req, res) => {
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
