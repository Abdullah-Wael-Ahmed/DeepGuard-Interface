const express = require('express');
const axios = require('axios');

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
        const client = getApiClient();
        const response = await client.get('/api/v1/clients');
        res.json(response.data);
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
        const client = getApiClient();
        // Just fetching root or ping endpoint
        await client.get('/api/v1/ping'); // Or another lightweight endpoint if /ping doesn't exist
        res.json({ status: 'Online', reachable: true });
    } catch (error) {
        console.error('Velociraptor health check failed:', error.message);
        res.status(500).json({ status: 'Offline', reachable: false, error: error.message });
    }
});

module.exports = router;
