const http = require("http");

const SOCKET_PATH = "/tmp/iptables-proxy/iptables.sock";

// ── Internal helper ───────────────────────────────────────────────────────────
function socketRequest(method, path, body = null, query = "") {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      socketPath: SOCKET_PATH,
      path: query ? `${path}?${query}` : path,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(payload && { "Content-Length": Buffer.byteLength(payload) }),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) return reject(parsed);
          resolve(parsed);
        } catch {
          reject(new Error("Invalid response from iptables-proxy"));
        }
      });
    });

    req.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new Error("iptables-proxy socket not found — is the service running?"));
      } else {
        reject(err);
      }
    });

    if (payload) req.write(payload);
    req.end();
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

// Quick block/unblock — for automated threat response
const blockIP   = (ip) => socketRequest("POST", "/block",   { ip });
const unblockIP = (ip) => socketRequest("POST", "/unblock", { ip });

// Full rule builder — mirrors your original /add-rule body shape exactly
// {chain, action, protocol, srcIp, destIp, srcPort, dstPort,
//  inInterface, outInterface, logEnabled, description}
const addRule = (ruleOptions) => socketRequest("POST", "/add-rule", ruleOptions);

// Delete by chain + rule number
// deleteRule("INPUT", 3)
const deleteRule = (chain, ruleNum) =>
  socketRequest("DELETE", "/delete-rule", null, `chain=${chain}&ruleNum=${ruleNum}`);

// List rules for a chain (defaults to INPUT on the proxy side)
// listRules()           → lists INPUT
// listRules("FORWARD")  → lists FORWARD
const listRules = (chain = "INPUT") =>
  socketRequest("GET", "/list", null, `chain=${chain}`);

// Health check — returns true/false
const healthCheck = () =>
  socketRequest("GET", "/health")
    .then(() => true)
    .catch(() => false);

module.exports = { blockIP, unblockIP, addRule, deleteRule, listRules, healthCheck };