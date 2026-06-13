const BACKEND_URL = 'http://localhost:5000';

async function simulateBruteForce() {
    console.log("🔥 Simulating Brute Force Attack...");
    const src_ip = "192.168.1.100";
    
    for (let i = 0; i < 55; i++) {
        await fetch(`${BACKEND_URL}/logs/filebeat`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                "@timestamp": new Date().toISOString(),
                source: { ip: src_ip, port: Math.floor(Math.random() * 10000) + 30000 },
                destination: { ip: "10.0.0.5", port: 22 },
                signature: "ET SCAN Potential SSH Scan",
                severity: 2,
                protocol: "TCP"
            })
        }).catch(err => {});
        
        if (i > 0 && i % 10 === 0) console.log(`Sent ${i} alerts...`);
    }
    console.log("✅ Sent 55 alerts from the same IP.");
}

async function simulatePortScan() {
    console.log("\n🔥 Simulating Horizontal Port Scan...");
    const src_ip = "192.168.1.200";
    
    for (let i = 0; i < 25; i++) {
        await fetch(`${BACKEND_URL}/logs/filebeat`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                "@timestamp": new Date().toISOString(),
                source: { ip: src_ip, port: 44444 },
                destination: { ip: "10.0.0.5", port: 20 + i }, // Hitting different ports
                signature: "ET SCAN Potential Port Scan",
                severity: 3,
                protocol: "TCP"
            })
        }).catch(err => {});
    }
    console.log("✅ Sent 25 alerts targeting different ports.");
}

async function run() {
    try {
        console.log("Checking if rules need to be seeded...");
        // Ensure rules exist
        await fetch(`${BACKEND_URL}/rules/seed`, { method: 'POST' }).catch(() => {});
        
        await simulateBruteForce();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await simulatePortScan();
        
        console.log("\n🎉 Testing complete! Check your Correlation and Incidents dashboards.");
    } catch (error) {
        console.error("Test failed. Is the backend running on port 5000?", error.message);
    }
}

run();
