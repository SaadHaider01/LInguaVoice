import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import XPToast from '../components/XPToast';
import LevelUpModal from '../components/LevelUpModal';
import BadgeNotification from '../components/BadgeNotification';

const GamificationContext = createContext();

export const useGamification = () => useContext(GamificationContext);

export const GamificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [levelUpData, setLevelUpData] = useState(null);
  const [badgeQueue, setBadgeQueue] = useState([]);
  const [currentBadge, setCurrentBadge] = useState(null);

  const showXPToast = useCallback((amount) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, amount }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  const showLevelUp = useCallback((oldLevel, newLevel, levelName) => {
    setLevelUpData({ oldLevel, newLevel, levelName });
  }, []);

  const showBadges = useCallback((badgesArray) => {
    if (badgesArray && badgesArray.length > 0) {
      setBadgeQueue((prev) => [...prev, ...badgesArray]);
    }
  }, []);

  useEffect(() => {
    const handleXPEvent = (e) => {
      const data = e.detail;
      if (!data) return;

      if (data.xp_awarded > 0) {
        showXPToast(data.xp_awarded);
      }
      if (data.leveled_up) {
        showLevelUp(data.new_level - 1, data.new_level, data.new_level_name);
      }
      if (data.new_badges && data.new_badges.length > 0) {
        showBadges(data.new_badges);
      }
    };

    window.addEventListener("gamification_pushed", handleXPEvent);
    return () => window.removeEventListener("gamification_pushed", handleXPEvent);
  }, [showXPToast, showLevelUp, showBadges]);

  useEffect(() => {
    if (!currentBadge && badgeQueue.length > 0) {
      const nextBadge = badgeQueue[0];
      setCurrentBadge(nextBadge);
      setBadgeQueue((prev) => prev.slice(1));
    }
  }, [badgeQueue, currentBadge]);

  const dismissLevelUp = () => setLevelUpData(null);
  const dismissBadge = () => {
    setCurrentBadge(null);
  };

  return (
    <GamificationContext.Provider value={{ showXPToast, showLevelUp, showBadges }}>
      {children}
      
      {/* XP Toast Layer */}
      <div className="xp-toast-container">
        {toasts.map((toast) => (
          <XPToast key={toast.id} amount={toast.amount} />
        ))}
      </div>

      {/* Level Up Modal Layer */}
      {levelUpData && (
        <LevelUpModal 
          oldLevel={levelUpData.oldLevel} 
          newLevel={levelUpData.newLevel} 
          levelName={levelUpData.levelName} 
          onDismiss={dismissLevelUp} 
        />
      )}

      {/* Badge Notification Layer */}
      {currentBadge && (
        <BadgeNotification 
          badge={currentBadge} 
          onDismiss={dismissBadge} 
        />
      )}
    </GamificationContext.Provider>
  );
};
