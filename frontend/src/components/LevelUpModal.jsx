import React, { useEffect, useState } from 'react';
import './gamification.css';

const LevelUpModal = ({ oldLevel, newLevel, levelName, onDismiss }) => {
  const [displayLevel, setDisplayLevel] = useState(oldLevel);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayLevel(newLevel);
    }, 100);
    return () => clearTimeout(timer);
  }, [newLevel]);

  const confettiPieces = Array.from({ length: 20 }, (_, i) => {
    const angle = (i / 20) * 360;
    const distance = 100 + Math.random() * 100;
    const dx = Math.cos(angle * Math.PI / 180) * distance + 'px';
    const dy = Math.sin(angle * Math.PI / 180) * distance + 'px';
    const dr = Math.random() * 360 + 'deg';
    const color = ['#7c3aed', '#a855f7', '#ffbf00', '#10b981', '#3b82f6'][i % 5];
    
    return (
      <div 
        key={i} 
        className="confetti" 
        style={{ 
          '--dx': dx, '--dy': dy, '--dr': dr, 
          backgroundColor: color,
          left: '50%', top: '50%'
        }} 
      />
    );
  });

  return (
    <div className="level-up-overlay" onClick={onDismiss}>
      <div className="level-up-card" onClick={(e) => e.stopPropagation()}>
        {confettiPieces}
        <h1>Level Up!</h1>
        <div className="level-counter">
          {displayLevel}
        </div>
        <p className="level-name">{levelName}</p>
        <button className="keep-learning-btn" onClick={onDismiss}>
          Keep Learning
        </button>
      </div>
    </div>
  );
};

export default LevelUpModal;
