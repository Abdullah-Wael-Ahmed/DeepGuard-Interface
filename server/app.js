const express = require('express');
require("dotenv").config({quiet: true});
const db = require('./util/db');
const logRouter = require("./routes/logRoutes")
const fireWallRouter = require("./routes/firewallRoutes")
const cors = require('cors');
const http = require('http')
const { initWebSocket } = require('./util/websocket');

const app = express()

app.use(express.json())
app.use(cors({
    origin: [process.env.REACT_FRONTEND, process.env.REACT_FRONTEND_LOCAL],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}))

server = http.createServer(app)

initWebSocket(server)

db.sync().then(() => {
    console.log("Database synced");
}).catch((e) => {
    console.log(e);
})

app.use("/logs", logRouter)
app.use("/firewall", fireWallRouter)

server.listen(5000, () => {
    console.log("server running on port 5000");
})