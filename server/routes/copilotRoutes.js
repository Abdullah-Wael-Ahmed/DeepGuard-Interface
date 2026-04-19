const express = require('express');
const router = express.Router();
const https = require('https');

// ─────────────────────────────────────────────────────────────────────────────
// DeepGuard AI Copilot — gemini-2.0-flash-lite — updated 2026-04-20T01:05
// POST /copilot/query
// Body: { prompt: string, context?: object }
// ─────────────────────────────────────────────────────────────────────────────

// ── Live alert context (mirrors mitreRoutes.js — in production pull from DB)
const ACTIVE_DETECTIONS = [
    { alert_id: 'DG-ATTCK-2031', technique_id: 'T1046', tactic_id: 'TA0007', source: 'Suricata', severity: 'Critical', confidence: 0.93, ai_inferred: false, src_ip: '104.152.52.11', dest_ip: '192.168.50.22', signature: 'ET SCAN Potential VNC Scan 5900-5920', dest_ports: [22, 80, 443, 3389, 5900], packet_count: 482, protocol: 'TCP' },
    { alert_id: 'DG-ATTCK-2032', technique_id: 'T1087', tactic_id: 'TA0007', source: 'Zeek', severity: 'Medium', confidence: 0.76, ai_inferred: false, src_ip: '10.0.0.55', dest_ip: '10.0.0.1', signature: 'Zeek: LDAP enumeration detected', dest_ports: [389], packet_count: 24, protocol: 'TCP' },
    { alert_id: 'DG-ATTCK-2033', technique_id: 'T1082', tactic_id: 'TA0007', source: 'AI Behavioral', severity: 'Low', confidence: 0.68, ai_inferred: true, src_ip: '10.0.0.105', dest_ip: '10.0.0.1', signature: 'AI: Unusual system info queries from internal host', dest_ports: [135, 445], packet_count: 15, protocol: 'TCP' },
    { alert_id: 'DG-ATTCK-2034', technique_id: 'T1110', tactic_id: 'TA0006', source: 'Suricata', severity: 'High', confidence: 0.98, ai_inferred: false, src_ip: '185.220.101.34', dest_ip: '192.168.1.10', signature: 'ET SCAN SSH Brute Force Attempt', dest_ports: [22], packet_count: 1200, protocol: 'TCP' },
    { alert_id: 'DG-ATTCK-2035', technique_id: 'T1059', tactic_id: 'TA0002', source: 'AI Behavioral', severity: 'High', confidence: 0.88, ai_inferred: true, src_ip: '10.0.0.42', dest_ip: '10.0.0.1', signature: 'AI: Anomalous PowerShell execution pattern', dest_ports: [5985], packet_count: 8, protocol: 'TCP' },
    { alert_id: 'DG-ATTCK-2036', technique_id: 'T1021', tactic_id: 'TA0008', source: 'Correlated', severity: 'Critical', confidence: 0.91, ai_inferred: false, src_ip: '10.0.0.42', dest_ip: '10.0.0.200', signature: 'Correlated: Internal RDP+SMB lateral pivot', dest_ports: [3389, 445], packet_count: 340, protocol: 'TCP' },
    { alert_id: 'DG-ATTCK-2037', technique_id: 'T1071', tactic_id: 'TA0011', source: 'AI Behavioral', severity: 'Medium', confidence: 0.72, ai_inferred: true, src_ip: '10.0.0.88', dest_ip: '23.94.12.55', signature: 'AI: Periodic DNS beaconing to low-reputation domain', dest_ports: [53, 443], packet_count: 200, protocol: 'UDP' },
    { alert_id: 'DG-ATTCK-2038', technique_id: 'T1498', tactic_id: 'TA0040', source: 'Suricata', severity: 'Critical', confidence: 0.95, ai_inferred: false, src_ip: '45.155.205.233', dest_ip: '192.168.50.1', signature: 'ET DOS Possible NTP DDoS Amplification', dest_ports: [123], packet_count: 15000, protocol: 'UDP' },
    { alert_id: 'DG-ATTCK-2039', technique_id: 'T1190', tactic_id: 'TA0001', source: 'Suricata', severity: 'High', confidence: 0.85, ai_inferred: false, src_ip: '91.240.118.172', dest_ip: '192.168.50.80', signature: 'ET WEB_SERVER SQL Injection Attempt', dest_ports: [80, 443], packet_count: 12, protocol: 'TCP' },
    { alert_id: 'DG-ATTCK-2040', technique_id: 'T1562', tactic_id: 'TA0005', source: 'AI Behavioral', severity: 'Medium', confidence: 0.79, ai_inferred: true, src_ip: '10.0.0.42', dest_ip: '10.0.0.1', signature: 'AI: Firewall rule modification anomaly detected', dest_ports: [], packet_count: 3, protocol: 'TCP' },
    { alert_id: 'DG-ATTCK-2041', technique_id: 'T1098', tactic_id: 'TA0003', source: 'Correlated', severity: 'High', confidence: 0.84, ai_inferred: false, src_ip: '10.0.0.42', dest_ip: '10.0.0.1', signature: 'Correlated: Service account added after brute force', dest_ports: [445], packet_count: 5, protocol: 'TCP' },
    { alert_id: 'DG-ATTCK-2042', technique_id: 'T1041', tactic_id: 'TA0010', source: 'Zeek', severity: 'High', confidence: 0.81, ai_inferred: false, src_ip: '10.0.0.200', dest_ip: '23.94.12.55', signature: 'Zeek: Large outbound data transfer to flagged C2', dest_ports: [443], packet_count: 890, protocol: 'TCP' },
];

