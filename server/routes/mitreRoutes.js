const express = require('express');
const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// MITRE ATT&CK Knowledge Base (Static Reference Data)
// In production this would be pulled from the MITRE ATT&CK STIX/TAXII feed
// ─────────────────────────────────────────────────────────────────────────────

const MITRE_TACTICS = [
    { id: 'TA0001', name: 'Initial Access', shortName: 'Initial Access' },
    { id: 'TA0002', name: 'Execution', shortName: 'Execution' },
    { id: 'TA0003', name: 'Persistence', shortName: 'Persistence' },
    { id: 'TA0004', name: 'Privilege Escalation', shortName: 'Priv Esc' },
    { id: 'TA0005', name: 'Defense Evasion', shortName: 'Defense Evasion' },
    { id: 'TA0006', name: 'Credential Access', shortName: 'Credential Access' },
    { id: 'TA0007', name: 'Discovery', shortName: 'Discovery' },
    { id: 'TA0008', name: 'Lateral Movement', shortName: 'Lateral Movement' },
    { id: 'TA0009', name: 'Collection', shortName: 'Collection' },
    { id: 'TA0011', name: 'Command and Control', shortName: 'C2' },
    { id: 'TA0010', name: 'Exfiltration', shortName: 'Exfiltration' },
    { id: 'TA0040', name: 'Impact', shortName: 'Impact' },
];

