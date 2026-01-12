const db = require("./util/db");
const ZeekConnection = require("./models/ZeekConnection");
const ZeekDNS = require("./models/ZeekDNS");

const PROTOCOLS = ["tcp", "udp", "icmp"];
const SERVICES = ["http", "ssh", "dns", "ssl", "ftp"];
const STATES = ["S0", "S1", "SF", "REJ", "S2"];
const DOMAINS = ["google.com", "example.com", "malware.site", "cdn.net", "api.service.io", "facebook.com", "yahoo.com"];
const DNS_TYPES = ["A", "AAAA", "CNAME", "ptr"];
const RCODES = ["NOERROR", "NXDOMAIN", "SERVFAIL"];

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

async function seed() {
    await db.sync();
    console.log("Database synced. Seeding Zeek data...");

    // Seed Connections
    const connections = [];
    const now = new Date();

    for (let i = 0; i < 200; i++) {
        const timeOffset = Math.floor(Math.random() * 24 * 60 * 60 * 1000); // last 24h
        const timestamp = new Date(now.getTime() - timeOffset);

        connections.push({
            timestamp,
            uid: Math.random().toString(36).substring(7),
            id_orig_h: randomChoice(["192.168.1.5", "192.168.1.10", "10.0.0.5", randomIP(), randomIP()]), // bias towards local
            id_orig_p: Math.floor(Math.random() * 65535),
            id_resp_h: randomIP(),
            id_resp_p: Math.floor(Math.random() * 65535),
            proto: randomChoice(PROTOCOLS),
            service: randomChoice(SERVICES),
            duration: Math.random() * 10,
            orig_bytes: Math.floor(Math.random() * 10000),
            resp_bytes: Math.floor(Math.random() * 50000),
            conn_state: randomChoice(STATES),
        });
    }

    await ZeekConnection.bulkCreate(connections);
    console.log(`Seeded ${connections.length} connections.`);

    // Seed DNS
    const dnsLogs = [];
    for (let i = 0; i < 100; i++) {
        const timeOffset = Math.floor(Math.random() * 24 * 60 * 60 * 1000);
        const timestamp = new Date(now.getTime() - timeOffset);

        dnsLogs.push({
            timestamp,
            uid: Math.random().toString(36).substring(7),
            id_orig_h: randomChoice(["192.168.1.5", "192.168.1.10", "10.0.0.5"]),
            id_orig_p: Math.floor(Math.random() * 65535),
            query: randomChoice(DOMAINS),
            qtype_name: randomChoice(DNS_TYPES),
            rcode_name: randomChoice(RCODES),
        });
    }

    await ZeekDNS.bulkCreate(dnsLogs);
    console.log(`Seeded ${dnsLogs.length} DNS logs.`);

    console.log("Seeding complete.");
}

seed().catch(console.error);
