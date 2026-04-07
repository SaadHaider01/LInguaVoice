// ============================================================
// frontend/src/config/curriculum.js
// A0 Alphabet curriculum definition and unlock thresholds.
// Mirror relevant parts in backend if lesson routing needs it.
// ============================================================

// Minimum score and XP required to unlock the next lesson, per CEFR level
export const UNLOCK_THRESHOLDS = {
  A0: { min_score: 50, min_xp: 40  },
  A1: { min_score: 60, min_xp: 60  },
  A2: { min_score: 60, min_xp: 60  },
  B1: { min_score: 70, min_xp: 80  },
  B2: { min_score: 70, min_xp: 80  },
  C1: { min_score: 80, min_xp: 100 },
  C2: { min_score: 80, min_xp: 100 },
};

// XP awards by score band (used in lessonGating.js)
export const SCORE_XP_MAP = [
  { min: 90, max: 100, event: "LESSON_SCORE_90_100", xp: 150 },
  { min: 70, max: 89,  event: "LESSON_SCORE_70_89",  xp: 100 },
  { min: 50, max: 69,  event: "LESSON_SCORE_50_69",  xp: 60  },
  { min: 0,  max: 49,  event: "LESSON_SCORE_BELOW_50", xp: 30 },
];

// A0 Alphabet module — 6 lessons
export const A0_ALPHABET_MODULE = {
  level: "A0",
  module: "alphabet",
  title: "Alphabet Module",
  total_lessons: 6,
  lessons: [
    {
      index: 0,
      key: "A0_alphabet_0",
      topic: "vowel_sounds",
      title: "Letters A to E",
      letters: ['A', 'B', 'C', 'D', 'E'],
      goal: "A0 Lesson 0",
      unlock_threshold: null,
    },
    {
      index: 1,
      key: "A0_alphabet_1",
      topic: "easy_consonants",
      title: "Letters F to K",
      letters: ['F', 'G', 'H', 'I', 'J', 'K'],
      goal: "A0 Lesson 1",
      unlock_threshold: { min_score: 50, min_xp: 40 },
    },
    {
      index: 2,
      key: "A0_alphabet_2",
      topic: "hard_consonants",
      title: "Letters L to Q",
      letters: ['L', 'M', 'N', 'O', 'P', 'Q'],
      goal: "A0 Lesson 2",
      unlock_threshold: { min_score: 50, min_xp: 40 },
    },
    {
      index: 3,
      key: "A0_alphabet_3",
      topic: "cvc_blending",
      title: "Letters R to V",
      letters: ['R', 'S', 'T', 'U', 'V'],
      goal: "A0 Lesson 3",
      unlock_threshold: { min_score: 50, min_xp: 40 },
    },
    {
      index: 4,
      key: "A0_alphabet_4",
      topic: "first_words",
      title: "Letters W to Z",
      letters: ['W', 'X', 'Y', 'Z'],
      goal: "A0 Lesson 4",
      unlock_threshold: { min_score: 50, min_xp: 40 },
    },
    {
      index: 5,
      key: "A0_alphabet_5",
      title: "Review Words",
      topic: "review",
      words: ["cat", "dog", "sun", "run", "big", "red"],
      goal: "A0 Lesson 5 Review",
      unlock_threshold: { min_score: 50, min_xp: 40 },
    },
  ],
};

// Build a flat lookup map: lessonKey → lesson definition
export const LESSON_MAP = {
  ...Object.fromEntries(
    A0_ALPHABET_MODULE.lessons.map((l) => [l.key, { ...l, level: "A0", module: "alphabet" }])
  ),
};

// Get lesson definition by key
export function getLessonByKey(key) {
  return LESSON_MAP[key] || null;
}

// Build lesson key string
export function buildLessonKey(level, module, lessonIndex) {
  return `${level}_${module}_${lessonIndex}`;
}

// Get A1+ module list (these map to the existing curriculum in backend)
export const A1_PLUS_MODULES = [
  { key: "greetings",       title: "Greetings",        icon: "👋", level_group: "beginner" },
  { key: "basic_questions", title: "Basic Questions",   icon: "❓", level_group: "beginner" },
  { key: "work_routine",    title: "Work & Routine",    icon: "💼", level_group: "intermediate" },
  { key: "asking_for_help", title: "Asking for Help",   icon: "🆘", level_group: "beginner" },
];
