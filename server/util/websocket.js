const { WebSocketServer } = require("ws");

let wss;

function initWebSocket(server) {
    wss = new WebSocketServer({ server });
    wss.on("connection", (ws) => {
        console.log("Frontend connected ✅");
        ws.on("close", () => console.log("Frontend disconnected ❌"));
    });
}

function broadcast(message) {
    if (!wss) {
        console.log('no wss')
        return
    };

    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(JSON.stringify(message));
        }
    });
}

module.exports = { initWebSocket, broadcast };
