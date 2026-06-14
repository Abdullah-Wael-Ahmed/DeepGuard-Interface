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
            'if [ -x /velociraptor/velociraptor ]; then VR_BIN=/velociraptor/velociraptor; elif [ -x /opt/velociraptor ]; then VR_BIN=/opt/velociraptor; else VR_BIN=velociraptor; fi; if [ ! -f /tmp/api_client.yaml ]; then $VR_BIN --config /etc/velociraptor/server.config.yaml config api_client --name admin --role administrator /tmp/api_client.yaml > /dev/null 2>&1; fi; $VR_BIN --api_config /tmp/api_client.yaml query "$VQL_QUERY" --format json'
        ];
        
        const { stdout, stderr } = await execFilePromise('docker', cmdArgs);
        
        if (stderr && stderr.trim()) {
            console.error('[Velociraptor CLI Stderr]:', stderr);
        }

        if (!stdout || !stdout.trim()) {
            return { Responses: [{ Response: [] }] };
        }
        
        let rows = [];
        try {
            // First try parsing the whole thing as a single JSON array
            rows = JSON.parse(stdout);
        } catch (e) {
            // If it fails, try to extract just the JSON array portion (handles docker warnings)
            try {
                const startIndex = stdout.indexOf('[');
                const endIndex = stdout.lastIndexOf(']') + 1;
                if (startIndex !== -1 && endIndex !== 0) {
                    rows = JSON.parse(stdout.substring(startIndex, endIndex));
                } else {
                    // Fallback to line-by-line parsing
                    const lines = stdout.split('\n').filter(l => l.trim());
                    for (const line of lines) {
                        try { rows.push(JSON.parse(line)); } catch (err) {}
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
