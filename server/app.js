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

db.sync().then(async () => {
    console.log("Database synced");
    await seedSuperAdmin();
}).catch((e) => {
    console.log(e);
})
app.use("/auth", auth)
app.use(verifyJWT)
app.use("/logs", logRouter)
app.use("/firewall", fireWallRouter)
app.use("/threat-intel", threatIntelRouter)
app.use("/zeek", zeekRouter)
app.use("/mitre", mitreRouter)

server.listen(5000, () => {
    console.log("server running on port 5000");
})