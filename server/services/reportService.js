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
        const totalAlerts = await Alert.count({ where: { createdAt: { [Op.gte]: sinceDate } } });
        
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
                [fn("DATE_FORMAT", col("createdAt"), timeFormat), "time"],
                "severity",
                [fn("COUNT", col("id")), "count"]
            ],
            where: { createdAt: { [Op.gte]: sinceDate } },
            group: [literal(`DATE_FORMAT(createdAt, '${timeFormat}')`), "severity"],
            order: [[literal("time"), "ASC"]],
            raw: true
        });

        // 3. Top Offenders
        const topSourceIps = await Alert.findAll({
            attributes: [
                "src_ip",
                [fn("COUNT", col("id")), "count"]
            ],
            where: { createdAt: { [Op.gte]: sinceDate } },
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
            where: { createdAt: { [Op.gte]: sinceDate } },
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
            where: { createdAt: { [Op.gte]: sinceDate } },
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
            where: { createdAt: { [Op.gte]: sinceDate } },
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
}

module.exports = new ReportService();
