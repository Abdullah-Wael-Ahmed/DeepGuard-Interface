const { queryVelociraptor } = require('../util/velociraptorUtils');
const Alert = require('../models/Alert');
const ZeekConnection = require('../models/ZeekConnection');
// Optional: IncidentEvent if we want to fan out to timeline specific events
// const IncidentEvent = require('../models/IncidentEvent');

class VelociraptorPoller {
    constructor() {
        this.activeHunts = new Map(); // key: flow_id, value: { clientId, artifact, startTime }
        this.pollInterval = 10000; // 10 seconds
        this.intervalId = null;
        this.timeoutLimit = 15 * 60 * 1000; // 15 minutes timeout
    }

    start() {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => this.pollActiveHunts(), this.pollInterval);
        console.log('[VelociraptorPoller] Started polling service');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[VelociraptorPoller] Stopped polling service');
        }
    }

    addHunt(clientId, flowId, artifact) {
        this.activeHunts.set(flowId, {
            clientId,
            artifact,
            startTime: Date.now()
        });
        console.log(`[VelociraptorPoller] Tracking new hunt - Flow ID: ${flowId}, Client: ${clientId}, Artifact: ${artifact}`);
        if (!this.intervalId) {
            this.start();
        }
    }

    async pollActiveHunts() {
        if (this.activeHunts.size === 0) return;

        for (const [flowId, huntData] of this.activeHunts.entries()) {
            const { clientId, artifact, startTime } = huntData;

            // Check for timeout
            if (Date.now() - startTime > this.timeoutLimit) {
                console.warn(`[VelociraptorPoller] Hunt ${flowId} timed out after 15 minutes. Removing from tracker.`);
                this.activeHunts.delete(flowId);
                continue;
            }

            try {
                // Check flow state
                const data = await queryVelociraptor(`SELECT state FROM flows(client_id='${clientId}') WHERE flow_id='${flowId}'`);
                let state = null;
                
                if (data.Responses && data.Responses.length > 0) {
                    let flows = data.Responses[0].Response || [];
                    if (typeof flows === 'string') {
                        try { flows = JSON.parse(flows); } catch(e) {}
                    }
                    if (Array.isArray(flows) && flows.length > 0) {
                        state = flows[0].state;
                    }
                }

                if (state === 'FINISHED') {
                    console.log(`[VelociraptorPoller] Hunt ${flowId} FINISHED. Fetching and parsing results...`);
                    this.activeHunts.delete(flowId);
                    await this.fetchAndFanOutResults(clientId, flowId, artifact);
                } else if (state === 'ERROR' || state === 'TERMINATED') {
                    console.log(`[VelociraptorPoller] Hunt ${flowId} ended with state: ${state}. Removing from tracker.`);
                    this.activeHunts.delete(flowId);
                }
                // If RUNNING or other states, continue polling
            } catch (error) {
                console.error(`[VelociraptorPoller] Error polling flow ${flowId}:`, error.message);
            }
        }
    }

    async fetchAndFanOutResults(clientId, flowId, artifact) {
        try {
            const data = await queryVelociraptor(`SELECT * FROM source(client_id='${clientId}', flow_id='${flowId}', artifact='${artifact}')`);
            let results = [];
            
            if (data.Responses && data.Responses.length > 0) {
                results = data.Responses[0].Response || [];
                if (typeof results === 'string') {
                    try {
                        results = JSON.parse(results);
                    } catch(e) {
                        results = results.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
                    }
                }
            }

            if (!Array.isArray(results) || results.length === 0) {
                console.log(`[VelociraptorPoller] No results found for flow ${flowId}.`);
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
