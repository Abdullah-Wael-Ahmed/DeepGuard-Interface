const { Op, fn, col, literal } = require("sequelize");
const axios = require("axios");
const Alert = require("../models/Alert");
const ZeekConnection = require("../models/ZeekConnection");
const Incident = require("../models/Incident");

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
}

module.exports = new ReportService();
