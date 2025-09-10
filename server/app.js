const express = require('express')

const server = express()


server.get("/hello", (req, res) => {
    res.send("Hello Kareem hossam")
})

server.listen(5000, () => {
    console.log("server running on port 5000");
})