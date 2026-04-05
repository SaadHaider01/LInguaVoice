// ============================================================
// frontend/src/utils/lessonGating.js
// XP-gated lesson progression logic.
// Called after feedback step completes to determine unlock.
// All XP awards go through the backend → awardXP.js — never direct.
// ============================================================

import { UNLOCK_THRESHOLDS, buildLessonKey, A0_ALPHABET_MODULE } from "../config/curriculum";

const API_URL = import.meta.env.VITE_API_URL;

/**
 * After a lesson's feedback step, determine if the next lesson unlocks.
 * Calls the backend which uses awardXP.js for all XP writes.
 *
 * @param {string} uid - Firebase user UID
 * @param {string} token - Firebase ID token
 * @param {object} params
 * @param {string} params.level        - CEFR level e.g. "A0"
 * @param {string} params.moduleKey    - e.g. "alphabet"
 * @param {number} params.lessonIndex  - current lesson index
 * @param {number} params.score        - 0–100 score from Flask
 * @param {number} params.xpEarned     - XP earned this lesson
 * @param {boolean} params.isStreakDay  - consecutive day bonus
 * @param {boolean} params.isPerfect   - score === 100
 * @param {boolean} params.isFirstLesson - very first lesson ever
 * @returns {Promise<{ passed, nextLessonKey, moduleComplete, xpPayload }>}
 */
export async function checkAndUnlockNextLesson(uid, token, params) {
  const {
    level,
    moduleKey,
    lessonIndex,
    score,
    xpEarned,
    isStreakDay = false,
    isPerfect = false,
    isFirstLesson = false,
  } = params;

  const threshold = UNLOCK_THRESHOLDS[level] || UNLOCK_THRESHOLDS.A1;
  const passed = score >= threshold.min_score && xpEarned >= threshold.min_xp;

  try {
    const res = await fetch(`${API_URL}/api/lesson/gating`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        level,
        module_key: moduleKey,
        lesson_index: lessonIndex,
        score,
        xp_earned: xpEarned,
        passed,
        is_streak_day: isStreakDay,
        is_perfect: isPerfect,
        is_first_lesson: isFirstLesson,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[lessonGating] Backend error:", err);
      return { passed, nextLessonKey: null, moduleComplete: false, xpPayload: null };
    }

    const data = await res.json();
    return {
      passed,
      nextLessonKey: data.next_lesson_key || null,
      moduleComplete: data.module_complete || false,
      xpPayload: data.xp_payload || null,
    };
  } catch (err) {
    console.error("[lessonGating] Network error:", err);
    return { passed, nextLessonKey: null, moduleComplete: false, xpPayload: null };
  }
}

/**
 * Record a skip for a failed lesson. The lesson is NOT marked as passed.
 * A preview_flag is added to unlocked_lessons so the next lesson is accessible
 * in preview mode only.
 */
export async function skipLesson(uid, token, { level, moduleKey, lessonIndex }) {
  try {
    const res = await fetch(`${API_URL}/api/lesson/skip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ level, module_key: moduleKey, lesson_index: lessonIndex }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[lessonGating] Skip error:", err);
    return null;
  }
}

/**
 * Save lesson score, XP, and attempt count to Firestore via backend.
 */
export async function saveLessonResult(token, { lessonKey, score, xpEarned }) {
  try {
    const res = await fetch(`${API_URL}/api/lesson/result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lesson_key: lessonKey, score, xp_earned: xpEarned }),
    });
    return await res.json();
  } catch (err) {
    console.error("[lessonGating] Save result error:", err);
    return null;
  }
}

/**
 * Determine the lesson card state for dashboard rendering.
 * @param {string} lessonKey
 * @param {string[]} unlockedLessons - array of unlocked lesson keys from Firestore
 * @param {object} lessonScores - map of lessonKey → score
 * @param {string[]} previewLessons - lesson keys in preview/skip state
 * @param {string} [level="A0"] - CEFR level for threshold lookup
 * @returns {"completed"|"unlocked"|"locked"|"retry"|"preview"}
 */
export function getLessonCardState(lessonKey, unlockedLessons = [], lessonScores = {}, previewLessons = [], level = "A0") {
  const threshold = UNLOCK_THRESHOLDS[level] || UNLOCK_THRESHOLDS.A0;
  const score = lessonScores[lessonKey];

  if (previewLessons.includes(lessonKey)) return "preview";

  if (score !== undefined) {
    if (score >= threshold.min_score) return "completed";
    return "retry"; // attempted but not passed
  }

  if (unlockedLessons.includes(lessonKey)) return "unlocked";
  return "locked";
}

/**
 * Check if all lessons in the A0 alphabet module are passed.
 */
export function isA0ModuleComplete(lessonScores = {}) {
  return A0_ALPHABET_MODULE.lessons.every(
    (l) => (lessonScores[l.key] || 0) >= UNLOCK_THRESHOLDS.A0.min_score
  );
}
