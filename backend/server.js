// ============================================================
// backend/server.js
// LinguaVoice — Node.js + Express API server
// Runs on port 3001 (local dev) or process.env.PORT (Vercel)
// ============================================================
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const admin   = require("firebase-admin");
const path    = require("path");
const fs      = require("fs");

// ─── Firebase Admin Init ─────────────────────────────────────────────────────
// Reads service account from file path in .env (local dev)
// On Vercel: set FIREBASE_SERVICE_ACCOUNT as a JSON string env var instead
if (!admin.apps.length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Vercel / CI: JSON string in env var
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    // Local dev: path to JSON file
    const keyPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!fs.existsSync(keyPath)) {
      console.error(`[Firebase] Service account file not found: ${keyPath}`);
      console.error("[Firebase] Set FIREBASE_SERVICE_ACCOUNT_PATH in .env");
      process.exit(1);
    }
    credential = admin.credential.cert(require(keyPath));
  } else {
    console.warn("[Firebase] No service account configured — Firebase Admin disabled");
    console.warn("[Firebase] Set FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env");
  }
  if (credential) {
    admin.initializeApp({ credential });
    console.log("✅ Firebase Admin SDK initialized");
  }
}

const authRoutes        = require("./routes/auth");
const lessonRoute       = require("./routes/lesson");
const lessonGatingRoutes = require("./routes/lessonGating");
const progressRoutes    = require("./routes/progress");
const paymentRoutes     = require("./routes/payments");
const diagnosticRoutes  = require("./routes/diagnostic");
const accentRoutes      = require("./routes/accent");
const vocabRoutes       = require("./routes/vocab");
const xpRoutes          = require("./routes/xp");
const onboardingRoutes  = require("./routes/onboarding");
const settingsRoutes    = require("./routes/settings");

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));   // large enough for audio blobs
app.use(express.urlencoded({ extended: true }));

// Allow requests from Vite dev server and future Vercel domain
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5176",
  "http://localhost:3000",
  process.env.FRONTEND_URL,                 // set this in Vercel env
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ─── Health check (Step 1 validation) ────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status:  "ok",
    service: "linguavoice-backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",       authRoutes);
app.use("/api/diagnostic", diagnosticRoutes);
app.use("/api/accent",     accentRoutes);
app.use("/api/lesson",     lessonRoute);       // existing lesson engine
app.use("/api/lesson",     lessonGatingRoutes); // gating: /gating, /skip, /result, /nudge-dismiss
app.use("/api/progress",   progressRoutes);
app.use("/api/payments",   paymentRoutes);
app.use("/api/vocab",      vocabRoutes);
app.use("/api/xp",         xpRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/settings",   settingsRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

// ─── Start ───────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`✅ LinguaVoice backend running on http://localhost:${PORT}`);
  console.log(`   Flask AI server expected at: ${process.env.FLASK_URL || "http://localhost:5000"}`);
  console.log(`   Press Ctrl+C to stop.`);
});

// Handle port-in-use and other listen errors clearly
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${PORT} is already in use by another process.`);
    console.error(`   To fix: find the PID with  netstat -ano | findstr :${PORT}`);
    console.error(`           then kill it with   taskkill /PID <pid> /F\n`);
  } else {
    console.error("❌ Server error:", err.message);
  }
  process.exit(1);
});

// Graceful shutdown on Ctrl+C
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down LinguaVoice backend...");
  server.close(() => {
    console.log("   Server closed. Goodbye.");
    process.exit(0);
  });
});
