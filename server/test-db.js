const db = require("./util/db");
const Playbook = require("./models/Playbook");

async function run() {
    try {
        await db.authenticate();
        console.log("DB Authenticated.");
        
        console.log("Attempting to create a playbook directly...");
        const pb = await Playbook.create({
            name: "Test Direct Playbook",
            description: "Testing",
            status: "draft",
            triggerType: "manual",
            nodes: "[]",
            edges: "[]"
        });
        
        console.log("Playbook created successfully!", pb.toJSON());
    } catch (error) {
        console.error("Playbook Create Error:", error);
    } finally {
        process.exit();
    }
}
run();
