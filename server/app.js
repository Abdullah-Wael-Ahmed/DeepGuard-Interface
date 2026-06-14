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
const velociraptorPoller = require("./services/velociraptorPoller")
const cors = require('cors');
const http = require('http')
const { initWebSocket } = require('./util/websocket');
const { seedSuperAdmin } = require('./util/seeder');
const verifyJWT = require("./middleware/verifyJWT")
const { restrictWriteToAdminOrOperator } = require("./middleware/authorize");

const app = express()

app.use(cors({ origin: true, credentials: true }))
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
            velociraptorPoller.start(); // Init Velociraptor flow polling
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
app.use("/logs", verifyJWT, logRouter)
app.use("/firewall", verifyJWT, restrictWriteToAdminOrOperator, fireWallRouter)
app.use("/threat-intel", verifyJWT, restrictWriteToAdminOrOperator, threatIntelRouter)
app.use("/zeek", verifyJWT, zeekRouter)
app.use("/mitre", verifyJWT, mitreRouter)
app.use("/anomaly", verifyJWT, anomalyRouter)
app.use("/copilot", verifyJWT, copilotRouter)
app.use("/api/velociraptor", verifyJWT, restrictWriteToAdminOrOperator, velociraptorRoutes)
app.use("/incidents", verifyJWT, restrictWriteToAdminOrOperator, incidentRouter)
app.use("/rules", verifyJWT, restrictWriteToAdminOrOperator, correlationRouter)
app.use("/playbooks", verifyJWT, restrictWriteToAdminOrOperator, playbookRouter)

server.listen(5000, () => {
    console.log("server running on port 5000");
})