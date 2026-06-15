const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

// Helper to query Velociraptor via local docker exec
const queryVelociraptor = async (vqlQuery) => {
    try {
        // We pass the VQL query as an environment variable to the docker container.
        // This completely bypasses any shell positional argument ($0, $1) parsing inconsistencies
        // and guarantees the query is executed exactly as intended.
        const cmdArgs = [
            'exec',
            '-e', `VQL_QUERY=${vqlQuery}`,
            'deepguard-velociraptor',
            'sh',
            '-c',
            'if [ -x /velociraptor/velociraptor ]; then VR_BIN=/velociraptor/velociraptor; elif [ -x /opt/velociraptor ]; then VR_BIN=/opt/velociraptor; else VR_BIN=velociraptor; fi; if [ ! -f /tmp/api_client.yaml ]; then $VR_BIN --config /etc/velociraptor/server.config.yaml config api_client --name admin --role administrator /tmp/api_client.yaml > /dev/null 2>&1; fi; $VR_BIN --api_config /tmp/api_client.yaml query "$VQL_QUERY" --format jsonl'
        ];
        
        // Add a 60-second timeout and a large 50MB maxBuffer. 
        // If Velociraptor hangs, this prevents infinite overlapping docker execs.
        // The maxBuffer prevents crashes when querying large artifacts or many clients.
        const { stdout, stderr } = await execFilePromise('docker', cmdArgs, { 
            timeout: 60000, 
            killSignal: 'SIGKILL',
            maxBuffer: 1024 * 1024 * 50 // 50 MB
        });
        
        if (stderr && stderr.trim()) {
            console.error('[Velociraptor CLI Stderr]:', stderr);
        }

        if (!stdout || !stdout.trim()) {
            return { Responses: [{ Response: [] }] };
        }
        
        let rows = [];
        const cleanStdout = stdout.trim();
        
        try {
            // First try parsing as a single JSON object/array
            rows = JSON.parse(cleanStdout);
        } catch (e) {
            // If it fails, it might be multiple JSON arrays concatenated: [...] [...]
            // or JSON Lines: {...} \n {...}
            // or preceded by docker warnings
            try {
                // Try to extract all JSON arrays using regex and merge them
                const arrays = cleanStdout.match(/\[[\s\S]*?\]/g);
                if (arrays && arrays.length > 0) {
                    for (const arrStr of arrays) {
                        try {
                            const parsed = JSON.parse(arrStr);
                            if (Array.isArray(parsed)) rows.push(...parsed);
                        } catch(err) {}
                    }
                }
                
                // If regex didn't find valid arrays, fallback to jsonl parsing
                if (rows.length === 0) {
                    const lines = cleanStdout.split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        try {
                            const parsed = JSON.parse(trimmed);
                            rows.push(parsed);
                        } catch (err) {}
                    }
                }
            } catch (err) {
                console.error('[Velociraptor JSON extraction failed]:', err.message);
            }
        }
        
        return { Responses: [{ Response: rows }] };
    } catch (error) {
        console.error('Docker exec query failed:', error.message);
        if (error.stdout) console.error('Stdout:', error.stdout);
        if (error.stderr) console.error('Stderr:', error.stderr);
        throw new Error('Failed to query velociraptor datastore locally: ' + error.message);
    }
};

module.exports = { queryVelociraptor };
