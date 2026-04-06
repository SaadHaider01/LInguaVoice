// ============================================================
// frontend/src/pages/DashboardPage.jsx
// SCOPE NOTE: Only the lesson grid section has been updated.
// Header, XP bar, streak display, and badge sections are unchanged.
// ============================================================
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LEVEL_THRESHOLDS, LEVEL_NAMES } from "../constants/gamification";
import { A0_ALPHABET_MODULE, A1_PLUS_MODULES, UNLOCK_THRESHOLDS } from "../config/curriculum";
import { getLessonCardState } from "../utils/lessonGating";
import "./dashboard.css";



export default function DashboardPage() {
  const { currentUser, userDoc, logout, refreshUserDoc } = useAuth();
  const navigate = useNavigate();

  const displayName =
    userDoc?.display_name ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "Learner";

  const level        = userDoc?.assessment?.level || userDoc?.cefr_level || "A1";
  const accent       = userDoc?.accent_preference || userDoc?.preferred_accent || null;
  const plan         = userDoc?.subscription_plan || "free";
  const streakDays   = userDoc?.streak_days       || 0;
  
  const completedLessons = userDoc?.progress?.lessons_completed || [];
  const xp = userDoc?.xp || 0;
  const appLevel = userDoc?.app_level || 1;

  // ── New: curriculum-aware lesson progress ─────────────────
  const cefrLevel        = userDoc?.cefr_level || null;         // null until onboarding done
  const isA0User         = cefrLevel === "A0";
  const unlockedLessons  = userDoc?.unlocked_lessons || [];     // array of lesson key strings
  const lessonScores     = userDoc?.lesson_scores || {};        // { "A0_alphabet_0": 85 }
  const previewLessons   = userDoc?.preview_lessons || [];
  const accentNudgeDismissed = userDoc?.accent_nudge_dismissed || false;

  // ── A0 module progress count ──────────────────────────────
  const a0LessonsCompleted = isA0User
    ? A0_ALPHABET_MODULE.lessons.filter(
        (l) => (lessonScores[l.key] || 0) >= UNLOCK_THRESHOLDS.A0.min_score
      ).length
    : 0;

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

  // ── Accent nudge: show after first lesson if not dismissed ─
  const [showAccentNudge, setShowAccentNudge] = useState(false);
  useEffect(() => {
    const lessonCount = Object.values(lessonScores).filter(
      (s) => s >= UNLOCK_THRESHOLDS[cefrLevel || "A0"]?.min_score
    ).length;
    if (lessonCount === 1 && !accentNudgeDismissed) {
      setShowAccentNudge(true);
    }
  }, [lessonScores, accentNudgeDismissed]);

  const dismissNudge = async () => {
    setShowAccentNudge(false);
    try {
      const token = await currentUser.getIdToken();
      await fetch(`${import.meta.env.VITE_API_URL}/api/lesson/nudge-dismiss`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error("Nudge dismiss failed", err);
    }
  };

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
          {/* Settings gear — links to /settings */}
          <a
            href="/settings"
            className="nav-settings-icon"
            title="Settings"
            aria-label="Settings"
          >⚙️</a>
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

        {/* ─── LESSON GRID — scope-bounded section ─────────────── */}
        {/* Only this section was changed. Everything above is intact. */}

        {/* A0 Alphabet Module */}
        {isA0User && (
          <div className="lesson-module-container">
            <div className="lesson-module-header">
              <h2 className="lesson-module-title">🔤 Alphabet Module</h2>
              <span className="lesson-module-progress">
                {a0LessonsCompleted} / {A0_ALPHABET_MODULE.total_lessons} lessons
              </span>
            </div>

            {/* Module progress bar */}
            <div className="lesson-progress-bar-track">
              <div
                className="lesson-progress-bar-fill"
                style={{
                  width: `${(a0LessonsCompleted / A0_ALPHABET_MODULE.total_lessons) * 100}%`,
                }}
              />
            </div>

            {/* Lesson dots row */}
            <div className="lesson-dots-row">
              {A0_ALPHABET_MODULE.lessons.map((lesson, i) => {
                const cardState = getLessonCardState(
                  lesson.key,
                  unlockedLessons,
                  lessonScores,
                  previewLessons,
                  "A0"
                );
                return (
                  <div
                    key={lesson.key}
                    className={`lesson-dot lesson-dot-${cardState}`}
                    title={lesson.title}
                  />
                );
              })}
            </div>

            {/* Lesson cards grid */}
            <div className="module-grid">
              {A0_ALPHABET_MODULE.lessons.map((lesson) => {
                const cardState = getLessonCardState(
                  lesson.key,
                  unlockedLessons,
                  lessonScores,
                  previewLessons,
                  "A0"
                );
                const score = lessonScores[lesson.key];
                const isClickable = ["unlocked", "completed", "retry", "preview"].includes(cardState);
                const stars =
                  score >= 90 ? "⭐⭐⭐" :
                  score >= 60 ? "⭐⭐" :
                  score >= 50 ? "⭐" : null;

                return (
                  <div
                    key={lesson.key}
                    className={`module-card lesson-state-${cardState}`}
                    onClick={() => {
                      if (isClickable) navigate(`/lesson/a0_${lesson.topic}/${lesson.key}`);
                    }}
                    style={{ cursor: isClickable ? "pointer" : "default" }}
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onKeyDown={(e) => e.key === "Enter" && isClickable && navigate(`/lesson/a0_${lesson.topic}/${lesson.key}`)}
                  >
                    <div className="lesson-card-top">
                      <span className="lesson-card-index">Lesson {lesson.index + 1}</span>
                      {cardState === "completed" && <span className="lesson-badge-completed">✓</span>}
                      {cardState === "locked"    && <span className="lesson-badge-locked">🔒</span>}
                      {cardState === "retry"     && <span className="lesson-badge-retry">⚡</span>}
                      {cardState === "preview"   && <span className="lesson-badge-preview">👁</span>}
                    </div>
                    <h3 className="lesson-card-title">{lesson.title}</h3>
                    {stars && <div className="lesson-stars">{stars}</div>}
                    {score !== undefined && <div className="lesson-score-label">{score}%</div>}
                    <span className="lesson-card-cta">
                      {cardState === "completed" && "Replay →"}
                      {cardState === "unlocked"  && "Start →"}
                      {cardState === "retry"     && "Try Again →"}
                      {cardState === "preview"   && "Preview →"}
                      {cardState === "locked"    && `Score ${UNLOCK_THRESHOLDS.A0.min_score}% in Lesson ${lesson.index} to unlock`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* A1+ Module List — existing modules for non-A0 users */}
        {!isA0User && (
          <div className="module-grid">
            {A1_PLUS_MODULES.map((mod, i) => {
              const isUnlocked = i === 0 || completedLessons.includes(A1_PLUS_MODULES[i - 1].key);
              const isCompleted = completedLessons.includes(mod.key);

              return (
                <div
                  key={mod.key}
                  className={`module-card ${!isUnlocked ? "locked" : ""}`}
                  onClick={() => { if (isUnlocked) navigate(`/lesson/${mod.key}`); }}
                  style={{ cursor: isUnlocked ? "pointer" : "not-allowed", opacity: isUnlocked ? 1 : 0.6 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="module-card-icon">{mod.icon}</span>
                    {isCompleted && <span style={{ color: '#34d399', fontWeight: 'bold' }}>✓ Done</span>}
                    {!isUnlocked && <span>🔒 Locked</span>}
                  </div>
                  <h3>{mod.title}</h3>
                  <span className={isUnlocked ? "badge-start" : "badge-locked"} style={{ display: "inline-block", marginTop: "1rem", color: isUnlocked ? "#a855f7" : "#888", fontWeight: "bold" }}>
                    {isUnlocked ? (isCompleted ? "Replay Lesson →" : "Start Lesson →") : "Complete previous first"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Post-lesson-1 Accent Nudge — bottom sheet */}
        {showAccentNudge && (
          <div className="accent-nudge-sheet">
            <div className="accent-nudge-content">
              <p>How did Luna sound? You can change her accent anytime in Settings ⚙️</p>
              <div className="accent-nudge-actions">
                <button
                  className="accent-nudge-btn primary"
                  onClick={() => { dismissNudge(); navigate("/settings"); }}
                >
                  Change Accent
                </button>
                <button className="accent-nudge-btn ghost" onClick={dismissNudge}>
                  Keep Current
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
