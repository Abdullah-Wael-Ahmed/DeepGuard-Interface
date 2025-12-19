const express = require('express');
const router = express.Router();
const axios = require('axios');
const { exec } = require('child_process');
const IOC = require('../models/IOC');
const BlockedIP = require('../models/BlockedIP');
const ThreatFeed = require('../models/ThreatFeed');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate IP address format
 */
function isValidIP(ip) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;
    
    const parts = ip.split('.');
    return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
    });
}

/**
 * Check if IP is private (to prevent blocking internal IPs)
 */
function isPrivateIP(ip) {
    const parts = ip.split('.').map(Number);
    
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    
    return false;
}

// ============================================
// THREAT INTELLIGENCE PROVIDERS
// ============================================

/**
 * Check IP against AbuseIPDB
 * Free: 1,000 checks/day
 * https://www.abuseipdb.com/
 */
async function checkAbuseIPDB(ip) {
    const apiKey = process.env.ABUSEIPDB_API_KEY;
    
    if (!apiKey) {
        return { available: false, error: 'No API key configured' };
    }

    try {
        const response = await axios.get('https://api.abuseipdb.com/api/v2/check', {
            params: {
                ipAddress: ip,
                maxAgeInDays: 90,
                verbose: true
            },
            headers: {
                'Key': apiKey,
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        const data = response.data.data;
        return {
            available: true,
            provider: 'AbuseIPDB',
            score: data.abuseConfidenceScore || 0,
            reports: data.totalReports || 0,
            country: data.countryCode,
            isp: data.isp,
            domain: data.domain,
            usageType: data.usageType,
            lastReported: data.lastReportedAt,
            isWhitelisted: data.isWhitelisted,
            isTor: data.isTor,
            categories: data.reports?.map(r => r.categories)?.flat() || []
        };
    } catch (error) {
        console.error('[AbuseIPDB] Error:', error.message);
        return { available: false, error: error.message };
    }
}

/**
 * Check IP against VirusTotal
 * Free: 4 requests/minute, 500/day
 * https://www.virustotal.com/
 */
async function checkVirusTotal(ip) {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    
    if (!apiKey) {
        return { available: false, error: 'No API key configured' };
    }

    try {
        const response = await axios.get(
            `https://www.virustotal.com/api/v3/ip_addresses/${ip}`,
            {
                headers: { 'x-apikey': apiKey },
                timeout: 15000
            }
        );

        const data = response.data.data;
        const stats = data.attributes.last_analysis_stats || {};
        const malicious = stats.malicious || 0;
        const suspicious = stats.suspicious || 0;
        const total = Object.values(stats).reduce((a, b) => a + b, 0);

        return {
            available: true,
            provider: 'VirusTotal',
            score: total > 0 ? Math.round((malicious + suspicious) / total * 100) : 0,
            malicious: malicious,
            suspicious: suspicious,
            harmless: stats.harmless || 0,
            undetected: stats.undetected || 0,
            country: data.attributes.country,
            asOwner: data.attributes.as_owner,
            asn: data.attributes.asn,
            network: data.attributes.network,
            reputation: data.attributes.reputation
        };
    } catch (error) {
        console.error('[VirusTotal] Error:', error.message);
        return { available: false, error: error.message };
    }
}

/**
 * Check IP against AlienVault OTX
 * Free: Unlimited (with rate limiting)
 * https://otx.alienvault.com/
 */
async function checkAlienVaultOTX(ip) {
    const apiKey = process.env.OTX_API_KEY;
    
    if (!apiKey) {
        return { available: false, error: 'No API key configured' };
    }

    try {
        const response = await axios.get(
            `https://otx.alienvault.com/api/v1/indicators/IPv4/${ip}/general`,
            {
                headers: { 'X-OTX-API-KEY': apiKey },
                timeout: 10000
            }
        );

        const data = response.data;
        return {
            available: true,
            provider: 'AlienVault OTX',
            pulseCount: data.pulse_info?.count || 0,
            reputation: data.reputation || 0,
            country: data.country_name,
            city: data.city,
            asn: data.asn,
            pulses: data.pulse_info?.pulses?.slice(0, 5).map(p => ({
                name: p.name,
                tags: p.tags,
                created: p.created
            })) || []
        };
    } catch (error) {
        console.error('[AlienVault OTX] Error:', error.message);
        return { available: false, error: error.message };
    }
}

/**
 * Check IP against GreyNoise
 * Free: 100 queries/day (Community API)
 * https://www.greynoise.io/
 */
async function checkGreyNoise(ip) {
    const apiKey = process.env.GREYNOISE_API_KEY;
    
    // GreyNoise Community API (free, no key required for basic)
    try {
        const url = apiKey 
            ? `https://api.greynoise.io/v3/community/${ip}`
            : `https://api.greynoise.io/v3/community/${ip}`;
        
        const headers = apiKey ? { 'key': apiKey } : {};
        
        const response = await axios.get(url, {
            headers,
            timeout: 10000
        });

        const data = response.data;
        return {
            available: true,
            provider: 'GreyNoise',
            noise: data.noise || false,      // Is this IP "internet noise"?
            riot: data.riot || false,        // Is this a known benign service?
            classification: data.classification, // benign, malicious, unknown
            name: data.name,                 // Actor name if known
            link: data.link,
            lastSeen: data.last_seen,
            message: data.message
        };
    } catch (error) {
        if (error.response?.status === 404) {
            // IP not found in GreyNoise = not seen scanning
            return {
                available: true,
                provider: 'GreyNoise',
                noise: false,
                riot: false,
                classification: 'unknown',
                message: 'IP not observed'
            };
        }
        console.error('[GreyNoise] Error:', error.message);
        return { available: false, error: error.message };
    }
}

/**
 * Check IP against Shodan
 * Free: Limited (need API key)
 * https://www.shodan.io/
 */
async function checkShodan(ip) {
    const apiKey = process.env.SHODAN_API_KEY;
    
    if (!apiKey) {
        return { available: false, error: 'No API key configured' };
    }

    try {
        const response = await axios.get(
            `https://api.shodan.io/shodan/host/${ip}`,
            {
                params: { key: apiKey },
                timeout: 10000
            }
        );

        const data = response.data;
        return {
            available: true,
            provider: 'Shodan',
            ports: data.ports || [],
            hostnames: data.hostnames || [],
            country: data.country_name,
            city: data.city,
            org: data.org,
            asn: data.asn,
            isp: data.isp,
            os: data.os,
            vulns: data.vulns || [],
            tags: data.tags || [],
            lastUpdate: data.last_update
        };
    } catch (error) {
        if (error.response?.status === 404) {
            return {
                available: true,
                provider: 'Shodan',
                message: 'No information available',
                ports: [],
                hostnames: []
            };
        }
        console.error('[Shodan] Error:', error.message);
        return { available: false, error: error.message };
    }
}

/**
 * Check IP against IPQualityScore
 * Free: 5,000 lookups/month
 * https://www.ipqualityscore.com/
 */
async function checkIPQualityScore(ip) {
    const apiKey = process.env.IPQUALITYSCORE_API_KEY;
    
    if (!apiKey) {
        return { available: false, error: 'No API key configured' };
    }

    try {
        const response = await axios.get(
            `https://ipqualityscore.com/api/json/ip/${apiKey}/${ip}`,
            {
                params: {
                    strictness: 1,
                    allow_public_access_points: true
                },
                timeout: 10000
            }
        );

        const data = response.data;
        return {
            available: true,
            provider: 'IPQualityScore',
            fraudScore: data.fraud_score || 0,
            isProxy: data.proxy,
            isVPN: data.vpn,
            isTor: data.tor,
            isBot: data.bot_status,
            isCrawler: data.is_crawler,
            recentAbuse: data.recent_abuse,
            country: data.country_code,
            city: data.city,
            isp: data.ISP,
            asn: data.ASN,
            connectionType: data.connection_type
        };
    } catch (error) {
        console.error('[IPQualityScore] Error:', error.message);
        return { available: false, error: error.message };
    }
}

/**
 * Map AbuseIPDB category IDs to names
 */
function getCategoryNames(categoryIds) {
    const categories = {
        1: 'DNS Compromise',
        2: 'DNS Poisoning',
        3: 'Fraud Orders',
        4: 'DDoS Attack',
        5: 'FTP Brute-Force',
        6: 'Ping of Death',
        7: 'Phishing',
        8: 'Fraud VoIP',
        9: 'Open Proxy',
        10: 'Web Spam',
        11: 'Email Spam',
        12: 'Blog Spam',
        13: 'VPN IP',
        14: 'Port Scan',
        15: 'Hacking',
        16: 'SQL Injection',
        17: 'Spoofing',
        18: 'Brute-Force',
        19: 'Bad Web Bot',
        20: 'Exploited Host',
        21: 'Web App Attack',
        22: 'SSH',
        23: 'IoT Targeted'
    };
    
    if (!categoryIds || !Array.isArray(categoryIds)) return [];
    return [...new Set(categoryIds)].map(id => categories[id] || `Category ${id}`);
}

/**
 * Calculate aggregated threat score from multiple providers
 */
function calculateAggregatedScore(results) {
    const scores = [];
    const weights = {
        'AbuseIPDB': 1.0,
        'VirusTotal': 1.2,
        'AlienVault OTX': 0.8,
        'GreyNoise': 0.7,
        'IPQualityScore': 0.9
    };
    
    if (results.abuseipdb?.available && results.abuseipdb.score !== undefined) {
        scores.push({ score: results.abuseipdb.score, weight: weights['AbuseIPDB'] });
    }
    
    if (results.virustotal?.available && results.virustotal.score !== undefined) {
        scores.push({ score: results.virustotal.score, weight: weights['VirusTotal'] });
    }
    
    if (results.otx?.available && results.otx.pulseCount !== undefined) {
        // Convert pulse count to a score (more pulses = higher threat)
        const otxScore = Math.min(results.otx.pulseCount * 10, 100);
        scores.push({ score: otxScore, weight: weights['AlienVault OTX'] });
    }
    
    if (results.greynoise?.available) {
        let gnScore = 0;
        if (results.greynoise.classification === 'malicious') gnScore = 90;
        else if (results.greynoise.noise) gnScore = 50;
        else if (results.greynoise.riot) gnScore = 0; // Known benign
        scores.push({ score: gnScore, weight: weights['GreyNoise'] });
    }
    
    if (results.ipqualityscore?.available && results.ipqualityscore.fraudScore !== undefined) {
        scores.push({ score: results.ipqualityscore.fraudScore, weight: weights['IPQualityScore'] });
    }
    
    if (scores.length === 0) return 0;
    
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    const weightedSum = scores.reduce((sum, s) => sum + (s.score * s.weight), 0);
    
    return Math.round(weightedSum / totalWeight);
}

// ============================================
// IP REPUTATION LOOKUP - MULTI-PROVIDER
// ============================================

/**
 * GET /threat-intel/lookup/:ip
 * Look up IP reputation from multiple sources
 */
router.get('/lookup/:ip', async (req, res) => {
    const { ip } = req.params;
    const { providers } = req.query; // Optional: comma-separated list of providers
    
    if (!isValidIP(ip)) {
        return res.status(400).json({ error: 'Invalid IP address format' });
    }

    try {
        // Determine which providers to query
        const requestedProviders = providers 
            ? providers.split(',').map(p => p.trim().toLowerCase())
            : ['abuseipdb', 'virustotal', 'otx', 'greynoise', 'ipqualityscore', 'shodan'];
        
        // Run all provider checks in parallel
        const providerPromises = {};
        
        if (requestedProviders.includes('abuseipdb')) {
            providerPromises.abuseipdb = checkAbuseIPDB(ip);
        }
        if (requestedProviders.includes('virustotal')) {
            providerPromises.virustotal = checkVirusTotal(ip);
        }
        if (requestedProviders.includes('otx')) {
            providerPromises.otx = checkAlienVaultOTX(ip);
        }
        if (requestedProviders.includes('greynoise')) {
            providerPromises.greynoise = checkGreyNoise(ip);
        }
        if (requestedProviders.includes('shodan')) {
            providerPromises.shodan = checkShodan(ip);
        }
        if (requestedProviders.includes('ipqualityscore')) {
            providerPromises.ipqualityscore = checkIPQualityScore(ip);
        }
        
        // Wait for all providers
        const providerKeys = Object.keys(providerPromises);
        const providerResults = await Promise.all(Object.values(providerPromises));
        
        const results = {};
        providerKeys.forEach((key, idx) => {
            results[key] = providerResults[idx];
        });
        
        // Check local database
        const localIOC = await IOC.findOne({ where: { type: 'ip', value: ip } });
        const blockedEntry = await BlockedIP.findOne({ where: { ip, active: true } });
        
        // Calculate aggregated score
        const aggregatedScore = calculateAggregatedScore(results);
        
        // Determine overall reputation
        let reputation = 'clean';
        if (aggregatedScore >= 70) reputation = 'malicious';
        else if (aggregatedScore >= 40) reputation = 'suspicious';
        else if (aggregatedScore >= 20) reputation = 'low_risk';
        
        // Collect all categories/tags
        const allCategories = [];
        if (results.abuseipdb?.available && results.abuseipdb.categories) {
            allCategories.push(...getCategoryNames(results.abuseipdb.categories));
        }
        if (results.greynoise?.available && results.greynoise.classification) {
            allCategories.push(`GreyNoise: ${results.greynoise.classification}`);
        }
        if (results.ipqualityscore?.available) {
            if (results.ipqualityscore.isProxy) allCategories.push('Proxy');
            if (results.ipqualityscore.isVPN) allCategories.push('VPN');
            if (results.ipqualityscore.isTor) allCategories.push('Tor');
            if (results.ipqualityscore.isBot) allCategories.push('Bot');
        }
        
        // Get best available geo info
        const country = results.abuseipdb?.country || results.virustotal?.country || 
                       results.otx?.country || results.ipqualityscore?.country || 'Unknown';
        const isp = results.abuseipdb?.isp || results.shodan?.isp || 
                   results.ipqualityscore?.isp || 'Unknown';
        
        res.json({
            ip,
            reputation,
            aggregatedScore,
            country,
            isp,
            categories: [...new Set(allCategories)],
            isBlocked: blockedEntry !== null,
            isInLocalDB: localIOC !== null,
            providers: results,
            // Summary stats
            summary: {
                providersQueried: providerKeys.length,
                providersResponded: Object.values(results).filter(r => r.available).length,
                highestScore: Math.max(...Object.values(results).filter(r => r.available && r.score !== undefined).map(r => r.score), 0)
            }
        });
    } catch (error) {
        console.error('[ThreatIntel] Multi-provider lookup error:', error);
        res.status(500).json({ error: 'Failed to lookup IP reputation' });
    }
});

/**
 * GET /threat-intel/lookup/:ip/quick
 * Quick lookup - only AbuseIPDB (faster, for bulk operations)
 */
router.get('/lookup/:ip/quick', async (req, res) => {
    const { ip } = req.params;
    
    if (!isValidIP(ip)) {
        return res.status(400).json({ error: 'Invalid IP address format' });
    }

    try {
        const abuseResult = await checkAbuseIPDB(ip);
        const blockedEntry = await BlockedIP.findOne({ where: { ip, active: true } });

        if (!abuseResult.available) {
            // Return mock data if no API key
            return res.json({
                ip,
                reputation: Math.random() > 0.5 ? 'suspicious' : 'clean',
                score: Math.floor(Math.random() * 100),
                country: 'US',
                isp: 'Example ISP',
                reports: Math.floor(Math.random() * 50),
                isBlocked: blockedEntry !== null,
                mock: true
            });
        }

        res.json({
            ip,
            reputation: abuseResult.score > 50 ? 'malicious' : abuseResult.score > 20 ? 'suspicious' : 'clean',
            score: abuseResult.score,
            country: abuseResult.country,
            isp: abuseResult.isp,
            reports: abuseResult.reports,
            categories: getCategoryNames(abuseResult.categories),
            isBlocked: blockedEntry !== null,
            lastReported: abuseResult.lastReported
        });
    } catch (error) {
        console.error('[ThreatIntel] Quick lookup error:', error);
        res.status(500).json({ error: 'Failed to lookup IP' });
    }
});

/**
 * GET /threat-intel/providers
 * Get status of all configured providers
 */
router.get('/providers', async (req, res) => {
    const providers = [
        {
            id: 'abuseipdb',
            name: 'AbuseIPDB',
            description: 'IP abuse reports from the community',
            website: 'https://www.abuseipdb.com/',
            configured: !!process.env.ABUSEIPDB_API_KEY,
            freeLimit: '1,000 checks/day'
        },
        {
            id: 'virustotal',
            name: 'VirusTotal',
            description: 'Multi-antivirus IP/URL/file scanning',
            website: 'https://www.virustotal.com/',
            configured: !!process.env.VIRUSTOTAL_API_KEY,
            freeLimit: '4 requests/minute, 500/day'
        },
        {
            id: 'otx',
            name: 'AlienVault OTX',
            description: 'Open Threat Exchange community intel',
            website: 'https://otx.alienvault.com/',
            configured: !!process.env.OTX_API_KEY,
            freeLimit: 'Unlimited (rate limited)'
        },
        {
            id: 'greynoise',
            name: 'GreyNoise',
            description: 'Internet scanner and noise detection',
            website: 'https://www.greynoise.io/',
            configured: true, // Community API works without key
            freeLimit: '100 queries/day (Community)'
        },
        {
            id: 'shodan',
            name: 'Shodan',
            description: 'Internet device and port scanning data',
            website: 'https://www.shodan.io/',
            configured: !!process.env.SHODAN_API_KEY,
            freeLimit: '100 queries/month'
        },
        {
            id: 'ipqualityscore',
            name: 'IPQualityScore',
            description: 'Fraud detection and proxy/VPN detection',
            website: 'https://www.ipqualityscore.com/',
            configured: !!process.env.IPQUALITYSCORE_API_KEY,
            freeLimit: '5,000 lookups/month'
        }
    ];
    
    res.json(providers);
});

// ============================================
// IOC MANAGEMENT
// ============================================

/**
 * GET /threat-intel/iocs
 * Get all IOCs with pagination and filtering
 */
router.get('/iocs', async (req, res) => {
    const { page = 1, limit = 50, type, severity } = req.query;
    
    try {
        const where = {};
        if (type) where.type = type;
        if (severity) where.severity = severity;
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        const { count, rows } = await IOC.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset,
            order: [['createdAt', 'DESC']]
        });

        res.json({
            iocs: rows,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit))
        });
    } catch (error) {
        console.error('[ThreatIntel] Get IOCs error:', error);
        res.status(500).json({ error: 'Failed to fetch IOCs' });
    }
});

