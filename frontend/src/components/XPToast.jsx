// ============================================================
// frontend/src/components/XPToast.jsx
// Animated XP reward toast — slides in from right, fades out.
// Rendered by GamificationContext; receives `amount` prop.
// ============================================================
import { useEffect, useState } from "react";

const XPToast = ({ amount }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on mount
    const enterTimer = setTimeout(() => setVisible(true), 10);
    // Trigger exit animation before unmount
    const exitTimer = setTimeout(() => setVisible(false), 2000);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, []);

  return (
    <div className={`xp-toast ${visible ? "xp-toast-in" : ""}`}>
      <span className="xp-star">⭐</span>
      <div className="xp-toast-body">
        <span className="xp-amount">+{amount} XP</span>
        <span className="xp-label">Earned!</span>
      </div>
    </div>
  );
};

export default XPToast;
