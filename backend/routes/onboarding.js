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
// Called when:
//   A) Zero-knowledge checkbox ticked (is_zero_knowledge = true)
//   B) After diagnostic completes (cefr_level set externally, called again)
// onboarding_complete set ONLY when BOTH:
//   Condition A: native_language is set (not null/empty)
//   Condition B: is_zero_knowledge = true OR cefr_level is set
router.post("/complete", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const db = admin.firestore();
  const userRef = db.collection("users").doc(decoded.uid);

  try {
    const {
      native_language,
      is_zero_knowledge,
      cefr_level,      // passed when zero-knowledge path chosen
    } = req.body;

    const updateData = {};

    // Write native_language if provided
    if (native_language) {
      updateData.native_language = native_language;
    }

    // Zero-knowledge path: assign A0 curriculum fields
    if (is_zero_knowledge === true) {
      updateData.is_zero_knowledge = true;
      updateData.cefr_level        = cefr_level || "A0";
      updateData.current_module    = "alphabet";
      updateData.current_lesson    = 0;
      updateData.current_step      = "warmup";
      updateData.unlocked_lessons  = admin.firestore.FieldValue.arrayUnion("A0_alphabet_0");
    } else {
      updateData.is_zero_knowledge = false;
    }

    // Check both conditions before setting onboarding_complete
    const snap = await userRef.get();
    const existing = snap.exists ? snap.data() : {};
    const effectiveLang    = native_language || existing.native_language;
    const effectiveZeroKnow = (is_zero_knowledge === true) || existing.is_zero_knowledge;
    const effectiveCefr    = cefr_level || existing.cefr_level;

    const conditionA = effectiveLang && effectiveLang !== "other_unset";
    const conditionB = effectiveZeroKnow || !!effectiveCefr;

    if (conditionA && conditionB) {
      updateData.onboarding_complete = true;
    }

    await userRef.update(updateData);
    return res.json({ success: true, onboarding_complete: !!(conditionA && conditionB) });
  } catch (err) {
    console.error("[Onboarding Complete Error]", err.message);
    return res.status(500).json({ error: "Failed to complete onboarding" });
  }
});

module.exports = router;
