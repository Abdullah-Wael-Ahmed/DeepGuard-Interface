/**
 * DeepGuard SOAR — Pre-Built Playbook Templates
 *
 * These are the 8 playbooks defined in the spec. Each returns a JSON structure
 * compatible with the Playbook model (nodes + edges for ReactFlow + engine).
 *
 * Call seedPlaybooks() to insert all templates into the database.
 */

const Playbook = require("../../models/Playbook");

// ── Helper: Generate a node ID ──────────────────────────────────────────────
let _nodeCounter = 0;
const nid = (prefix) => `${prefix}_${++_nodeCounter}`;
const resetCounter = () => { _nodeCounter = 0; };

// ── Helper: Build standard node structure ───────────────────────────────────
const trigger = (id, y, label, triggerType) => ({
    id, type: "triggerNode",
    position: { x: 300, y },
    data: { label, triggerType }
});

const action = (id, y, actionType) => ({
    id, type: "actionNode",
    position: { x: 300, y },
    data: { actionType }
});

const condition = (id, y, field, operator, value) => ({
    id, type: "conditionNode",
    position: { x: 300, y },
    data: { conditionField: field, conditionOperator: operator, conditionValue: value }
});

const edge = (source, target, handle = null) => ({
    id: `e-${source}-${target}`,
    source, target,
    sourceHandle: handle,
    animated: true,
    style: { stroke: "#a855f7", strokeWidth: 2 }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYBOOK DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const PLAYBOOK_TEMPLATES = [
    // ── 1. Malicious IP Auto Block ───────────────────────────────────────────
    {
        name: "Malicious IP Auto Block",
        description: "Automatically blocks IPs with high threat intel scores. Enriches the source IP, checks if it exceeds the malicious threshold, blocks it, creates an incident, and notifies the dashboard.",
        triggerType: "on_alert",
        triggerConditions: { minSeverity: 2 },
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "High Severity Alert", "on_alert"),
                action("a1", 180, "enrich_ip"),
                condition("c1", 330, "threat_score", ">=", "50"),
                action("a2", 500, "block_ip"),
                action("a3", 650, "create_incident"),
                action("a4", 800, "tag_mitre"),
                action("a5", 950, "notify_dashboard"),
            ];
            const edges = [
                edge("t1", "a1"),
                edge("a1", "c1"),
                edge("c1", "a2", "true"),
                edge("c1", "a5", "false"), // Just notify if below threshold
                edge("a2", "a3"),
                edge("a3", "a4"),
                edge("a4", "a5"),
            ];
            return { nodes, edges };
        }
    },

    // ── 2. Brute Force Detection Response ────────────────────────────────────
    {
        name: "Brute Force Detection Response",
        description: "Responds to brute force attacks detected by the correlation engine. Enriches the attacker IP, checks geo reputation, blocks the source, creates an incident with MITRE tagging (T1110), and alerts the analyst.",
        triggerType: "on_incident_created",
        triggerConditions: { category: "brute_force" },
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Brute Force Incident", "on_incident_created"),
                action("a1", 180, "enrich_ip"),
                condition("c1", 330, "reputation", "==", "malicious"),
                action("a2", 500, "block_ip"),
                action("a3", 650, "add_watchlist"),
                action("a4", 800, "notify_dashboard"),
            ];
            // Set MITRE technique in node data
            nodes[4].data.mitre_technique_id = "T1110";
            const edges = [
                edge("t1", "a1"),
                edge("a1", "c1"),
                edge("c1", "a2", "true"),
                edge("c1", "a4", "false"),
                edge("a2", "a3"),
                edge("a3", "a4"),
            ];
            return { nodes, edges };
        }
    },

    // ── 3. Port Scan Containment ─────────────────────────────────────────────
    {
        name: "Port Scan Containment",
        description: "Detects port scan activity from Zeek/Correlation and temporarily blocks the scanner IP after threat intel verification.",
        triggerType: "on_incident_created",
        triggerConditions: { category: "port_scan" },
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Port Scan Detected", "on_incident_created"),
                action("a1", 180, "enrich_ip"),
                condition("c1", 330, "threat_score", ">", "30"),
                action("a2", 500, "block_ip"),
                action("a3", 650, "notify_dashboard"),
            ];
            // Set a TTL for temporary block
            nodes[3].data.block_ttl_minutes = 60;
            const edges = [
                edge("t1", "a1"),
                edge("a1", "c1"),
                edge("c1", "a2", "true"),
                edge("c1", "a3", "false"),
                edge("a2", "a3"),
            ];
            return { nodes, edges };
        }
    },

    // ── 4. Malware Callback Detection ────────────────────────────────────────
    {
        name: "Malware Callback Detection",
        description: "Detects suspicious outbound connections (C2 beaconing). Enriches the destination IP/domain, blocks outbound communication, and generates an incident for investigation.",
        triggerType: "on_alert",
        triggerConditions: { minSeverity: 1 },
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Suspicious Outbound Connection", "on_alert"),
                action("a1", 180, "enrich_ip"),
                condition("c1", 330, "reputation", "!=", "clean"),
                action("a2", 500, "block_ip"),
                action("a3", 650, "add_watchlist"),
                action("a4", 800, "create_incident"),
                action("a5", 950, "notify_dashboard"),
            ];
            const edges = [
                edge("t1", "a1"),
                edge("a1", "c1"),
                edge("c1", "a2", "true"),
                edge("c1", "a5", "false"),
                edge("a2", "a3"),
                edge("a3", "a4"),
                edge("a4", "a5"),
            ];
            return { nodes, edges };
        }
    },

    // ── 5. Anomaly Detection Response ────────────────────────────────────────
    {
        name: "Anomaly Detection Response",
        description: "Responds to AI model anomaly scores exceeding thresholds. Correlates with Suricata/Zeek data, creates an incident, and optionally auto-blocks if confidence is high.",
        triggerType: "on_incident_created",
        triggerConditions: null,
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Anomaly Detected", "on_incident_created"),
                action("a1", 180, "enrich_ip"),
                condition("c1", 330, "severity", "==", "critical"),
                action("a2", 500, "block_ip"),
                action("a3", 650, "notify_dashboard"),
            ];
            const edges = [
                edge("t1", "a1"),
                edge("a1", "c1"),
                edge("c1", "a2", "true"),
                edge("c1", "a3", "false"),
                edge("a2", "a3"),
            ];
            return { nodes, edges };
        }
    },

    // ── 6. Threat Intel IOC Match ────────────────────────────────────────────
    {
        name: "Threat Intel IOC Match",
        description: "When an IOC hit is detected, enriches the indicator, searches internal history, blocks the indicator, and creates an investigation case.",
        triggerType: "on_alert",
        triggerConditions: null,
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "IOC Match Detected", "on_alert"),
                action("a1", 180, "enrich_ip"),
                action("a2", 330, "add_watchlist"),
                action("a3", 480, "block_ip"),
                action("a4", 630, "create_incident"),
                action("a5", 780, "notify_dashboard"),
            ];
            const edges = [
                edge("t1", "a1"),
                edge("a1", "a2"),
                edge("a2", "a3"),
                edge("a3", "a4"),
                edge("a4", "a5"),
            ];
            return { nodes, edges };
        }
    },

    // ── 7. Endpoint Compromise Response (Velociraptor V2) ────────────────────
    {
        name: "Endpoint Compromise Response",
        description: "Responds to critical endpoint alerts. Isolates the host, kills malicious processes, creates an incident with full evidence. Requires Velociraptor integration (V2).",
        triggerType: "on_incident_created",
        triggerConditions: { severity: "critical" },
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Critical Endpoint Alert", "on_incident_created"),
                action("a1", 180, "isolate_host"),
                action("a2", 330, "kill_process"),
                action("a3", 480, "create_incident"),
                action("a4", 630, "notify_dashboard"),
            ];
            const edges = [
                edge("t1", "a1"),
                edge("a1", "a2"),
                edge("a2", "a3"),
                edge("a3", "a4"),
            ];
            return { nodes, edges };
        }
    },

    // ── 8. Data Exfiltration Detection ───────────────────────────────────────
    {
        name: "Data Exfiltration Detection",
        description: "Detects unusual outbound data volume. Correlates with destination reputation, blocks the transfer, and escalates to a P1 incident.",
        triggerType: "on_alert",
        triggerConditions: null,
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Unusual Outbound Volume", "on_alert"),
                action("a1", 180, "enrich_ip"),
                condition("c1", 330, "reputation", "!=", "clean"),
                action("a2", 500, "block_ip"),
                action("a3", 650, "create_incident"),
                action("a4", 800, "tag_mitre"),
                action("a5", 950, "notify_dashboard"),
            ];
            // Tag as T1041 - Exfiltration Over C2 Channel
            nodes[5].data.mitre_technique_id = "T1041";
            const edges = [
                edge("t1", "a1"),
                edge("a1", "c1"),
                edge("c1", "a2", "true"),
                edge("c1", "a5", "false"),
                edge("a2", "a3"),
                edge("a3", "a4"),
                edge("a4", "a5"),
            ];
            return { nodes, edges };
        }
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SEED FUNCTION — Inserts all templates into the DB (skips duplicates)
// ═══════════════════════════════════════════════════════════════════════════════

async function seedPlaybooks() {
    let created = 0;
    for (const template of PLAYBOOK_TEMPLATES) {
        const exists = await Playbook.findOne({ where: { name: template.name } });
        if (exists) continue;

        const { nodes, edges } = template.build();
        await Playbook.create({
            name: template.name,
            description: template.description,
            status: "draft", // Created as draft — analyst activates them
            triggerType: template.triggerType,
            triggerConditions: template.triggerConditions,
            nodes,
            edges,
            author: "DeepGuard SOAR"
        });
        created++;
    }
    return { total: PLAYBOOK_TEMPLATES.length, created, skipped: PLAYBOOK_TEMPLATES.length - created };
}

module.exports = { seedPlaybooks, PLAYBOOK_TEMPLATES };
