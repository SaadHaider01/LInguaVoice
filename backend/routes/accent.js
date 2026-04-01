// ============================================================
// backend/routes/accent.js
// LinguaVoice — Step 4: Accent Selection Route
//
// POST /api/accent/select
//   Saves user's chosen accent to Firestore
//
// GET /api/accent/preview?accent=american|british
//   Streams a TTS preview audio clip from Flask
// ============================================================
const router = require("express").Router();
const admin  = require("firebase-admin");
const axios  = require("axios");

const FLASK_URL = process.env.FLASK_URL || "http://localhost:5000";

// ─── Auth helper ──────────────────────────────────────────────
async function verifyToken(req) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try { return await admin.auth().verifyIdToken(token); }
  catch { return null; }
}

// ─── POST /api/accent/select ──────────────────────────────────
router.post("/select", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const { accent } = req.body;
  if (!["american", "british"].includes(accent)) {
    return res.status(400).json({ error: "accent must be 'american' or 'british'" });
  }

  await admin.firestore().collection("users").doc(decoded.uid).update({
    preferred_accent: accent,
    last_active: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[Accent] uid=${decoded.uid} selected accent: ${accent}`);
  return res.json({ success: true, accent });
});

// ─── GET /api/accent/preview?accent=american|british ─────────
// Proxies to Flask /synthesize and streams raw audio back
router.get("/preview", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const accent = req.query.accent || "american";
  // Short texts synthesize in ~3-5s on CPU vs 30+ for long sentences
  const previewTexts = {
    american: "Hi! I'm your American English coach. Let's improve together!",
    british:  "Hello! I'm your British English coach. Shall we begin?",
  };

  const text = previewTexts[accent] || previewTexts.american;

  try {
    const flaskRes = await axios.post(
      `${FLASK_URL}/synthesize`,
      { text, accent },
      { responseType: "arraybuffer", timeout: 90_000 }  // 90s — Kokoro cold start can take 40s on CPU
    );

    res.set("Content-Type", "audio/wav");
    res.set("Cache-Control", "no-store");
    return res.send(Buffer.from(flaskRes.data));
  } catch (err) {
    console.error("[Accent] TTS preview error:", err.message);
    return res.status(503).json({ error: "TTS service unavailable" });
  }
});

module.exports = router;
