const XP_REWARDS = {
  // ─── Existing (do not change) ───────────────────────────────
  LESSON_COMPLETE: 50,
  PRONUNCIATION_75_89: 10,
  PRONUNCIATION_90_100: 25,
  VOCAB_REVIEW_COMPLETE: 20,
  STREAK_3_DAY: 15,
  STREAK_7_DAY: 40,
  FIRST_LESSON_BONUS: 100,

  // ─── New: score-band lesson rewards ─────────────────────────
  LESSON_SCORE_90_100: 150,
  LESSON_SCORE_70_89: 100,
  LESSON_SCORE_50_69: 60,
  LESSON_SCORE_BELOW_50: 30, // participation only — lesson not passed

  // ─── New: bonus XP ──────────────────────────────────────────
  PERFECT_SCORE: 50,        // flat bonus when score = 100%
  STREAK_BONUS: 0,          // handled as +20% of base in route logic
  FIRST_LESSON: 100,        // one-time welcome bonus (alias for FIRST_LESSON_BONUS)

  // ─── New: milestone ─────────────────────────────────────────
  A0_COMPLETION: 500,       // awarded when all 6 A0 alphabet lessons passed
};

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000];

const LEVEL_NAMES = [
  "Newcomer", "Beginner", "Confident Beginner", "Elementary",
  "Pre-Intermediate", "Intermediate", "Upper-Intermediate",
  "Advanced", "Expert", "Master"
];

const BADGES = [
  { id: "first_word", name: "First Word", description: "Completed your first lesson", hint: "Complete your first lesson" },
  { id: "consistent", name: "Consistent", description: "Maintained a 3-day streak", hint: "Keep a 3-day streak" },
  { id: "on_fire", name: "On Fire", description: "Maintained a 7-day streak", hint: "Keep a 7-day streak" },
  { id: "pronunciation_pro", name: "Pronunciation Pro", description: "Scored 90+ in a lesson", hint: "Score 90 or above in any lesson" },
  { id: "vocab_builder", name: "Vocab Builder", description: "Added 20 words to your notebook", hint: "Collect 20 vocabulary words" },
  { id: "halfway_there", name: "Halfway There", description: "Completed 5 modules", hint: "Complete 5 modules" },
  { id: "fluent", name: "Fluent", description: "Reached app level 5", hint: "Reach level 5" },
  { id: "dedicated", name: "Dedicated", description: "Completed 30 lessons", hint: "Complete 30 total lessons" }
];

const UNLOCK_THRESHOLDS = {
  A0: { min_score: 50, min_xp: 40  },
  A1: { min_score: 60, min_xp: 60  },
  A2: { min_score: 60, min_xp: 60  },
  B1: { min_score: 70, min_xp: 80  },
  B2: { min_score: 70, min_xp: 80  },
  C1: { min_score: 80, min_xp: 100 },
  C2: { min_score: 80, min_xp: 100 },
};

module.exports = { XP_REWARDS, LEVEL_THRESHOLDS, LEVEL_NAMES, BADGES, UNLOCK_THRESHOLDS };
