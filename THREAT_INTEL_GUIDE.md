# Threat Intelligence Implementation Guide

This guide will walk you through making the Threat Intelligence page fully functional with real data, external API integrations, and backend support.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Backend Setup](#2-backend-setup)
   - Database Models
   - API Routes
   - External API Integration
3. [Frontend Integration](#3-frontend-integration)
4. [External APIs](#4-external-apis)
5. [Real-time Updates](#5-real-time-updates)
6. [Security Considerations](#6-security-considerations)

---

## 1. Overview

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Frontend      │────▶│   Backend API   │────▶│  External APIs   │
│  (React)        │     │   (Express)     │     │  (AbuseIPDB,     │
│                 │◀────│                 │◀────│   VirusTotal)    │
└─────────────────┘     └─────────────────┘     └──────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   SQLite DB     │
                        │  (IOCs, Blocks) │
                        └─────────────────┘
```

### Features to Implement

| Feature | Frontend | Backend | External API |
|---------|----------|---------|--------------|
| IP Reputation Lookup | ✅ Done | ❌ Needed | AbuseIPDB / VirusTotal |
| Threat Feeds | ✅ Done | ❌ Needed | Optional (manual/api) |
| IOC Storage | ✅ Done | ❌ Needed | - |
| Blocked IPs | ✅ Done | ❌ Needed | + iptables integration |
| Auto-blocking | ❌ | ❌ Needed | - |

---

## 2. Backend Setup

### 2.1 Database Models

Create these Sequelize models in `server/models/`:

#### `server/models/IOC.js`
```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const IOC = sequelize.define('IOC', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        type: {
            type: DataTypes.ENUM('ip', 'domain', 'hash', 'url'),
            allowNull: false
        },
        value: {
            type: DataTypes.STRING,
            allowNull: false
        },
        threat: {
            type: DataTypes.STRING,
            allowNull: true
        },
        severity: {
            type: DataTypes.ENUM('critical', 'high', 'medium', 'low', 'info'),
            defaultValue: 'medium'
        },
        source: {
            type: DataTypes.STRING,
            allowNull: true
        },
        confidence: {
            type: DataTypes.INTEGER,
            defaultValue: 50 // 0-100
        },
        firstSeen: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        lastSeen: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {
        indexes: [
            { fields: ['type'] },
            { fields: ['value'] },
            { fields: ['severity'] }
        ]
    });

    return IOC;
};
```

#### `server/models/BlockedIP.js`
```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const BlockedIP = sequelize.define('BlockedIP', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        ip: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        reason: {
            type: DataTypes.STRING,
            allowNull: false
        },
        source: {
            type: DataTypes.STRING, // 'manual', 'auto', 'threat-feed'
            defaultValue: 'manual'
        },
        autoBlocked: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true // null = permanent
        },
        active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    });

    return BlockedIP;
};
```

#### `server/models/ThreatFeed.js`
```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ThreatFeed = sequelize.define('ThreatFeed', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        apiKey: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive', 'error'),
            defaultValue: 'inactive'
        },
        lastSync: {
            type: DataTypes.DATE,
            allowNull: true
        },
        entryCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        syncInterval: {
            type: DataTypes.INTEGER, // minutes
            defaultValue: 60
        }
    });

    return ThreatFeed;
};
```

### 2.2 API Routes

Create `server/routes/threatIntelRoutes.js`:

```javascript
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { exec } = require('child_process');

// Import models (adjust path as needed)
// const { IOC, BlockedIP, ThreatFeed } = require('../models');

// ============================================
// IP REPUTATION LOOKUP
// ============================================

/**
 * GET /threat-intel/lookup/:ip
 * Look up IP reputation from external sources
 */
router.get('/lookup/:ip', async (req, res) => {
    const { ip } = req.params;
    
    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address format' });
    }

    try {
        // Check AbuseIPDB
        const abuseResult = await checkAbuseIPDB(ip);
        
        // Check local IOC database
        // const localIOC = await IOC.findOne({ where: { type: 'ip', value: ip } });
        
        // Check if IP is blocked
        // const isBlocked = await BlockedIP.findOne({ where: { ip, active: true } });

        res.json({
            ip,
            reputation: abuseResult.abuseConfidenceScore > 50 ? 'malicious' : 'clean',
            score: abuseResult.abuseConfidenceScore,
            country: abuseResult.countryCode,
            isp: abuseResult.isp,
            domain: abuseResult.domain,
            reports: abuseResult.totalReports,
            lastReported: abuseResult.lastReportedAt,
            categories: abuseResult.categories || [],
            isBlocked: false, // isBlocked !== null
            whitelisted: abuseResult.isWhitelisted
        });
    } catch (error) {
        console.error('IP lookup error:', error);
        res.status(500).json({ error: 'Failed to lookup IP' });
    }
});

