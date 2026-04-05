// ============================================================
// backend/routes/settings.js
// LinguaVoice — Settings API
// Handles accent, native language, display name, and account deletion.
// ============================================================
const router = require("express").Router();
const admin  = require("firebase-admin");

// ─── Auth Helper ─────────────────────────────────────────────────────────────
async function verifyToken(req) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try { return await admin.auth().verifyIdToken(token); } catch { return null; }
}

// ─── POST /api/settings/accent ────────────────────────────────────────────────
// Save updated accent_preference to Firestore.
router.post("/accent", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const { accent } = req.body;
  if (!accent || !["american", "british"].includes(accent)) {
    return res.status(400).json({ error: "Invalid accent. Must be 'american' or 'british'." });
  }

  try {
    const db = admin.firestore();
    await db.collection("users").doc(decoded.uid).update({
      accent_preference: accent,
    });
    return res.json({ success: true, accent });
  } catch (err) {
    console.error("[Settings/accent] Error:", err.message);
    return res.status(500).json({ error: "Failed to update accent preference." });
  }
});

// ─── PATCH /api/settings/language ─────────────────────────────────────────────
// Update native_language preference.
router.patch("/language", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const { native_language } = req.body;
  if (!native_language) {
    return res.status(400).json({ error: "native_language is required." });
  }

  try {
    const db = admin.firestore();
    await db.collection("users").doc(decoded.uid).update({
      native_language,
    });
    return res.json({ success: true, native_language });
  } catch (err) {
    console.error("[Settings/language] Error:", err.message);
    return res.status(500).json({ error: "Failed to update native language." });
  }
});

// ─── PATCH /api/settings/display-name ─────────────────────────────────────────
// Update display name in Firestore. Firebase Auth profile is a separate concern.
router.patch("/display-name", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const { display_name } = req.body;
  if (!display_name || display_name.trim().length === 0) {
    return res.status(400).json({ error: "display_name cannot be empty." });
  }

  try {
    const db = admin.firestore();
    await db.collection("users").doc(decoded.uid).update({
      display_name: display_name.trim(),
    });
    return res.json({ success: true, display_name: display_name.trim() });
  } catch (err) {
    console.error("[Settings/display-name] Error:", err.message);
    return res.status(500).json({ error: "Failed to update display name." });
  }
});

// ─── DELETE /api/settings/account ─────────────────────────────────────────────
// Permanently delete: Firebase Auth user + Firestore document.
// Frontend must show a confirmation dialog before calling this.
router.delete("/account", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const uid = decoded.uid;
  const db  = admin.firestore();

  try {
    // Delete Firestore user document
    await db.collection("users").doc(uid).delete();

    // Delete Firebase Auth user
    await admin.auth().deleteUser(uid);

    console.log(`[Settings/account] Deleted account for uid: ${uid}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("[Settings/account] Error:", err.message);
    return res.status(500).json({ error: "Failed to delete account." });
  }
});

module.exports = router;
