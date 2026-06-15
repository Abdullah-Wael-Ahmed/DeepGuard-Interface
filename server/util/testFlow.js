const { queryVelociraptor } = require('./velociraptorUtils');

(async () => {
    try {
        const flowId = process.argv[2] || 'F.D8N9VEH5KP754';
        const clientId = process.argv[3];
        console.log(`Testing flowId: ${flowId}`);
        // Let's get the client ID of this flow if not provided
        let query = clientId 
            ? `SELECT request.artifacts AS artifacts FROM flows(client_id='${clientId}') WHERE session_id='${flowId}'`
            : `SELECT client_id, request.artifacts AS artifacts FROM foreach(row={SELECT client_id FROM clients()}, query={SELECT client_id, request.artifacts FROM flows(client_id=client_id) WHERE session_id='${flowId}'})`;
        
        const flowData = await queryVelociraptor(query);
        console.log("Flow Data:", JSON.stringify(flowData, null, 2));
    } catch (err) {
        console.error(err);
    }
})();
