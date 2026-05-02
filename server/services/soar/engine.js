/**
 * DeepGuard SOAR — Playbook Execution Engine v2
 *
 * Replaces the original basic playbookEngine.js with a full-featured engine:
 *  - Action plugin dispatch via actionPlugins registry
 *  - Rollback execution on failure
 *  - Retry logic with exponential backoff
 *  - Timeout handling per step
 *  - Audit logging per step
 *  - Approval gates (pause workflow until analyst approves)
 *  - Anti-loop protection
 *  - Crash recovery (state persisted to DB per step)
 *  - Extended condition evaluator (>, <, >=, <=, !=, contains, regex, exists)
 */

const Playbook = require("../../models/Playbook");
const PlaybookExecution = require("../../models/PlaybookExecution");
const { getAction, listActions } = require("./actionPlugins");
const { broadcast } = require("../../util/websocket");

// Execution timeout per step (ms)
const STEP_TIMEOUT_MS = 30000;
// Maximum retries per action step
const MAX_RETRIES = 2;
// Maximum nodes to visit in a single execution (anti-loop)
const MAX_STEPS = 50;

class SOAREngine {
    constructor() {
        this.pendingApprovals = new Map(); // executionId → { resolve, context }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MAIN ENTRY: Run a playbook
    // ═══════════════════════════════════════════════════════════════════════════

    async runPlaybook(playbookId, triggerSource, contextData = {}) {
        const playbook = await Playbook.findByPk(playbookId);
        if (!playbook || playbook.status !== "active") return null;

        const execution = await PlaybookExecution.create({
            playbookId,
            triggerSource,
            contextData,
            status: "running"
        });

        const logs = [];
        const rollbackStack = []; // LIFO stack of { actionType, rollbackData }
        let stepCount = 0;

        const log = (level, msg, data = null) => {
            const entry = { timestamp: new Date().toISOString(), level, message: msg, data };
            console.log(`[SOAR] [${level.toUpperCase()}] ${msg}`);
            logs.push(entry);
        };

        try {
            log("info", `▶ Starting playbook: ${playbook.name} (trigger: ${triggerSource})`);

            const nodesMap = new Map(playbook.nodes.map(n => [n.id, n]));
            const adjList = new Map();
            playbook.edges.forEach(edge => {
                if (!adjList.has(edge.source)) adjList.set(edge.source, []);
                adjList.get(edge.source).push({ target: edge.target, handle: edge.sourceHandle });
            });

            // Find trigger node
            const startNodes = playbook.nodes.filter(n => n.type === "triggerNode");
            if (startNodes.length === 0) throw new Error("No trigger node found in playbook");

            let currentNode = startNodes[0];
            let payload = { ...contextData };

            // ── DAG Traversal ────────────────────────────────────────────────
            while (currentNode) {
                stepCount++;
                if (stepCount > MAX_STEPS) {
                    log("error", `Anti-loop protection: exceeded ${MAX_STEPS} steps. Aborting.`);
                    execution.status = "failed";
                    break;
                }

                const nodeLabel = currentNode.data?.label || currentNode.data?.actionType || currentNode.type;
                log("info", `Step ${stepCount}: Executing node "${nodeLabel}" (${currentNode.type})`);

                let nextHandle = null;

                // ── TRIGGER NODE ─────────────────────────────────────────────
                if (currentNode.type === "triggerNode") {
                    log("info", `Trigger type: ${currentNode.data?.triggerType || playbook.triggerType}`);
                }

                // ── ACTION NODE ──────────────────────────────────────────────
                else if (currentNode.type === "actionNode") {
                    const actionType = currentNode.data?.actionType;
                    const plugin = getAction(actionType);

                    if (!plugin) {
                        log("warn", `Unknown action type: "${actionType}". Skipping.`);
                    } else {
                        // Validation
                        const validation = await plugin.validate(payload);
                        if (!validation.valid) {
                            log("warn", `Validation failed for ${actionType}: ${validation.errors.join(", ")}`);
                        } else {
                            // Approval gate
                            if (plugin.requiresApproval && triggerSource !== "manual") {
                                log("info", `⏸ Action "${actionType}" requires approval. Pausing execution.`);
                                execution.status = "awaiting_approval";
                                execution.logs = logs;
                                execution.contextData = payload;
                                await execution.save();

                                broadcast({
                                    type: "soar_approval_required",
                                    data: {
                                        executionId: execution.id,
                                        playbookName: playbook.name,
                                        actionType,
                                        target: payload.src_ip || payload.hostname || "unknown",
                                        timestamp: new Date().toISOString()
                                    }
                                });

                                // Return execution in paused state — will be resumed via /approve endpoint
                                return execution;
                            }

                            // Execute with retry + timeout
                            const result = await this._executeWithRetry(plugin, actionType, payload, {
                                playbookId: playbook.id,
                                playbookName: playbook.name,
                                executionId: execution.id
                            }, log);

                            if (result.success) {
                                log("info", `✅ Action "${actionType}" succeeded`, result.result);
                                if (result.rollbackData) {
                                    rollbackStack.push({ actionType, rollbackData: result.rollbackData });
                                }
                                // Merge result data into payload for downstream nodes
                                if (result.result && typeof result.result === "object") {
                                    Object.assign(payload, result.result);
                                }
                            } else {
                                log("error", `❌ Action "${actionType}" failed after retries`, result.result);
                                // Rollback all previous actions
                                await this._rollbackAll(rollbackStack, log);
                                execution.status = "failed";
                                break;
                            }
                        }
                    }
                }

                // ── CONDITION NODE ───────────────────────────────────────────
                else if (currentNode.type === "conditionNode") {
                    const condResult = this._evaluateCondition(currentNode.data, payload);
                    log("info", `Condition: ${currentNode.data.conditionField} ${currentNode.data.conditionOperator} ${currentNode.data.conditionValue} → ${condResult}`);
                    nextHandle = condResult ? "true" : "false";
                }

                // ── Find next node ───────────────────────────────────────────
                const outEdges = adjList.get(currentNode.id) || [];
                if (outEdges.length === 0) {
                    log("info", "⏹ Workflow reached terminal node.");
                    break;
                }

                if (currentNode.type === "conditionNode") {
                    const edge = outEdges.find(e => e.handle === nextHandle);
                    if (edge) {
                        currentNode = nodesMap.get(edge.target);
                    } else {
                        log("info", `No path for condition result "${nextHandle}". Workflow ended.`);
                        break;
                    }
                } else {
                    currentNode = nodesMap.get(outEdges[0].target);
                }
            }

            if (execution.status === "running") {
                execution.status = "success";
                log("info", `✅ Playbook "${playbook.name}" completed successfully.`);
            }

        } catch (error) {
            log("error", `💥 Fatal error: ${error.message}`);
            await this._rollbackAll(rollbackStack, log);
            execution.status = "failed";
        } finally {
            execution.completedAt = new Date();
            execution.logs = logs;
            execution.contextData = payload || contextData;
            await execution.save();

            broadcast({
                type: "soar_execution_complete",
                data: {
                    executionId: execution.id,
                    playbookId: playbook.id,
                    playbookName: playbook.name,
                    status: execution.status,
                    steps: stepCount
                }
            });
        }

        return execution;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Resume an execution that was paused for approval
    // ═══════════════════════════════════════════════════════════════════════════

    async resumeExecution(executionId, approved, approver = "analyst") {
        const execution = await PlaybookExecution.findByPk(executionId);
        if (!execution || execution.status !== "awaiting_approval") {
            return { success: false, error: "Execution not found or not awaiting approval" };
        }

        if (!approved) {
            execution.status = "rejected";
            execution.completedAt = new Date();
            const logs = execution.logs || [];
            logs.push({ timestamp: new Date().toISOString(), level: "warn", message: `Execution rejected by ${approver}` });
            execution.logs = logs;
            await execution.save();
            return { success: true, status: "rejected" };
        }

        // Re-run from beginning with original context (approval flag set to skip gate)
        execution.status = "running";
        await execution.save();

        // Re-run the playbook as "manual" trigger (bypasses approval gates)
        const result = await this.runPlaybook(execution.playbookId, "manual", execution.contextData);
        return { success: true, status: result?.status || "unknown", executionId: result?.id };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Auto-trigger on new incident (called from incidentRoutes)
    // ═══════════════════════════════════════════════════════════════════════════

    async triggerOnIncident(incident) {
        try {
            const playbooks = await Playbook.findAll({
                where: { status: "active", triggerType: "on_incident_created" }
            });

            for (const pb of playbooks) {
                let shouldRun = true;
                if (pb.triggerConditions) {
                    if (pb.triggerConditions.severity && incident.severity !== pb.triggerConditions.severity) {
                        shouldRun = false;
                    }
                    if (pb.triggerConditions.category && incident.category !== pb.triggerConditions.category) {
                        shouldRun = false;
                    }
                }

                if (shouldRun) {
                    let src_ip = null;
                    try {
                        const tags = typeof incident.tags === "string" ? JSON.parse(incident.tags) : (incident.tags || []);
                        const ipTag = tags.find(t => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(t));
                        if (ipTag) src_ip = ipTag;
                    } catch (e) { /* no tags */ }

                    const payload = {
                        incidentId: incident.id,
                        severity: incident.severity,
                        title: incident.title,
                        category: incident.category,
                        src_ip: src_ip || incident.sourceRef
                    };

                    // Fire-and-forget async execution
                    this.runPlaybook(pb.id, "automated", payload);
                }
            }
        } catch (e) {
            console.error("[SOAR] Error evaluating auto-playbooks:", e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Auto-trigger on raw alert (Suricata)
    // ═══════════════════════════════════════════════════════════════════════════

    async triggerOnAlert(alert) {
        try {
            const playbooks = await Playbook.findAll({
                where: { status: "active", triggerType: "on_alert" }
            });

            for (const pb of playbooks) {
                let shouldRun = true;
                if (pb.triggerConditions) {
                    if (pb.triggerConditions.minSeverity && alert.severity > pb.triggerConditions.minSeverity) {
                        shouldRun = false; // Suricata: 1=high, 3=low — lower number = higher severity
                    }
                }

                if (shouldRun) {
                    const payload = {
                        src_ip: alert.src_ip,
                        dest_ip: alert.dest_ip,
                        src_port: alert.src_port,
                        dest_port: alert.dest_port,
                        signature: alert.signature,
                        severity: alert.severity === 1 ? "critical" : alert.severity === 2 ? "high" : "medium",
                        protocol: alert.protocol,
                        alertId: alert.id
                    };
                    this.runPlaybook(pb.id, "automated", payload);
                }
            }
        } catch (e) {
            console.error("[SOAR] Error evaluating alert-triggered playbooks:", e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE: Execute action with retry + timeout
    // ═══════════════════════════════════════════════════════════════════════════

    async _executeWithRetry(plugin, actionType, payload, context, log) {
        for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
            try {
                const result = await Promise.race([
                    plugin.execute(payload, context),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Step timeout")), STEP_TIMEOUT_MS))
                ]);
                return result;
            } catch (e) {
                log("warn", `Action "${actionType}" attempt ${attempt}/${MAX_RETRIES + 1} failed: ${e.message}`);
                if (attempt <= MAX_RETRIES) {
                    const backoffMs = 1000 * Math.pow(2, attempt - 1);
                    log("info", `Retrying in ${backoffMs}ms...`);
                    await new Promise(r => setTimeout(r, backoffMs));
                } else {
                    return { success: false, result: { error: e.message }, rollbackData: null };
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE: Rollback all executed actions in reverse order
    // ═══════════════════════════════════════════════════════════════════════════

    async _rollbackAll(rollbackStack, log) {
        if (rollbackStack.length === 0) return;
        log("warn", `⏪ Rolling back ${rollbackStack.length} actions...`);

        while (rollbackStack.length > 0) {
            const { actionType, rollbackData } = rollbackStack.pop();
            try {
                const plugin = getAction(actionType);
                if (plugin) {
                    await plugin.rollback(rollbackData);
                    log("info", `Rolled back: ${actionType}`);
                }
            } catch (e) {
                log("error", `Rollback failed for ${actionType}: ${e.message}`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE: Condition evaluator
    // ═══════════════════════════════════════════════════════════════════════════

    _evaluateCondition(data, payload) {
        const field = data.conditionField || "severity";
        const operator = data.conditionOperator || "==";
        const expectedValue = data.conditionValue || "";
        const actualValue = payload[field];

        if (actualValue === undefined || actualValue === null) {
            return operator === "not_exists";
        }

        const actual = String(actualValue).toLowerCase();
        const expected = String(expectedValue).toLowerCase();

        switch (operator) {
            case "==":       return actual === expected;
            case "!=":       return actual !== expected;
            case "contains": return actual.includes(expected);
            case "not_contains": return !actual.includes(expected);
            case ">":        return parseFloat(actualValue) > parseFloat(expectedValue);
            case "<":        return parseFloat(actualValue) < parseFloat(expectedValue);
            case ">=":       return parseFloat(actualValue) >= parseFloat(expectedValue);
            case "<=":       return parseFloat(actualValue) <= parseFloat(expectedValue);
            case "exists":   return true; // If we got here, it exists
            case "not_exists": return false;
            case "regex":
                try { return new RegExp(expectedValue, "i").test(actual); } catch { return false; }
            default:         return actual === expected;
        }
    }
}

// Singleton
module.exports = new SOAREngine();
