const { queryVelociraptor } = require('../util/velociraptorUtils');
const Alert = require('../models/Alert');
const ZeekConnection = require('../models/ZeekConnection');

class VelociraptorPoller {
    constructor() {
        this.processedFlows = new Set();
        this.pollInterval = 30000; // 30 seconds
        this.intervalId = null;
    }

    start() {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => this.pollGlobalHunts(), this.pollInterval);
        console.log('[VelociraptorPoller] Started global polling service');
        // Run immediately on start
        this.pollGlobalHunts();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[VelociraptorPoller] Stopped global polling service');
        }
    }

    async pollGlobalHunts() {
        try {
            // This query fetches all flows from all clients in the last 60 minutes
            const vql = `SELECT client_id, session_id, state, request FROM foreach(row={SELECT client_id FROM clients()}, query={SELECT client_id, session_id, state, request FROM flows(client_id=client_id) WHERE create_time > timestamp(epoch=now() - 3600)})`;
            
            const data = await queryVelociraptor(vql);
            
            let flows = [];
            if (data.Responses && data.Responses.length > 0) {
                flows = data.Responses[0].Response || [];
                if (typeof flows === 'string') {
                    try { flows = JSON.parse(flows); } catch(e) {}
                }
            }

            if (!Array.isArray(flows)) return;

            for (const flow of flows) {
                const { client_id, session_id, state, request } = flow;
                
                if (state === 'FINISHED' && !this.processedFlows.has(session_id)) {
                    const artifactsList = request?.artifacts || request?.Artifacts || request?.ArtifactList || [];
                    const primaryArtifact = Array.isArray(artifactsList) && artifactsList.length > 0 ? artifactsList[0] : '';
                    
                    if (primaryArtifact) {
                        console.log(`[VelociraptorPoller] Found new completed hunt ${session_id} for artifact ${primaryArtifact}. Fetching results...`);
                        
                        // Mark as processed immediately to prevent concurrent duplicate fetching
                        this.processedFlows.add(session_id);
                        
                        await this.fetchAndFanOutResults(client_id, session_id, primaryArtifact);
                    }
                }
            }
        } catch (error) {
            console.error(`[VelociraptorPoller] Error in global sync engine:`, error.message);
        }
    }

    async fetchAndFanOutResults(clientId, flowId, artifact) {
        try {
            const data = await queryVelociraptor(`SELECT * FROM source(client_id='${clientId}', flow_id='${flowId}', artifact='${artifact}')`);
            
            const parseResponse = (resData) => {
                let res = [];
                if (resData.Responses && resData.Responses.length > 0) {
                    res = resData.Responses[0].Response || [];
                    if (typeof res === 'string') {
                        try { res = JSON.parse(res); } catch(e) {
                            res = res.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
                        }
                    }
                }
                return res;
            };

            let results = parseResponse(data);

            if (results.length === 0) {
                const fallbackSources = ['BasicInformation', 'Pslist', 'NetworkConnections', 'Users'];
                for (const src of fallbackSources) {
                    try {
                        const retryData = await queryVelociraptor(`SELECT * FROM source(client_id='${clientId}', flow_id='${flowId}', artifact='${artifact}', source='${src}')`);
                        const retryResults = parseResponse(retryData);
                        if (retryResults.length > 0) {
                            results = retryResults;
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }
            
            if (results.length === 0) {
                console.log(`[VelociraptorPoller] Hunt ${flowId} returned 0 rows.`);
                return;
            }

            console.log(`[VelociraptorPoller] Parsing ${results.length} results for artifact ${artifact}`);
            
            // Basic Fan-out logic based on artifact name/type
            let alertsInserted = 0;
            let networkInserted = 0;

            for (const row of results) {
                // If it looks like a network connection (Netstat, Zeek, etc.)
                if (row.Laddr || row.Raddr || artifact.toLowerCase().includes('network') || artifact.toLowerCase().includes('netstat')) {
                    // map to ZeekConnection format conceptually
                    const src_ip = row.Laddr?.IP || '0.0.0.0';
                    const src_port = row.Laddr?.Port || 0;
                    const dest_ip = row.Raddr?.IP || '0.0.0.0';
                    const dest_port = row.Raddr?.Port || 0;
                    
                    await ZeekConnection.create({
                        ts: Date.now() / 1000,
                        uid: `VR-${flowId}-${networkInserted}`,
                        id_orig_h: src_ip,
                        id_orig_p: src_port,
                        id_resp_h: dest_ip,
                        id_resp_p: dest_port,
                        proto: row.Family === 2 ? 'tcp' : 'udp',
                        service: artifact,
                        duration: 0,
                        orig_bytes: 0,
                        resp_bytes: 0,
                        conn_state: row.Status || 'ESTABLISHED'
                    }).catch(() => {}); // ignore duplicates/errors
                    networkInserted++;
                } 
                // Default to creating an Alert for everything else so it shows up in Timeline/Alerts
                else {
                    await Alert.create({
                        timestamp: new Date().toISOString(),
                        src_ip: clientId,
                        dest_ip: clientId, // Endpoint self-referencing
                        src_port: null,
                        dest_port: null,
                        signature: `Velociraptor Hunt: ${artifact} - ${row.Name || row.Caption || row.ImagePath || 'Evidence Found'}`,
                        severity: 2, // Medium severity by default for hunt hits
                        protocol: 'VQL'
                    }).catch(() => {});
                    alertsInserted++;
                }
            }

            console.log(`[VelociraptorPoller] Fan-out complete. Alerts inserted: ${alertsInserted}, Network connections inserted: ${networkInserted}`);

        } catch (error) {
            console.error(`[VelociraptorPoller] Error fetching results for flow ${flowId}:`, error.message);
        }
    }
}

module.exports = new VelociraptorPoller();
