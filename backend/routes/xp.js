const router = require("express").Router();
const admin = require("firebase-admin");
const awardXP = require("../helpers/awardXP");

// Middleware to verify Firebase token for XP award route
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No auth token provided" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── POST /api/xp/award ──────────────────────────────────────────────
// Called by frontend after significant events (lesson, vocab, streak)
router.post("/award", verifyToken, async (req, res) => {
  const { event_type } = req.body;

  if (!event_type) {
    return res.status(400).json({ error: "Missing event_type in body" });
  }

  try {
    const result = await awardXP(req.uid, event_type);
    return res.json(result);
  } catch (err) {
    console.error("[XP Route Error]", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
