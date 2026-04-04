const admin = require("firebase-admin");
const { XP_REWARDS, LEVEL_THRESHOLDS, LEVEL_NAMES, BADGES } = require("../constants/gamification");

/**
 * awardXP - Central logic for handling gamification events.
 * @param {string} userId - User's UID
 * @param {string} eventType - Key from XP_REWARDS
 * @returns {Promise<Object>} The result of the XP award and any secondary unlocks.
 */
async function awardXP(userId, eventType) {
  const db = admin.firestore();
  const userRef = db.collection("users").doc(userId);

  try {
    const result = await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new Error("User document not found");

      const userData = snap.data();
      let currentXp = userData.xp || 0;
      let currentLevel = userData.app_level || 1;
      let currentBadges = userData.badges || [];
      const streak = userData.streak_days || 0;
      const progress = userData.progress || {};
      const lessonsCompletedCount = (progress.sessions_completed || []).length; 
      // Note: Re-checking schema: AuthRoute had 'lessons_completed_this_week' but progress route 
      // seemed to use 'progress.lessons_completed' or similar. 
      // I will use 'userData.lessons_completed_count' or fall back to an internal calculation
      // if not explicitly stored. Let's stick to the prompt's implied fields.
      const modulesUnlocked = userData.modules_unlocked || 0;

      const xpAwarded = XP_REWARDS[eventType] || 0;
      const newTotalXp = currentXp + xpAwarded;

      // Calculate new level
      let newLevel = currentLevel;
      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (newTotalXp >= LEVEL_THRESHOLDS[i]) {
          newLevel = i + 1;
          break;
        }
      }

      const leveledUp = newLevel > currentLevel;

      // Check Badges
      const newBadgesUnlocked = [];
      
      const checkBadge = async (badgeId, condition) => {
        if (!currentBadges.includes(badgeId) && condition) {
          currentBadges.push(badgeId);
          const badgeDef = BADGES.find(b => b.id === badgeId);
          newBadgesUnlocked.push(badgeDef);
        }
      };

      // In Step 3, the prompt mentions "vocab subcollection count >= 20"
      // Getting a count in a transaction can be tricky but possible with a separate read.
      // However, we are INSIDE a transaction. 
      // Actually, we can count it outside if needed, but let's see if we can simplify.
      let vocabCount = 0;
      if (!currentBadges.includes("vocab_builder")) {
          const vocabSnap = await db.collection("users").doc(userId).collection("vocabulary").count().get();
          vocabCount = vocabSnap.data().count;
      }

      // badge logic
      await checkBadge("first_word", (userData.lessons_completed_count || lessonsCompletedCount) >= 1);
      await checkBadge("consistent", streak >= 3);
      await checkBadge("on_fire", streak >= 7);
      await checkBadge("pronunciation_pro", eventType === "PRONUNCIATION_90_100");
      await checkBadge("vocab_builder", vocabCount >= 20);
      await checkBadge("halfway_there", modulesUnlocked >= 5);
      await checkBadge("fluent", newLevel >= 5);
      await checkBadge("dedicated", (userData.lessons_completed_count || lessonsCompletedCount) >= 30);

      // Update Firestore
      const updateData = {
        xp: newTotalXp,
        app_level: newLevel,
        badges: currentBadges
      };
      
      t.update(userRef, updateData);

      return {
        xp_awarded: xpAwarded,
        new_total_xp: newTotalXp,
        leveled_up: leveledUp,
        new_level: newLevel,
        new_level_name: LEVEL_NAMES[newLevel - 1] || "Master",
        new_badges: newBadgesUnlocked
      };
    });

    return result;

  } catch (err) {
    console.error("[awardXP Helper Error]", err);
    throw err;
  }
}

module.exports = awardXP;
