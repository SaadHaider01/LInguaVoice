import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BADGES } from '../constants/badges';
import './badges.css';

const EMOJI_MAP = {
  first_word: '📝',
  consistent: '🔥',
  on_fire: '🔥',
  pronunciation_pro: '🎯',
  vocab_builder: '📚',
  halfway_there: '⭐',
  fluent: '💬',
  dedicated: '🏆'
};

const BadgesPage = () => {
  const { userDoc } = useAuth();
  const earnedBadgeIds = userDoc?.badges || [];
  const earnedCount = earnedBadgeIds.length;

  return (
    <div className="badges-page">
      <nav className="badges-nav">
        <a href="/dashboard" className="back-link">← Back to Dashboard</a>
      </nav>

      <main className="badges-content">
        <header className="badges-header">
          <h1>Your Achievements</h1>
          <div className="stats-pill">
            {earnedCount} / {BADGES.length} unlocked
          </div>
        </header>

        <div className="badges-grid">
          {BADGES.map((badge) => {
            const isEarned = earnedBadgeIds.includes(badge.id);
            return (
              <div 
                key={badge.id} 
                className={`badge-card ${isEarned ? 'earned' : 'locked'}`}
              >
                <div className="badge-visual">
                  {isEarned ? (
                    <span className="badge-emoji">{EMOJI_MAP[badge.id] || '🏅'}</span>
                  ) : (
                    <div className="lock-icon">🔒</div>
                  )}
                </div>
                <div className="badge-details">
                  <h3>{badge.name}</h3>
                  <p>{isEarned ? badge.description : badge.hint}</p>
                  {isEarned ? (
                    <span className="status-pill earned">Earned</span>
                  ) : (
                    <span className="status-pill locked">Locked</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default BadgesPage;
