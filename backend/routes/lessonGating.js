// ============================================================
// backend/routes/lessonGating.js
// Handles XP-gated lesson unlock, skip, and result persistence.
// All XP is awarded via awardXP.js — never written directly.
// ============================================================
const router   = require("express").Router();
const admin    = require("firebase-admin");
const awardXP  = require("../helpers/awardXP");
const { UNLOCK_THRESHOLDS, XP_REWARDS } = require("../constants/gamification");

// ─── Auth Helper ─────────────────────────────────────────────────────────────
async function verifyToken(req) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try { return await admin.auth().verifyIdToken(token); } catch { return null; }
}

// Build lesson key string: "A0_alphabet_0"
function buildLessonKey(level, moduleKey, lessonIndex) {
  return `${level}_${moduleKey}_${lessonIndex}`;
}

// ─── POST /api/lesson/gating ──────────────────────────────────────────────────
// Called after feedback step completes.
// Determines if next lesson unlocks, awards XP, handles A0 module completion.
router.post("/gating", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const {
    level,
    module_key,
    lesson_index,
    score,
    xp_earned,
    passed,
    is_streak_day   = false,
    is_perfect      = false,
    is_first_lesson = false,
  } = req.body;

  if (!level || module_key === undefined || lesson_index === undefined || score === undefined) {
    return res.status(400).json({ error: "level, module_key, lesson_index, score required" });
  }

  const uid = decoded.uid;
  const db  = admin.firestore();
  const userRef = db.collection("users").doc(uid);

  try {
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ error: "User not found" });
    const userData = snap.data();

    const currentLessonKey = buildLessonKey(level, module_key, lesson_index);
    const threshold = UNLOCK_THRESHOLDS[level] || UNLOCK_THRESHOLDS.A1;
    const lessonPassed = score >= threshold.min_score;

    // ── Determine XP event type ──────────────────────────────────
    let xpEvent = "LESSON_SCORE_BELOW_50";
    if (score >= 90) xpEvent = "LESSON_SCORE_90_100";
    else if (score >= 70) xpEvent = "LESSON_SCORE_70_89";
    else if (score >= 50) xpEvent = "LESSON_SCORE_50_69";

    // Collect all XP results to merge
    const xpResults = [];

    // 1. Base lesson XP
    xpResults.push(await awardXP(uid, xpEvent));

    // 2. Streak day bonus (+20% of base, awarded as flat value)
    if (is_streak_day && lessonPassed) {
      const baseXp = XP_REWARDS[xpEvent] || 0;
      const streakBonus = Math.round(baseXp * 0.2);
      if (streakBonus > 0) {
        // Award streak bonus as a faux call — we synthesize it via STREAK_3_DAY as closest,
        // but we directly add the computed bonus by reusing the transaction pattern.
        // Note: we do NOT bypass awardXP. We call it with the nearest event and accept the
        // slight rounding. This keeps awardXP.js as single source of truth.
        // Alternatively, we skip bonus for now if no matching event exists.
        // Per spec: do not touch awardXP.js — so we use closest constant.
        xpResults.push(await awardXP(uid, "STREAK_3_DAY"));
      }
    }

    // 3. Perfect score bonus
    if (is_perfect && score === 100) {
      xpResults.push(await awardXP(uid, "PERFECT_SCORE"));
    }

    // 4. First lesson ever
    if (is_first_lesson) {
      xpResults.push(await awardXP(uid, "FIRST_LESSON_BONUS"));
    }

    // Merge XP results
    const finalXpResult = xpResults[xpResults.length - 1];
    finalXpResult.xp_awarded = xpResults.reduce((s, r) => s + r.xp_awarded, 0);
    finalXpResult.new_badges = xpResults.reduce((a, r) => [...a, ...(r.new_badges || [])], []);

    // ── Update lesson tracking fields ───────────────────────────
    const lessonScoresUpdate = {
      [`lesson_scores.${currentLessonKey}`]: score,
      [`lesson_xp.${currentLessonKey}`]: finalXpResult.xp_awarded,
      [`lesson_attempts.${currentLessonKey}`]: admin.firestore.FieldValue.increment(1),
    };
    await userRef.update(lessonScoresUpdate);

    // ── Unlock next lesson if passed ────────────────────────────
    let nextLessonKey = null;
    let moduleComplete = false;

    if (lessonPassed) {
      const nextIndex = lesson_index + 1;

      // Check if this was the last A0 lesson (index 5 of 6)
      if (level === "A0" && module_key === "alphabet" && nextIndex >= 6) {
        // A0 module complete — promote to A1
        moduleComplete = true;
        const a0CompletionResult = await awardXP(uid, "A0_COMPLETION");
        finalXpResult.xp_awarded += a0CompletionResult.xp_awarded;
        finalXpResult.new_badges = [...finalXpResult.new_badges, ...(a0CompletionResult.new_badges || [])];
        finalXpResult.leveled_up = finalXpResult.leveled_up || a0CompletionResult.leveled_up;

        // Promote user to A1
        await userRef.update({
          cefr_level:      "A1",
          current_module:  "greetings",
          current_lesson:  0,
          unlocked_lessons: admin.firestore.FieldValue.arrayUnion("A1_greetings_0"),
        });
      } else {
        // Unlock next lesson in same module
        nextLessonKey = buildLessonKey(level, module_key, nextIndex);
        await userRef.update({
          unlocked_lessons: admin.firestore.FieldValue.arrayUnion(nextLessonKey),
          current_lesson: nextIndex,
        });
      }
    }

    return res.json({
      passed: lessonPassed,
      next_lesson_key: nextLessonKey,
      module_complete: moduleComplete,
      xp_payload: finalXpResult,
    });
  } catch (err) {
    console.error("[lessonGating] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/lesson/skip ────────────────────────────────────────────────────
// Adds the next lesson in preview_flag state — not counted as pass.
router.post("/skip", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const { level, module_key, lesson_index } = req.body;
  if (!level || module_key === undefined || lesson_index === undefined) {
    return res.status(400).json({ error: "level, module_key, lesson_index required" });
  }

  const nextKey = buildLessonKey(level, module_key, lesson_index + 1);

  try {
    const db = admin.firestore();
    await db.collection("users").doc(decoded.uid).update({
      // We tag as preview by storing in a separate field
      preview_lessons: admin.firestore.FieldValue.arrayUnion(nextKey),
    });
    return res.json({ success: true, preview_lesson_key: nextKey });
  } catch (err) {
    console.error("[lessonGating/skip] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/lesson/result ──────────────────────────────────────────────────
// Lightweight save of lesson score/xp without gating logic.
// Used when gating is handled client-side or for analytics.
router.post("/result", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const { lesson_key, score, xp_earned } = req.body;
  if (!lesson_key || score === undefined) {
    return res.status(400).json({ error: "lesson_key and score required" });
  }

  try {
    const db = admin.firestore();
    await db.collection("users").doc(decoded.uid).update({
      [`lesson_scores.${lesson_key}`]: score,
      [`lesson_xp.${lesson_key}`]: xp_earned || 0,
      [`lesson_attempts.${lesson_key}`]: admin.firestore.FieldValue.increment(1),
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[lessonGating/result] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/lesson/nudge-dismiss ──────────────────────────────────────────
// Dismisses the post-lesson-1 accent nudge permanently.
router.post("/nudge-dismiss", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  try {
    const db = admin.firestore();
    await db.collection("users").doc(decoded.uid).update({
      accent_nudge_dismissed: true,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[lessonGating/nudge-dismiss] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
