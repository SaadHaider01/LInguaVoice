// middleware/authMiddleware.js — placeholder (implemented in Step 2)
// Will verify Firebase ID tokens on protected routes.

const authMiddleware = async (req, res, next) => {
  // TODO Step 2: extract Bearer token, verify with firebase-admin
  console.warn("[AUTH] authMiddleware not yet implemented — Step 2 will add this");
  next();
};

module.exports = authMiddleware;
