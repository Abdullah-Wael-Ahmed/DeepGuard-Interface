const { Op, fn, col, literal } = require("sequelize");
const axios = require("axios");
const Alert = require("../models/Alert");
const ZeekConnection = require("../models/ZeekConnection");
const Incident = require("../models/Incident");
const { queryVelociraptor } = require("../util/velociraptorUtils");

const ANOMALY_BASE = "http://deepguard-anomaly:5001";

class ReportService {
    /**
     * Get data for the Executive Security Summary
     * @param {number} hours - Time window in hours
     */
    async getExecutiveSummary(hours = 24) {
        const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000);

        // 1. Global Metrics
        const totalAlerts = await Alert.count({ where: { timestamp: { [Op.gte]: sinceDate } } });
        
        let totalAnomalies = 0;
        try {
            const anomalyRes = await axios.get(`${ANOMALY_BASE}/results`, { timeout: 5000 });
            if (anomalyRes.data?.results) {
                // Filter anomalies by time if the anomaly data has a timestamp, otherwise just use count
                // Assuming anomaly detector returns recent anomalies
                const anomalies = anomalyRes.data.results.filter(a => a.is_anomaly);
                totalAnomalies = anomalies.length;
            }
        } catch (error) {
            console.error("Error fetching anomalies for report:", error.message);
        }

        // 2. Threat Trends (Group by Date and Severity)
        // Grouping by hour or day depending on the requested window
        const timeFormat = hours <= 48 ? "%Y-%m-%d %H:00:00" : "%Y-%m-%d";
        
        const trends = await Alert.findAll({
            attributes: [
                [fn("DATE_FORMAT", col("timestamp"), timeFormat), "time"],
                "severity",
                [fn("COUNT", col("id")), "count"]
            ],
            where: { timestamp: { [Op.gte]: sinceDate } },
            group: [literal(`DATE_FORMAT(timestamp, '${timeFormat}')`), "severity"],
            order: [[literal("time"), "ASC"]],
            raw: true
        });

        // 3. Top Offenders
        const topSourceIps = await Alert.findAll({
            attributes: [
                "src_ip",
                [fn("COUNT", col("id")), "count"]
            ],
            where: { timestamp: { [Op.gte]: sinceDate } },
            group: ["src_ip"],
            order: [[literal("count"), "DESC"]],
            limit: 5,
            raw: true
        });

        const topDestIps = await Alert.findAll({
            attributes: [
                "dest_ip",
                [fn("COUNT", col("id")), "count"]
            ],
            where: { timestamp: { [Op.gte]: sinceDate } },
            group: ["dest_ip"],
            order: [[literal("count"), "DESC"]],
            limit: 5,
            raw: true
        });

        const topSignatures = await Alert.findAll({
            attributes: [
                "signature",
                [fn("COUNT", col("id")), "count"]
            ],
            where: { timestamp: { [Op.gte]: sinceDate } },
            group: ["signature"],
            order: [[literal("count"), "DESC"]],
            limit: 5,
            raw: true
        });

        // Calculate a pseudo mean risk score for the network based on incident severity
        const activeIncidents = await Incident.findAll({
            where: { 
                createdAt: { [Op.gte]: sinceDate },
                status: { [Op.notIn]: ["closed", "remediated"] }
            },
            attributes: ["severity"],
            raw: true
        });

        let riskScoreSum = 0;
        const severityWeights = { critical: 10, high: 7, medium: 4, low: 2, info: 1 };
        
        activeIncidents.forEach(inc => {
            riskScoreSum += severityWeights[inc.severity] || 0;
        });
        
        const meanRiskScore = activeIncidents.length > 0 
            ? Math.min(10, Math.round((riskScoreSum / activeIncidents.length) * 10) / 10) 
            : 0;

