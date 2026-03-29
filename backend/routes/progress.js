// routes/progress.js — placeholder (implemented in Step 7)
const router = require("express").Router();

router.get("/status", (_req, res) => {
  res.json({ message: "Progress routes ready — implemented in Step 7" });
});

module.exports = router;
