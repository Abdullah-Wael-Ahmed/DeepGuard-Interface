const express = require('express');
const axios = require('axios');
const { Op } = require('sequelize');
const Alert = require('../models/Alert');
const ZeekConnection = require('../models/ZeekConnection');

const router = express.Router();

const getApiClient = () => {
    return axios.create({
        baseURL: process.env.VR_SERVER_URL,
        headers: {
            'Authorization': `Bearer ${process.env.VR_API_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
};

// GET /api/velociraptor/clients — fetch all enrolled endpoint agents
router.get('/clients', async (req, res) => {
    try {
        // Velociraptor uses a gRPC API. 
        // This is a placeholder until the gRPC client is fully implemented.
        res.json({ items: [] });
    } catch (error) {
        console.error('Error fetching velociraptor clients:', error.message);
        res.status(500).json({ error: 'Failed to fetch clients from Velociraptor' });
    }
});

// GET /api/velociraptor/clients/:clientId — fetch details for a specific endpoint
router.get('/clients/:clientId', async (req, res) => {
    try {
        const client = getApiClient();
        const response = await client.get(`/api/v1/clients/${req.params.clientId}`);
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching velociraptor client ${req.params.clientId}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch client details' });
    }
});

// GET /api/velociraptor/clients/:clientId/collections — fetch artifact collection results for an endpoint
router.get('/clients/:clientId/collections', async (req, res) => {
    try {
        const client = getApiClient();
        const response = await client.get(`/api/v1/clients/${req.params.clientId}/collections`);
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching velociraptor collections for ${req.params.clientId}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch client collections' });
    }
});

// POST /api/velociraptor/hunt — trigger a VQL artifact hunt on a specific client
router.post('/hunt', async (req, res) => {
    try {
        const { artifact, clientId } = req.body;
        if (!artifact) {
            return res.status(400).json({ error: 'Missing artifact in request body' });
        }
        
        const client = getApiClient();
        
        const huntPayload = {
            artifacts: [artifact],
            env: [],
            // if clientId is provided, we might want to target it, though standard hunts target groups
            // for the scope of this implementation we just pass it along
            ...(clientId ? { condition: `clientId = '${clientId}'` } : {})
        };

        const response = await client.post('/api/v1/hunts', huntPayload);
        res.json(response.data);
    } catch (error) {
        console.error('Error triggering velociraptor hunt:', error.message);
        res.status(500).json({ error: 'Failed to trigger hunt' });
    }
});

// GET /api/velociraptor/hunts — list all active/past hunts
router.get('/hunts', async (req, res) => {
    try {
        const client = getApiClient();
        const response = await client.get('/api/v1/hunts');
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching velociraptor hunts:', error.message);
        res.status(500).json({ error: 'Failed to fetch hunts' });
    }
});

// GET /api/velociraptor/status — health check
router.get('/status', async (req, res) => {
    try {
        // Ping the Velociraptor GUI port to check if the container is up and running
        await axios.get(`http://velociraptor:${process.env.VR_GUI_PORT || 8000}/`);
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
