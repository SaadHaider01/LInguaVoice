// ============================================================
// backend/routes/auth.js
// LinguaVoice — Auth routes
// Called by the frontend AFTER Firebase Auth creates the user.
// The backend's job: create the Firestore user document on first signup.
// ============================================================
const router = require("express").Router();
const admin  = require("firebase-admin");

// ─── POST /api/auth/create-user ──────────────────────────────────────────────
// Called once after successful Firebase Auth signup.
// Creates the user document in Firestore if it doesn't exist yet.
//
// Body: { uid, email, displayName, nativeLanguage? }
// Auth: Firebase ID token in Authorization header (verified here)
router.post("/create-user", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No auth token provided" });
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const { uid } = decoded;
  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);

  try {
    const snap = await userRef.get();
    if (snap.exists) {
      // Already exists — return current data (idempotent)
      return res.json({ created: false, user: snap.data() });
    }

    // Build the user document per the schema in the spec
    const now = admin.firestore.FieldValue.serverTimestamp();
    const userData = {
      email:                        decoded.email || req.body.email || "",
      display_name:                 decoded.name  || req.body.displayName || "Learner",
      created_at:                   now,
      native_language:              req.body.nativeLanguage || "unknown",
      target_language:              "English",
      preferred_accent:             null,          // set in Step 4
      subscription_plan:            "free",
      subscription_stripe_id:       null,
      subscription_expiry:          null,
      lessons_completed_this_week:  [],
      streak_days:                  0,
      last_active:                  now,
      assessment: {
        completed:              false,
        level:                  null,
        grammar_score:          null,
        vocabulary_score:       null,
        pronunciation_score:    null,
        fluency_score:          null,
        detected_native_accent: null,
        completed_date:         null,
      },
      xp: 0,
      app_level: 1,
      badges: [],
      onboarding_complete: false,
    };

    await userRef.set(userData);
    console.log(`[Auth] Created Firestore user doc for uid: ${uid}`);
    return res.status(201).json({ created: true, user: userData });

  } catch (err) {
    console.error("[Auth] Error creating user doc:", err.message);
    return res.status(500).json({ error: "Failed to create user document" });
  }
});


// ─── GET /api/auth/me ────────────────────────────────────────────────────────
// Returns the current user's Firestore document.
// Used by the frontend to hydrate user state on load.
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ error: "No auth token" });

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const snap = await admin.firestore().collection("users").doc(decoded.uid).get();
    if (!snap.exists) return res.status(404).json({ error: "User not found" });
    return res.json(snap.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


module.exports = router;
