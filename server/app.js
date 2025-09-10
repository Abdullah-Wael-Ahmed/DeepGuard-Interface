const express = require('express')
const fs = require("fs")

const server = express()


server.get("/hello", (req, res) => {
    res.send("Hello Kareem hossam")
})

server.get("/eve", (req, res) => {
    try {
        const filepath = "/var/log/suricata/eve.json"
        const file = fs.readFileSync(filepath, "utf8")
        // const json = JSON.parse(file)
        res.type('text/plain')
        res.send(file)

    } catch (error) {
        console.log(error);
        res.status(500).json("Internal Server Error")
    }
})

server.listen(5000, () => {
    console.log("server running on port 5000");
})