const express = require('express');
require("dotenv").config({ quiet: true });
const db = require('./util/db');
const cookieParser = require('cookie-parser')
const logRouter = require("./routes/logRoutes")
const fireWallRouter = require("./routes/firewallRoutes")
const threatIntelRouter = require("./routes/threatIntelRoutes")
const auth = require("./routes/auth")
const zeekRouter = require("./routes/zeekRoutes")
const cors = require('cors');
const http = require('http')
const { initWebSocket } = require('./util/websocket');
const { seedSuperAdmin } = require('./util/seeder');

const app = express()

app.use(express.json())
app.use(cookieParser());
app.use(cors({
    origin: [process.env.REACT_FRONTEND, process.env.REACT_FRONTEND_LOCAL],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}))

server = http.createServer(app)

initWebSocket(server)

db.sync().then(async () => {
    console.log("Database synced");
    await seedSuperAdmin();
}).catch((e) => {
    console.log(e);
})

app.use("/logs", logRouter)
app.use("/firewall", fireWallRouter)
app.use("/threat-intel", threatIntelRouter)
app.use("/auth", auth)
app.use("/zeek", zeekRouter)

server.listen(5000, () => {
    console.log("server running on port 5000");
})