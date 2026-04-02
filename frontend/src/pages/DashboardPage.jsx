// ============================================================
// frontend/src/pages/DashboardPage.jsx
// Step 2 version: shows welcome + user info + module placeholders.
// Full dashboard UI is built in Step 7.
// ============================================================
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
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


  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err.message);
    }
  }

  return (
    <div className="dashboard-page">
      {/* ─── Nav ─── */}
      <nav className="dashboard-nav">
        <a href="/dashboard" className="nav-logo">
          🎤 <span>LinguaVoice</span>
        </a>
        <div className="nav-actions">
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
          <h1>Welcome, {displayName} 👋</h1>
          <p>Ready to practise your English today? Pick a module below.</p>
        </div>

        {/* Info pills */}
        <div className="info-strip">
          <span className="info-pill">📊 Level: {level}</span>
          <span className="info-pill">🎙 Accent: {accent ? (accent === "american" ? "American" : "British") : "Not set yet"}</span>
          <span className="info-pill">🔥 Streak: {streakDays} {streakDays === 1 ? "day" : "days"}</span>
          <span className="info-pill">⭐ Plan: {plan === "pro" ? "Pro" : "Free"}</span>
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