// ── Build a live context summary to inject into every prompt
function buildLiveContext() {
    const criticalAlerts = ACTIVE_DETECTIONS.filter(d => d.severity === 'Critical');
    const highAlerts = ACTIVE_DETECTIONS.filter(d => d.severity === 'High');
    const tactics = [...new Set(ACTIVE_DETECTIONS.map(d => d.tactic_id))];

    return `
LIVE DEEPGUARD PLATFORM STATE (as of query time):
- Total active detections: ${ACTIVE_DETECTIONS.length}
- Critical alerts: ${criticalAlerts.length} (IPs: ${criticalAlerts.map(a => a.src_ip).join(', ')})
- High severity alerts: ${highAlerts.length}
- Active tactics observed: ${tactics.length} across the MITRE ATT&CK framework
- Recent critical detections:
${criticalAlerts.map(a => `  * [${a.alert_id}] ${a.technique_id} | ${a.signature} | SRC: ${a.src_ip} → ${a.dest_ip} | Confidence: ${(a.confidence * 100).toFixed(0)}%`).join('\n')}
- All active alert IDs: ${ACTIVE_DETECTIONS.map(a => a.alert_id).join(', ')}
`;
}

// ── System prompt for the DeepGuard AI Copilot
const SYSTEM_PROMPT = `You are DeepGuard AI, a cybersecurity assistant integrated inside the DeepGuard SOC platform.

Your role is to act as a Security Operations Center (SOC) analyst assistant that helps users understand alerts, analyze threats, and take actions.

========================
CORE BEHAVIOR
========================

- Be concise, clear, and technical but understandable.
- Always prioritize actionable insights over theory.
- Never give generic answers — always relate to the provided data (alerts, logs, IPs).
- If no data is provided, give general cybersecurity guidance.
- Use markdown formatting for readability (bold for emphasis, bullet points for lists).

========================
CAPABILITIES
========================

You can:
1. Explain security alerts
2. Analyze suspicious IPs and traffic behavior
3. Recommend mitigation actions
4. Explain anomaly detection results
5. Map alerts to MITRE ATT&CK techniques
6. Answer cybersecurity questions
7. Assist with firewall and response decisions

========================
ALERT EXPLANATION FORMAT
========================

When explaining an alert, respond in this structure:

**Summary:**
What happened in simple terms

**Technical Details:**
What triggered the alert (rule, behavior, etc.)

**Risk Level:**
Low / Medium / High / Critical with justification

**Possible Attack Type:**
e.g. Port Scan, Brute Force, DDoS, Exploit attempt

**MITRE ATT&CK Mapping:**
- Technique Name — Technique ID (e.g., T1046)
- Tactic: e.g., Discovery

**Recommended Actions:**
- Clear steps (block IP, monitor, investigate logs, etc.)

========================
ANOMALY ANALYSIS FORMAT
========================

When analyzing anomalies:
- Explain what "normal behavior" is
- Explain what deviation occurred
- Explain why it might indicate a threat
- Suggest next steps

========================
RESPONSE ACTION GUIDANCE
========================

When recommending actions:
- Be practical and safe
- Prefer: Block IP (if malicious), Monitor (if suspicious), Ignore (if false positive)
- Never assume full automation unless confirmed

========================
TONE
========================

- Professional SOC analyst tone
- No emojis
- No unnecessary explanations
- Focus on helping the user take decisions quickly

========================
LIMITATIONS
========================

- If data is missing, say "Insufficient data for precise analysis"
- Do NOT hallucinate logs or facts
- Do NOT give offensive hacking instructions
- If asked something outside cybersecurity, politely redirect to your SOC role

========================
GOAL
========================

Help the user understand threats, reduce analysis time, and support decision-making inside DeepGuard.`;

