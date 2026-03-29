// routes/lessons.js — placeholder (implemented in Step 5)
const router = require("express").Router();

router.get("/status", (_req, res) => {
  res.json({ message: "Lesson routes ready — implemented in Step 5" });
});

module.exports = router;