/**
 * POST /threat-intel/iocs
 * Add a new IOC
 */
router.post('/iocs', async (req, res) => {
    const { type, value, threat, severity, source, confidence } = req.body;
    
    if (!type || !value) {
        return res.status(400).json({ error: 'Type and value are required' });
    }

    try {
        // Check if IOC already exists
        const existing = await IOC.findOne({ where: { type, value } });
        if (existing) {
            // Update last seen
            existing.lastSeen = new Date();
            await existing.save();
            return res.json({ message: 'IOC updated', ioc: existing });
        }

        const ioc = await IOC.create({
            type,
            value,
            threat,
            severity: severity || 'medium',
            source,
            confidence: confidence || 50,
            firstSeen: new Date(),
            lastSeen: new Date()
        });
        
        res.status(201).json({ message: 'IOC created', ioc });
    } catch (error) {
        console.error('[ThreatIntel] Create IOC error:', error);
        res.status(500).json({ error: 'Failed to create IOC' });
    }
});

/**
 * DELETE /threat-intel/iocs/:id
 * Delete an IOC
 */
router.delete('/iocs/:id', async (req, res) => {
    try {
        const deleted = await IOC.destroy({ where: { id: req.params.id } });
        if (deleted === 0) {
            return res.status(404).json({ error: 'IOC not found' });
        }
        res.json({ message: 'IOC deleted' });
    } catch (error) {
        console.error('[ThreatIntel] Delete IOC error:', error);
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
        const blockedIPs = await BlockedIP.findAll({
            where: { active: true },
            order: [['createdAt', 'DESC']]
        });
        
        res.json(blockedIPs);
    } catch (error) {
        console.error('[ThreatIntel] Get blocked IPs error:', error);
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

    if (!isValidIP(ip)) {
        return res.status(400).json({ error: 'Invalid IP address format' });
    }

    if (isPrivateIP(ip)) {
        return res.status(400).json({ error: 'Cannot block private/internal IP addresses' });
    }

    try {
        // Check if already blocked
        const existing = await BlockedIP.findOne({ where: { ip } });
        if (existing) {
            if (existing.active) {
                return res.status(409).json({ error: 'IP is already blocked' });
            }
            // Reactivate
            existing.active = true;
            existing.reason = reason || existing.reason;
            await existing.save();
        } else {
            await BlockedIP.create({
                ip,
                reason: reason || 'Manual block',
                source: autoBlocked ? 'auto' : 'manual',
                autoBlocked
            });
        }
        
        // Add iptables rule (optional - only on Linux)
        if (process.platform === 'linux') {
            try {
                await addIptablesBlock(ip);
            } catch (iptablesError) {
                console.error('[ThreatIntel] iptables error:', iptablesError);
                // Continue anyway - IP is blocked in database
            }
        }
        
        res.status(201).json({ message: `IP ${ip} blocked successfully` });
    } catch (error) {
        console.error('[ThreatIntel] Block IP error:', error);
        res.status(500).json({ error: 'Failed to block IP' });
    }
});

/**
 * DELETE /threat-intel/block/:ip
 * Unblock an IP address
 */
router.delete('/block/:ip', async (req, res) => {
    const { ip } = req.params;
    
    if (!isValidIP(ip)) {
        return res.status(400).json({ error: 'Invalid IP address format' });
    }
    
    try {
        const result = await BlockedIP.update(
            { active: false },
            { where: { ip } }
        );
        
        if (result[0] === 0) {
            return res.status(404).json({ error: 'IP not found in block list' });
        }
        
        // Remove iptables rule (optional - only on Linux)
        if (process.platform === 'linux') {
            try {
                await removeIptablesBlock(ip);
            } catch (iptablesError) {
                console.error('[ThreatIntel] iptables removal error:', iptablesError);
            }
        }
        
        res.json({ message: `IP ${ip} unblocked successfully` });
    } catch (error) {
        console.error('[ThreatIntel] Unblock IP error:', error);
        res.status(500).json({ error: 'Failed to unblock IP' });
    }
});

/**
 * Add iptables DROP rule for IP
 */
function addIptablesBlock(ip) {
    return new Promise((resolve, reject) => {
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
        let feeds = await ThreatFeed.findAll();
        
        // If no feeds exist, create default ones based on configured API keys
        if (feeds.length === 0) {
            const defaultFeeds = [
                { 
                    name: 'AbuseIPDB', 
                    description: 'IP address abuse reports', 
                    status: process.env.ABUSEIPDB_API_KEY ? 'active' : 'inactive',
                    url: 'https://api.abuseipdb.com'
                },
                { 
                    name: 'VirusTotal', 
                    description: 'Malware and URL scanning', 
                    status: process.env.VIRUSTOTAL_API_KEY ? 'active' : 'inactive',
                    url: 'https://www.virustotal.com'
                },
                { 
                    name: 'AlienVault OTX', 
                    description: 'Open Threat Exchange pulses', 
                    status: process.env.OTX_API_KEY ? 'active' : 'inactive',
                    url: 'https://otx.alienvault.com'
                },
                { 
                    name: 'GreyNoise', 
                    description: 'Internet noise detection', 
                    status: 'active', // Community API works without key
                    url: 'https://www.greynoise.io'
                },
                { 
                    name: 'Shodan', 
                    description: 'Internet device scanning', 
                    status: process.env.SHODAN_API_KEY ? 'active' : 'inactive',
                    url: 'https://www.shodan.io'
                },
                { 
                    name: 'IPQualityScore', 
                    description: 'Fraud and proxy detection', 
                    status: process.env.IPQUALITYSCORE_API_KEY ? 'active' : 'inactive',
                    url: 'https://www.ipqualityscore.com'
                }
            ];
            
            feeds = await ThreatFeed.bulkCreate(defaultFeeds);
        }
        
        res.json(feeds);
    } catch (error) {
        console.error('[ThreatIntel] Get feeds error:', error);
        res.status(500).json({ error: 'Failed to fetch feeds' });
    }
});

/**
 * PUT /threat-intel/feeds/:id
 * Update a threat feed
 */
router.put('/feeds/:id', async (req, res) => {
    const { id } = req.params;
    const { status, apiKey, syncInterval } = req.body;
    
    try {
        const feed = await ThreatFeed.findByPk(id);
        if (!feed) {
            return res.status(404).json({ error: 'Feed not found' });
        }
        
        if (status) feed.status = status;
        if (apiKey) feed.apiKey = apiKey;
        if (syncInterval) feed.syncInterval = syncInterval;
        
        await feed.save();
        res.json(feed);
    } catch (error) {
        console.error('[ThreatIntel] Update feed error:', error);
        res.status(500).json({ error: 'Failed to update feed' });
    }
});

/**
 * POST /threat-intel/feeds/:id/sync
 * Manually sync a threat feed
 */
router.post('/feeds/:id/sync', async (req, res) => {
    const { id } = req.params;
    
    try {
        const feed = await ThreatFeed.findByPk(id);
        if (!feed) {
            return res.status(404).json({ error: 'Feed not found' });
        }
        
        // Update last sync time
        feed.lastSync = new Date();
        await feed.save();
        
        res.json({ message: 'Feed sync initiated', feed });
    } catch (error) {
        console.error('[ThreatIntel] Sync feed error:', error);
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
        const totalIOCs = await IOC.count();
        const blockedCount = await BlockedIP.count({ where: { active: true } });
        const activeFeeds = await ThreatFeed.count({ where: { status: 'active' } });
        
        // Get last sync time from any feed
        const lastSyncedFeed = await ThreatFeed.findOne({
            where: { lastSync: { [require('sequelize').Op.ne]: null } },
            order: [['lastSync', 'DESC']]
        });
        
        // Count configured providers
        const configuredProviders = [
            process.env.ABUSEIPDB_API_KEY,
            process.env.VIRUSTOTAL_API_KEY,
            process.env.OTX_API_KEY,
            process.env.GREYNOISE_API_KEY,
            process.env.SHODAN_API_KEY,
            process.env.IPQUALITYSCORE_API_KEY
        ].filter(Boolean).length + 1; // +1 for GreyNoise community
        
        res.json({
            totalIOCs,
            blockedIPs: blockedCount,
            activeFeeds,
            configuredProviders,
            totalProviders: 6,
            lastUpdate: lastSyncedFeed?.lastSync || null
        });
    } catch (error) {
        console.error('[ThreatIntel] Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
