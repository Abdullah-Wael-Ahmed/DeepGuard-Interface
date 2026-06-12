const express = require('express');
const axios = require('axios');
const { Op } = require('sequelize');
const Alert = require('../models/Alert');
const ZeekConnection = require('../models/ZeekConnection');

const router = express.Router();

const https = require('https');

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Helper to query Velociraptor via local docker exec
const queryVelociraptor = async (vqlQuery) => {
    try {
        // Escape single quotes for the shell command
        const safeQuery = vqlQuery.replace(/'/g, "'\\''");
        
        // Execute the VQL query directly against the live server by generating and using a temporary API client
        const cmd = `docker exec deepguard-velociraptor sh -c "/opt/velociraptor --config /etc/velociraptor/server.config.yaml config api_client --name admin --role administrator /tmp/api_client.yaml > /dev/null 2>&1; /opt/velociraptor --api_config /tmp/api_client.yaml query '${safeQuery}' --format json"`;
        const { stdout, stderr } = await execPromise(cmd);
        
        if (stderr && stderr.trim()) {
            console.error('[Velociraptor CLI Stderr]:', stderr);
        }

        if (!stdout || !stdout.trim()) {
            return { Responses: [{ Response: [] }] };
        }
        
        let rows = [];
        try {
            // First try parsing the whole thing as a single JSON array
            rows = JSON.parse(stdout);
        } catch (e) {
            // If it fails, parse line by line (Velociraptor often outputs line-delimited JSON)
            const lines = stdout.split('\n').filter(l => l.trim());
            for (const line of lines) {
                try {
                    rows.push(JSON.parse(line));
                } catch (err) {
                    console.log('[Velociraptor ignored non-JSON line]:', line);
                }
            }
        }
        
        return { Responses: [{ Response: rows }] };
    } catch (error) {
        console.error('Docker exec query failed:', error.message);
        if (error.stdout) console.error('Stdout:', error.stdout);
        if (error.stderr) console.error('Stderr:', error.stderr);
        throw new Error('Failed to query velociraptor datastore locally: ' + error.message);
    }
};

// GET /api/velociraptor/clients — fetch all enrolled endpoint agents
router.get('/clients', async (req, res) => {
    try {
        const data = await queryVelociraptor('SELECT client_id, os_info, labels, last_seen_at FROM clients()');
        
        // VQL returns an array of objects in data.Responses[0].Response (usually JSON string or object array)
        let clients = [];
        if (data.Responses && data.Responses.length > 0) {
            clients = data.Responses[0].Response || [];
            if (typeof clients === 'string') {
                try {
                    clients = JSON.parse(clients);
                } catch (e) {
                    // Try to parse line-delimited JSON
                    clients = clients.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
                }
            }
        }
        
        res.json({ items: clients });
    } catch (error) {
        console.error('Error fetching velociraptor clients:', error.message);
        res.status(500).json({ error: error.message || 'Failed to fetch clients from Velociraptor' });
    }
});

// GET /api/velociraptor/clients/:clientId — fetch details for a specific endpoint
router.get('/clients/:clientId', async (req, res) => {
    try {
        const clientId = req.params.clientId.replace(/[^a-zA-Z0-9.-]/g, '');
        const data = await queryVelociraptor(`SELECT * FROM clients() WHERE client_id = '${clientId}'`);
        
        let client = {};
        if (data.Responses && data.Responses.length > 0) {
            let clients = data.Responses[0].Response || [];
            if (typeof clients === 'string') {
                try {
                    clients = JSON.parse(clients);
                } catch(e) {
                    clients = clients.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
                }
            }
            if (clients.length > 0) client = clients[0];
        }
        
        res.json(client);
    } catch (error) {
        console.error(`Error fetching velociraptor client ${req.params.clientId}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch client details' });
    }
});

// GET /api/velociraptor/clients/:clientId/collections — fetch artifact collection results for an endpoint
router.get('/clients/:clientId/collections', async (req, res) => {
    try {
        // Placeholder for now
        res.json({ items: [] });
    } catch (error) {
        console.error(`Error fetching velociraptor collections:`, error.message);
        res.status(500).json({ error: 'Failed to fetch client collections' });
    }
});

// POST /api/velociraptor/hunt — trigger a VQL artifact hunt on a specific client
router.post('/hunt', async (req, res) => {
    try {
        // Placeholder for now
        res.json({ status: 'started' });
    } catch (error) {
        console.error('Error triggering velociraptor hunt:', error.message);
        res.status(500).json({ error: 'Failed to trigger hunt' });
    }
});

// GET /api/velociraptor/hunts — list all active/past hunts
router.get('/hunts', async (req, res) => {
    try {
        const data = await queryVelociraptor('SELECT * FROM hunts() LIMIT 50');
        let hunts = [];
        if (data.Responses && data.Responses.length > 0) {
            hunts = data.Responses[0].Response || [];
            if (typeof hunts === 'string') {
                try {
                    hunts = JSON.parse(hunts);
                } catch(e) {
                    hunts = hunts.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
                }
            }
        }
        res.json({ items: hunts });
    } catch (error) {
        console.error('Error fetching velociraptor hunts:', error.message);
        res.status(500).json({ error: 'Failed to fetch hunts' });
    }
});

// GET /api/velociraptor/status — health check
router.get('/status', async (req, res) => {
    try {
        // Ping the Velociraptor GUI port to check if the container is up and running
        const agent = new https.Agent({ rejectUnauthorized: false });
        const response = await axios.get(process.env.VR_SERVER_URL || 'https://localhost:8889', { 
            httpsAgent: agent,
            validateStatus: (status) => status === 200 || status === 401 // 401 means server is up and asking for auth
        });
        res.json({ status: 'Online', reachable: true });
    } catch (error) {
        console.error('Velociraptor health check failed:', error.message);
        res.status(500).json({ status: 'Offline', reachable: false, error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  CROSS-CORRELATION ENDPOINTS (for Endpoint Detail Panel)
// ═══════════════════════════════════════════════════════════════

// GET /api/velociraptor/context/:ip — Get all correlated data for an IP address
router.get('/context/:ip', async (req, res) => {
    try {
        const ip = req.params.ip;
        const hours = parseInt(req.query.hours) || 24;
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        // 1. Suricata alerts for this IP (as source or destination)
        const alerts = await Alert.findAll({
            where: {
                [Op.or]: [
                    { src_ip: ip },
                    { dest_ip: ip }
                ],
                createdAt: { [Op.gte]: since }
            },
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        // 2. Zeek connections for this IP (as source or destination)
        const zeekConnections = await ZeekConnection.findAll({
            where: {
                [Op.or]: [
                    { id_orig_h: ip },
                    { id_resp_h: ip }
                ],
                createdAt: { [Op.gte]: since }
            },
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        // 3. Anomaly detections for this IP (from anomaly detector service)
        let anomalies = [];
        try {
            const anomalyRes = await axios.get('http://deepguard-anomaly:5001/results', { timeout: 5000 });
            if (anomalyRes.data?.results) {
                anomalies = anomalyRes.data.results.filter(r => r.src_ip === ip);
            }
        } catch (e) {
            // Anomaly service may not be running
        }

        // 4. Compute risk score (0-10)
        const criticalAlerts = alerts.filter(a => a.severity === 1).length;
        const highAlerts = alerts.filter(a => a.severity === 2).length;
        const mediumAlerts = alerts.filter(a => a.severity === 3).length;
        const anomalyCount = anomalies.filter(a => a.is_anomaly).length;
        const highSeverityAnomalies = anomalies.filter(a => a.severity === 'HIGH').length;

        let riskScore = 0;
        riskScore += Math.min(criticalAlerts * 3, 4);     // max 4 from critical alerts
        riskScore += Math.min(highAlerts * 1.5, 2);       // max 2 from high alerts
        riskScore += Math.min(mediumAlerts * 0.5, 1);     // max 1 from medium alerts
        riskScore += Math.min(anomalyCount * 1, 2);       // max 2 from anomalies
        riskScore += Math.min(highSeverityAnomalies * 1, 1); // max 1 from high severity anomalies
        riskScore = Math.min(Math.round(riskScore * 10) / 10, 10);

        // 5. Unique destination ports from Zeek (for port scan detection)
        const uniqueDestPorts = new Set(zeekConnections.map(c => c.id_resp_p));
        const uniqueDestIPs = new Set(zeekConnections.map(c => c.id_resp_h));

        res.json({
            ip,
            timeRange: { hours, since: since.toISOString() },
            riskScore,
            summary: {
                totalAlerts: alerts.length,
                criticalAlerts,
                highAlerts,
                mediumAlerts,
                totalConnections: zeekConnections.length,
                uniqueDestPorts: uniqueDestPorts.size,
                uniqueDestIPs: uniqueDestIPs.size,
                totalAnomalies: anomalyCount,
                highSeverityAnomalies
            },
            alerts: alerts.slice(0, 20),
            zeekConnections: zeekConnections.slice(0, 20),
            anomalies: anomalies.slice(0, 20)
        });
    } catch (error) {
        console.error('Error fetching endpoint context:', error.message);
        res.status(500).json({ error: 'Failed to fetch endpoint context' });
    }
});

// GET /api/velociraptor/overview — summary stats for the endpoints page KPIs
router.get('/overview', async (req, res) => {
    try {
        // Get counts of IPs seen in the last 24 hours from Zeek connections
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentConnections = await ZeekConnection.findAll({
            attributes: ['id_orig_h'],
            where: { createdAt: { [Op.gte]: since24h } },
            group: ['id_orig_h'],
            raw: true
        });

        const uniqueSourceIPs = recentConnections.length;

        // Get total alerts in last 24h
        const alertCount = await Alert.count({
            where: { createdAt: { [Op.gte]: since24h } }
        });

        // Get critical alerts
        const criticalCount = await Alert.count({
            where: { createdAt: { [Op.gte]: since24h }, severity: 1 }
        });

        res.json({
            totalEndpoints: uniqueSourceIPs,
            activeAlerts: alertCount,
            criticalAlerts: criticalCount,
        });
    } catch (error) {
        console.error('Error fetching overview:', error.message);
        res.status(500).json({ error: 'Failed to fetch overview stats' });
    }
});

module.exports = router;
