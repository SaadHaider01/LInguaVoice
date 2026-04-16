// ============================================================
// frontend/src/pages/BadgesPage.jsx
// LinguaVoice — Full badges grid with modal detail view.
// Earned: full color + glow. Locked: greyed + lock icon.
// Click any badge to see its description in a modal.
// ============================================================
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { BADGES } from "../constants/badges";
import "./badges.css";

// ── Badge metadata extensions ────────────────────────────────
// (extends constants/badges.js without touching that file)
const BADGE_META = {
  first_word:        { emoji: "📝", category: "Milestones", color: "#a855f7" },
  consistent:        { emoji: "🔥", category: "Streak",     color: "#f97316" },
  on_fire:           { emoji: "🔥", category: "Streak",     color: "#ef4444" },
  pronunciation_pro: { emoji: "🎯", category: "Performance", color: "#3b82f6" },
  vocab_builder:     { emoji: "📚", category: "Performance", color: "#10b981" },
  halfway_there:     { emoji: "⭐", category: "Milestones", color: "#f59e0b" },
  fluent:            { emoji: "💬", category: "Milestones", color: "#6366f1" },
  dedicated:         { emoji: "🏆", category: "Milestones", color: "#ffbf00" },
};

const CATEGORIES = ["All", "Milestones", "Streak", "Performance"];

export default function BadgesPage() {
  const { userDoc } = useAuth();
  const earnedBadgeIds = userDoc?.badges || [];
  const earnedCount    = earnedBadgeIds.length;

  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedBadge, setSelectedBadge]   = useState(null);

  const filtered =
    activeCategory === "All"
      ? BADGES
      : BADGES.filter(
          (b) => (BADGE_META[b.id]?.category || "Milestones") === activeCategory
        );

  return (
    <div className="badges-page">
      {/* ─── Nav ─── */}
      <nav className="badges-nav">
        <Link to="/dashboard" className="back-link">← Dashboard</Link>
        <h1 className="badges-nav-title">Achievements</h1>
        <div className="badges-nav-count">
          <span className="earned-count">{earnedCount}</span>
          <span className="total-count">/ {BADGES.length}</span>
        </div>
      </nav>

      <main className="badges-content">
        {/* ─── Hero ─── */}
        <header className="badges-hero">
          <div className="hero-progress-ring">
            <svg viewBox="0 0 80 80" className="ring-svg">
              <circle cx="40" cy="40" r="34" className="ring-track" />
              <circle
                cx="40" cy="40" r="34"
                className="ring-fill"
                style={{
                  strokeDasharray: `${2 * Math.PI * 34}`,
                  strokeDashoffset: `${2 * Math.PI * 34 * (1 - earnedCount / BADGES.length)}`,
                }}
              />
            </svg>
            <div className="ring-label">
              <span className="ring-num">{Math.round((earnedCount / BADGES.length) * 100)}%</span>
            </div>
          </div>
          <div className="hero-text">
            <h2>Your Achievements</h2>
            <p>{earnedCount} of {BADGES.length} badges unlocked</p>
          </div>
        </header>

        {/* ─── Category filter ─── */}
        <div className="category-tabs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`cat-tab ${activeCategory === cat ? "active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ─── Badges grid ─── */}
        <div className="badges-grid">
          {filtered.map((badge) => {
            const isEarned = earnedBadgeIds.includes(badge.id);
            const meta     = BADGE_META[badge.id] || { emoji: "🏅", color: "#7c3aed" };

            return (
              <button
                key={badge.id}
                className={`badge-card ${isEarned ? "earned" : "locked"}`}
                onClick={() => setSelectedBadge({ badge, isEarned, meta })}
                style={isEarned ? { "--badge-color": meta.color } : {}}
                aria-label={`${badge.name} — ${isEarned ? "Earned" : "Locked"}`}
              >
                <div className="badge-visual">
                  {isEarned ? (
                    <>
                      <span className="badge-emoji">{meta.emoji}</span>
                      <div className="badge-glow" style={{ background: meta.color }} />
                    </>
                  ) : (
                    <span className="badge-lock">🔒</span>
                  )}
                </div>
                <div className="badge-info">
                  <span className="badge-name">{badge.name}</span>
                  {isEarned ? (
                    <span className="badge-status earned-status">Earned ✓</span>
                  ) : (
                    <span className="badge-status locked-status">Locked</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* ─── Badge detail modal ─── */}
      {selectedBadge && (
        <div
          className="badge-modal-overlay"
          onClick={() => setSelectedBadge(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Badge details"
        >
          <div
            className="badge-modal"
            onClick={(e) => e.stopPropagation()}
            style={
              selectedBadge.isEarned
                ? { "--badge-color": selectedBadge.meta.color }
                : {}
            }
          >
            <button className="modal-close" onClick={() => setSelectedBadge(null)}>✕</button>

            <div className={`modal-badge-visual ${selectedBadge.isEarned ? "earned" : "locked"}`}>
              {selectedBadge.isEarned ? (
                <>
                  <span className="modal-emoji">{selectedBadge.meta.emoji}</span>
                  <div className="modal-glow" style={{ background: selectedBadge.meta.color }} />
                </>
              ) : (
                <span className="modal-lock">🔒</span>
              )}
            </div>

            <span className="modal-category">{selectedBadge.meta.category}</span>
            <h3 className="modal-badge-name">{selectedBadge.badge.name}</h3>

            {selectedBadge.isEarned ? (
              <p className="modal-desc earned-desc">{selectedBadge.badge.description}</p>
            ) : (
              <p className="modal-desc locked-desc">
                <span className="hint-label">How to unlock:</span>{" "}
                {selectedBadge.badge.hint}
              </p>
            )}

            <div className={`modal-status-pill ${selectedBadge.isEarned ? "earned" : "locked"}`}>
              {selectedBadge.isEarned ? "🏆 Achievement Unlocked" : "🔒 Not yet unlocked"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
