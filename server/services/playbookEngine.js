const Playbook = require("../models/Playbook");
const PlaybookExecution = require("../models/PlaybookExecution");
const Incident = require("../models/Incident");
const BlockedIP = require("../models/BlockedIP");
const axios = require("axios");

class PlaybookEngine {
    async runPlaybook(playbookId, triggerSource, contextData) {
        const playbook = await Playbook.findByPk(playbookId);
        if (!playbook || playbook.status !== "active") return false;

        const execution = await PlaybookExecution.create({
            playbookId,
            triggerSource,
            contextData,
            status: "running"
        });

        const logs = [];
        const log = (msg) => {
            console.log(`[Playbook Engine] ${msg}`);
            logs.push({ timestamp: new Date().toISOString(), message: msg });
        };

        try {
            log(`Starting execution of Playbook: ${playbook.name}`);
            
            const nodesMap = new Map(playbook.nodes.map(n => [n.id, n]));
            const nextNodesCache = new Map();
            
            // Build adjacency list for forward edges
            playbook.edges.forEach(edge => {
                if (!nextNodesCache.has(edge.source)) {
                    nextNodesCache.set(edge.source, []);
                }
                nextNodesCache.get(edge.source).push({ target: edge.target, handleInfo: edge.sourceHandle });
            });

            // Find starting node (Type: trigger)
            const startNodes = playbook.nodes.filter(n => n.type === 'triggerNode');
            if (startNodes.length === 0) throw new Error("No trigger node found in playbook.");

            let currentNode = startNodes[0];
            let payload = { ...contextData };

            // Traversal loop
            while (currentNode) {
                log(`Executing step: ${currentNode.data?.label || currentNode.type}`);
                
                // 1. Process Node
                let nextHandle = null; // 'true' or 'false' for condition nodes
                
                if (currentNode.type === 'actionNode') {
                    const actionType = currentNode.data?.actionType;
                    
                    if (actionType === 'block_ip') {
                       const ipToBlock = payload.src_ip || payload.ip;
                       if (ipToBlock) {
                           log(`Action: Blocking IP ${ipToBlock}`);
                           // Wait for block to apply (simulate IPTABLES proxy hit or DB save)
                           await BlockedIP.create({ ip: ipToBlock, reason: `Playbook: ${playbook.name}`, source: 'SOAR' }).catch(() => {});
                           payload.blocked = true;
                       } else {
                           log(`Warning: block_ip action failed. No IP found in context.`);
                       }
                    } else if (actionType === 'close_incident') {
                        const incId = payload.incidentId;
                        if (incId) {
                            log(`Action: Closing Incident INC-${incId}`);
                            await Incident.update({ status: 'closed' }, { where: { id: incId } }).catch(()=>{});
                        }
                    } else if (actionType === 'notify_slack') {
                        log(`Action: Sending notification for INC-${payload.incidentId || 'Unknown'}`);
                        // Mock notification
                    } else {
                        log(`Warning: Unknown actionType ${actionType}`);
                    }
                } else if (currentNode.type === 'conditionNode') {
                    const field = currentNode.data?.conditionField || 'severity';
                    const operator = currentNode.data?.conditionOperator || '==';
                    const value = currentNode.data?.conditionValue || 'critical';
                    
                    const actualValue = payload[field];
                    let conditionMet = false;
                    
                    if (operator === '==') conditionMet = (actualValue?.toLowerCase() === value?.toLowerCase());
                    else if (operator === 'contains') conditionMet = !!actualValue?.includes(value);
                    else if (operator === 'exists') conditionMet = (actualValue !== undefined && actualValue !== null);

                    log(`Condition: ${field} ${operator} ${value} (Actual: ${actualValue}) -> ${conditionMet}`);
                    nextHandle = conditionMet ? 'true' : 'false';
                }

                // 2. Find Next Node
                const possibleEdges = nextNodesCache.get(currentNode.id) || [];
                if (possibleEdges.length === 0) {
                    log(`Workflow reached end node.`);
                    break;
                }

                // If it was a condition node, we must follow the correct handle
                if (currentNode.type === 'conditionNode') {
                    const edgeToFollow = possibleEdges.find(e => e.handleInfo === nextHandle);
                    if (edgeToFollow) {
                        currentNode = nodesMap.get(edgeToFollow.target);
                    } else {
                         log(`Workflow ended (No path extending from condition result: ${nextHandle})`);
                         break;
                    }
                } else {
                    // For trigger/action, just follow the first outgoing edge
                    currentNode = nodesMap.get(possibleEdges[0].target);
                }
            }

            log(`Playbook execution completed successfully.`);
            execution.status = "success";

        } catch (error) {
            console.error("Playbook execution error:", error);
            log(`ERROR: ${error.message}`);
            execution.status = "failed";
        } finally {
            execution.completedAt = new Date();
            execution.logs = logs;
            await execution.save();
        }

        return execution;
    }

    // Auto-trigger on new incident
    async triggerOnIncident(incident) {
        try {
            const playbooks = await Playbook.findAll({
                where: { status: 'active', triggerType: 'on_incident_created' }
            });

            for (const pb of playbooks) {
                // Check if trigger conditions match (e.g. only critical severity)
                let shouldRun = true;
                if (pb.triggerConditions) {
                   if (pb.triggerConditions.severity && incident.severity !== pb.triggerConditions.severity) {
                       shouldRun = false;
                   }
                }

                if (shouldRun) {
                    // Extract src_ip from tags or context if available
                    let src_ip = null;
                    try {
                        const tags = typeof incident.tags === 'string' ? JSON.parse(incident.tags) : (incident.tags || []);
                        const ipTag = tags.find(t => t.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/));
                        if (ipTag) src_ip = ipTag;
                    } catch(e) {}

                    const payload = {
                        incidentId: incident.id,
                        severity: incident.severity,
                        title: incident.title,
                        src_ip: incident.sourceRef || src_ip // Very rough proxy
                    };

                    // Run asynchronously
                    this.runPlaybook(pb.id, 'automated', payload);
                }
            }
        } catch (e) {
            console.error("Error evaluating auto-playbooks:", e);
        }
    }
}

module.exports = new PlaybookEngine();
