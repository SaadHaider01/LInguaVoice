const router = require("express").Router();
const admin = require("firebase-admin");
const awardXP = require("../helpers/awardXP");

// Helper to verify token securely
async function verifyToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try { return await admin.auth().verifyIdToken(token); } catch { return null; }
}

// Ensure proper midnight-bounded dates
function getMidnightDate(addDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  d.setHours(0,0,0,0);
  return d.toISOString();
}

// ─── POST /api/vocab/add ─────────────────────────────────────────────
router.post("/add", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const { word, definition, example_sentence, source_module } = req.body;
  if (!word) return res.status(400).json({ error: "Missing word parameter" });

  try {
    const db = admin.firestore();
    const vocabRef = db.collection("users").doc(decoded.uid).collection("vocabulary");
    
    // Check if word exists (using word text as doc ID lowercased)
    const docId = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!docId) return res.status(400).json({ error: "Invalid word" });

    const docTarget = vocabRef.doc(docId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(docTarget);
      if (doc.exists) {
        // Just increment review count slightly safely, maybe shift next review date? 
        // We'll just bump review_count for now so SM-2 stays intact.
        t.update(docTarget, { review_count: admin.firestore.FieldValue.increment(1) });
      } else {
        const todayStr = getMidnightDate(); 
        t.set(docTarget, {
          word,
          definition: definition || "No definition provided.",
          example_sentence: example_sentence || "No example provided.",
          first_seen_date: todayStr,
          last_reviewed_date: todayStr,
          review_count: 0,
          ease_factor: 2.5,
          interval: 1, // days
          next_review_date: todayStr, // immediately due for learning!
          source_module: source_module || "General"
        });
      }
    });

    res.json({ success: true, word });
  } catch (err) {
    console.error("[Vocab Add Error]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/vocab ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  try {
    const db = admin.firestore();
    const snap = await db.collection("users").doc(decoded.uid).collection("vocabulary")
      .orderBy("next_review_date", "asc")
      .get();
      
    const words = [];
    snap.forEach(d => words.push({ id: d.id, ...d.data() }));
    res.json({ words });
  } catch (err) {
    console.error("[Vocab Get Error]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/vocab/due ──────────────────────────────────────────────
router.get("/due", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  try {
    const db = admin.firestore();
    const todayStr = getMidnightDate(); // Current midnight
    
    // Firebase inequality filters: <= today maps dynamically to "due today or past due"
    const snap = await db.collection("users").doc(decoded.uid).collection("vocabulary")
      .where("next_review_date", "<=", todayStr)
      .orderBy("next_review_date", "asc")
      .get();
      
    const dueWords = [];
    snap.forEach(d => dueWords.push({ id: d.id, ...d.data() }));
    res.json({ dueWords });
  } catch (err) {
    console.error("[Vocab Due Error]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/vocab/review ──────────────────────────────────────────
router.post("/review", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const { word_id, quality } = req.body;
  if (!word_id || quality === undefined) return res.status(400).json({ error: "Missing fields" });

  try {
    const db = admin.firestore();
    const targetRef = db.collection("users").doc(decoded.uid).collection("vocabulary").doc(word_id);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(targetRef);
      if (!doc.exists) throw new Error("Word missing");

      const data = doc.data();
      let ef = data.ease_factor || 2.5;
      let interval = data.interval || 1;
      
      // SM-2 logic block
      // 0 = Forgot, 2 = Hard, 4 = Good, 5 = Easy
      ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (ef < 1.3) ef = 1.3;

      if (quality < 3) {
        // Failed retention, drop interval back to 1
        interval = 1;
      } else {
        // Successful retention, scale up interval
        // First repetition
        if (data.review_count === 0) {
           interval = 1;
        } else if (data.review_count === 1) {
           interval = 6;
        } else {
           interval = Math.max(1, Math.round(interval * ef));
        }
      }

      const todayStr = getMidnightDate(); 
      const nextReviewStr = getMidnightDate(interval);

      t.update(targetRef, {
        ease_factor: ef,
        interval: interval,
        review_count: (data.review_count || 0) + 1,
        last_reviewed_date: todayStr,
        next_review_date: nextReviewStr
      });
    });

    // ─── Gamification Hook ───
    let xp_payload = null;
    if (req.body.is_last_word) {
       xp_payload = await awardXP(decoded.uid, "VOCAB_REVIEW_COMPLETE");
    }

    res.json({ success: true, xp_payload });
  } catch (err) {
    console.error("[Vocab Review Error]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
