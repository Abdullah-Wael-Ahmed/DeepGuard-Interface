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

const User = require("../../models/User");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

async function runVelociraptorFlow(targetId, flowName, envParams = {}) {
    try {
        let envString = "";
        if (Object.keys(envParams).length > 0) {
            envString = " " + Object.entries(envParams).map(([k,v]) => `--env ${k}="${v}"`).join(" ");
        }
        const cmd = `sudo docker exec deepguard-velociraptor sh -c '/opt/velociraptor --config /etc/velociraptor/server.config.yaml config api_client --name admin --role administrator /tmp/api_client.yaml && /opt/velociraptor --config /tmp/api_client.yaml query "SELECT * FROM start_flow(client_id=\"${targetId}\", flow_name=\"${flowName}\"${envString ? ', args=dict(' + Object.entries(envParams).map(([k,v])=> `${k}=\"${v}\"`).join(',') + ')' : ''})" --format json'`;
        
        const { stdout } = await execPromise(cmd);
        return { success: true, result: JSON.parse(stdout) };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function getVelociraptorClientId(hostnameOrIp) {
    const cmd = `sudo docker exec deepguard-velociraptor sh -c '/opt/velociraptor --config /etc/velociraptor/server.config.yaml config api_client --name admin --role administrator /tmp/api_client.yaml && /opt/velociraptor --config /tmp/api_client.yaml query "SELECT client_id, os_info, last_seen_at FROM clients()" --format json'`;
    try {
        const { stdout } = await execPromise(cmd);
        const clients = JSON.parse(stdout);
        const match = clients.find(c => c.os_info?.hostname?.toLowerCase() === hostnameOrIp?.toLowerCase() || (c.last_ip || '').includes(hostnameOrIp));
        return match ? match.client_id : null;
    } catch (e) {
        return null;
    }
}


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
            if (ip === "192.168.192.1" || ip === "127.0.0.1" || ip === "192.168.192.138" || ip.startsWith("172.18.")) return { valid: false, errors: ["Cannot block localhost/host IP"] };
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
        requiresApproval: true,
        async validate(payload) {
            if (!payload.hostname && !payload.host_ip) return { valid: false, errors: ["No hostname or host_ip specified"] };
            return { valid: true, errors: [] };
        },
        async execute(payload) {
            const target = payload.hostname || payload.host_ip;
            const clientId = await getVelociraptorClientId(target);
            if (!clientId) return { success: false, result: { error: `Velociraptor client not found for ${target}` } };
            
            const res = await runVelociraptorFlow(clientId, "Windows.Remediation.Isolate");
            broadcast({ type: "soar_notification", data: { message: `Host isolation triggered on ${target}`, severity: "high" } });
            
            return { success: res.success, result: { target, clientId, isolated: res.success, details: res.result }, rollbackData: { target, clientId } };
        },
        async rollback(data) {
            if (data?.clientId) {
                await runVelociraptorFlow(data.clientId, "Windows.Remediation.Unisolate");
                broadcast({ type: "soar_notification", data: { message: `Host release requested for ${data.target}`, severity: "info" } });
                return { success: true };
            }
            return { success: false };
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
            const clientId = await getVelociraptorClientId(target);
            if (!clientId) return { success: false, result: { error: `Client not found for ${target}` } };
            
            const res = await runVelociraptorFlow(clientId, "Windows.Remediation.Unisolate");
            broadcast({ type: "soar_notification", data: { message: `Host release triggered on ${target}`, severity: "info" } });
            return { success: res.success, result: { target, released: res.success }, rollbackData: null };
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
            const clientId = await getVelociraptorClientId(target);
            if (!clientId) return { success: false, result: { error: `Client not found` } };
            
            // Note: Simplistic kill using arbitrary flow or specific
            const res = await runVelociraptorFlow(clientId, "Windows.System.Taskkill", { ProcessName: proc });
            broadcast({ type: "soar_notification", data: { message: `Kill process ${proc} triggered on ${target}`, severity: "high" } });
            return { success: res.success, result: { target, process: proc, killed: res.success }, rollbackData: null };
        },
        async rollback() { return { success: true }; }
    },

    disable_user_account: {
        label: "Disable User Account",
        category: "response",
        requiresApproval: true,
        async validate(payload) {
            if (!payload.username && !payload.user) return { valid: false, errors: ["No username found in context"] };
            return { valid: true, errors: [] };
        },
        async execute(payload) {
            const username = payload.username || payload.user;
            const user = await User.findOne({ where: { username } });
            if (user) {
                user.status = "disabled";
                await user.save();
                broadcast({ type: "soar_notification", data: { message: `Local user ${username} disabled`, severity: "high" } });
                return { success: true, result: { username, disabled: true }, rollbackData: { username } };
            }
            broadcast({ type: "soar_notification", data: { message: `[STUB] AD User ${username} disabled`, severity: "high" } });
            return { success: true, result: { username, disabled: true, ad_stub: true }, rollbackData: { username } };
        },
        async rollback(data) {
            const user = await User.findOne({ where: { username: data.username } });
            if (user) {
                user.status = "active";
                await user.save();
            }
            broadcast({ type: "soar_notification", data: { message: `User ${data.username} re-enabled`, severity: "info" } });
            return { success: true };
        }
    },

    collect_forensic_snapshot: {
        label: "Collect Forensic Snapshot",
        category: "enrichment",
        requiresApproval: false,
        async validate(payload) {
            if (!payload.hostname && !payload.host_ip) return { valid: false, errors: ["No target host specified"] };
            return { valid: true, errors: [] };
        },
        async execute(payload, context) {
            const target = payload.hostname || payload.host_ip;
            const clientId = await getVelociraptorClientId(target);
            if (!clientId) return { success: false, result: { error: `Client not found for ${target}` } };
            
            const res = await runVelociraptorFlow(clientId, "Windows.KapeFiles.Targets", { KapeTriage: "Y" });
            broadcast({ type: "soar_notification", data: { message: `Forensic snapshot started on ${target}`, severity: "info" } });
            
            if (payload.incidentId && res.success) {
                await Evidence.create({
                    incidentId: payload.incidentId,
                    type: "log",
                    title: "Forensic Snapshot Flow",
                    content: `Flow started: ${JSON.stringify(res.result)}`,
                    addedBy: "SOAR"
                });
            }
            
            return { success: res.success, result: { target, snapshot_flow: res.result }, rollbackData: null };
        },
        async rollback() { return { success: true }; }
    },

    create_jira_ticket: {
        label: "Create Jira/ServiceNow Ticket",
        category: "notification",
        requiresApproval: false,
        async validate(payload) {
            return { valid: true, errors: [] };
        },
        async execute(payload, context) {
            const webhookUrl = payload.ticket_webhook_url || process.env.TICKET_WEBHOOK_URL || "http://localhost:5000/webhook-stub";
            try {
                const res = await axios.post(webhookUrl, {
                    summary: `[SOAR] Incident on ${extractIP(payload) || payload.hostname}`,
                    description: `Playbook: ${context.playbookName}\nSeverity: ${payload.severity}`,
                    priority: payload.severity || "medium"
                }, { timeout: 10000 }).catch(() => ({ data: { key: "STUB-123" } }));
                return { success: true, result: { ticket_id: res.data.key || res.data.id || "STUB-123" }, rollbackData: null };
            } catch (e) {
                return { success: false, result: { error: e.message } };
            }
        },
        async rollback() { return { success: true }; }
    },

    run_nmap_scan: {
        label: "Run Nmap Scan",
        category: "enrichment",
        requiresApproval: false,
        async validate(payload) {
            if (!extractIP(payload)) return { valid: false, errors: ["No IP to scan"] };
            return { valid: true, errors: [] };
        },
        async execute(payload, context) {
            const ip = extractIP(payload);
            try {
                const { stdout } = await execPromise(`nmap -F -T4 ${ip}`);
                if (payload.incidentId) {
                    await Evidence.create({
                        incidentId: payload.incidentId,
                        type: "log",
                        title: "Nmap Scan Results",
                        content: stdout,
                        addedBy: "SOAR"
                    });
                }
                payload.nmap_results = stdout;
                return { success: true, result: { ip, nmap_success: true }, rollbackData: null };
            } catch (e) {
                return { success: false, result: { error: e.message } };
            }
        },
        async rollback() { return { success: true }; }
    },

    query_elk: {
        label: "Query ELK (Correlated Events)",
        category: "enrichment",
        requiresApproval: false,
        async validate(payload) {
            if (!extractIP(payload) && !payload.username) return { valid: false, errors: ["No IP or username to query"] };
            return { valid: true, errors: [] };
        },
        async execute(payload, context) {
            const ip = extractIP(payload);
            const user = payload.username || "";
            try {
                const recentAlerts = await Alert.findAll({
                    where: { src_ip: ip },
                    limit: 5,
                    order: [["timestamp", "DESC"]]
                });
                const summary = recentAlerts.map(a => `[${a.severity}] ${a.signature}`).join("\n");
                if (payload.incidentId) {
                    await Evidence.create({
                        incidentId: payload.incidentId,
                        type: "log",
                        title: "ELK Correlation Results",
                        content: summary || "No recent correlated events found in ELK.",
                        addedBy: "SOAR"
                    });
                }
                payload.elk_results = summary;
                return { success: true, result: { ip, elk_events_found: recentAlerts.length }, rollbackData: null };
            } catch (e) {
                return { success: false, result: { error: e.message } };
            }
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
