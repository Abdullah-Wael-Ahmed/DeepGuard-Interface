const express = require('express');
require("dotenv").config({ quiet: true });
const db = require('./util/db');
const cookieParser = require('cookie-parser')
const logRouter = require("./routes/logRoutes")
const fireWallRouter = require("./routes/firewallRoutes")
const threatIntelRouter = require("./routes/threatIntelRoutes")
const auth = require("./routes/auth")
const zeekRouter = require("./routes/zeekRoutes")
const mitreRouter = require("./routes/mitreRoutes")
const anomalyRouter = require("./routes/anomalyRoutes")
const copilotRouter = require("./routes/copilotRoutes") // Gemini AI Copilot — loaded 2026-04-20
const velociraptorRoutes = require('./routes/velociraptor');
const incidentRouter = require("./routes/incidentRoutes")
const correlationRouter = require("./routes/correlationRoutes")
const playbookRouter = require("./routes/playbookRoutes")
const correlationEngine = require("./services/correlationEngine")
const cors = require('cors');
const http = require('http')
const { initWebSocket } = require('./util/websocket');
const { seedSuperAdmin } = require('./util/seeder');
const verifyJWT = require("./middleware/verifyJWT")

const app = express()

app.use(express.json())
app.use(cookieParser());

server = http.createServer(app)

initWebSocket(server)

async function connectWithRetry(retries = 10, delay = 3000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await db.authenticate();
            await db.sync();
            console.log(`Database synced (attempt ${attempt})`);
            await correlationEngine.init(); // Init backend correlation
            await seedSuperAdmin();
            return;
        } catch (e) {
            console.log(`DB connection attempt ${attempt}/${retries} failed: ${e.message}`);
            if (attempt === retries) {
                console.error("Could not connect to the database after maximum retries. Exiting.");
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

connectWithRetry();
app.use("/auth", auth)
// if (process.env.NODE_ENV === "dep") app.use(verifyJWT)
app.use("/logs", logRouter)
app.use("/firewall", fireWallRouter)
app.use("/threat-intel", threatIntelRouter)
app.use("/zeek", zeekRouter)
app.use("/mitre", mitreRouter)
app.use("/anomaly", anomalyRouter)
app.use("/copilot", copilotRouter)
app.use("/api/velociraptor", velociraptorRoutes)
app.use("/incidents", incidentRouter)
app.use("/rules", correlationRouter)
app.use("/playbooks", playbookRouter)

server.listen(5000, () => {
    console.log("server running on port 5000");
})