const db = require("./util/db");
const Playbook = require("./models/Playbook");
const { seedPlaybooks } = require("./services/soar/playbookTemplates");

async function run() {
    try {
        await db.authenticate();
        console.log("DB Authenticated.");
        await db.sync({ alter: true });
        console.log("DB Synced.");
        
        console.log("Attempting to seed playbooks...");
        const result = await seedPlaybooks();
        console.log("Seed Success:", result);
    } catch (error) {
        console.error("Seed Error:", error);
    } finally {
        process.exit();
    }
}
run();
