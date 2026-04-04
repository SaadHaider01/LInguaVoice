import React, { useEffect } from 'react';
import './gamification.css';

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

const BadgeNotification = ({ badge, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="badge-notification-container">
      <div className="badge-notification" onClick={onDismiss}>
        <div className="badge-emoji">
          {EMOJI_MAP[badge.id] || '🏅'}
        </div>
        <div className="badge-info">
          <h4>{badge.name}</h4>
          <p>{badge.description}</p>
          <span className="unlocked-label">Unlocked!</span>
        </div>
      </div>
    </div>
  );
};

export default BadgeNotification;
