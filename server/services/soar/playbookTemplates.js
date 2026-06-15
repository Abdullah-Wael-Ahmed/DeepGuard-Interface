/**
 * DeepGuard SOAR — Pre-Built Playbook Templates (Cybersecurity-First)
 */

const Playbook = require("../../models/Playbook");

// ── Helper: Generate a node ID ──────────────────────────────────────────────
let _nodeCounter = 0;
const nid = (prefix) => `${prefix}_${++_nodeCounter}`;
const resetCounter = () => { _nodeCounter = 0; };

// ── Helpers: Build standard node structures ─────────────────────────────────
const trigger = (id, y, label, triggerType) => ({
    id, type: "triggerNode",
    position: { x: 300, y },
    data: { label, triggerType }
});

const action = (id, y, actionType, xOffset = 300) => ({
    id, type: "actionNode",
    position: { x: xOffset, y },
    data: { actionType }
});

const condition = (id, y, field, operator, value) => ({
    id, type: "conditionNode",
    position: { x: 300, y },
    data: { conditionField: field, conditionOperator: operator, conditionValue: value }
});

const edge = (source, target, handle = null) => ({
    id: `e-${source}-${target}${handle ? '-' + handle : ''}`,
    source, target,
    sourceHandle: handle,
    animated: true,
    style: { stroke: handle === 'true' ? '#22c55e' : handle === 'false' ? '#ef4444' : '#3b82f6', strokeWidth: 2 }
});

