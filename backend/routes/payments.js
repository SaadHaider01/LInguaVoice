// routes/payments.js — placeholder (implemented in Step 6)
const router = require("express").Router();

router.get("/status", (_req, res) => {
  res.json({ message: "Payment routes ready — implemented in Step 6" });
});

module.exports = router;
