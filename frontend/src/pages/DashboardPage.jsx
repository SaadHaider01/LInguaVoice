// ============================================================
// frontend/src/pages/DashboardPage.jsx
// Step 2 version: shows welcome + user info + module placeholders.
// Full dashboard UI is built in Step 7.
// ============================================================
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LEVEL_THRESHOLDS, LEVEL_NAMES } from "../constants/gamification";
import "./dashboard.css";

const MODULES = [
  { icon: "👋", title: "Greetings",       desc: "Introduce yourself",      id: "module1" },
  { icon: "❓", title: "Basic Questions", desc: "Ask & answer questions",  id: "module2" },
  { icon: "💼", title: "Work & Routine",  desc: "Talk about your job",     id: "module3" },
  { icon: "🆘", title: "Asking for Help", desc: "Survival phrases",        id: "module4" },
];

export default function DashboardPage() {
  const { currentUser, userDoc, logout } = useAuth();
  const navigate = useNavigate();

  const displayName =
    userDoc?.display_name ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "Learner";

  const level        = userDoc?.assessment?.level || "A1";
  const accent       = userDoc?.preferred_accent  || null;
  const plan         = userDoc?.subscription_plan || "free";
  const streakDays   = userDoc?.streak_days       || 0;
  
  const completedLessons = userDoc?.progress?.lessons_completed || [];
  const xp = userDoc?.xp || 0;
  const appLevel = userDoc?.app_level || 1;

  // Calculate XP Progress
  const currentLevelIdx = appLevel - 1;
  const nextLevelIdx = appLevel;
  const currentThreshold = LEVEL_THRESHOLDS[currentLevelIdx] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[nextLevelIdx] || currentThreshold;
  const xpInLevel = xp - currentThreshold;
  const xpToNext = nextThreshold - currentThreshold;
  const progressPercent = nextThreshold > currentThreshold 
    ? Math.min(100, Math.max(0, (xpInLevel / xpToNext) * 100))
    : 100;
  const xpRemaining = nextThreshold - xp;
  const nextLevelName = LEVEL_NAMES[nextLevelIdx] || "Master";


  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err.message);
    }
  }

  const [vocabDueCount, setVocabDueCount] = useState(0);

  // Auto streak check-in when dashboard drops.
  useEffect(() => {
    async function checkin() {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/progress/streak/checkin`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.xp_payload) {
           window.dispatchEvent(new CustomEvent("gamification_pushed", { detail: data.xp_payload }));
        }
        refreshUserDoc(); // Pull latest score metadata.
      } catch (err) {
        console.error("Checkin ping failed", err);
      }
    }
    
    async function fetchVocabCount() {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/vocab/due`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.dueWords) setVocabDueCount(data.dueWords.length);
      } catch (e) {
        console.error("Vocab check failed", e);
      }
    }

    if (currentUser) {
      checkin();
      fetchVocabCount();
    }
  }, [currentUser]);

  return (
    <div className="dashboard-page">
      {/* ─── Nav ─── */}
      <nav className="dashboard-nav">
        <a href="/dashboard" className="nav-logo">
          🎤 <span>LinguaVoice</span>
        </a>
        <div className="nav-actions">
          <a href="/vocabulary" className="nav-link">Vocabulary</a>
          <a href="/badges" className="nav-link">Badges</a>
          <span className="nav-user" title={currentUser?.email}>
            {displayName}
          </span>
          <button id="dashboard-logout" className="btn-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </nav>

      {/* ─── Main ─── */}
      <main className="dashboard-main">
        <div className="welcome-hero">
          <div className="welcome-header">
            <h1>Welcome, {displayName} 👋</h1>
            <span className="level-pill">Lv. {appLevel}</span>
          </div>
          <p>Ready to practise your English today? Pick a module below.</p>
          
          <div className="xp-progress-container">
            <div className="xp-bar-bg">
              <div className="xp-bar-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <div className="xp-label">
              {xpRemaining > 0 
                ? `${xpRemaining} XP to Level ${appLevel + 1} (${nextLevelName})`
                : "Max Level Reached!"}
            </div>
          </div>
        </div>

        <div className="info-strip" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <span className="info-pill">📊 Level: {level}</span>
          <span className="info-pill">🎙 {accent ? (accent === "american" ? "American" : "British") : "Not set"}</span>
          <span className="info-pill" style={{ color: "#f59e0b", fontWeight: "bold" }}>🔥 Streak: {streakDays}</span>
          
          <span 
            className="info-pill" 
            onClick={() => navigate("/vocabulary")}
            style={{ 
               cursor: "pointer", 
               background: vocabDueCount > 0 ? "rgba(239, 68, 68, 0.2)" : "rgba(255,255,255,0.05)",
               border: vocabDueCount > 0 ? "1px solid #ef4444" : "1px solid transparent",
               color: vocabDueCount > 0 ? "#fca5a5" : "#fff",
               fontWeight: vocabDueCount > 0 ? "bold" : "normal"
            }}
          >
            📚 Words Due: {vocabDueCount}
          </span>
          
          <button 
            onClick={() => navigate("/progress")}
            className="btn-progress"
            style={{ 
              marginLeft: "auto", 
              background: "linear-gradient(90deg, #7c3aed, #a855f7)", 
              border: "none", 
              color: "#fff", 
              padding: "0.5rem 1rem", 
              borderRadius: "8px", 
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            View Progress →
          </button>
        </div>

        {/* Module cards */}
        <div className="module-grid">
          {MODULES.map((mod, i) => {
            // Is it module 1? Or is the previous module in completedLessons?
            const isUnlocked = i === 0 || completedLessons.includes(MODULES[i - 1].id);
            const isCompleted = completedLessons.includes(mod.id);
            
            return (
              <div 
                key={mod.id} 
                className={`module-card ${!isUnlocked ? "locked" : ""}`}
                onClick={() => {
                  if (isUnlocked) navigate(`/lesson/${mod.id}`);
                }}
                style={{ cursor: isUnlocked ? "pointer" : "not-allowed", opacity: isUnlocked ? 1 : 0.6 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="module-card-icon">{mod.icon}</span>
                  {isCompleted && <span style={{ color: '#34d399', fontWeight: 'bold' }}>✓ Done</span>}
                  {!isUnlocked && <span>🔒 Locked</span>}
                </div>
                <h3>{mod.title}</h3>
                <p>{mod.desc}</p>
                <span className={isUnlocked ? "badge-start" : "badge-locked"} style={{ display: "inline-block", marginTop: "1rem", color: isUnlocked ? "#a855f7" : "#888", fontWeight: "bold" }}>
                  {isUnlocked ? (isCompleted ? "Replay Lesson →" : "Start Lesson →") : "Complete previous first"}
                </span>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
