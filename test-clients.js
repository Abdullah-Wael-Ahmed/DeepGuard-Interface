const { execSync } = require('child_process');

try {
    const stdout = execSync(`docker exec -e VQL_QUERY="SELECT client_id, os_info, last_seen_at FROM clients()" deepguard-velociraptor sh -c "velociraptor --api_config /tmp/api_client.yaml query \\"$VQL_QUERY\\" --format jsonl"`);
    console.log(stdout.toString());
} catch(e) {
    console.error(e.message);
}
