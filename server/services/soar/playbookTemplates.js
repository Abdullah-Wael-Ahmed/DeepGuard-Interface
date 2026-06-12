/**
 * DeepGuard SOAR — Pre-Built Playbook Templates
 *
 * These are the 5 playbooks defined in the specs.
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

const edge = (source, target, handle = null) => ({
    id: `e-${source}-${target}`,
    source, target,
    sourceHandle: handle,
    animated: true,
    style: { stroke: "#a855f7", strokeWidth: 2 }
});

const PLAYBOOK_TEMPLATES = [
    // ── 1. Phishing response ────────────────────────────────────────────────
    {
        name: "Phishing response",
        description: "Phishing response: T1566 -> disable user -> block domain -> forensic snapshot -> ticket -> notify",
        triggerType: "on_incident_created",
        triggerConditions: { category: "phishing" },
        mitreTags: ["T1566"],
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Phishing Incident (T1566)", "on_incident_created"),
                action("a1", 180, "disable_user_account"),
                action("a2", 330, "block_ip"), // or block domain if implemented
                action("a3", 480, "collect_forensic_snapshot"),
                action("a4", 630, "create_jira_ticket"),
                action("a5", 780, "notify_dashboard"),
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a3"), edge("a3", "a4"), edge("a4", "a5")
            ];
            return { nodes, edges };
        }
    },
    // ── 2. Ransomware containment ───────────────────────────────────────────
    {
        name: "Ransomware containment",
        description: "Ransomware containment: T1486 or T1490 -> isolate host -> forensic snapshot -> ticket -> notify",
        triggerType: "on_incident_created",
        triggerConditions: { category: "ransomware" },
        mitreTags: ["T1486", "T1490"],
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Ransomware Detected (T1486/T1490)", "on_incident_created"),
                action("a1", 180, "isolate_host"),
                action("a2", 330, "collect_forensic_snapshot"),
                action("a3", 480, "create_jira_ticket"),
                action("a4", 630, "notify_dashboard"),
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a3"), edge("a3", "a4")
            ];
            return { nodes, edges };
        }
    },
    // ── 3. Brute-force lockout ──────────────────────────────────────────────
    {
        name: "Brute-force lockout",
        description: "Brute-force lockout: T1110 -> disable user -> block IP -> notify",
        triggerType: "on_incident_created",
        triggerConditions: { category: "brute_force" },
        mitreTags: ["T1110"],
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Brute Force Detected (T1110)", "on_incident_created"),
                action("a1", 180, "disable_user_account"),
                action("a2", 330, "block_ip"),
                action("a3", 480, "notify_dashboard"),
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a3")
            ];
            return { nodes, edges };
        }
    },
    // ── 4. Lateral movement detection ───────────────────────────────────────
    {
        name: "Lateral movement detection",
        description: "Lateral movement detection: T1021 or T1570 -> query ELK -> ticket -> notify",
        triggerType: "on_incident_created",
        triggerConditions: { category: "lateral_movement" },
        mitreTags: ["T1021", "T1570"],
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Lateral Movement (T1021/T1570)", "on_incident_created"),
                action("a1", 180, "query_elk"),
                action("a2", 330, "create_jira_ticket"),
                action("a3", 480, "notify_dashboard"),
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a3")
            ];
            return { nodes, edges };
        }
    },
    // ── 5. Data exfiltration alert ──────────────────────────────────────────
    {
        name: "Data exfiltration alert",
        description: "Data exfiltration alert: T1041 or T1048 -> forensic snapshot -> block IP -> ticket -> notify",
        triggerType: "on_alert",
        triggerConditions: { minSeverity: 1 },
        mitreTags: ["T1041", "T1048"],
        build() {
            resetCounter();
            const nodes = [
                trigger("t1", 50, "Exfiltration Alert (T1041/T1048)", "on_alert"),
                action("a1", 180, "collect_forensic_snapshot"),
                action("a2", 330, "block_ip"),
                action("a3", 480, "create_jira_ticket"),
                action("a4", 630, "notify_dashboard"),
            ];
            const edges = [
                edge("t1", "a1"), edge("a1", "a2"), edge("a2", "a3"), edge("a3", "a4")
            ];
            return { nodes, edges };
        }
    }
];

async function seedPlaybooks() {
    let created = 0;
    for (const template of PLAYBOOK_TEMPLATES) {
        const exists = await Playbook.findOne({ where: { name: template.name } });
        if (exists) continue;

        const { nodes, edges } = template.build();
        await Playbook.create({
            name: template.name,
            description: template.description,
            status: "draft",
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
