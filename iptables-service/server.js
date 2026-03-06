const express = require("express");
const { execFile } = require("child_process");
const net = require("net");
const fs = require("fs");

const app = express();
app.use(express.json());

const SOCKET_PATH = "/tmp/iptables-proxy/iptables.sock";

// ── Core helper ───────────────────────────────────────────────────────────────
// execFile never spawns a shell — args are passed directly to the kernel
// injection is structurally impossible regardless of input content
function runIptables(args) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: iptables ${args.join(" ")}`);
    execFile("iptables", args, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout);
    });
  });
}

// ── Validators ────────────────────────────────────────────────────────────────
function isValidIP(ip) {
  // Supports plain IPs and CIDR e.g. 192.168.1.0/24
  const parts = ip.split("/");
  if (parts.length > 2) return false;
  if (!net.isIP(parts[0])) return false;
  if (parts[1] !== undefined) {
    const prefix = Number(parts[1]);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) return false;
  }
  return true;
}
function isValidPort(port) {
  const n = Number(port);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}
function isValidChain(chain) {
  return /^[a-zA-Z0-9_-]+$/.test(chain);
}
function isValidAction(action) {
  return ["ACCEPT", "DROP", "REJECT", "LOG", "RETURN", "MASQUERADE"].includes(action.toUpperCase());
}
function isValidProtocol(proto) {
  return ["tcp", "udp", "icmp", "all"].includes(proto.toLowerCase());
}
function isValidInterface(iface) {
  return /^[a-zA-Z0-9_:.-]+$/.test(iface);
}

// ── Output parser (mirrors your original router) ──────────────────────────────
function parseIptablesOutput(output) {
  const lines = output.trim().split("\n");
  const rules = [];
  let chainName = "";
  let startIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("Chain ")) {
      chainName = line.split(" ")[1];
      continue;
    }
    if (line.startsWith("num")) {
      startIndex = i + 1;
      continue;
    }
    if (startIndex === -1) continue;

    const parts = line.split(/\s+/);
    if (parts.length >= 6) {
      const [num, target, prot, opt, source, destination, ...rest] = parts;
      const rawExtra = rest.join(" ");
      const commentMatch = rawExtra.match(/\/\*\s*(.*?)\s*\*\//);

      rules.push({
        chain: chainName,
        num: Number(num),
        target,
        prot,
        opt,
        source,
        destination,
        description: commentMatch ? commentMatch[1] : "",
        extra: rawExtra,
      });
    }
  }
  return rules;
}

// ── POST /block ───────────────────────────────────────────────────────────────
// Quick single-IP block — used by automated alert/threat responses
app.post("/block", async (req, res) => {
  const { ip } = req.body;
  if (!ip || !isValidIP(ip)) {
    return res.status(400).json({ error: "Invalid IP address" });
  }

  // Idempotency check — don't add a duplicate rule
  try {
    await runIptables(["-C", "FORWARD", "-s", ip, "-j", "DROP"]);
    return res.json({ ok: true, message: "Rule already exists" });
  } catch {
    // Rule doesn't exist yet — safe to insert
  }

  try {
    await runIptables(["-I", "FORWARD", "-s", ip, "-j", "DROP"]);
    console.log(`[BLOCK] ${ip}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(`[BLOCK ERROR] ${ip}:`, err);
    res.status(500).json({ error: err });
  }
});