const PLAYBOOK_TEMPLATES = [
    // ── 1. Brute Force Lockout ───────────────────────────────────────────────
    {
        name: "Brute Force Lockout",
        description: "T1110: Enrich IP -> check severity -> block IP + disable user -> notify",
        triggerType: "on_alert",
        triggerConditions: { signatureContains: ["Brute Force", "Login Attempt"] },
        mitreTags: ["T1110"],
        defaultStatus: "draft",
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Brute Force Alert (T1110)", "on_alert"),
                action("a1", 180, "enrich_ip"),
                condition("c1", 310, "severity", "==", "critical"),
                action("a2", 480, "block_ip", 150),
                action("a3", 480, "disable_user_account", 450),
                action("a4", 630, "create_incident", 300),
                action("a5", 780, "notify_dashboard", 300)
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "c1"),
                edge("c1", "a2", "true"), edge("c1", "a3", "true"),
                edge("a2", "a4"), edge("a3", "a4"), edge("c1", "a4", "false"),
                edge("a4", "a5")
            ];
            return { nodes, edges };
        }
    },
    // ── 2. Port Scan Response ───────────────────────────────────────────────
    {
        name: "Port Scan Response",
        description: "T1046: Enrich IP -> block IP -> run Nmap scan -> notify",
        triggerType: "on_alert",
        triggerConditions: { signatureContains: ["Scan", "Recon"] },
        mitreTags: ["T1046"],
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Port Scan Detected (T1046)", "on_alert"),
                action("a1", 180, "enrich_ip"),
                action("a2", 330, "block_ip"),
                action("a3", 480, "run_nmap_scan"),
                action("a4", 630, "create_incident"),
                action("a5", 780, "notify_dashboard")
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a3"), edge("a3", "a4"), edge("a4", "a5")
            ];
            return { nodes, edges };
        }
    },
    // ── 3. DDoS Mitigation ──────────────────────────────────────────────────
    {
        name: "DDoS Mitigation",
        description: "T1498/T1499: Enrich IP -> Block IP -> Create P1 Incident -> Notify",
        triggerType: "on_alert",
        triggerConditions: { signatureContains: ["DDoS", "Flood", "Amplification"] },
        mitreTags: ["T1498", "T1499"],
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "DDoS Attack (T1498/T1499)", "on_alert"),
                action("a1", 180, "enrich_ip"),
                action("a2", 330, "block_ip"),
                action("a3", 480, "create_incident"),
                action("a4", 630, "notify_dashboard")
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a3"), edge("a3", "a4")
            ];
            return { nodes, edges };
        }
    },
    // ── 4. C2 Beaconing Containment ──────────────────────────────────────────
    {
        name: "C2 Beaconing Containment",
        description: "T1071/T1568: Enrich IP -> Isolate Host -> Block IP -> Forensic Snapshot -> Notify",
        triggerType: "on_alert",
        triggerConditions: { signatureContains: ["C2", "Command and Control", "Beacon"] },
        mitreTags: ["T1071", "T1568"],
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "C2 Beaconing (T1071/T1568)", "on_alert"),
                action("a1", 180, "enrich_ip"),
                action("a2", 330, "isolate_host", 150),
                action("a3", 330, "block_ip", 450),
                action("a4", 480, "collect_forensic_snapshot", 300),
                action("a5", 630, "create_incident", 300),
                action("a6", 780, "notify_dashboard", 300)
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "a2"), edge("a1", "a3"),
                edge("a2", "a4"), edge("a3", "a4"), edge("a4", "a5"), edge("a5", "a6")
            ];
            return { nodes, edges };
        }
    },
    // ── 5. Data Exfiltration Response ───────────────────────────────────────
    {
        name: "Data Exfiltration Response",
        description: "T1041/T1048: Enrich IP -> Block IP -> Query ELK -> Forensic Snapshot -> Notify",
        triggerType: "on_alert",
        triggerConditions: { signatureContains: ["Exfiltration", "Exfil", "Large Outbound"] },
        mitreTags: ["T1041", "T1048"],
        defaultStatus: "active",
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Exfiltration Alert (T1041/T1048)", "on_alert"),
                action("a1", 180, "enrich_ip"),
                action("a2", 330, "block_ip"),
                action("a3", 480, "query_elk"),
                action("a4", 630, "collect_forensic_snapshot"),
                action("a5", 780, "create_incident"),
                action("a6", 930, "notify_dashboard")
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a3"), edge("a3", "a4"), edge("a4", "a5"), edge("a5", "a6")
            ];
            return { nodes, edges };
        }
    },
    // ── 6. Web Application Attack ───────────────────────────────────────────
    {
        name: "Web Application Attack",
        description: "T1190: Enrich IP -> check severity -> block IP + add to watchlist -> notify",
        triggerType: "on_alert",
        triggerConditions: { signatureContains: ["SQL Injection", "XSS", "LFI", "RFI", "Web", "Directory Traversal"] },
        mitreTags: ["T1190", "T1059"],
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Web Attack Alert (T1190)", "on_alert"),
                action("a1", 180, "enrich_ip"),
                condition("c1", 310, "severity", "==", "critical"),
                action("a2", 480, "block_ip", 150),
                action("a3", 480, "add_to_watchlist", 450),
                action("a4", 630, "create_incident", 300),
                action("a5", 780, "notify_dashboard", 300)
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "c1"),
                edge("c1", "a2", "true"), edge("c1", "a3", "true"),
                edge("a2", "a4"), edge("a3", "a4"), edge("c1", "a4", "false"),
                edge("a4", "a5")
            ];
            return { nodes, edges };
        }
    },
    // ── 7. Lateral Movement Detection ───────────────────────────────────────
    {
        name: "Lateral Movement Detection",
        description: "T1021/T1570: Query ELK -> Run Nmap -> Forensic Snapshot -> Notify",
        triggerType: "on_incident_created",
        triggerConditions: { category: "lateral_movement" },
        mitreTags: ["T1021", "T1570"],
        defaultStatus: "draft",
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Lateral Movement (T1021/T1570)", "on_incident_created"),
                action("a1", 180, "query_elk"),
                action("a2", 330, "run_nmap_scan"),
                action("a3", 480, "collect_forensic_snapshot"),
                action("a4", 630, "create_jira_ticket"),
                action("a5", 780, "notify_dashboard")
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a3"), edge("a3", "a4"), edge("a4", "a5")
            ];
            return { nodes, edges };
        }
    },
    // ── 8. Phishing Response ────────────────────────────────────────────────
    {
        name: "Phishing Response",
        description: "T1566: Disable user -> Enrich IP/Domain -> Block IP -> Ticket -> Notify",
        triggerType: "on_incident_created",
        triggerConditions: { category: "phishing" },
        mitreTags: ["T1566"],
        defaultStatus: "draft",
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Phishing Incident (T1566)", "on_incident_created"),
                action("a1", 180, "disable_user_account"),
                action("a2", 330, "enrich_domain"),
                action("a3", 480, "block_ip"),
                action("a4", 630, "create_jira_ticket"),
                action("a5", 780, "notify_dashboard")
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a3"), edge("a3", "a4"), edge("a4", "a5")
            ];
            return { nodes, edges };
        }
    },
    // ── 9. Ransomware Containment ───────────────────────────────────────────
    {
        name: "Ransomware Containment",
        description: "T1486/T1490: Isolate host -> Forensic Snapshot -> Ticket -> Notify",
        triggerType: "on_incident_created",
        triggerConditions: { category: "ransomware" },
        mitreTags: ["T1486", "T1490"],
        defaultStatus: "draft",
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Ransomware Detected (T1486)", "on_incident_created"),
                action("a1", 180, "isolate_host"),
                action("a2", 330, "collect_forensic_snapshot"),
                action("a3", 480, "create_jira_ticket"),
                action("a4", 630, "notify_dashboard")
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a3"), edge("a3", "a4")
            ];
            return { nodes, edges };
        }
    },
    // ── 10. Credential Theft Response ───────────────────────────────────────
    {
        name: "Credential Theft Response",
        description: "T1003/T1558: Enrich IP -> check severity -> disable user + add to watchlist -> notify",
        triggerType: "on_alert",
        triggerConditions: { signatureContains: ["Kerberos", "NTLM", "Credential", "Pass-the-Hash", "LDAP"] },
        mitreTags: ["T1003", "T1558"],
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Credential Theft Alert", "on_alert"),
                action("a1", 180, "enrich_ip"),
                condition("c1", 310, "severity", "==", "critical"),
                action("a2", 480, "disable_user_account", 150),
                action("a3", 480, "add_to_watchlist", 450),
                action("a4", 630, "create_incident", 300),
                action("a5", 780, "notify_dashboard", 300)
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "c1"),
                edge("c1", "a2", "true"), edge("c1", "a3", "true"),
                edge("a2", "a4"), edge("a3", "a4"), edge("c1", "a4", "false"),
                edge("a4", "a5")
            ];
            return { nodes, edges };
        }
    }
];

async function seedPlaybooks() {
    let created = 0;
    for (const template of PLAYBOOK_TEMPLATES) {
        const exists = await Playbook.findOne({ where: { name: template.name } });
        const { nodes, edges } = template.build();
        
        if (exists) {
            await exists.update({ nodes, edges, status: template.defaultStatus || "active" });
            created++;
            continue;
        }

        await Playbook.create({
            name: template.name,
            description: template.description,
            status: template.defaultStatus || "draft",
            triggerType: template.triggerType,
            triggerConditions: template.triggerConditions,
            mitreTags: template.mitreTags,
            nodes,
            edges,
            author: "DeepGuard SOAR"
        });
        created++;
    }
    return { total: PLAYBOOK_TEMPLATES.length, created, skipped: PLAYBOOK_TEMPLATES.length - created };
}

module.exports = { seedPlaybooks, PLAYBOOK_TEMPLATES };
