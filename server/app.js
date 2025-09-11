const express = require('express')
const fs = require("fs")
const ndjson = require('ndjson')

const server = express()


server.get("/hello", (req, res) => {
    res.send("Hello Kareem hossam")
})

server.get("/eve", (req, res) => {
    // try {
        const filepath = "/var/log/suricata/eve.json"
    //     const file = fs.readFileSync(filepath, "utf8")
    //     const json = JSON.parse(file)
    //     // res.type('text/plain')
    //     res.json(json)

    // } catch (error) {
    //     console.log(error);
    //     res.status(500).json("Internal Server Error")
    // }
    res.setHeader('Content-Type', 'application/json');
    res.write('['); // start JSON array

    let first = true;

    fs.createReadStream(filepath)
        .pipe(ndjson.parse())
        .on('data', obj => {
            if (!first) {
                res.write(','); // comma between objects
            } else {
                first = false;
            }
            res.write(JSON.stringify(obj));
        })
        .on('end', () => {
            res.write(']');
            res.end();
        })
        .on('error', err => {
            console.error('Stream error:', err);
            res.status(500).json({ error: 'Failed to read events' });
        });
})

server.post("/filebeat", (req, res) => {
    console.log('filebeat sent');
    console.log(req);
    res.json("ok")
})

server.listen(5000, () => {
    console.log("server running on port 5000");
})