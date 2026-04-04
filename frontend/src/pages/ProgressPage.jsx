import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  CartesianGrid
} from "recharts";
import "./progress.css";

// Assuming MODULES logic maps to Dashboard, recreate for list context
const MODULE_DEFS = [
  { id: "module1", title: "Greetings & Introductions" },
  { id: "module2", title: "Asking Simple Questions" },
  { id: "module3", title: "My Job and Daily Routine" },
  { id: "module4", title: "Can You Help Me?" }
];

export default function ProgressPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProgress() {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/progress`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to load progress");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadProgress();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="progress-page center-layout">
        <div className="thinking-state">Loading your progress...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="progress-page center-layout">
        <div className="error-text">{error}</div>
      </div>
    );
  }

  // Derived logic for average score
  const sessionHistory = data.session_history || [];
  const totalScore = sessionHistory.reduce((acc, curr) => acc + curr.score, 0);
  const avgScore = sessionHistory.length > 0 ? Math.round(totalScore / sessionHistory.length) : 0;

  // Render rolling 7-day strip
  // To keep it simple, we use the last 7 dates ending in "today"
  const today = new Date();
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const dtStr = d.toISOString().split("T")[0];
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const isCompleted = (data.total_sessions_raw || []).includes(dtStr); // using the lessons_completed_this_week array actually
    return { dtStr, dayName, isCompleted, isToday: i === 6 };
  });

  return (
    <div className="progress-page">
      <nav className="dashboard-nav">
        <a href="/dashboard" className="nav-logo">
          🎤 <span>LinguaVoice</span>
        </a>
        <div className="nav-actions">
          <button className="btn-secondary" onClick={() => navigate("/dashboard")}>← Back</button>
        </div>
      </nav>

      <main className="progress-main">
        <h1 className="page-title">Your Progress Journey</h1>

        {/* STREAK SECTION */}
        <section className="streak-section glass-panel">
          <div className="streak-header">
            <div className="streak-flame">
              🔥 <span className="streak-count">{data.streak}</span>
            </div>
            <div className="streak-titles">
              <h2>Day Streak</h2>
              <div className="longest-streak">Longest streak: {data.longest_streak} days</div>
            </div>
          </div>
          
          <div className="streak-strip">
            {last7Days.map((day, idx) => (
              <div key={idx} className={`streak-day ${day.isToday ? "is-today" : ""}`}>
                <div className="day-name">{day.dayName}</div>
                <div className={`day-circle ${day.isCompleted ? "completed" : "missed"}`}>
                  {day.isCompleted ? "✓" : ""}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* LEVEL & STATS SECTION */}
        <section className="stats-grid">
          <div className="stat-card glass-panel cefr-panel">
            <div className="stat-label">CEFR Level</div>
            <div className="stat-value highlight-gradient">{data.cefr_level}</div>
          </div>
          <div className="stat-card glass-panel">
            <div className="stat-label">Avg Output Score</div>
            <div className="stat-value">{avgScore}</div>
          </div>
          <div className="stat-card glass-panel">
            <div className="stat-label">Modules Passed</div>
            <div className="stat-value">{data.modules_unlocked.length} / 4</div>
          </div>
        </section>

        {/* SCORE HISTORY CHART */}
        <section className="chart-section glass-panel">
          <h2>Recent Path (Last 14 Sessions)</h2>
          <div className="chart-wrapper">
            {sessionHistory.length === 0 ? (
              <div className="empty-state">No sessions completed yet. Start learning!</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={sessionHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric" })} tick={{ fill: "#888" }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#888" }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "rgba(15, 12, 41, 0.9)", border: "1px solid rgba(139, 92, 246, 0.4)", borderRadius: "8px" }} 
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Area type="monotone" dataKey="score" stroke="#14b8a6" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* MODULES PROGRESS SECTION */}
        <section className="modules-list-section glass-panel">
          <h2>Module Syllabus</h2>
          <div className="modules-list">
            {MODULE_DEFS.map((mod, i) => {
              const isUnlocked = i === 0 || data.modules_unlocked.includes(MODULE_DEFS[i - 1].id);
              const isCompleted = data.modules_unlocked.includes(mod.id);
              
              const historyForMod = sessionHistory.filter(s => s.module_id === mod.id);
              const bestScore = historyForMod.length > 0 ? Math.max(...historyForMod.map(s => s.score)) : null;

              return (
                <div key={mod.id} className={`mod-row ${!isUnlocked ? "mod-locked" : ""}`}>
                  <div className="mod-info">
                    <div className="mod-title">{mod.title}</div>
                    <div className="mod-status">
                      {isCompleted ? <span className="s-comp">✓ Completed</span> : isUnlocked ? <span className="s-prog">▶ In Progress</span> : <span className="s-lock">🔒 Locked</span>}
                    </div>
                  </div>
                  {isUnlocked && bestScore !== null && (
                    <div className="mod-score">
                      Best: <span>{bestScore}</span>
                    </div>
                  )}
                  {isUnlocked && bestScore === null && (
                    <div className="mod-score">Untested</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}
