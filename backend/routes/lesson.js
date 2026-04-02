// ============================================================
// backend/routes/lesson.js
// LinguaVoice — Step 5: Lesson Engine Router
// Handles /init (start lesson) and /turn (student interaction).
// ============================================================
const router   = require("express").Router();
const admin    = require("firebase-admin");
const multer   = require("multer");
const FormData = require("form-data");
const axios    = require("axios");
const ffmpeg   = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const fs       = require("fs");
const path     = require("path");
const os       = require("os");

const { curriculum, getLevelGroup } = require("../utils/curriculum");

ffmpeg.setFfmpegPath(ffmpegPath);

const FLASK_URL = process.env.FLASK_URL || "http://localhost:5000";

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50MB audio
});

const lessonSteps = [
  "warmup",
  "input",
  "guided",
  "free",
  "feedback"
];

// ─── Auth Helper ─────────────────────────────────────────────────────────────
async function verifyToken(req) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try { return await admin.auth().verifyIdToken(token); } catch { return null; }
}

// ─── TTS Helper ──────────────────────────────────────────────────────────────
async function generateAudioBase64(text, accent) {
  try {
    const res = await axios.post(`${FLASK_URL}/synthesize`, { text, accent }, {
      responseType: 'arraybuffer',
      timeout: 30000 // 30s limit for Kokoro local synthesis
    });
    return Buffer.from(res.data).toString('base64');
  } catch (err) {
    console.error("[TTS Error]", err.message);
    return null; 
  }
}

// ─── JSON Parser with Fallback ───────────────────────────────────────────────
function parseLessonJSON(raw) {
  try { return JSON.parse(raw); } catch {}
  
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }

  // Fallback if Groq hallucinates non-JSON
  console.warn("[Lesson JSON Parse] Fallback used!");
  return {
    teacher_response: "Can you try that again?",
    advance_step: false,
    errors_detected: [],
    praise: "",
    correction: null,
    student_score: 50
  };
}

// ─── Audio Converter (WebM -> WAV) ───────────────────────────────────────────
async function convertWebmToWav(inputBuffer) {
  return new Promise((resolve, reject) => {
    const tmpInput  = path.join(os.tmpdir(), `in_${Date.now()}.webm`);
    const tmpOutput = path.join(os.tmpdir(), `out_${Date.now()}.wav`);
    fs.writeFileSync(tmpInput, inputBuffer);
    
    ffmpeg(tmpInput)
      .toFormat('wav')
      .on('end', () => {
        const wavBuffer = fs.readFileSync(tmpOutput);
        fs.unlinkSync(tmpInput);
        fs.unlinkSync(tmpOutput);
        resolve(wavBuffer);
      })
      .on('error', (err) => reject(err))
      .save(tmpOutput);
  });
}

// ─── STEP 1: INIT ROUTE ──────────────────────────────────────────────────────
router.post("/init", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const { moduleId, lessonId } = req.body;
  if (!moduleId || !curriculum[moduleId]) {
    return res.status(400).json({ error: "Valid moduleId is required" });
  }

  const db = admin.firestore();
  let userSnap = await db.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) return res.status(404).json({ error: "User not found" });
  const userData = userSnap.data();

  const cefrLevel = userData.assessment?.level || "A1";
  const accent = userData.preferred_accent || "american";
  const levelGroup = getLevelGroup(cefrLevel);
  const nativeLang = userData.assessment?.detected_native_accent || "unknown";

  const moduleData = curriculum[moduleId];
  const lessonData = moduleData.levels[levelGroup];

  // Build Init Prompt for Warmup (Step index 0)
  const initPrompt = `
You are a professional English language teacher.
Teaching accent: ${accent}
Current lesson: ${moduleData.title}
Lesson step: ${lessonSteps[0]} (warmup)
Student level: ${cefrLevel}
Student native language: ${nativeLang}

Lesson focus: ${lessonData.system_prompt}

Student CEFR level: ${cefrLevel}
Adjust your vocabulary, question complexity, and error tolerance to match this level exactly.
A1 student needs very simple words and patience.
B1 student needs moderate challenge.
C1 student needs near-native conversation.

Rules:
1. Welcome the student and introduce the topic.
2. End with an open question to start the conversation.
3. Keep response under 50 words.
4. Use simple vocabulary for ${cefrLevel} level.
5. Never break teacher character.

Return ONLY this JSON:
{
  "teacher_response": "your response here",
  "advance_step": false,
  "errors_detected": [],
  "praise": "",
  "correction": null,
  "student_score": 100
}`;

  let aiResJson = {};
  try {
    const mistralRes = await axios.post(`${FLASK_URL}/generate_response`, {
      system_prompt: "",
      user_message: initPrompt,
    }, { timeout: 60000 });
    
    aiResJson = parseLessonJSON(mistralRes.data.response);
  } catch (err) {
    console.error("[Init Error]", err.message);
    aiResJson = parseLessonJSON(""); // triggers fallback
    aiResJson.teacher_response = "Hello! Let's get started. How are you today?";
  }

  // Generate TTS Audio
  const audioBase64 = await generateAudioBase64(aiResJson.teacher_response, accent);

  // Initialize Session in Firestore
  const sessionRef = db.collection("users").doc(decoded.uid).collection("sessions").doc();
  const sessionData = {
    session_id: sessionRef.id,
    module_id: moduleId,
    lesson_id: lessonId,
    level_group: levelGroup,
    cefr_level: cefrLevel,
    started_at: admin.firestore.FieldValue.serverTimestamp(),
    current_step_index: 0,
    turns: [
      {
        turn: 0,
        step: lessonSteps[0],
        ai_response: aiResJson.teacher_response,
        timestamp: new Date().toISOString()
      }
    ],
    errors_history: [],
    final_score: 0,
    completed: false
  };

  await sessionRef.set(sessionData);

  return res.json({
    sessionId: sessionRef.id,
    step_index: 0,
    aiResponseJSON: aiResJson,
    audioBase64: audioBase64
  });
});

