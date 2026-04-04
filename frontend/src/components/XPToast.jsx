import React from 'react';

const XPToast = ({ amount }) => {
  return (
    <div className="xp-toast">
      <span className="xp-star">★</span>
      <span className="xp-amount">+{amount} XP</span>
    </div>
  );
};

export default XPToast;