/**
 * Check IP against AbuseIPDB
 */
async function checkAbuseIPDB(ip) {
    const apiKey = process.env.ABUSEIPDB_API_KEY;
    
    if (!apiKey) {
        // Return mock data if no API key
        return {
            abuseConfidenceScore: Math.floor(Math.random() * 100),
            countryCode: 'US',
            isp: 'Example ISP',
            domain: 'example.com',
            totalReports: Math.floor(Math.random() * 50),
            lastReportedAt: new Date().toISOString(),
            categories: [14, 18], // Port scan, Brute force
            isWhitelisted: false
        };
    }

    const response = await axios.get('https://api.abuseipdb.com/api/v2/check', {
        params: {
            ipAddress: ip,
            maxAgeInDays: 90,
            verbose: true
        },
        headers: {
            'Key': apiKey,
            'Accept': 'application/json'
        }
    });

    return response.data.data;
}

// ============================================
// IOC MANAGEMENT
// ============================================

/**
 * GET /threat-intel/iocs
 * Get all IOCs with pagination
 */
router.get('/iocs', async (req, res) => {
    const { page = 1, limit = 50, type, severity } = req.query;
    
    try {
        // TODO: Replace with actual database query
        // const where = {};
        // if (type) where.type = type;
        // if (severity) where.severity = severity;
        
        // const iocs = await IOC.findAndCountAll({
        //     where,
        //     limit: parseInt(limit),
        //     offset: (parseInt(page) - 1) * parseInt(limit),
        //     order: [['createdAt', 'DESC']]
        // });

        // Mock data for now
        res.json({
            iocs: [
                { id: 1, type: 'ip', value: '185.220.101.45', threat: 'Tor Exit Node', severity: 'medium', source: 'AbuseIPDB' },
                { id: 2, type: 'ip', value: '45.155.205.233', threat: 'Brute Force', severity: 'high', source: 'Fail2Ban' },
            ],
            total: 2,
            page: parseInt(page),
            totalPages: 1
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch IOCs' });
    }
});

/**
 * POST /threat-intel/iocs
 * Add a new IOC
 */
router.post('/iocs', async (req, res) => {
    const { type, value, threat, severity, source } = req.body;
    
    if (!type || !value) {
        return res.status(400).json({ error: 'Type and value are required' });
    }

    try {
        // const ioc = await IOC.create({ type, value, threat, severity, source });
        // res.status(201).json(ioc);
        
        res.status(201).json({ message: 'IOC created', id: Date.now() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create IOC' });
    }
});

/**
 * DELETE /threat-intel/iocs/:id
 * Delete an IOC
 */
router.delete('/iocs/:id', async (req, res) => {
    try {
        // await IOC.destroy({ where: { id: req.params.id } });
        res.json({ message: 'IOC deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete IOC' });
    }
});

// ============================================
// BLOCKED IPS
// ============================================

/**
 * GET /threat-intel/blocked
 * Get all blocked IPs
 */
router.get('/blocked', async (req, res) => {
    try {
        // const blockedIPs = await BlockedIP.findAll({
        //     where: { active: true },
        //     order: [['createdAt', 'DESC']]
        // });
        
        // Mock data
        res.json([
            { id: 1, ip: '185.220.101.45', reason: 'Tor Exit Node', autoBlocked: true, createdAt: new Date() },
            { id: 2, ip: '45.155.205.233', reason: 'Brute Force', autoBlocked: true, createdAt: new Date() },
        ]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch blocked IPs' });
    }
});

/**
 * POST /threat-intel/block
 * Block an IP address
 */
router.post('/block', async (req, res) => {
    const { ip, reason, autoBlocked = false } = req.body;
    
    if (!ip) {
        return res.status(400).json({ error: 'IP address is required' });
    }

    try {
        // Add to database
        // const blocked = await BlockedIP.create({ ip, reason, autoBlocked });
        
        // Add iptables rule
        await addIptablesBlock(ip);
        
        res.status(201).json({ message: `IP ${ip} blocked successfully` });
    } catch (error) {
        console.error('Block IP error:', error);
        res.status(500).json({ error: 'Failed to block IP' });
    }
});

/**
 * DELETE /threat-intel/block/:ip
 * Unblock an IP address
 */
router.delete('/block/:ip', async (req, res) => {
    const { ip } = req.params;
    
    try {
        // Update database
        // await BlockedIP.update({ active: false }, { where: { ip } });
        
        // Remove iptables rule
        await removeIptablesBlock(ip);
        
        res.json({ message: `IP ${ip} unblocked successfully` });
    } catch (error) {
        console.error('Unblock IP error:', error);
        res.status(500).json({ error: 'Failed to unblock IP' });
    }
});

/**
 * Add iptables DROP rule for IP
 */
function addIptablesBlock(ip) {
    return new Promise((resolve, reject) => {
        // SECURITY: Validate IP format strictly before executing
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ip)) {
            return reject(new Error('Invalid IP format'));
        }

        const command = `sudo iptables -A INPUT -s ${ip} -j DROP`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

/**
 * Remove iptables DROP rule for IP
 */
function removeIptablesBlock(ip) {
    return new Promise((resolve, reject) => {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ip)) {
            return reject(new Error('Invalid IP format'));
        }

        const command = `sudo iptables -D INPUT -s ${ip} -j DROP`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

// ============================================
// THREAT FEEDS
// ============================================

/**
 * GET /threat-intel/feeds
 * Get all threat feeds
 */
router.get('/feeds', async (req, res) => {
    try {
        // const feeds = await ThreatFeed.findAll();
        
        res.json([
            { id: 1, name: 'AbuseIPDB', status: 'active', lastSync: new Date(), entryCount: 15420 },
            { id: 2, name: 'Emerging Threats', status: 'active', lastSync: new Date(), entryCount: 8932 },
            { id: 3, name: 'Spamhaus DROP', status: 'active', lastSync: new Date(), entryCount: 1245 },
        ]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch feeds' });
    }
});

/**
 * POST /threat-intel/feeds/:id/sync
 * Manually sync a threat feed
 */
router.post('/feeds/:id/sync', async (req, res) => {
    const { id } = req.params;
    
    try {
        // TODO: Implement feed sync logic based on feed type
        // const feed = await ThreatFeed.findByPk(id);
        // await syncFeed(feed);
        
        res.json({ message: 'Feed sync initiated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to sync feed' });
    }
});

// ============================================
// STATS
// ============================================

/**
 * GET /threat-intel/stats
 * Get threat intelligence statistics
 */
router.get('/stats', async (req, res) => {
    try {
        // const totalIOCs = await IOC.count();
        // const blockedCount = await BlockedIP.count({ where: { active: true } });
        // const activeFeeds = await ThreatFeed.count({ where: { status: 'active' } });
        
        res.json({
            totalIOCs: 31275,
            blockedIPs: 4,
            activeFeeds: 5,
            lastUpdate: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
```

### 2.3 Register Routes in `app.js`

Add to your `server/app.js`:

```javascript
const threatIntelRoutes = require('./routes/threatIntelRoutes');

// ... existing code ...

app.use('/threat-intel', threatIntelRoutes);
```

### 2.4 Environment Variables

Add to your `.env` file:

```env
# Threat Intelligence API Keys
ABUSEIPDB_API_KEY=your_api_key_here
VIRUSTOTAL_API_KEY=your_api_key_here
OTX_API_KEY=your_api_key_here
```

---

## 3. Frontend Integration

Update `ThreatIntelligence.jsx` to use real API calls:

### 3.1 API Service

Create `front/src/services/threatIntelService.js`:

```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_BACK;

export const threatIntelService = {
    // IP Lookup
    lookupIP: async (ip) => {
        const response = await axios.get(`${API_URL}/threat-intel/lookup/${ip}`, {
            withCredentials: true
        });
        return response.data;
    },

    // IOCs
    getIOCs: async (params = {}) => {
        const response = await axios.get(`${API_URL}/threat-intel/iocs`, {
            params,
            withCredentials: true
        });
        return response.data;
    },

    addIOC: async (ioc) => {
        const response = await axios.post(`${API_URL}/threat-intel/iocs`, ioc, {
            withCredentials: true
        });
        return response.data;
    },

    deleteIOC: async (id) => {
        const response = await axios.delete(`${API_URL}/threat-intel/iocs/${id}`, {
            withCredentials: true
        });
        return response.data;
    },

    // Blocked IPs
    getBlockedIPs: async () => {
        const response = await axios.get(`${API_URL}/threat-intel/blocked`, {
            withCredentials: true
        });
        return response.data;
    },

    blockIP: async (ip, reason) => {
        const response = await axios.post(`${API_URL}/threat-intel/block`, 
            { ip, reason },
            { withCredentials: true }
        );
        return response.data;
    },

    unblockIP: async (ip) => {
        const response = await axios.delete(`${API_URL}/threat-intel/block/${ip}`, {
            withCredentials: true
        });
        return response.data;
    },

    // Threat Feeds
    getFeeds: async () => {
        const response = await axios.get(`${API_URL}/threat-intel/feeds`, {
            withCredentials: true
        });
        return response.data;
    },

    syncFeed: async (feedId) => {
        const response = await axios.post(`${API_URL}/threat-intel/feeds/${feedId}/sync`, {}, {
            withCredentials: true
        });
        return response.data;
    },

    // Stats
    getStats: async () => {
        const response = await axios.get(`${API_URL}/threat-intel/stats`, {
            withCredentials: true
        });
        return response.data;
    }
};
```

### 3.2 Update ThreatIntelligence.jsx

Replace the mock functions with real API calls:

```javascript
import { threatIntelService } from '../services/threatIntelService';
import { toast } from 'react-toastify';

// In component:
const [threatFeeds, setThreatFeeds] = useState([]);
const [recentIOCs, setRecentIOCs] = useState([]);
const [blockedIPs, setBlockedIPs] = useState([]);
const [stats, setStats] = useState({});

// Fetch data on mount
useEffect(() => {
    loadData();
}, []);

const loadData = async () => {
    try {
        const [feeds, iocs, blocked, statsData] = await Promise.all([
            threatIntelService.getFeeds(),
            threatIntelService.getIOCs({ limit: 10 }),
            threatIntelService.getBlockedIPs(),
            threatIntelService.getStats()
        ]);
        
        setThreatFeeds(feeds);
        setRecentIOCs(iocs.iocs);
        setBlockedIPs(blocked);
        setStats(statsData);
    } catch (error) {
        console.error('Error loading threat intel data:', error);
        toast.error('Failed to load threat intelligence data');
    }
};

// Real IP lookup
const handleIPLookup = async () => {
    if (!searchIP.trim()) return;
    
    setSearching(true);
    try {
        const result = await threatIntelService.lookupIP(searchIP);
        setSearchResult(result);
    } catch (error) {
        toast.error('Failed to lookup IP');
    }
    setSearching(false);
};

// Block IP
const handleBlockIP = async (ip, reason) => {
    try {
        await threatIntelService.blockIP(ip, reason);
        toast.success(`IP ${ip} blocked`);
        loadData(); // Refresh data
    } catch (error) {
        toast.error('Failed to block IP');
    }
};

// Unblock IP
const handleUnblockIP = async (ip) => {
    try {
        await threatIntelService.unblockIP(ip);
        toast.success(`IP ${ip} unblocked`);
        loadData();
    } catch (error) {
        toast.error('Failed to unblock IP');
    }
};
```

---

## 4. External APIs

### 4.1 AbuseIPDB

**Sign up:** https://www.abuseipdb.com/pricing

**Free tier:** 1,000 checks/day

**API Documentation:** https://docs.abuseipdb.com/

**Endpoints used:**
- `GET /api/v2/check` - Check IP reputation
- `POST /api/v2/report` - Report an IP

### 4.2 VirusTotal

**Sign up:** https://www.virustotal.com/gui/join-us

**Free tier:** 4 lookups/minute, 500/day

**API Documentation:** https://developers.virustotal.com/reference/overview

```javascript
async function checkVirusTotal(ip) {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    
    const response = await axios.get(
        `https://www.virustotal.com/api/v3/ip_addresses/${ip}`,
        {
            headers: { 'x-apikey': apiKey }
        }
    );
    
    return response.data;
}
```

### 4.3 AlienVault OTX

**Sign up:** https://otx.alienvault.com/

**Free tier:** Unlimited (with rate limiting)

```javascript
async function checkOTX(ip) {
    const apiKey = process.env.OTX_API_KEY;
    
    const response = await axios.get(
        `https://otx.alienvault.com/api/v1/indicators/IPv4/${ip}/general`,
        {
            headers: { 'X-OTX-API-KEY': apiKey }
        }
    );
    
    return response.data;
}
```

### 4.4 Spamhaus DROP List (Free, No API Key)

```javascript
async function downloadSpamhausDROP() {
    const response = await axios.get('https://www.spamhaus.org/drop/drop.txt');
    
    const lines = response.data.split('\n');
    const ips = lines
        .filter(line => line && !line.startsWith(';'))
        .map(line => line.split(';')[0].trim());
    
    return ips;
}
```

---

## 5. Real-time Updates

### 5.1 WebSocket Integration

Update your WebSocket handler to broadcast threat intel events:

```javascript
// In server/util/websocket.js

function broadcastThreatIntel(type, data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: `threat_intel_${type}`, // 'new_ioc', 'ip_blocked', etc.
                data
            }));
        }
    });
}

module.exports = { broadcastThreatIntel };
```

### 5.2 Frontend WebSocket Listener

```javascript
// In ThreatIntelligence.jsx

const { lastMessage } = useWebSocket(import.meta.env.VITE_WS, {
    shouldReconnect: () => true
});

useEffect(() => {
    if (!lastMessage?.data) return;
    
    try {
        const message = JSON.parse(lastMessage.data);
        
        if (message.type === 'threat_intel_new_ioc') {
            setRecentIOCs(prev => [message.data, ...prev.slice(0, 9)]);
            toast.info(`New IOC detected: ${message.data.value}`);
        }
        
        if (message.type === 'threat_intel_ip_blocked') {
            setBlockedIPs(prev => [message.data, ...prev]);
            toast.warning(`IP blocked: ${message.data.ip}`);
        }
    } catch (error) {
        console.error('WebSocket message error:', error);
    }
}, [lastMessage]);
```

---

## 6. Security Considerations

### 6.1 Input Validation

**CRITICAL:** Always validate IP addresses before using in iptables commands:

```javascript
function isValidIP(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255 && part === num.toString();
    });
}

// Also check for private IPs to prevent blocking yourself
function isPrivateIP(ip) {
    const parts = ip.split('.').map(Number);
    
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    
    // 127.0.0.0/8 (localhost)
    if (parts[0] === 127) return true;
    
    return false;
}
```

### 6.2 Rate Limiting

Add rate limiting to prevent API abuse:

```javascript
const rateLimit = require('express-rate-limit');

const threatIntelLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: { error: 'Too many requests, please slow down' }
});

app.use('/threat-intel', threatIntelLimiter);
```

### 6.3 API Key Storage

Never expose API keys in frontend code. Always call external APIs from the backend.

### 6.4 Audit Logging

Log all threat intel actions:

```javascript
async function logAction(action, details, userId) {
    console.log(`[THREAT_INTEL] ${action}:`, details);
    // Also save to database for audit trail
}

// Usage:
logAction('IP_BLOCKED', { ip, reason, blockedBy: 'system' });
logAction('IP_LOOKUP', { ip, result: 'malicious' });
```

---

## 7. Implementation Checklist

### Phase 1: Backend Foundation
- [ ] Create database models (IOC, BlockedIP, ThreatFeed)
- [ ] Create threat intel routes
- [ ] Register routes in app.js
- [ ] Test with mock data

### Phase 2: External API Integration
- [ ] Sign up for AbuseIPDB (free tier)
- [ ] Add API key to .env
- [ ] Implement IP lookup
- [ ] Test with real IPs

### Phase 3: Frontend Integration
- [ ] Create threatIntelService.js
- [ ] Update ThreatIntelligence.jsx to use real API
- [ ] Add error handling and loading states
- [ ] Test full flow

### Phase 4: Real-time & Advanced
- [ ] Add WebSocket events for new IOCs
- [ ] Implement auto-blocking based on severity
- [ ] Add threat feed sync scheduler
- [ ] Implement search and filtering

---

## Quick Start Commands

```bash
# Install required packages (backend)
cd server
npm install axios express-rate-limit

# Add to .env
echo "ABUSEIPDB_API_KEY=your_key_here" >> .env

# Restart server
npm run dev
```

---

## Need Help?

If you get stuck on any step, let me know and I can help implement it!
