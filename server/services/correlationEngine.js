const { Op } = require("sequelize");
const CorrelationRule = require("../models/CorrelationRule");
const Incident = require("../models/Incident");
const Evidence = require("../models/Evidence");
const IncidentEvent = require("../models/IncidentEvent");

class CorrelationEngine {
    constructor() {
        this.rules = [];
        this.eventsCache = []; // Rolling window of events
        this.lastTriggered = new Map(); // Keep track of cooldowns: Map<RuleID+Key, Timestamp>
        this.MAX_CACHE_AGE_MS = 60 * 60 * 1000; // 1 hour max cache to prevent memory leak
        this.isRunning = false;
    }

    async init() {
        await this.reloadRules();
        this.isRunning = true;
        
        // Cleanup stale events every minute
        setInterval(() => this.cleanupCache(), 60000);
        console.log(`[Correlation Engine] Initialized with ${this.rules.length} active rules.`);
    }

    async reloadRules() {
        try {
            this.rules = await CorrelationRule.findAll({ where: { enabled: true } });
        } catch (e) {
            console.error("[Correlation Engine] Error loading rules:", e);
        }
    }

    cleanupCache() {
        const threshold = Date.now() - this.MAX_CACHE_AGE_MS;
        this.eventsCache = this.eventsCache.filter(e => e.receivedAt >= threshold);
    }

    /**
     * Ingest an event (Alert, Zeek connection, DNS)
     * e.g., type: 'suricata_alert', data: { src_ip, dest_ip, signature, ... }
     */
    async processEvent(type, data) {
        if (!this.isRunning) return;

        const event = {
            id: reqId(),
            type,
            data,
            receivedAt: Date.now()
        };

        this.eventsCache.push(event);

        // Evaluate rules
        for (const rule of this.rules) {
            try {
                await this.evaluateRule(rule, event);
            } catch (err) {
                console.error(`[Correlation Engine] Error evaluating rule ${rule.id}:`, err);
            }
        }
    }

    async evaluateRule(rule, newEvent) {
        // Very basic implementation:
        // We evaluate primarily 'threshold' and 'unique_threshold' rules against the new event
        
        const conds = rule.conditions;
        
        // 1. Check if the new event matches the rule's target type (e.g. 'suricata_alert')
        if (conds.eventType && conds.eventType !== newEvent.type) return;

        // 2. Filter cache for events in the time window matching the condition
        const windowStart = Date.now() - (rule.windowSeconds * 1000);
        const windowEvents = this.eventsCache.filter(e => 
            e.receivedAt >= windowStart && 
            (!conds.eventType || e.type === conds.eventType)
        );

        let isMatch = false;
        let matchContext = {};
        
        // Quick rule evaluation logic (simplified for the POC)
        if (rule.ruleType === "threshold") {
            // e.g. Count >= N where filter matches
            const matchingEvents = windowEvents.filter(e => this.matchFilter(e.data, conds.filter));
            if (matchingEvents.length >= conds.threshold) {
                isMatch = true;
                matchContext = { events: matchingEvents, count: matchingEvents.length };
            }
        } else if (rule.ruleType === "unique_threshold") {
            // e.g. Port scan: N unique dest_ports from same src_ip
            if (this.matchFilter(newEvent.data, conds.filter)) {
                const groupByField = conds.groupBy; // e.g. 'src_ip'
                const selectField = conds.uniqueField; // e.g. 'dest_port'
                
                const groupVal = newEvent.data[groupByField];
                if (!groupVal) return;

                const matchingEvents = windowEvents.filter(e => this.matchFilter(e.data, conds.filter) && e.data[groupByField] === groupVal);
                const uniqueValues = new Set(matchingEvents.map(e => e.data[selectField]));
                
                if (uniqueValues.size >= conds.threshold) {
                    isMatch = true;
                    matchContext = { events: matchingEvents, count: uniqueValues.size, groupVal };
                }
            }
        }

        if (isMatch) {
            await this.triggerRule(rule, matchContext);
        }
    }

    matchFilter(data, filter) {
        if (!filter) return true;
        // Simple key-value exact match
        for (const [k, v] of Object.entries(filter)) {
            if (data[k] !== v) return false;
        }
        return true;
    }

    async triggerRule(rule, context) {
        const cooldownKey = `${rule.id}-${context.groupVal || 'global'}`;
        const lastTrigger = this.lastTriggered.get(cooldownKey) || 0;
        
        if (Date.now() - lastTrigger < (rule.cooldownSeconds * 1000)) {
            return; // In cooldown
        }

        this.lastTriggered.set(cooldownKey, Date.now());

        // Update rule stats
        rule.matchCount += 1;
        rule.lastMatchAt = new Date();
        await rule.save();

        console.log(`[Correlation Engine] 🚨 Rule Triggered: ${rule.name}`);

        if (rule.actions.includes("create_incident")) {
            await this.createIncidentFromCorrelation(rule, context);
        }
    }

    async createIncidentFromCorrelation(rule, context) {
        try {
            const title = `[Correlation] ${rule.name}` + (context.groupVal ? ` on ${context.groupVal}` : "");
            const description = `${rule.description}\n\nTriggered by matching ${context.count} events within ${rule.windowSeconds} seconds.`;

            // Auto-calculate priority from severity
            const priority = {
                critical: "P1",
                high: "P2",
                medium: "P3",
                low: "P4",
                info: "P4",
            }[rule.severity] || "P3";

            // SLA helper inline
            const slaHours = { critical: 1, high: 4, medium: 24, low: 72, info: 168 };
            const hours = slaHours[rule.severity] || 24;
            const slaDeadline = new Date(Date.now() + hours * 60 * 60 * 1000);

            const incident = await Incident.create({
                title,
                description,
                severity: rule.severity,
                priority,
                category: rule.category || "other",
                source: "correlation",
                sourceRef: `rule-${rule.id}`,
                slaDeadline
            });

            await IncidentEvent.create({
                incidentId: incident.id,
                type: "created",
                actor: "system",
                message: `Incident auto-created by Correlation Rule: ${rule.name}`
            });

            // Attach evidence (up to 10 events)
            const sampleEvents = (context.events || []).slice(0, 10);
            if (sampleEvents.length > 0) {
                await Evidence.create({
                    incidentId: incident.id,
                    type: "log",
                    title: `Correlated Events Sample (${sampleEvents.length}/${context.events.length})`,
                    content: JSON.stringify(sampleEvents.map(e => e.data), null, 2),
                    addedBy: "correlation_engine"
                });
            }

            // Also broadcast a WebSocket event if needed
            const { broadcast } = require("../util/websocket");
            broadcast({ type: "new_incident", data: incident });

        } catch (error) {
            console.error("[Correlation Engine] Error creating incident:", error);
        }
    }
}

function reqId() {
    return Math.random().toString(36).substr(2, 9);
}

// Singleton pattern
const engine = new CorrelationEngine();
module.exports = engine;
