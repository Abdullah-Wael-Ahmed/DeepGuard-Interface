const express = require('express');
const router = express.Router();
const https = require('https');

// ── Sequelize models — direct DB access for live platform data
const Alert = require('../models/Alert');
const ZeekConnection = require('../models/ZeekConnection');
const ZeekDNS = require('../models/ZeekDNS');
const BlockedIP = require('../models/BlockedIP');
const IOC = require('../models/IOC');
const Incident = require('../models/Incident');

// ── Shared MITRE ATT&CK data (lives in mitreRoutes memory)
const mitreRouter = require('./mitreRoutes');
const getMitreDetections = () => mitreRouter.ACTIVE_DETECTIONS || [];

// ── Firewall rules via iptables-proxy (Linux containers only)
const { listRules } = require('../util/iptables');

// ─────────────────────────────────────────────────────────────────────────────
// DeepGuard AI Copilot — Dynamic RAG Pipeline
// Queries ALL platform data sources before every Gemini call
// ─────────────────────────────────────────────────────────────────────────────

// ── 30-second context cache to avoid DB hammering on rapid queries
let _cachedContext = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

// ── Async data gathering from all platform sources
async function buildLiveContext() {
    // Return cached version if fresh
    if (_cachedContext && Date.now() - _cacheTimestamp < CACHE_TTL_MS) {
        return _cachedContext;
    }

    // Gather all data in parallel for speed
    const [
        recentAlerts,
        alertCount,
        recentConnections,
        connectionCount,
        recentDNS,
        blockedIPs,
        iocs,
        activeIncidents,
        incidentCount,
    ] = await Promise.all([
        Alert.findAll({ order: [['createdAt', 'DESC']], limit: 20 }).catch(() => []),
        Alert.count().catch(() => 0),
        ZeekConnection.findAll({ order: [['timestamp', 'DESC']], limit: 15 }).catch(() => []),
        ZeekConnection.count().catch(() => 0),
        ZeekDNS.findAll({ order: [['timestamp', 'DESC']], limit: 10 }).catch(() => []),
        BlockedIP.findAll({ where: { active: true } }).catch(() => []),
        IOC.findAll({ limit: 20, order: [['createdAt', 'DESC']] }).catch(() => []),
        Incident.findAll({ where: { status: { [require('sequelize').Op.notIn]: ['closed'] } }, order: [['createdAt', 'DESC']], limit: 15 }).catch(() => []),
        Incident.count().catch(() => 0),
    ]);

    // Firewall rules — only works in Linux Docker container
    let firewallRules = [];
    try {
        const result = await listRules('INPUT');
        firewallRules = result?.rules || result || [];
    } catch {
        // Expected to fail on Windows dev — iptables-proxy not available
    }

    // MITRE ATT&CK detections (from shared in-memory state)
    const mitreDetections = getMitreDetections();
    const criticalMitre = mitreDetections.filter(d => d.severity === 'Critical');
    const highMitre = mitreDetections.filter(d => d.severity === 'High');

    // ── Format everything into structured text for Gemini
    const sections = [];

    // — Suricata/IDS Alerts
    sections.push(`═══ SURICATA ALERTS (${recentAlerts.length} recent / ${alertCount} total) ═══`);
    if (recentAlerts.length > 0) {
        recentAlerts.forEach(a => {
            const sev = a.severity === 1 ? 'HIGH' : a.severity === 2 ? 'MEDIUM' : 'LOW';
            sections.push(`[${a.timestamp}] ${sev} | ${a.src_ip}:${a.src_port} → ${a.dest_ip}:${a.dest_port} | ${a.protocol} | ${a.signature || 'No signature'}`);
        });
    } else {
        sections.push('No Suricata alerts in database.');
    }

    // — MITRE ATT&CK Detections
    sections.push(`\n═══ MITRE ATT&CK ACTIVE DETECTIONS (${mitreDetections.length} active) ═══`);
    sections.push(`Critical: ${criticalMitre.length} | High: ${highMitre.length}`);
    mitreDetections.forEach(d => {
        sections.push(`* [${d.alert_id}] ${d.technique_id} | ${d.signature} | ${d.severity} | SRC: ${d.src_ip} → ${d.dest_ip} | Confidence: ${(d.confidence * 100).toFixed(0)}%`);
    });

    // — Zeek Network Connections
    sections.push(`\n═══ ZEEK NETWORK CONNECTIONS (${recentConnections.length} recent / ${connectionCount} total) ═══`);
    if (recentConnections.length > 0) {
        recentConnections.forEach(c => {
            sections.push(`${c.id_orig_h}:${c.id_orig_p} → ${c.id_resp_h}:${c.id_resp_p} | ${c.proto || '?'} | service: ${c.service || 'unknown'} | duration: ${c.duration || 0}s | state: ${c.conn_state || '?'}`);
        });
    } else {
        sections.push('No Zeek connections in database.');
    }

    // — DNS Activity
    sections.push(`\n═══ DNS ACTIVITY (${recentDNS.length} recent) ═══`);
    if (recentDNS.length > 0) {
        recentDNS.forEach(d => {
            sections.push(`${d.id_orig_h} → ${d.query} (${d.qtype_name || 'A'}) | rcode: ${d.rcode_name || 'NOERROR'}`);
        });
    } else {
        sections.push('No DNS activity recorded.');
    }

    // — Blocked IPs
    sections.push(`\n═══ BLOCKED IPs (${blockedIPs.length} active) ═══`);
    if (blockedIPs.length > 0) {
        blockedIPs.forEach(b => {
            sections.push(`${b.ip} — ${b.reason || 'No reason'} | source: ${b.source || 'manual'} | since: ${b.createdAt}`);
        });
    } else {
        sections.push('No IPs currently blocked.');
    }

    // — IOCs
    sections.push(`\n═══ INDICATORS OF COMPROMISE (${iocs.length} recent) ═══`);
    if (iocs.length > 0) {
        iocs.forEach(i => {
            sections.push(`[${i.type}] ${i.value} | threat: ${i.threat || 'unknown'} | severity: ${i.severity} | confidence: ${i.confidence}%`);
        });
    } else {
        sections.push('No IOCs in database.');
    }

    // — Firewall Rules
    sections.push(`\n═══ FIREWALL RULES (INPUT chain) ═══`);
    if (Array.isArray(firewallRules) && firewallRules.length > 0) {
        firewallRules.forEach((r, i) => {
            sections.push(`Rule ${i + 1}: ${JSON.stringify(r)}`);
        });
    } else {
        sections.push('No firewall rules available (iptables-proxy may not be running).');
    }

    // — Active Incidents
    sections.push(`\n═══ ACTIVE INCIDENTS (${activeIncidents.length} active / ${incidentCount} total) ═══`);
    if (activeIncidents.length > 0) {
        activeIncidents.forEach(inc => {
            const tags = inc.tags ? (typeof inc.tags === 'string' ? JSON.parse(inc.tags) : inc.tags) : [];
            sections.push(`INC-${String(inc.id).padStart(5, '0')} | ${inc.severity?.toUpperCase()} ${inc.priority} | ${inc.status} | ${inc.title} | assignee: ${inc.assignee || 'unassigned'} | category: ${inc.category || 'N/A'} | tags: ${tags.join(', ') || 'none'}`);
        });
    } else {
        sections.push('No active incidents.');
    }

    const context = `\nLIVE DEEPGUARD PLATFORM STATE (queried at ${new Date().toISOString()}):\n${sections.join('\n')}\n`;

    // Cache it
    _cachedContext = context;
    _cacheTimestamp = Date.now();

    console.log(`[Copilot] Live context built: ${recentAlerts.length} alerts, ${recentConnections.length} connections, ${blockedIPs.length} blocked IPs, ${mitreDetections.length} MITRE detections, ${activeIncidents.length} incidents`);

    return context;
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
- You receive LIVE data from the platform — always reference it when answering

========================
DATA SOURCES (injected into every query)
========================

You have access to LIVE platform data injected before every query:
1. **Suricata/IDS Alerts** — Real alerts from the database with IPs, ports, signatures, severity
2. **MITRE ATT&CK Detections** — Active technique detections mapped to the MITRE framework
3. **Zeek Network Connections** — Recent network flows with source/dest IPs, protocols, durations
4. **Zeek DNS Activity** — Recent DNS queries (useful for detecting C2 beaconing, tunneling)
5. **Blocked IPs** — Currently blocked IPs with reasons and timestamps
6. **IOCs** — Indicators of Compromise stored in the platform database
7. **Firewall Rules** — Current iptables rules (when available)
8. **Active Incidents** — Open and in-progress incident cases with severity, priority, assignee, and status

When answering questions about the platform state, ALWAYS reference the actual data provided. Do not make up data. If a section says "No data" or is empty, say so honestly.

========================
GOAL
========================

Help the user understand threats, reduce analysis time, and support decision-making inside DeepGuard.`;

// ── Model fallback chain — ordered by preference (NVIDIA NIM)
const MODEL_CHAIN = [
    'meta/llama-3.3-70b-instruct',
    'meta/llama-3.1-70b-instruct',
    'nvidia/llama-3.1-nemotron-70b-instruct',
];

// ── Rate Limit Tracking State
let requestHistory = []; // Timestamps of queries (ms)
let lastRemoteLimit = null; // Quota parsed from headers
const RPM_LIMIT = 40;

/** Calculate rate limit status from local history */
function getRateLimitEstimate() {
    const now = Date.now();
    // Keep only requests from the last 60 seconds
    requestHistory = requestHistory.filter(timestamp => now - timestamp < 60000);

    const remaining = Math.max(0, RPM_LIMIT - requestHistory.length);
    let resetSeconds = 0;
    if (requestHistory.length > 0) {
        resetSeconds = Math.max(0, Math.ceil((requestHistory[0] + 60000 - now) / 1000));
    }

    return {
        limit: RPM_LIMIT,
        remaining,
        reset: resetSeconds,
        source: 'local'
    };
}

/** Return the hybrid rate limit state (preferring fresh remote header data if available) */
function getRateLimitState() {
    const local = getRateLimitEstimate();
    // If we have a fresh remote limit state (less than 10 seconds old), return it
    if (lastRemoteLimit && (Date.now() - lastRemoteLimit.timestamp < 10000)) {
        return {
            limit: lastRemoteLimit.limit,
            remaining: lastRemoteLimit.remaining,
            reset: lastRemoteLimit.reset,
            source: 'remote'
        };
    }
    return local;
}

// ── Single NVIDIA NIM API call (no retry — that's handled by the caller)
function callNvidiaOnce(modelName, payload, apiKey) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'integrate.api.nvidia.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(payload),
            },
        };

        const req = https.request(options, (res) => {
            // Read headers for rate limit info
            const limitHeader = res.headers['x-ratelimit-limit'] || res.headers['x-ratelimit-limit-requests'];
            const remainingHeader = res.headers['x-ratelimit-remaining'] || res.headers['x-ratelimit-remaining-requests'];
            const resetHeader = res.headers['x-ratelimit-reset'];

            if (remainingHeader !== undefined) {
                lastRemoteLimit = {
                    limit: parseInt(limitHeader) || RPM_LIMIT,
                    remaining: parseInt(remainingHeader),
                    reset: parseInt(resetHeader) || 60,
                    timestamp: Date.now()
                };
            }

            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode !== 200 || parsed.error) {
                        const errMsg = parsed.error?.message || `NVIDIA API error (status: ${res.statusCode})`;
                        const errCode = parsed.error?.code || res.statusCode;
                        const err = new Error(errMsg);
                        err.statusCode = res.statusCode;
                        err.isRateLimit = res.statusCode === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit');
                        err.modelUsed = modelName;
                        if (res.statusCode === 429) {
                            const retryAfter = res.headers['retry-after'];
                            err.retryAfter = retryAfter ? parseInt(retryAfter) : 15;
                        }
                        return reject(err);
                    }
                    const text = parsed?.choices?.[0]?.message?.content;
                    if (!text) {
                        return reject(new Error('No content in NVIDIA response'));
                    }
                    resolve({ text, model: modelName });
                } catch (e) {
                    reject(new Error('Failed to parse NVIDIA response: ' + e.message));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('NVIDIA request timed out'));
        });
        req.write(payload);
        req.end();
    });
}

// ── Retry + fallback orchestrator
async function callNvidia(systemPrompt, liveContext, userPrompt, pageContext) {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
        throw new Error('NVIDIA_API_KEY not configured in server/.env');
    }

    const fullUserMessage = [
        liveContext,
        pageContext ? `\nCURRENT PAGE CONTEXT:\n${pageContext}` : '',
        `\nUSER QUERY: ${userPrompt}`
    ].filter(Boolean).join('\n');

    const MAX_RETRIES = 3;
    const errors = [];

    for (const model of MODEL_CHAIN) {
        const payload = JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: fullUserMessage }
            ],
            temperature: 0.2,
            top_p: 0.7,
            max_tokens: 1024,
        });

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`[Copilot] Trying NVIDIA model ${model} (attempt ${attempt}/${MAX_RETRIES})...`);
                const result = await callNvidiaOnce(model, payload, apiKey);
                console.log(`[Copilot] Success with ${result.model}`);
                return result;
            } catch (err) {
                errors.push({ model, attempt, message: err.message });
                console.warn(`[Copilot] NVIDIA ${model} attempt ${attempt} failed: ${err.message}`);

                // If rate-limited (quota=0 or 429), skip to next model immediately
                if (err.isRateLimit) {
                    console.warn(`[Copilot] ${model} rate-limited, skipping to next model`);
                    break;
                }

                // If last attempt for this model, move to next
                if (attempt === MAX_RETRIES) {
                    console.warn(`[Copilot] ${model} exhausted all retries, trying next model`);
                    break;
                }

                // Wait 1s and retry
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    // All models and retries exhausted
    const lastErr = errors[errors.length - 1];
    const err = new Error(`All models failed. Last error (${lastErr.model}): ${lastErr.message}`);
    err.isOverloaded = true;
    err.allErrors = errors;
    throw err;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /copilot/limit — Fetch current rate limit status
// ─────────────────────────────────────────────────────────────────────────────
router.get('/limit', (req, res) => {
    res.json(getRateLimitState());
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /copilot/query — Main AI copilot endpoint
// Body: { prompt: string, pageContext?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/query', async (req, res) => {
    const { prompt, pageContext } = req.body;

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // Track request count
    requestHistory.push(Date.now());

    try {
        const liveContext = await buildLiveContext();
        const result = await callNvidia(SYSTEM_PROMPT, liveContext, prompt.trim(), pageContext || '');

        res.json({
            analysis: result.text,
            prompt: prompt.trim(),
            timestamp: new Date().toISOString(),
            model: result.model,
            context_alerts: getMitreDetections().length,
            rateLimit: getRateLimitState()
        });
    } catch (error) {
        console.error('[Copilot] All models failed:', error.message);
        const isRateLimit = error.isRateLimit || error.message?.toLowerCase().includes('quota') || error.message?.toLowerCase().includes('rate limit');
        const isOverloaded = error.isOverloaded || error.message?.toLowerCase().includes('high demand') || error.message?.toLowerCase().includes('overloaded');
        const retryAfter = error.retryAfter || (isOverloaded ? 15 : (isRateLimit ? getRateLimitState().reset || 15 : null));
        const status = isRateLimit ? 429 : 503;

        let errorMessage;
        if (isOverloaded) {
            errorMessage = 'All NVIDIA models are currently experiencing high demand. This is a temporary provider-side issue. Please wait a few seconds and try again.';
        } else if (isRateLimit) {
            errorMessage = 'Rate limit reached. The NVIDIA NIM free tier quota is temporarily exhausted.';
        } else {
            errorMessage = 'DeepGuard Copilot inference engine unavailable';
        }

        res.status(status).json({
            error: errorMessage,
            details: error.message,
            retryAfter,
            isRateLimit,
            isOverloaded,
            rateLimit: getRateLimitState()
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /copilot/health — Health check
// ─────────────────────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
    res.json({
        status: 'online',
        models: MODEL_CHAIN,
        primary_model: MODEL_CHAIN[0],
        gemini_configured: !!process.env.GEMINI_API_KEY,
        nvidia_configured: !!process.env.NVIDIA_API_KEY,
        active_mitre_detections: getMitreDetections().length,
        data_sources: ['Alert', 'ZeekConnection', 'ZeekDNS', 'BlockedIP', 'IOC', 'MITRE', 'iptables', 'Incident'],
        cache_ttl_seconds: CACHE_TTL_MS / 1000,
        timestamp: new Date().toISOString(),
        rateLimit: getRateLimitState()
    });
});

module.exports = router;


