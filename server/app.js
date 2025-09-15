const express = require('express');
const db = require('./util/db');
const logRouter = require("./routes/logRoutes")
const cors = require('cors')

const server = express()

server.use(express.json())

server.use(cors({
    origin: process.env.REACT_FRONTEND,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}))

db.sync().then(() => {
    console.log("Database synced");
}).catch((e) => {
    console.log(e);
})

server.use("/logs", logRouter)

server.listen(5000, () => {
    console.log("server running on port 5000");
})