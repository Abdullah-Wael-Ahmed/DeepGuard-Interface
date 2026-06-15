const express = require("express");
const { addRule, deleteRule, listRules } = require("../util/iptables");

const router = express.Router();

// ── POST /add-rule ────────────────────────────────────────────────────────────
router.post("/add-rule", async (req, res) => {
  let {
    chain, action, protocol, srcIp, destIp,
    srcPort, dstPort, inInterface, outInterface,
    logEnabled, description,
  } = req.body;

  // Convert 0.0.0.0 to 0.0.0.0/0 (CIDR notation for "everywhere")
  if (srcIp?.trim() === "0.0.0.0") srcIp = "0.0.0.0/0";
  if (destIp?.trim() === "0.0.0.0") destIp = "0.0.0.0/0";

  try {
    const result = await addRule({
      chain, action, protocol, srcIp, destIp,
      srcPort, dstPort, inInterface, outInterface,
      logEnabled, description,
    });
    res.json(result);
  } catch (error) {
    console.error("Add rule error:", error);
    // Proxy returns a structured error object for validation failures
    const status = error?.error ? 400 : 500;
    res.status(status).json({ error: "Failed to add rule", details: error });
  }
});

// ── DELETE /delete-rule ───────────────────────────────────────────────────────
router.delete("/delete-rule", async (req, res) => {
  const { chain, ruleNum } = req.query;

  if (!chain || !ruleNum) {
    return res.status(400).json({
      error: "Missing required fields: 'chain' and 'ruleNum' are required.",
    });
  }

  try {
    const result = await deleteRule(chain, ruleNum);
    res.json(result);
  } catch (error) {
    console.error("Delete rule error:", error);
    if (error?.error?.includes("not found") || error?.error?.includes("index out of range")) {
      return res.status(404).json(error);
    }
    res.status(500).json({ error: "Failed to delete rule", details: error });
  }
});

// ── GET /list ─────────────────────────────────────────────────────────────────
router.get("/list", async (req, res) => {
  try {
    const inputRes = await listRules("INPUT");
    const forwardRes = await listRules("FORWARD");
    const outputRes = await listRules("OUTPUT");

    // Combine all rules
    const combinedRules = [
      ...(inputRes?.output || []),
      ...(forwardRes?.output || []),
      ...(outputRes?.output || [])
    ];

    res.json({ message: "Rules listed successfully", output: combinedRules });
  } catch (error) {
    console.error("List rules error:", error);
    res.status(500).json({ error: "Failed to list rules", details: error });
  }
});

// ── GET /debug-user ───────────────────────────────────────────────────────────
// Kept for debugging — shows which user the backend process is running as
const { exec } = require("child_process");

router.get("/debug-user", (req, res) => {
  exec("whoami && id", (err, stdout) => {
    res.json({
      runningAs: stdout.trim(),
      note: "The iptables-proxy service handles privileged operations — this backend user no longer needs sudo.",
    });
  });
});

module.exports = router;