// ── POST /unblock ─────────────────────────────────────────────────────────────
app.post("/unblock", async (req, res) => {
  const { ip } = req.body;
  if (!ip || !isValidIP(ip)) {
    return res.status(400).json({ error: "Invalid IP address" });
  }

  try {
    await runIptables(["-D", "FORWARD", "-s", ip, "-j", "DROP"]);
    console.log(`[UNBLOCK] ${ip}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(`[UNBLOCK ERROR] ${ip}:`, err);
    res.status(500).json({ error: err });
  }
});

// ── POST /add-rule ────────────────────────────────────────────────────────────
// Full rule builder — mirrors your original /add-rule route
app.post("/add-rule", async (req, res) => {
  const {
    chain, action, protocol, srcIp, destIp,
    srcPort, dstPort, inInterface, outInterface,
    logEnabled, description,
  } = req.body;

  // Validate
  if (!chain || !isValidChain(chain))
    return res.status(400).json({ error: "Invalid or missing chain" });
  if (!action || !isValidAction(action))
    return res.status(400).json({ error: "Invalid or missing action" });
  if (protocol && !isValidProtocol(protocol))
    return res.status(400).json({ error: "Invalid protocol" });
  if (srcIp?.trim() && !isValidIP(srcIp.trim()))
    return res.status(400).json({ error: "Invalid source IP" });
  if (destIp?.trim() && !isValidIP(destIp.trim()))
    return res.status(400).json({ error: "Invalid destination IP" });
  if (srcPort?.trim() && !isValidPort(srcPort.trim()))
    return res.status(400).json({ error: "Invalid source port" });
  if (dstPort?.trim() && !isValidPort(dstPort.trim()))
    return res.status(400).json({ error: "Invalid destination port" });
  if (inInterface?.trim() && !isValidInterface(inInterface.trim()))
    return res.status(400).json({ error: "Invalid input interface" });
  if (outInterface?.trim() && !isValidInterface(outInterface.trim()))
    return res.status(400).json({ error: "Invalid output interface" });

  // Build args array — each value is a discrete argument, no shell involved
  const buildArgs = (jumpTarget) => {
    const args = ["-A", chain];

    if (protocol && protocol !== "all") args.push("-p", protocol.toLowerCase());
    if (srcIp?.trim())        args.push("-s", srcIp.trim());
    if (destIp?.trim())       args.push("-d", destIp.trim());
    if (inInterface?.trim())  args.push("-i", inInterface.trim());
    if (outInterface?.trim()) args.push("-o", outInterface.trim());

    if (protocol === "tcp" || protocol === "udp") {
      if (srcPort?.trim()) args.push("--sport", srcPort.trim());
      if (dstPort?.trim()) args.push("--dport", dstPort.trim());
    }

    if (description?.trim()) {
      // No length cap needed here since it's a discrete arg, not shell-interpolated
      args.push("-m", "comment", "--comment", description.trim());
    }

    args.push("-j", jumpTarget.toUpperCase());
    return args;
  };

  try {
    // If logging enabled, insert the LOG rule first (same chain, same criteria)
    if (logEnabled) {
      const prefix = description
        ? description.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 29)
        : "DeepGuard_Log";

      const logArgs = buildArgs("LOG");
      // Splice --log-prefix in before the final -j LOG
      const jIndex = logArgs.lastIndexOf("-j");
      logArgs.splice(jIndex, 0, "--log-prefix", `${prefix} `);
      await runIptables(logArgs);
    }

    // Add the actual action rule
    const actionArgs = buildArgs(action);
    await runIptables(actionArgs);

    res.json({
      message: "Rule(s) added successfully",
      command: `iptables ${actionArgs.join(" ")}`,
    });
  } catch (error) {
    console.error("Add rule error:", error);
    res.status(500).json({ error: "Failed to add rule", details: error });
  }
});

// ── DELETE /delete-rule ───────────────────────────────────────────────────────
app.delete("/delete-rule", async (req, res) => {
  const { chain, ruleNum } = req.query;

  if (!chain || !ruleNum) {
    return res.status(400).json({ error: "Missing required fields: 'chain' and 'ruleNum'" });
  }
  if (!/^\d+$/.test(ruleNum)) {
    return res.status(400).json({ error: "Invalid rule number. Must be an integer." });
  }
  if (!isValidChain(chain)) {
    return res.status(400).json({ error: "Invalid chain name." });
  }

  try {
    await runIptables(["-D", chain, ruleNum]);
    res.json({ message: `Successfully deleted rule #${ruleNum} from chain ${chain}` });
  } catch (error) {
    console.error("Delete error:", error);
    if (error.toString().includes("Bad rule") || error.toString().includes("Index of deletion")) {
      return res.status(404).json({ error: "Rule not found or index out of range." });
    }
    res.status(500).json({ error: "Failed to delete rule", details: error.toString() });
  }
});

// ── GET /list ─────────────────────────────────────────────────────────────────
// Accepts optional ?chain=FORWARD query param, defaults to INPUT
app.get("/list", async (req, res) => {
  const chain = req.query.chain || "INPUT";

  if (!isValidChain(chain)) {
    return res.status(400).json({ error: "Invalid chain name." });
  }

  try {
    const stdout = await runIptables(["-L", chain, "--line-numbers"]);
    res.json({
      message: "Rules listed successfully",
      output: parseIptablesOutput(stdout),
    });
  } catch (error) {
    console.error("List error:", error);
    res.status(500).json({ error: "Failed to list rules", details: error.toString() });
  }
});

// ── GET /health ───────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── Start on Unix socket ──────────────────────────────────────────────────────
fs.mkdirSync("/tmp/iptables-proxy", { recursive: true });

if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);

app.listen(SOCKET_PATH, () => {
  fs.chmodSync(SOCKET_PATH, "600"); // root-only access
  console.log(`iptables-proxy listening on ${SOCKET_PATH}`);
});