        return {
            timeRange: { hours, since: sinceDate.toISOString() },
            metrics: {
                totalThreats: totalAlerts,
                totalAnomalies: totalAnomalies,
                meanRiskScore: meanRiskScore,
                activeIncidentsCount: activeIncidents.length
            },
            trends: trends,
            topOffenders: {
                sourceIps: topSourceIps,
                destIps: topDestIps,
                signatures: topSignatures
            }
        };
    }

    /**
     * Get data for the Endpoint Fleet Health template
     */
    async getEndpointHealth(hours = 24) {
        const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000);

        // 1. Agent Status & OS Breakdown
        let clients = [];
        try {
            const data = await queryVelociraptor('SELECT client_id, os_info, labels, last_seen_at FROM clients()');
            if (data.Responses && data.Responses.length > 0) {
                clients = data.Responses[0].Response || [];
                if (typeof clients === 'string') {
                    try { clients = JSON.parse(clients); } 
                    catch (e) { clients = clients.split('\\n').filter(l => l.trim()).map(l => JSON.parse(l)); }
                }
            }
        } catch (error) {
            console.error("Error fetching Velociraptor clients for report:", error.message);
        }

        const agentStatus = { online: 0, offline: 0 };
        const osBreakdown = { Windows: 0, Linux: 0, macOS: 0, Other: 0 };

        // Define "online" as seen within the last 15 minutes (or 24 hours depending on needs, using 1 hour here)
        const onlineThreshold = Date.now() - (60 * 60 * 1000);

        clients.forEach(c => {
            // Check online status
            // last_seen_at might be in microseconds or seconds. Usually microseconds in VQL, or ISO string.
            // Assuming it's microseconds since epoch if numeric, or standard date
            let lastSeen = 0;
            if (typeof c.last_seen_at === 'number') {
                lastSeen = c.last_seen_at > 1e12 ? c.last_seen_at / 1000 : c.last_seen_at * 1000;
            } else if (typeof c.last_seen_at === 'string') {
                lastSeen = new Date(c.last_seen_at).getTime();
            }
            
            if (lastSeen > onlineThreshold) agentStatus.online++;
            else agentStatus.offline++;

            // Check OS
            const os = (c.os_info?.system || '').toLowerCase();
            if (os.includes('windows')) osBreakdown.Windows++;
            else if (os.includes('linux')) osBreakdown.Linux++;
            else if (os.includes('darwin') || os.includes('mac')) osBreakdown.macOS++;
            else osBreakdown.Other++;
        });

        // 2. Active Response Audit (Hunts)
        let hunts = [];
        try {
            const huntData = await queryVelociraptor('SELECT * FROM hunts() ORDER BY create_time DESC LIMIT 50');
            if (huntData.Responses && huntData.Responses.length > 0) {
                hunts = huntData.Responses[0].Response || [];
                if (typeof hunts === 'string') {
                    try { hunts = JSON.parse(hunts); } 
                    catch (e) { hunts = hunts.split('\\n').filter(l => l.trim()).map(l => JSON.parse(l)); }
                }
            }
        } catch (error) {
            console.error("Error fetching Velociraptor hunts for report:", error.message);
        }

        const auditLog = hunts.map(h => {
            let timestamp = h.create_time;
            if (typeof timestamp === 'number') timestamp = timestamp > 1e12 ? timestamp / 1000 : timestamp * 1000;
            
            return {
                timestamp: new Date(timestamp).toISOString(),
                analystId: h.creator || 'System',
                description: h.description || 'Unknown Action',
                state: h.state
            };
        });

        // 3. High-Risk Assets (Calculate risk based on Suricata alerts)
        // Group alerts by src_ip
        const riskData = await Alert.findAll({
            attributes: [
                'src_ip',
                [fn('COUNT', col('id')), 'totalAlerts'],
                [fn('SUM', literal('CASE WHEN severity = 1 THEN 3 WHEN severity = 2 THEN 1.5 ELSE 0.5 END')), 'riskScore']
            ],
            where: { timestamp: { [Op.gte]: sinceDate } },
            group: ['src_ip'],
            having: literal('riskScore > 7'),
            order: [[literal('riskScore'), 'DESC']],
            limit: 10,
            raw: true
        });

        const highRiskAssets = riskData.map(r => ({
            ip: r.src_ip,
            riskScore: Math.min(10, Math.round(r.riskScore * 10) / 10), // Cap at 10
            totalAlerts: r.totalAlerts
        }));

        return {
            timeRange: { hours, since: sinceDate.toISOString() },
            agentStatus,
            osBreakdown,
            auditLog,
            highRiskAssets
        };
    }

    /**
     * Get data for the Incident Post-Mortem template
     */
    async getIncidentPostMortem(ip, hours = 24) {
        const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000);

        // If no IP is provided, find the most critical active IP in the timeframe
        let targetIp = ip;
        if (!targetIp) {
            const topAlert = await Alert.findOne({
                attributes: ['src_ip'],
                where: { timestamp: { [Op.gte]: sinceDate } },
                order: [['severity', 'ASC'], ['timestamp', 'DESC']], // 1 is critical
                raw: true
            });
            targetIp = topAlert ? topAlert.src_ip : '10.0.0.5'; // fallback
        }

        // 1. Fetch Timeline Data (Suricata, Zeek, Anomalies)
        const alerts = await Alert.findAll({
            where: {
                [Op.or]: [{ src_ip: targetIp }, { dest_ip: targetIp }],
                timestamp: { [Op.gte]: sinceDate }
            },
            order: [['timestamp', 'DESC']],
            limit: 100,
            raw: true
        });

        const zeekConnections = await ZeekConnection.findAll({
            where: {
                [Op.or]: [{ id_orig_h: targetIp }, { id_resp_h: targetIp }],
                timestamp: { [Op.gte]: sinceDate }
            },
            order: [['timestamp', 'DESC']],
            limit: 100,
            raw: true
        });

        let anomalies = [];
        try {
            const anomalyRes = await axios.get(`${ANOMALY_BASE}/results`, { timeout: 5000 });
            if (anomalyRes.data?.results) {
                anomalies = anomalyRes.data.results.filter(r => r.src_ip === targetIp || r.dest_ip === targetIp);
            }
        } catch (e) {
            console.error("Error fetching anomalies:", e.message);
        }

        // Merge into a single chronological timeline
        const timeline = [];
        alerts.forEach(a => timeline.push({
            id: `alert-${a.id}`,
            timestamp: new Date(a.timestamp).getTime(),
            type: 'suricata',
            title: a.signature,
            severity: a.severity,
            source: a.src_ip,
            dest: a.dest_ip,
            details: `Port: ${a.dest_port}, Protocol: ${a.protocol}`
        }));

        zeekConnections.forEach(c => timeline.push({
            id: `zeek-${c.id}`,
            timestamp: new Date(c.timestamp).getTime(),
            type: 'zeek',
            title: `Connection to ${c.id_resp_h}`,
            severity: 4, // Info
            source: c.id_orig_h,
            dest: c.id_resp_h,
            details: `Port: ${c.id_resp_p}, Protocol: ${c.proto}, Service: ${c.service || 'unknown'}`
        }));

        anomalies.forEach((a, i) => timeline.push({
            id: `anomaly-${i}`,
            timestamp: a.timestamp ? new Date(a.timestamp).getTime() : Date.now(),
            type: 'anomaly',
            title: `ML Anomaly: ${a.type || 'Behavioral Deviation'}`,
            severity: a.severity === 'HIGH' ? 2 : 3,
            source: a.src_ip,
            dest: a.dest_ip,
            details: `Confidence: ${Math.round(a.score * 100)}%, Flow bytes: ${a.bytes || 'N/A'}`
        }));

        // Sort descending (newest first)
        timeline.sort((a, b) => b.timestamp - a.timestamp);

        // 2. Compute Risk Score for this IP
        const criticalAlerts = alerts.filter(a => a.severity === 1).length;
        const highAlerts = alerts.filter(a => a.severity === 2).length;
        const mediumAlerts = alerts.filter(a => a.severity === 3).length;
        const anomalyCount = anomalies.filter(a => a.is_anomaly).length;

        let riskScore = 0;
        riskScore += Math.min(criticalAlerts * 3, 4);
        riskScore += Math.min(highAlerts * 1.5, 2);
        riskScore += Math.min(mediumAlerts * 0.5, 1);
        riskScore += Math.min(anomalyCount * 1, 3);
        riskScore = Math.min(Math.round(riskScore * 10) / 10, 10);

        // 3. Fetch Forensic Evidence (Hunts affecting this IP)
        // Find if this IP is associated with any enrolled Velociraptor client
        let relatedClientId = null;
        let forensicEvidence = [];
        
        try {
            const data = await queryVelociraptor(`SELECT client_id, os_info, last_ip FROM clients()`);
            if (data.Responses && data.Responses.length > 0) {
                let clients = data.Responses[0].Response || [];
                if (typeof clients === 'string') {
                    try { clients = JSON.parse(clients); } 
                    catch (e) { clients = clients.split('\\n').filter(l => l.trim()).map(l => JSON.parse(l)); }
                }
                
                // VQL last_ip often looks like "10.0.0.5:12345" or just "10.0.0.5"
                const matchedClient = clients.find(c => c.last_ip && c.last_ip.includes(targetIp));
                if (matchedClient) {
                    relatedClientId = matchedClient.client_id;
                }
            }

            if (relatedClientId) {
                // Fetch hunts/flows for this client
                const flowData = await queryVelociraptor(`SELECT * FROM flows(client_id='${relatedClientId}') ORDER BY create_time DESC LIMIT 5`);
                if (flowData.Responses && flowData.Responses.length > 0) {
                    let flows = flowData.Responses[0].Response || [];
                    if (typeof flows === 'string') {
                        try { flows = JSON.parse(flows); } 
                        catch (e) { flows = flows.split('\\n').filter(l => l.trim()).map(l => JSON.parse(l)); }
                    }
                    
                    forensicEvidence = flows.map(f => {
                        let ts = f.create_time;
                        if (typeof ts === 'number') ts = ts > 1e12 ? ts / 1000 : ts * 1000;
                        return {
                            timestamp: new Date(ts).toISOString(),
                            artifact: (f.artifacts && f.artifacts.length > 0) ? f.artifacts.join(", ") : 'Generic Collection',
                            state: f.state,
                            flowId: f.flow_id
                        };
                    });
                }
            }
        } catch (error) {
            console.error("Error fetching forensic evidence for post-mortem:", error.message);
        }

        return {
            targetIp,
            timeRange: { hours, since: sinceDate.toISOString() },
            overview: {
                riskScore,
                status: riskScore > 7 ? 'Investigating' : riskScore > 4 ? 'Monitoring' : 'Resolved',
                totalEvents: timeline.length,
                relatedClientId
            },
            timeline: timeline.slice(0, 50), // Send top 50 events for the report
            forensicEvidence
        };
    }

    /**
     * Get data for the DeepGuard AI Anomalies template
     */
    async getAiAnomaliesReport(hours = 24) {
        const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000);
        
        let totalAnalyzed = 0;
        let results = [];
        
        try {
            // Try to get stats from the ML container
            const statsRes = await axios.get(`${ANOMALY_BASE}/stats`, { timeout: 5000 });
            totalAnalyzed = statsRes.data?.total_analyzed || 0;
            
            // If the ML container doesn't return total_analyzed, fallback to total Zeek connections in timeframe
            if (!totalAnalyzed) {
                totalAnalyzed = await ZeekConnection.count({ where: { timestamp: { [Op.gte]: sinceDate } } });
            }

            const anomalyRes = await axios.get(`${ANOMALY_BASE}/results`, { timeout: 5000 });
            if (anomalyRes.data?.results) {
                results = anomalyRes.data.results.filter(a => a.is_anomaly);
            }
        } catch (error) {
            console.error("Error fetching AI anomalies for report:", error.message);
            // Fallback for total analyzed if ML container is completely down
            totalAnalyzed = await ZeekConnection.count({ where: { timestamp: { [Op.gte]: sinceDate } } });
        }

        // 1. ML Performance Metrics
        const metrics = {
            totalAnalyzed,
            totalFlagged: results.length
        };

        // 2. Behavioral Deviations (Bar Chart Data)
        // Group anomalies by description/type
        const deviationMap = {};
        results.forEach(a => {
            const type = a.details || a.type || 'Unknown Behavior';
            deviationMap[type] = (deviationMap[type] || 0) + 1;
        });
        
        // Convert to array and sort descending
        const deviations = Object.keys(deviationMap).map(key => ({
            name: key,
            count: deviationMap[key]
        })).sort((a, b) => b.count - a.count);

        // 3. AI Detections Log (Table)
        const log = results.map(a => {
            // Create a pseudo-timestamp if the ML model doesn't return one directly
            const ts = a.timestamp ? new Date(a.timestamp) : new Date();
            return {
                timestamp: ts.toISOString(),
                srcIp: a.src_ip || 'Unknown',
                destIp: a.dest_ip || 'Unknown',
                score: a.score ? Math.round(a.score * 100) : 85, // Default 85% confidence if missing
                description: a.details || a.type || 'Behavioral Deviation Detected'
            };
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return {
            timeRange: { hours, since: sinceDate.toISOString() },
            metrics,
            deviations: deviations.slice(0, 10), // Send top 10 deviations for the chart
            log: log.slice(0, 100) // Send latest 100 anomalies for the table
        };
    }
}

module.exports = new ReportService();
