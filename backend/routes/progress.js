const router = require("express").Router();
const admin = require("firebase-admin");
const awardXP = require("../helpers/awardXP");

// Helper
async function verifyToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try { return await admin.auth().verifyIdToken(token); } catch { return null; }
}

// ─── GET /api/progress ───────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  try {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userSnap.data();
    const progress = userData.progress || { lessons_completed: [] };
    const completedModules = progress.lessons_completed;
    
    // Fetch last 14 sessions
    // Removed .where("completed") to bypass composite index requirement
    // orderBy automatically filters out documents where completed_at doesn't exist
    const sessionsSnap = await userRef.collection("sessions")
      .orderBy("completed_at", "desc")
      .limit(20)
      .get();
      
    const sessionHistory = [];
    sessionsSnap.forEach(doc => {
      const d = doc.data();
      if (!d.completed) return; // double check manual filter
      if (sessionHistory.length >= 14) return;
      sessionHistory.unshift({ // unshift to reverse order chronologically
        id: doc.id,
        module_id: d.module_id,
        score: d.final_score || 0,
        date: d.completed_at ? d.completed_at.toDate().toISOString() : new Date().toISOString()
      });
    });

    // Calculate Vocab Due
    const todayD = new Date();
    todayD.setHours(0,0,0,0);
    const todayStr = todayD.toISOString(); 
    const vocabSnap = await userRef.collection("vocabulary")
      .where("next_review_date", "<=", todayStr)
      .get();
    const vocab_due_count = vocabSnap.size;

    res.json({
      streak: userData.streak_days || 0,
      longest_streak: userData.longest_streak || userData.streak_days || 0,
      cefr_level: userData.assessment?.level || "A1",
      total_sessions: userData.lessons_completed_this_week ? userData.lessons_completed_this_week.length : 0, 
      // Note: lessons_completed_this_week is just an array of timestamps, rename might be needed but it tracks count
      modules_unlocked: completedModules,
      session_history: sessionHistory,
      last_active: userData.last_active || null,
      vocab_due_count: vocab_due_count
    });

  } catch (err) {
    console.error("[Progress GET Error]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/progress/streak/checkin ───────────────────────────────────────
router.post("/streak/checkin", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  try {
    const db = admin.firestore();
    const userRef = db.collection("users").doc(decoded.uid);
    
    const { finalStreak, updated } = await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
      if (!doc.exists) throw new Error("User missing");

      const data = doc.data();
      let streak = data.streak_days || 0;
      let longestStreak = data.longest_streak || streak;
      
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
      let lastActiveStr = data.last_active;
      // Convert Firestore Timestamp to YYYY-MM-DD string if necessary
      if (lastActiveStr && typeof lastActiveStr.toDate === 'function') {
        lastActiveStr = lastActiveStr.toDate().toISOString().split("T")[0];
      }
      
      if (lastActiveStr === todayStr) {
        // Already checked in today
        return { finalStreak: streak, updated: false };
      }
      
      if (lastActiveStr) {
        const lastActiveDate = new Date(lastActiveStr);
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        
        if (lastActiveStr === yesterdayStr) {
           streak += 1;
        } else {
           streak = 1; // missed a day
        }
      } else {
        streak = 1; // first checkin
      }
      
      if (streak > longestStreak) {
        longestStreak = streak;
      }
      
      // Update completion marks
      const logs = data.lessons_completed_this_week || [];
      // Just to keep a visual track of dates
      if (!logs.includes(todayStr)) {
         logs.push(todayStr);
      }

      t.update(userRef, {
        streak_days: streak,
        longest_streak: longestStreak,
        last_active: todayStr,
        lessons_completed_this_week: logs
      });
      return { finalStreak: streak, updated: true };
    });
    
    let xp_payload = null;
    if (updated) {
      if (finalStreak === 3) {
        xp_payload = await awardXP(decoded.uid, "STREAK_3_DAY");
      } else if (finalStreak === 7) {
        xp_payload = await awardXP(decoded.uid, "STREAK_7_DAY");
      }
    }

    res.json({ success: true, streak_days: finalStreak, xp_payload });
    
  } catch (err) {
    console.error("[Streak Checkin Error]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
