const router = require("express").Router();
const admin = require("firebase-admin");
const axios = require("axios");

const FLASK_URL = process.env.FLASK_URL || "http://localhost:5000";

// ─── Auth Helper ─────────────────────────────────────────────────────────────
async function verifyToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try { return await admin.auth().verifyIdToken(token); } catch { return null; }
}

// ─── TTS Helper ──────────────────────────────────────────────────────────────
async function generateAudioBase64(text, accent) {
  try {
    const res = await axios.post(`${FLASK_URL}/synthesize`, { text, accent }, {
      responseType: 'arraybuffer',
      timeout: 30000 
    });
    return Buffer.from(res.data).toString('base64');
  } catch (err) {
    console.error("[TTS Error]", err.message);
    return null; 
  }
}

// ─── GET /api/onboarding/intro ────────────────────────────────────────────────
router.get("/intro", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const db = admin.firestore();
  const userSnap = await db.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) return res.status(404).json({ error: "User not found" });
  
  const userData = userSnap.data();
  const accent = userData.preferred_accent || "american"; // default to american

  const systemPrompt = "You are Luna, a warm and encouraging English tutor. A new student has just joined LinguaVoice. Write a short friendly welcome message of exactly 3 sentences introducing yourself by name and explaining that you will first listen to them speak to understand their level, then build a personalized learning path. Sound like a real teacher, warm and human, not a robot. Return only the message text, no JSON.";

  try {
    const groqRes = await axios.post(`${FLASK_URL}/generate_response`, {
      system_prompt: systemPrompt,
      user_message: "Please introduce yourself to me.",
    }, { timeout: 60000 });

    const messageText = groqRes.data.response.trim();
    const audioBase64 = await generateAudioBase64(messageText, accent);

    return res.json({ message: messageText, audio: audioBase64 });
  } catch (err) {
    console.error("[Onboarding Intro Error]", err.message);
    return res.status(500).json({ error: "Failed to generate intro" });
  }
});

// ─── POST /api/onboarding/complete ───────────────────────────────────────────
router.post("/complete", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const db = admin.firestore();
  const userRef = db.collection("users").doc(decoded.uid);

  try {
    const { accent } = req.body;
    const updateData = { onboarding_complete: true };
    if (accent) {
      updateData.preferred_accent = accent;
    }

    await userRef.update(updateData);
    return res.json({ success: true });
  } catch (err) {
    console.error("[Onboarding Complete Error]", err.message);
    return res.status(500).json({ error: "Failed to complete onboarding" });
  }
});

module.exports = router;
