/**
 * DeepGuard SOAR — Action Plugin Registry
 * 
 * Each action plugin implements:
 *   execute(payload, context)  → { success, result, rollbackData }
 *   rollback(rollbackData)     → { success }
 *   validate(payload)          → { valid, errors[] }
 * 
 * The engine calls these during playbook traversal.
 */

const BlockedIP = require("../../models/BlockedIP");
const Incident = require("../../models/Incident");
const IncidentEvent = require("../../models/IncidentEvent");
const Evidence = require("../../models/Evidence");
const IOC = require("../../models/IOC");
const Alert = require("../../models/Alert");
const { blockIP, unblockIP } = require("../../util/iptables");
const { broadcast } = require("../../util/websocket");
const axios = require("axios");

// ─── Helper: safe IP extraction ──────────────────────────────────────────────
function extractIP(payload) {
    return payload.src_ip || payload.ip || payload.source_ip || payload.attacker_ip || null;
}

function extractDestIP(payload) {
    return payload.dest_ip || payload.destination_ip || payload.target_ip || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

const ACTIONS = {

    // ── FIREWALL ACTIONS ─────────────────────────────────────────────────────

    block_ip: {
        label: "Block IP (Firewall)",
        category: "response",
        requiresApproval: false,
        async validate(payload) {
            const ip = extractIP(payload);
            if (!ip) return { valid: false, errors: ["No IP found in context (src_ip, ip, source_ip)"] };
            if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return { valid: false, errors: [`Invalid IP format: ${ip}`] };
            return { valid: true, errors: [] };
        },
        async execute(payload, context) {
            const ip = extractIP(payload);
            const reason = context.playbookName ? `SOAR: ${context.playbookName}` : "SOAR automated block";
            const ttlMinutes = payload.block_ttl_minutes || context.block_ttl_minutes || null;
            const expiresAt = ttlMinutes ? new Date(Date.now() + ttlMinutes * 60000) : null;

            // Database record
            const [record, created] = await BlockedIP.findOrCreate({
                where: { ip },
                defaults: { ip, reason, source: "SOAR", autoBlocked: true, active: true, expiresAt }
            });
            if (!created && !record.active) {
                record.active = true;
                record.reason = reason;
                record.expiresAt = expiresAt;
                await record.save();
            }

            // Attempt iptables enforcement (fails gracefully on Windows/non-privileged)
            try { await blockIP(ip); } catch (e) { /* iptables-proxy not running — DB block still active */ }

            broadcast({ type: "ip_blocked", data: { ip, reason, source: "SOAR" } });

            return {
                success: true,
                result: { ip, blocked: true, expiresAt, created },
                rollbackData: { ip }
            };
        },
        async rollback(data) {
            if (!data?.ip) return { success: false };
            await BlockedIP.update({ active: false }, { where: { ip: data.ip } });
            try { await unblockIP(data.ip); } catch (e) { /* graceful */ }
            broadcast({ type: "ip_unblocked", data: { ip: data.ip, source: "SOAR_rollback" } });
            return { success: true };
        }
    },

    unblock_ip: {
        label: "Unblock IP",
        category: "response",
        requiresApproval: false,
        async validate(payload) {
            const ip = extractIP(payload);
            if (!ip) return { valid: false, errors: ["No IP found in context"] };
            return { valid: true, errors: [] };
        },
        async execute(payload) {
            const ip = extractIP(payload);
            await BlockedIP.update({ active: false }, { where: { ip } });
            try { await unblockIP(ip); } catch (e) { /* graceful */ }
            broadcast({ type: "ip_unblocked", data: { ip, source: "SOAR" } });
            return { success: true, result: { ip, unblocked: true }, rollbackData: { ip } };
        },
        async rollback(data) {
            if (!data?.ip) return { success: false };
            await BlockedIP.findOrCreate({ where: { ip: data.ip }, defaults: { ip: data.ip, reason: "SOAR rollback re-block", source: "SOAR", active: true } });
            try { await blockIP(data.ip); } catch (e) { /* graceful */ }
            return { success: true };
        }
    },

    // ── ENRICHMENT ACTIONS ───────────────────────────────────────────────────

    enrich_ip: {
        label: "Enrich IP (Threat Intel)",
        category: "enrichment",
        requiresApproval: false,
        async validate(payload) {
            const ip = extractIP(payload) || extractDestIP(payload);
            if (!ip) return { valid: false, errors: ["No IP to enrich"] };
            return { valid: true, errors: [] };
        },
        async execute(payload, context) {
            const ip = extractIP(payload) || extractDestIP(payload);
            let enrichment = { ip, providers: {}, aggregatedScore: 0, reputation: "unknown" };

            // Call our own Threat Intel backend endpoint
            try {
                const backendUrl = `http://localhost:5000/threat-intel/lookup/${ip}/quick`;
                const res = await axios.get(backendUrl, { timeout: 15000 });
                enrichment = { ...enrichment, ...res.data };
            } catch (e) {
                enrichment.error = e.message;
            }

            // Inject enrichment into the payload for downstream nodes
            payload.enrichment = enrichment;
            payload.threat_score = enrichment.score || enrichment.aggregatedScore || 0;
            payload.reputation = enrichment.reputation || "unknown";

            return { success: true, result: enrichment, rollbackData: null };
        },
        async rollback() { return { success: true }; } // Enrichment is read-only
    },

    enrich_domain: {
        label: "Enrich Domain (Threat Intel)",
        category: "enrichment",
        requiresApproval: false,
        async validate(payload) {
            if (!payload.domain) return { valid: false, errors: ["No domain found in context"] };
            return { valid: true, errors: [] };
        },
        async execute(payload) {
            // Domain enrichment — check IOC database
            const localIOC = await IOC.findOne({ where: { type: "domain", value: payload.domain } });
            const enrichment = {
                domain: payload.domain,
                inLocalDB: !!localIOC,
                severity: localIOC?.severity || "unknown",
                threat: localIOC?.threat || "none"
            };
            payload.domain_enrichment = enrichment;
            return { success: true, result: enrichment, rollbackData: null };
        },
        async rollback() { return { success: true }; }
    },

    // ── INCIDENT ACTIONS ─────────────────────────────────────────────────────

    create_incident: {
        label: "Create Incident",
        category: "case_management",
        requiresApproval: false,
        async validate(payload) {
            if (!payload.title && !payload.signature && !payload.src_ip) {
                return { valid: false, errors: ["Need at least a title, signature, or src_ip to create an incident"] };
            }
            return { valid: true, errors: [] };
        },
        async execute(payload, context) {
            const severity = payload.severity || "medium";
            const priorityMap = { critical: "P1", high: "P2", medium: "P3", low: "P4", info: "P4" };
            const slaHours = { critical: 1, high: 4, medium: 24, low: 72, info: 168 };
            const hours = slaHours[severity] || 24;

            const incident = await Incident.create({
                title: payload.title || `[SOAR] ${payload.signature || "Automated Incident"} — ${extractIP(payload) || "Unknown"}`,
                description: payload.description || `Auto-created by SOAR playbook: ${context.playbookName}.\n\nSource IP: ${extractIP(payload) || "N/A"}\nDest IP: ${extractDestIP(payload) || "N/A"}\nThreat Score: ${payload.threat_score || "N/A"}`,
                severity,
                priority: priorityMap[severity] || "P3",
                category: payload.category || "other",
                source: "playbook",
                sourceRef: `playbook-${context.playbookId}`,
                slaDeadline: new Date(Date.now() + hours * 3600000)
            });

            await IncidentEvent.create({
                incidentId: incident.id,
                type: "created",
                actor: "SOAR",
                message: `Incident auto-created by playbook: ${context.playbookName}`
            });

            // Attach enrichment data as evidence if available
            if (payload.enrichment) {
                await Evidence.create({
                    incidentId: incident.id,
                    type: "log",
                    title: "Threat Intel Enrichment",
                    content: JSON.stringify(payload.enrichment, null, 2),
                    addedBy: "SOAR"
                });
            }

            payload.incidentId = incident.id;
            broadcast({ type: "new_incident", data: incident });

            return { success: true, result: { incidentId: incident.id }, rollbackData: { incidentId: incident.id } };
        },
        async rollback(data) {
            if (!data?.incidentId) return { success: false };
            await Incident.update({ status: "closed" }, { where: { id: data.incidentId } });
            await IncidentEvent.create({ incidentId: data.incidentId, type: "closed", actor: "SOAR", message: "Incident auto-closed by playbook rollback" });
            return { success: true };
        }
    },

    close_incident: {
        label: "Close Incident",
        category: "case_management",
        requiresApproval: false,
        async validate(payload) {
            if (!payload.incidentId) return { valid: false, errors: ["No incidentId in context"] };
            return { valid: true, errors: [] };
        },
        async execute(payload) {
            const incident = await Incident.findByPk(payload.incidentId);
            if (!incident) return { success: false, result: { error: "Incident not found" }, rollbackData: null };
            const oldStatus = incident.status;
            incident.status = "closed";
            incident.closedAt = new Date();
            if (!incident.resolvedAt) incident.resolvedAt = new Date();
            await incident.save();
            await IncidentEvent.create({ incidentId: incident.id, type: "closed", actor: "SOAR", message: "Incident closed by SOAR playbook" });
            return { success: true, result: { closed: true }, rollbackData: { incidentId: incident.id, previousStatus: oldStatus } };
        },
        async rollback(data) {
            if (!data?.incidentId) return { success: false };
            await Incident.update({ status: data.previousStatus || "open", closedAt: null }, { where: { id: data.incidentId } });
            await IncidentEvent.create({ incidentId: data.incidentId, type: "reopened", actor: "SOAR", message: "Incident reopened by SOAR rollback" });
            return { success: true };
        }
    },

    // ── NOTIFICATION ACTIONS ─────────────────────────────────────────────────

    notify_dashboard: {
        label: "Notify Dashboard (WebSocket)",
        category: "notification",
        requiresApproval: false,
        async validate() { return { valid: true, errors: [] }; },
        async execute(payload, context) {
            broadcast({
                type: "soar_notification",
                data: {
                    playbookName: context.playbookName,
                    message: payload.notification_message || `Playbook "${context.playbookName}" executed action on ${extractIP(payload) || "target"}`,
                    severity: payload.severity || "info",
                    timestamp: new Date().toISOString()
                }
            });
            return { success: true, result: { notified: true }, rollbackData: null };
        },
        async rollback() { return { success: true }; }
    },

    send_webhook: {
        label: "Send Webhook",
        category: "notification",
        requiresApproval: false,
        async validate(payload) {
            if (!payload.webhook_url) return { valid: false, errors: ["No webhook_url in context"] };
            return { valid: true, errors: [] };
        },
        async execute(payload, context) {
            try {
                await axios.post(payload.webhook_url, {
                    event: "soar_action",
                    playbook: context.playbookName,
                    payload: { ip: extractIP(payload), severity: payload.severity, incidentId: payload.incidentId },
                    timestamp: new Date().toISOString()
                }, { timeout: 10000 });
                return { success: true, result: { sent: true }, rollbackData: null };
            } catch (e) {
                return { success: false, result: { error: e.message }, rollbackData: null };
            }
        },
        async rollback() { return { success: true }; }
    },

    // ── MITRE TAGGING ────────────────────────────────────────────────────────

    tag_mitre: {
        label: "Tag MITRE ATT&CK Technique",
        category: "enrichment",
        requiresApproval: false,
        async validate(payload) {
            if (!payload.mitre_technique_id && !payload.mitre_technique) return { valid: false, errors: ["No MITRE technique specified"] };
            return { valid: true, errors: [] };
        },
        async execute(payload) {
            const techniqueId = payload.mitre_technique_id || payload.mitre_technique;
            if (payload.incidentId) {
                const incident = await Incident.findByPk(payload.incidentId);
                if (incident) {
                    const currentTags = incident.tags || [];
                    if (!currentTags.includes(techniqueId)) {
                        currentTags.push(techniqueId);
                        incident.tags = currentTags;
                        await incident.save();
                    }
                    await IncidentEvent.create({ incidentId: incident.id, type: "tag_added", actor: "SOAR", message: `MITRE technique tagged: ${techniqueId}` });
                }
            }
            payload.mitre_tagged = techniqueId;
            return { success: true, result: { tagged: techniqueId }, rollbackData: { incidentId: payload.incidentId, tag: techniqueId } };
        },
        async rollback(data) {
            if (!data?.incidentId || !data?.tag) return { success: true };
            const incident = await Incident.findByPk(data.incidentId);
            if (incident) {
                incident.tags = (incident.tags || []).filter(t => t !== data.tag);
                await incident.save();
            }
            return { success: true };
        }
    },

    // ── WATCHLIST ACTIONS ────────────────────────────────────────────────────

    add_watchlist: {
        label: "Add to IOC Watchlist",
        category: "enrichment",
        requiresApproval: false,
        async validate(payload) {
            const ip = extractIP(payload);
            if (!ip && !payload.domain) return { valid: false, errors: ["No IP or domain to add to watchlist"] };
            return { valid: true, errors: [] };
        },
        async execute(payload, context) {
            const ip = extractIP(payload);
            const value = ip || payload.domain;
            const type = ip ? "ip" : "domain";

            const [ioc, created] = await IOC.findOrCreate({
                where: { type, value },
                defaults: {
                    type, value,
                    threat: payload.threat || "Flagged by SOAR",
                    severity: payload.severity || "medium",
                    source: `SOAR: ${context.playbookName}`,
                    confidence: payload.threat_score || 50,
                    firstSeen: new Date(),
                    lastSeen: new Date()
                }
            });
            if (!created) {
                ioc.lastSeen = new Date();
                await ioc.save();
            }

            return { success: true, result: { iocId: ioc.id, value, created }, rollbackData: { iocId: ioc.id, created } };
        },
        async rollback(data) {
            if (data?.created && data?.iocId) {
                await IOC.destroy({ where: { id: data.iocId } });
            }
            return { success: true };
        }
    },

    remove_watchlist: {
        label: "Remove from IOC Watchlist",
        category: "enrichment",
        requiresApproval: false,
        async validate(payload) {
            const ip = extractIP(payload);
            if (!ip && !payload.domain) return { valid: false, errors: ["No IP or domain to remove"] };
            return { valid: true, errors: [] };
        },
        async execute(payload) {
            const ip = extractIP(payload);
            const value = ip || payload.domain;
            const type = ip ? "ip" : "domain";
            const deleted = await IOC.destroy({ where: { type, value } });
            return { success: true, result: { value, deleted: deleted > 0 }, rollbackData: null };
        },
        async rollback() { return { success: true }; }
    },

    // ── ENDPOINT ACTIONS (Velociraptor stubs — ready for V2) ─────────────────

    isolate_host: {
        label: "Isolate Host (Velociraptor)",
        category: "response",
        requiresApproval: true, // Destructive — requires analyst approval
        async validate(payload) {
            if (!payload.hostname && !payload.host_ip) return { valid: false, errors: ["No hostname or host_ip specified"] };
            return { valid: true, errors: [] };
        },
        async execute(payload) {
            // V2: Integrate with Velociraptor API
            const target = payload.hostname || payload.host_ip;
            broadcast({ type: "soar_notification", data: { message: `[STUB] Host isolation requested for ${target}. Velociraptor integration pending.`, severity: "high" } });
            return { success: true, result: { target, isolated: false, stub: true }, rollbackData: { target } };
        },
        async rollback(data) {
            broadcast({ type: "soar_notification", data: { message: `[STUB] Host release requested for ${data?.target}`, severity: "info" } });
            return { success: true };
        }
    },

    release_host: {
        label: "Release Host Isolation",
        category: "response",
        requiresApproval: false,
        async validate(payload) {
            if (!payload.hostname && !payload.host_ip) return { valid: false, errors: ["No hostname or host_ip"] };
            return { valid: true, errors: [] };
        },
        async execute(payload) {
            const target = payload.hostname || payload.host_ip;
            broadcast({ type: "soar_notification", data: { message: `[STUB] Host release for ${target}. Velociraptor integration pending.`, severity: "info" } });
            return { success: true, result: { target, released: false, stub: true }, rollbackData: null };
        },
        async rollback() { return { success: true }; }
    },

    kill_process: {
        label: "Kill Process (Velociraptor)",
        category: "response",
        requiresApproval: true,
        async validate(payload) {
            if (!payload.hostname && !payload.host_ip) return { valid: false, errors: ["No target host specified"] };
            if (!payload.process_name && !payload.process_id) return { valid: false, errors: ["No process_name or process_id specified"] };
            return { valid: true, errors: [] };
        },
        async execute(payload) {
            const target = payload.hostname || payload.host_ip;
            const proc = payload.process_name || payload.process_id;
            broadcast({ type: "soar_notification", data: { message: `[STUB] Kill process "${proc}" on ${target}. Velociraptor integration pending.`, severity: "high" } });
            return { success: true, result: { target, process: proc, killed: false, stub: true }, rollbackData: null };
        },
        async rollback() { return { success: true }; }
    },
};

// ── EXPORTS ──────────────────────────────────────────────────────────────────

/**
 * Get an action plugin by its type key
 */
function getAction(actionType) {
    return ACTIONS[actionType] || null;
}

/**
 * Get all registered action types with metadata (for the frontend dropdown)
 */
function listActions() {
    return Object.entries(ACTIONS).map(([key, plugin]) => ({
        value: key,
        label: plugin.label,
        category: plugin.category,
        requiresApproval: plugin.requiresApproval || false
    }));
}

module.exports = { getAction, listActions, ACTIONS };