const MITRE_TECHNIQUES = {
    'TA0001': [
        { id: 'T1190', name: 'Exploit Public-Facing Application' },
        { id: 'T1133', name: 'External Remote Services' },
        { id: 'T1566', name: 'Phishing' },
    ],
    'TA0002': [
        { id: 'T1059', name: 'Command and Scripting Interpreter' },
        { id: 'T1203', name: 'Exploitation for Client Execution' },
        { id: 'T1047', name: 'Windows Management Instrumentation' },
    ],
    'TA0003': [
        { id: 'T1098', name: 'Account Manipulation' },
        { id: 'T1136', name: 'Create Account' },
        { id: 'T1053', name: 'Scheduled Task/Job' },
    ],
    'TA0004': [
        { id: 'T1548', name: 'Abuse Elevation Control Mechanism' },
        { id: 'T1134', name: 'Access Token Manipulation' },
        { id: 'T1068', name: 'Exploitation for Privilege Escalation' },
    ],
    'TA0005': [
        { id: 'T1070', name: 'Indicator Removal' },
        { id: 'T1027', name: 'Obfuscated Files or Information' },
        { id: 'T1562', name: 'Impair Defenses' },
    ],
    'TA0006': [
        { id: 'T1110', name: 'Brute Force' },
        { id: 'T1003', name: 'OS Credential Dumping' },
        { id: 'T1555', name: 'Credentials from Password Stores' },
    ],
    'TA0007': [
        { id: 'T1046', name: 'Network Service Discovery' },
        { id: 'T1087', name: 'Account Discovery' },
        { id: 'T1082', name: 'System Information Discovery' },
        { id: 'T1049', name: 'System Network Connections Discovery' },
    ],
    'TA0008': [
        { id: 'T1021', name: 'Remote Services' },
        { id: 'T1080', name: 'Taint Shared Content' },
        { id: 'T1550', name: 'Use Alternate Authentication Material' },
    ],
    'TA0009': [
        { id: 'T1560', name: 'Archive Collected Data' },
        { id: 'T1005', name: 'Data from Local System' },
        { id: 'T1114', name: 'Email Collection' },
    ],
    'TA0011': [
        { id: 'T1071', name: 'Application Layer Protocol' },
        { id: 'T1573', name: 'Encrypted Channel' },
        { id: 'T1105', name: 'Ingress Tool Transfer' },
    ],
    'TA0010': [
        { id: 'T1041', name: 'Exfiltration Over C2 Channel' },
        { id: 'T1048', name: 'Exfiltration Over Alternative Protocol' },
    ],
    'TA0040': [
        { id: 'T1498', name: 'Network Denial of Service' },
        { id: 'T1496', name: 'Resource Hijacking' },
        { id: 'T1489', name: 'Service Stop' },
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Simulated Active Detections (would come from Elasticsearch in production)
// Each detection maps an alert from Suricata/Zeek/AI to a MITRE technique
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVE_DETECTIONS = [
    // Discovery
    { alert_id: 'DG-ATTCK-2031', technique_id: 'T1046', tactic_id: 'TA0007', source: 'Suricata', severity: 'Critical', confidence: 0.93, ai_inferred: false, src_ip: '104.152.52.11', dest_ip: '192.168.50.22', timestamp: new Date(Date.now() - 12 * 60000).toISOString(), signature: 'ET SCAN Potential VNC Scan 5900-5920', dest_ports: [22, 80, 443, 3389, 5900], packet_count: 482, protocol: 'TCP' },
    { alert_id: 'DG-ATTCK-2032', technique_id: 'T1087', tactic_id: 'TA0007', source: 'Zeek', severity: 'Medium', confidence: 0.76, ai_inferred: false, src_ip: '10.0.0.55', dest_ip: '10.0.0.1', timestamp: new Date(Date.now() - 45 * 60000).toISOString(), signature: 'Zeek: LDAP enumeration detected', dest_ports: [389], packet_count: 24, protocol: 'TCP' },
    { alert_id: 'DG-ATTCK-2033', technique_id: 'T1082', tactic_id: 'TA0007', source: 'AI Behavioral', severity: 'Low', confidence: 0.68, ai_inferred: true, src_ip: '10.0.0.105', dest_ip: '10.0.0.1', timestamp: new Date(Date.now() - 120 * 60000).toISOString(), signature: 'AI: Unusual system info queries from internal host', dest_ports: [135, 445], packet_count: 15, protocol: 'TCP' },
    // Credential Access
    { alert_id: 'DG-ATTCK-2034', technique_id: 'T1110', tactic_id: 'TA0006', source: 'Suricata', severity: 'High', confidence: 0.98, ai_inferred: false, src_ip: '185.220.101.34', dest_ip: '192.168.1.10', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), signature: 'ET SCAN SSH Brute Force Attempt', dest_ports: [22], packet_count: 1200, protocol: 'TCP' },
    // Execution
    { alert_id: 'DG-ATTCK-2035', technique_id: 'T1059', tactic_id: 'TA0002', source: 'AI Behavioral', severity: 'High', confidence: 0.88, ai_inferred: true, src_ip: '10.0.0.42', dest_ip: '10.0.0.1', timestamp: new Date(Date.now() - 30 * 60000).toISOString(), signature: 'AI: Anomalous PowerShell execution pattern', dest_ports: [5985], packet_count: 8, protocol: 'TCP' },
    // Lateral Movement
    { alert_id: 'DG-ATTCK-2036', technique_id: 'T1021', tactic_id: 'TA0008', source: 'Correlated', severity: 'Critical', confidence: 0.91, ai_inferred: false, src_ip: '10.0.0.42', dest_ip: '10.0.0.200', timestamp: new Date(Date.now() - 8 * 60000).toISOString(), signature: 'Correlated: Internal RDP+SMB lateral pivot', dest_ports: [3389, 445], packet_count: 340, protocol: 'TCP' },
    // C2
    { alert_id: 'DG-ATTCK-2037', technique_id: 'T1071', tactic_id: 'TA0011', source: 'AI Behavioral', severity: 'Medium', confidence: 0.72, ai_inferred: true, src_ip: '10.0.0.88', dest_ip: '23.94.12.55', timestamp: new Date(Date.now() - 90 * 60000).toISOString(), signature: 'AI: Periodic DNS beaconing to low-reputation domain', dest_ports: [53, 443], packet_count: 200, protocol: 'UDP' },
    // Impact
    { alert_id: 'DG-ATTCK-2038', technique_id: 'T1498', tactic_id: 'TA0040', source: 'Suricata', severity: 'Critical', confidence: 0.95, ai_inferred: false, src_ip: '45.155.205.233', dest_ip: '192.168.50.1', timestamp: new Date(Date.now() - 2 * 60000).toISOString(), signature: 'ET DOS Possible NTP DDoS Amplification', dest_ports: [123], packet_count: 15000, protocol: 'UDP' },
    // Initial Access
    { alert_id: 'DG-ATTCK-2039', technique_id: 'T1190', tactic_id: 'TA0001', source: 'Suricata', severity: 'High', confidence: 0.85, ai_inferred: false, src_ip: '91.240.118.172', dest_ip: '192.168.50.80', timestamp: new Date(Date.now() - 60 * 60000).toISOString(), signature: 'ET WEB_SERVER SQL Injection Attempt', dest_ports: [80, 443], packet_count: 12, protocol: 'TCP' },
    // Defense Evasion
    { alert_id: 'DG-ATTCK-2040', technique_id: 'T1562', tactic_id: 'TA0005', source: 'AI Behavioral', severity: 'Medium', confidence: 0.79, ai_inferred: true, src_ip: '10.0.0.42', dest_ip: '10.0.0.1', timestamp: new Date(Date.now() - 15 * 60000).toISOString(), signature: 'AI: Firewall rule modification anomaly detected', dest_ports: [], packet_count: 3, protocol: 'TCP' },
    // Persistence
    { alert_id: 'DG-ATTCK-2041', technique_id: 'T1098', tactic_id: 'TA0003', source: 'Correlated', severity: 'High', confidence: 0.84, ai_inferred: false, src_ip: '10.0.0.42', dest_ip: '10.0.0.1', timestamp: new Date(Date.now() - 22 * 60000).toISOString(), signature: 'Correlated: Service account added after brute force', dest_ports: [445], packet_count: 5, protocol: 'TCP' },
    // Exfiltration
    { alert_id: 'DG-ATTCK-2042', technique_id: 'T1041', tactic_id: 'TA0010', source: 'Zeek', severity: 'High', confidence: 0.81, ai_inferred: false, src_ip: '10.0.0.200', dest_ip: '23.94.12.55', timestamp: new Date(Date.now() - 18 * 60000).toISOString(), signature: 'Zeek: Large outbound data transfer to flagged C2', dest_ports: [443], packet_count: 890, protocol: 'TCP' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CHATBOT — Response database for common queries
// In production: RAG pipeline with LLM + Elasticsearch + ChromaDB
// ─────────────────────────────────────────────────────────────────────────────

const CHATBOT_RESPONSES = {
    't1046': {
        analysis: "**T1046 — Network Service Discovery** was triggered because Suricata detected host `104.152.52.11` performing a high-velocity TCP SYN sweep across ports 22, 80, 443, 3389, and 5900 on internal target `192.168.50.22`. 482 packets were observed within a 2-minute window. GreyNoise classification: **Malicious**. The Isolation Forest model confirmed extreme deviance from baseline with a score of 0.93.",
        mapped_tactic: 'Discovery',
        confidence: 0.93,
        severity: 'Critical',
        recommended_action: [
            { type: 'firewall_rule', action: 'block_ip', target: '104.152.52.11', description: 'iptables -A INPUT -s 104.152.52.11 -j DROP' },
            { type: 'ids_rule', action: 'threshold', target: 'T1046', description: 'Lower Suricata SYN scan threshold to 50 packets/min' },
            { type: 'investigation', action: 'enrich', target: '104.152.52.11', description: 'Run full threat intel lookup on AbuseIPDB + GreyNoise' },
        ]
    },
    't1110': {
        analysis: "**T1110 — Brute Force** was triggered by Suricata detecting 1,200 SSH authentication attempts from `185.220.101.34` targeting `192.168.1.10:22` over a short period. This IP is a known Tor exit node. Confidence is 0.98 (signature-based). Immediate blocking is recommended.",
        mapped_tactic: 'Credential Access',
        confidence: 0.98,
        severity: 'High',
        recommended_action: [
            { type: 'firewall_rule', action: 'block_ip', target: '185.220.101.34', description: 'iptables -A INPUT -s 185.220.101.34 -j DROP' },
            { type: 'hardening', action: 'config', target: 'SSH', description: 'Enable fail2ban with maxretry=3, bantime=3600' },
        ]
    },
    'lateral': {
        analysis: "DeepGuard detected **lateral movement** activity (T1021 — Remote Services). Internal host `10.0.0.42` initiated RDP and SMB connections to `10.0.0.200` shortly after suspicious PowerShell execution was flagged. This matches a multi-stage attack pattern: initial compromise → execution → lateral pivot. Correlated confidence: 0.91.",
        mapped_tactic: 'Lateral Movement',
        confidence: 0.91,
        severity: 'Critical',
        recommended_action: [
            { type: 'investigation', action: 'isolate', target: '10.0.0.42', description: 'Isolate host 10.0.0.42 from the network segment' },
            { type: 'investigation', action: 'forensics', target: '10.0.0.42', description: 'Collect memory dump and event logs from compromised host' },
            { type: 'firewall_rule', action: 'block_ip', target: '10.0.0.42', description: 'iptables -A FORWARD -s 10.0.0.42 -j DROP (block inter-VLAN traffic)' },
        ]
    },
    'false_positive': {
        analysis: "To assess whether an alert is a **false positive**, DeepGuard considers: (1) Threat intel reputation of the source IP, (2) AI anomaly confidence score, (3) Packet volume & rate, (4) Whether the traffic pattern matches legitimate business use. Based on correlation engine data, alerts with confidence > 0.85 and matching threat intel are statistically unlikely to be false positives (< 3% FP rate in testing).",
        mapped_tactic: 'General',
        confidence: 0.85,
        severity: 'Info',
        recommended_action: [
            { type: 'investigation', action: 'review', target: 'alert', description: 'Review packet capture and compare with baseline traffic' },
            { type: 'action', action: 'whitelist', target: 'IP', description: 'If confirmed FP, add source to whitelist and retrain anomaly model' },
        ]
    },
    'credential': {
        analysis: "For **Credential Access** (TA0006) mitigations, DeepGuard recommends: enforce MFA on all external-facing services, implement account lockout policies after 5 failed attempts, deploy honeypot credentials to detect dumping attempts, and enable Zeek SMB/Kerberos logging for early detection of pass-the-hash attacks.",
        mapped_tactic: 'Credential Access',
        confidence: 0.90,
        severity: 'High',
        recommended_action: [
            { type: 'hardening', action: 'config', target: 'MFA', description: 'Enable multi-factor authentication on VPN and SSH gateways' },
            { type: 'ids_rule', action: 'deploy', target: 'Zeek', description: 'Enable Zeek kerberos and ntlm analyzers for credential theft detection' },
            { type: 'hardening', action: 'policy', target: 'Lockout', description: 'Set account lockout: 5 attempts / 15-min window / 30-min lockout' },
        ]
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /mitre/attack-mapping — Full matrix with detections overlay
// ─────────────────────────────────────────────────────────────────────────────

router.get('/attack-mapping', async (req, res) => {
    try {
        const timeWindow = req.query.window || '24h';

        // Build matrix: each tactic with its techniques and active detection state
        const matrix = MITRE_TACTICS.map(tactic => {
            const techniques = (MITRE_TECHNIQUES[tactic.id] || []).map(tech => {
                const detection = ACTIVE_DETECTIONS.find(d => d.technique_id === tech.id && d.tactic_id === tactic.id);
                return {
                    ...tech,
                    detected: !!detection,
                    source: detection?.source || null,
                    severity: detection?.severity || null,
                    confidence: detection?.confidence || 0,
                    ai_inferred: detection?.ai_inferred || false,
                    alert_id: detection?.alert_id || null,
                };
            });
            return { ...tactic, techniques };
        });

        // Compute stats
        const detectedTechniques = ACTIVE_DETECTIONS.length;
        const tacticsObserved = new Set(ACTIVE_DETECTIONS.map(d => d.tactic_id)).size;
        const aiBehavioralFlags = ACTIVE_DETECTIONS.filter(d => d.ai_inferred).length;
        const highSeverity = ACTIVE_DETECTIONS.filter(d => d.severity === 'Critical' || d.severity === 'High').length;
        const totalTechniques = Object.values(MITRE_TECHNIQUES).flat().length;

        res.json({
            status: 'success',
            timeWindow,
            stats: {
                active_techniques: detectedTechniques,
                tactics_observed: tacticsObserved,
                ai_behavioral_flags: aiBehavioralFlags,
                high_severity: highSeverity,
            },
            coverage: {
                detected: detectedTechniques,
                total: totalTechniques,
                score: Math.round((detectedTechniques / totalTechniques) * 100),
            },
            matrix,
        });
    } catch (error) {
        console.error('Error fetching MITRE mapping:', error);
        res.status(500).json({ error: 'Failed to fetch matrix telemetry' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /mitre/attack-mapping/:technique — Drill-down into a specific technique
// ─────────────────────────────────────────────────────────────────────────────

router.get('/attack-mapping/:technique', async (req, res) => {
    try {
        const techniqueId = req.params.technique.toUpperCase();
        const alerts = ACTIVE_DETECTIONS.filter(d => d.technique_id === techniqueId);

        if (alerts.length === 0) {
            return res.json({ technique_id: techniqueId, alerts: [], message: 'No active detections for this technique.' });
        }

        res.json({
            technique_id: techniqueId,
            technique_name: alerts[0]?.signature || techniqueId,
            alert_count: alerts.length,
            alerts: alerts.map(a => ({
                alert_id: a.alert_id,
                timestamp: a.timestamp,
                source: a.source,
                severity: a.severity,
                confidence: a.confidence,
                ai_inferred: a.ai_inferred,
                src_ip: a.src_ip,
                dest_ip: a.dest_ip,
                dest_ports: a.dest_ports,
                packet_count: a.packet_count,
                protocol: a.protocol,
                signature: a.signature,
            })),
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch technique details' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /mitre/alerts/:id — Single alert detail
// ─────────────────────────────────────────────────────────────────────────────

router.get('/alerts/:id', async (req, res) => {
    try {
        const alert = ACTIVE_DETECTIONS.find(d => d.alert_id === req.params.id);
        if (!alert) return res.status(404).json({ error: 'Alert not found' });
        res.json(alert);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch alert' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /mitre/recent-alerts — Latest detections stream
// ─────────────────────────────────────────────────────────────────────────────

router.get('/recent-alerts', async (req, res) => {
    try {
        const sorted = [...ACTIVE_DETECTIONS].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(sorted.slice(0, 10));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch recent alerts' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /mitre/chatbot/query — Security Copilot RAG endpoint
// ─────────────────────────────────────────────────────────────────────────────

router.post('/chatbot/query', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const lowerPrompt = prompt.toLowerCase();

        // Match known queries
        let response = null;

        if (lowerPrompt.includes('t1046') || lowerPrompt.includes('port scan') || lowerPrompt.includes('network service discovery')) {
            response = { query: prompt, ...CHATBOT_RESPONSES['t1046'] };
        } else if (lowerPrompt.includes('t1110') || lowerPrompt.includes('brute force') || lowerPrompt.includes('ssh')) {
            response = { query: prompt, ...CHATBOT_RESPONSES['t1110'] };
        } else if (lowerPrompt.includes('lateral') || lowerPrompt.includes('t1021') || lowerPrompt.includes('movement')) {
            response = { query: prompt, ...CHATBOT_RESPONSES['lateral'] };
        } else if (lowerPrompt.includes('false positive') || lowerPrompt.includes('fp')) {
            response = { query: prompt, ...CHATBOT_RESPONSES['false_positive'] };
        } else if (lowerPrompt.includes('credential') || lowerPrompt.includes('t1110') || lowerPrompt.includes('password') || lowerPrompt.includes('mitigation')) {
            response = { query: prompt, ...CHATBOT_RESPONSES['credential'] };
        } else {
            // Fallback: generic overview
            const criticalAlerts = ACTIVE_DETECTIONS.filter(d => d.severity === 'Critical');
            response = {
                query: prompt,
                analysis: `Currently tracking **${ACTIVE_DETECTIONS.length} active MITRE ATT&CK detections** across ${new Set(ACTIVE_DETECTIONS.map(d => d.tactic_id)).size} tactics. There are **${criticalAlerts.length} critical** alerts requiring immediate attention. Top threats: ${criticalAlerts.map(a => a.technique_id).join(', ')}. Ask about specific techniques (e.g., "Explain T1046") or tactics (e.g., "Show lateral movement") for detailed analysis.`,
                mapped_tactic: 'Overview',
                confidence: 1.0,
                severity: 'Info',
                recommended_action: [
                    { type: 'investigation', action: 'review', target: 'dashboard', description: 'Review the MITRE matrix for full coverage analysis' },
                ]
            };
        }

        // Simulate a slight processing delay for realism
        setTimeout(() => {
            res.json(response);
        }, 300);

    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({ error: 'Copilot inference failed' });
    }
});



// Export ACTIVE_DETECTIONS so the AI Copilot can access live MITRE data
router.ACTIVE_DETECTIONS = ACTIVE_DETECTIONS;
router.MITRE_TACTICS = MITRE_TACTICS;
router.MITRE_TECHNIQUES = MITRE_TECHNIQUES;

module.exports = router;
