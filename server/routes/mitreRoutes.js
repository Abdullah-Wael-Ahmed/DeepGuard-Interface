const express = require('express');
const router = express.Router();

// Mock data for the MITRE ATT&CK Matrix and related telemetry
// In a real scenario, this would aggregate data from Elasticsearch (Suricata + Zeek + AI anomalies)
const mockMatrixData = {
    status: 'success',
    coverage_score: 78.4,
    stats: {
        active_techniques: 14,
        tactics_observed: 5,
        ai_behavioral_flags: 3,
        high_severity: 8
    },
    matrix: {
        'Discovery': [
            { id: 'T1046', name: 'Network Service Discovery', source: 'Suricata', severity: 'High', ai_inferred: false, confidence: 0.93 },
            { id: 'T1087', name: 'Account Discovery', source: 'Zeek', severity: 'Medium', ai_inferred: false, confidence: 0.82 }
        ],
        'Execution': [
            { id: 'T1059', name: 'Command and Scripting Interpreter', source: 'AI Behavioral', severity: 'High', ai_inferred: true, confidence: 0.88 }
        ],
        'Credential Access': [
            { id: 'T1110', name: 'Brute Force', source: 'Suricata', severity: 'High', ai_inferred: false, confidence: 0.98 }
        ]
    }
};

// GET /mitre/attack-mapping
router.get('/attack-mapping', async (req, res) => {
    try {
        const timeWindow = req.query.window || '24h';
        // Mocking the aggregate behavior for the UI
        res.json({
            ...mockMatrixData,
            timeWindow
        });
    } catch (error) {
        console.error("Error fetching mitre mapping:", error);
        res.status(500).json({ error: "Failed to fetch matrix telemetry" });
    }
});

// GET /mitre/alerts/:id
router.get('/alerts/:id', async (req, res) => {
    try {
        res.json({
            alert_id: req.params.id,
            timestamp: new Date().toISOString(),
            source_engines: ["Suricata", "Isolation_Forest"],
            mitre_mapping: {
                technique_id: "T1046",
                technique_name: "Network Service Discovery",
                tactic: "Discovery"
            },
            telemetry: {
                src_ip: "104.152.52.11",
                dest_ip: "192.168.50.22",
                protocol: "TCP",
                dest_ports_scanned: [22, 80, 8080, 3389],
                packet_count: 482
            },
            ai_analytics: {
                anomaly_score: 0.91,
                is_inferred: true
            }
        });
    } catch (error) {
         res.status(500).json({ error: "Failed to fetch alert" });
    }
});

// POST /mitre/chatbot/query
router.post('/chatbot/query', async (req, res) => {
    const { prompt, context_alert_id, context_technique } = req.body;
    try {
        // Mock prompt processing via LLM overlay
        // Return a structured analysis payload that the UI knows how to render
        res.json({
            query: prompt,
            analysis: "Based on the heuristic data, this is highly unlikely to be a false positive. The pattern of sweeping TCP SYN packets across standard management and application ports originates from an external node with a malicious GreyNoise classification. The Isolation Forest model confirms extreme deviance from baseline traffic with a confidence of 0.93.",
            mapped_tactic: "Discovery",
            confidence: 0.93,
            recommended_action: [
                {
                    type: "firewall_rule",
                    action: "block_ip",
                    target: "104.152.52.11",
                    description: "Drop ingress traffic from scanning node. Run: iptables -A INPUT -s 104.152.52.11 -j DROP"
                }
            ]
        });
    } catch (error) {
        console.error("Error with AI chatbot inference:", error);
        res.status(500).json({ error: "Copilot inference failed" });
    }
});

module.exports = router;