// ── Call Gemini API via raw HTTPS (no SDK dependency needed)
function callGemini(systemPrompt, liveContext, userPrompt, pageContext) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return reject(new Error('GEMINI_API_KEY not configured'));
        }

        const fullUserMessage = [
            liveContext,
            pageContext ? `\nCURRENT PAGE CONTEXT:\n${pageContext}` : '',
            `\nUSER QUERY: ${userPrompt}`
        ].filter(Boolean).join('\n');

        const payload = JSON.stringify({
            system_instruction: {
                parts: [{ text: systemPrompt }]
            },
            contents: [
                {
                    role: 'user',
                    parts: [{ text: fullUserMessage }]
                }
            ],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024,
                topP: 0.8,
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            ]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        const errMsg = parsed.error.message || 'Gemini API error';
                        // Extract "retry in X seconds" from the error message if present
                        const retryMatch = errMsg.match(/Please retry in ([\d.]+)s/);
                        const retryAfter = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
                        const err = new Error(errMsg);
                        err.retryAfter = retryAfter;
                        err.isRateLimit = parsed.error.code === 429 || errMsg.toLowerCase().includes('quota');
                        return reject(err);
                    }
                    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!text) {
                        return reject(new Error('No content in Gemini response'));
                    }
                    resolve(text);
                } catch (e) {
                    reject(new Error('Failed to parse Gemini response: ' + e.message));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Gemini request timed out'));
        });
        req.write(payload);
        req.end();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /copilot/query — Main AI copilot endpoint
// Body: { prompt: string, pageContext?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/query', async (req, res) => {
    const { prompt, pageContext } = req.body;

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const liveContext = buildLiveContext();
        const aiResponse = await callGemini(SYSTEM_PROMPT, liveContext, prompt.trim(), pageContext || '');

        res.json({
            analysis: aiResponse,
            prompt: prompt.trim(),
            timestamp: new Date().toISOString(),
            model: 'gemini-2.5-flash',
            context_alerts: ACTIVE_DETECTIONS.length,
        });
    } catch (error) {
        console.error('[Copilot] Gemini API error:', error.message);
        const isRateLimit = error.isRateLimit || error.message?.toLowerCase().includes('quota');
        const retryAfter = error.retryAfter || null;
        const status = isRateLimit ? 429 : 503;
        res.status(status).json({
            error: isRateLimit
                ? 'Rate limit reached. The Gemini free tier quota is temporarily exhausted.'
                : 'DeepGuard Copilot inference engine unavailable',
            details: error.message,
            retryAfter,
            isRateLimit,
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /copilot/health — Simple health check for the AI backend
// ─────────────────────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
    res.json({
        status: 'online',
        model: 'gemini-2.5-flash',
        gemini_configured: !!process.env.GEMINI_API_KEY,
        active_detections: ACTIVE_DETECTIONS.length,
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