// ─── STEP 2: TURN ROUTE ──────────────────────────────────────────────────────
router.post("/turn", upload.single("audio"), async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });

  let transcript = "";
  if (req.file && req.file.buffer.length > 0) {
    try {
      const wavBuffer = await convertWebmToWav(req.file.buffer);
      const audioForm = new FormData();
      audioForm.append("audio", wavBuffer, { filename: "rec.wav", contentType: "audio/wav" });

      const transcribeRes = await axios.post(`${FLASK_URL}/transcribe`, audioForm, {
        headers: audioForm.getHeaders(),
        timeout: 60_000, 
      });
      transcript = transcribeRes.data?.transcript || "";
    } catch (err) {
      console.error("[Turn Whisper Error]", err.message);
      return res.status(200).json({ 
        error_type: "stt_timeout", 
        aiResponseJSON: { teacher_response: "I could not hear you clearly. Could you please try again?" } 
      });
    }
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(decoded.uid);
  const sessionRef = userRef.collection("sessions").doc(sessionId);
  const userSnap = await userRef.get();
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) return res.status(404).json({ error: "Session not found" });

  const userData = userSnap.data();
  let sessionData = sessionSnap.data();
  
  const cefrLevel = sessionData.cefr_level || "A1";
  const accent = userData.preferred_accent || "american";
  const nativeLang = userData.assessment?.detected_native_accent || "unknown";
  
  const moduleData = curriculum[sessionData.module_id];
  const lessonData = moduleData.levels[sessionData.level_group];
  let curStepIdx = sessionData.current_step_index;

  // Build Turn Prompt
  const turnPrompt = `
You are a professional English language teacher.
Teaching accent: ${accent}
Current lesson: ${moduleData.title}
Lesson step: ${lessonSteps[curStepIdx]}
Student level: ${cefrLevel}
Student native language: ${nativeLang}

Lesson focus: ${lessonData.system_prompt}

Student CEFR level: ${cefrLevel}
Adjust your vocabulary, question complexity, and error tolerance to match this level exactly.
A1 student needs very simple words and patience.
B1 student needs moderate challenge.
C1 student needs near-native conversation.

Previous errors this session: ${sessionData.errors_history.slice(-5).join(", ")}
Student's last response: "${transcript}"

Rules:
1. Keep response under 50 words
2. Use simple vocabulary for ${cefrLevel} level
3. Use sandwich feedback method:
   - Praise what they did well
   - Correct one specific error
   - Encourage next attempt
4. End with a question or clear instruction
5. Never break teacher character

Return ONLY this JSON:
{
  "teacher_response": "your response here",
  "advance_step": true or false,
  "errors_detected": ["error1", "error2"],
  "praise": "what student did well",
  "correction": "specific correction or null",
  "student_score": 85
}`;

  let aiResJson = {};
  try {
    const mistralRes = await axios.post(`${FLASK_URL}/generate_response`, {
      system_prompt: "",
      user_message: turnPrompt,
    }, { timeout: 60000 });
    aiResJson = parseLessonJSON(mistralRes.data.response);
  } catch (err) {
    console.error("[Turn LLM Error]", err.message);
    aiResJson = parseLessonJSON(""); // generic fallback
  }

  // Handle logic for Step 2 Input (auto advance handling is effectively decided by LLM, but we can force it logically if needed. We let the client track it or the LLM.)
  if (aiResJson.advance_step && curStepIdx < 4) {
    curStepIdx++;
  }

  // Generate TTS Audio
  const audioBase64 = await generateAudioBase64(aiResJson.teacher_response, accent);

  // Update session
  const newTurn = {
    turn: sessionData.turns.length,
    user_transcript: transcript,
    ai_response: aiResJson.teacher_response,
    errors_detected: aiResJson.errors_detected || [],
    score: aiResJson.student_score || 50,
    timestamp: new Date().toISOString()
  };

  sessionData.turns.push(newTurn);
  if (aiResJson.errors_detected && aiResJson.errors_detected.length > 0) {
    sessionData.errors_history.push(...aiResJson.errors_detected);
  }
  sessionData.current_step_index = curStepIdx;

  if (curStepIdx >= 4 && aiResJson.advance_step) { // completed
    sessionData.completed = true;
    sessionData.completed_at = admin.firestore.FieldValue.serverTimestamp();
    const sumScores = sessionData.turns.reduce((acc, t) => acc + (t.score || 50), 0);
    sessionData.final_score = Math.round(sumScores / Math.max(sessionData.turns.length, 1));
    
    // Update User Progress
    const userUpdates = {};
    const weekLogs = userData.lessons_completed_this_week || [];
    weekLogs.push(new Date().toISOString());
    userUpdates.lessons_completed_this_week = weekLogs;
    
    const prog = userData.progress || { lessons_completed: [], accuracy_history: [] };
    if (!prog.lessons_completed.includes(sessionData.lesson_id)) {
      prog.lessons_completed.push(sessionData.lesson_id);
    }
    prog.accuracy_history.push(sessionData.final_score);
    userUpdates.progress = prog;

    // simplistic streak (no strict tz check for this MVP)
    userUpdates.streak_days = (userData.streak_days || 0) + 1;
    
    await userRef.update(userUpdates);
  }

  await sessionRef.set(sessionData);

  return res.json({
    transcript,
    aiResponseJSON: aiResJson,
    audioBase64,
    step_index: curStepIdx,
    completed: sessionData.completed,
    final_score: sessionData.final_score
  });

});

module.exports = router;
