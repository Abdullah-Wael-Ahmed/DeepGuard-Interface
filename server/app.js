const express = require('express');
const db = require('./util/db');
const logRouter = require("./routes/logRoutes")

const server = express()

server.use(express.json())

db.sync().then(() => {
    console.log("Database synced");
}).catch((e) => {
    console.log(e);
})

// server.post("/filebeat", (req, res) => {
//     console.log('filebeat sent');
//     console.log("Headers -----------------------------------");
//     console.log(req.headers);
//     console.log("Body -----------------------------------");
//     console.log(req.body);
//     res.json("ok")
// })

server.use("/logs", logRouter)

server.listen(5000, () => {
    console.log("server running on port 5000");
})