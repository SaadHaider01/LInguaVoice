const XP_REWARDS = {
  LESSON_COMPLETE: 50,
  PRONUNCIATION_75_89: 10,
  PRONUNCIATION_90_100: 25,
  VOCAB_REVIEW_COMPLETE: 20,
  STREAK_3_DAY: 15,
  STREAK_7_DAY: 40,
  FIRST_LESSON_BONUS: 100
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

module.exports = { XP_REWARDS, LEVEL_THRESHOLDS, LEVEL_NAMES, BADGES };
