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
const awardXP = require("../helpers/awardXP");
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
async function generateAudioBase64(text, accent, native_language = 'english') {
  try {
    const res = await axios.post(`${FLASK_URL}/synthesize`, { text, accent, native_language }, {
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
    student_score: 50,
    anchor: { type: "none", content: "", translation: "" }
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
  if (!moduleId) return res.status(400).json({ error: "moduleId is required" });

  const db = admin.firestore();
  const userSnap = await db.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) return res.status(404).json({ error: "User not found" });
  const userData = userSnap.data();

  // ── A0 branch: proxy to Flask /lesson ─────────────────────────────────────
  // A0 lessonIds look like "A0_alphabet_0". moduleIds look like "a0_alphabet".
  const isA0Module = String(moduleId).toLowerCase().startsWith("a0_")
    || userData.cefr_level === "A0";

  if (isA0Module) {
    const accentA0    = userData.accent_preference || userData.preferred_accent || "american";
    const nativeLangA0 = userData.native_language || "other";
    // lessonId e.g. "A0_alphabet_0" → index = last segment
    const lessonIndex  = lessonId ? (parseInt(lessonId.split("_").pop()) || 0) : 0;
    // Derive lesson topic from lessonIndex (0="Letter A", 1="Letter B", etc.)
    const ALPHABET = ["A","B","C","D","E","F","G","H","I","J","K","L","M",
                      "N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];
    const lessonTopic  = `The letter ${ALPHABET[lessonIndex] || "A"}`;

    try {
      const flaskRes = await axios.post(`${FLASK_URL}/lesson`, {
        level:             "A0",
        step:              "warmup",
        native_language:   nativeLangA0,
        accent_preference: accentA0,
        lesson_topic:      lessonTopic,
        is_zero_knowledge: userData.is_zero_knowledge !== false,
        history:           [],
        audio:             null,
        session_stats:     { total_attempts: 0, correct_attempts: 0 },
      }, { timeout: 60000 });

      const fd = flaskRes.data;
      // Flask /lesson returns: { text, audio, step, session_stats, [score, lesson_complete] }
      return res.json({
        sessionId:      `${decoded.uid}_${lessonId || moduleId}_${Date.now()}`,
        step_index:     0,
        aiResponseJSON: {
          teacher_response: fd.text || "",
          advance_step:     false,
          errors_detected:  [],
          praise:           "",
          correction:       null,
          student_score:    100,
          anchor: { type: "letter", content: ALPHABET[lessonIndex] || "A", translation: lessonTopic },
        },
        audioBase64:   fd.audio || null,
        session_stats: fd.session_stats || { total_attempts: 0, correct_attempts: 0 },
        lesson_topic:  lessonTopic,
        lesson_index:  lessonIndex,
        is_a0:         true,
      });
    } catch (err) {
      console.error("[A0 Init Error]", err.message);
      return res.json({
        sessionId:      `${decoded.uid}_a0_fallback`,
        step_index:     0,
        aiResponseJSON: {
          teacher_response: `Let\'s learn the letter ${ALPHABET[lessonIndex] || "A"} today! Ready?`,
          advance_step:     false,
          errors_detected:  [],
          anchor: { type: "letter", content: ALPHABET[lessonIndex] || "A", translation: lessonTopic },
        },
        audioBase64:   null,
        lesson_topic:  lessonTopic,
        lesson_index:  lessonIndex,
        is_a0:         true,
      });
    }
  }

  // ── A1+ branch ─────────────────────────────────────────────────────────────
  if (!curriculum[moduleId]) {
    return res.status(400).json({ error: "Valid moduleId is required" });
  }

  const cefrLevel = userData.cefr_level || userData.assessment?.level || "A1";
  const accent    = userData.preferred_accent || userData.accent_preference || "american";
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
6. Provide a Visual Anchor relating to what is being taught (e.g., if teaching 'apple', type='word', content='apple', translation='a red fruit'). Set type to 'none' if no direct concept is being introduced.

Return ONLY this JSON:
{
  "teacher_response": "your response here",
  "advance_step": false,
  "errors_detected": [],
  "praise": "",
  "correction": null,
  "student_score": 100,
  "focus_word": "single most important word here",
  "anchor": {
    "type": "word | letter | sentence | none",
    "content": "<the text>",
    "translation": "<simple definition or example>"
  }
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
  const audioBase64 = await generateAudioBase64(aiResJson.teacher_response, accent, nativeLang);

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

// ─── A0 TURN ROUTE ──────────────────────────────────────────────────
// Handles voice turns for A0 lessons by proxying to Flask /lesson.
// Accepts: multipart/form-data { audio, step, native_language,
//          lesson_topic, lesson_index, accent_preference, session_stats }
// Returns same shape as /turn so LessonPage.jsx needs no changes.
router.post("/a0-turn", upload.single("audio"), async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const {
    step            = "guided",
    native_language = "other",
    lesson_topic    = "The letter A",
    lesson_index    = "0",
    accent_preference = "american",
    session_stats   = "{}",
  } = req.body;

  // Parse session_stats (sent as JSON string in FormData)
  let parsedStats = { total_attempts: 0, correct_attempts: 0 };
  try { parsedStats = JSON.parse(session_stats); } catch {}

  // Convert audio WebM → WAV → base64 for Flask
  let audioB64 = null;
  if (req.file && req.file.buffer.length > 0) {
    try {
      const wavBuf = await convertWebmToWav(req.file.buffer);
      audioB64 = wavBuf.toString("base64");
    } catch (e) {
      console.error("[A0 Turn] Audio convert error:", e.message);
    }
  }

  try {
    const flaskRes = await axios.post(`${FLASK_URL}/lesson`, {
      level:             "A0",
      step,
      native_language,
      accent_preference,
      lesson_topic,
      is_zero_knowledge: true,
      history:           [],
      audio:             audioB64,
      session_stats:     parsedStats,
    }, { timeout: 60000 });

    const fd = flaskRes.data;
    const ALPHABET = ["A","B","C","D","E","F","G","H","I","J","K","L","M",
                      "N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];
    const idx = parseInt(lesson_index) || 0;

    // Shape matches /turn so LessonPage.jsx doesn't need branching
    return res.json({
      transcript:     "", // Whisper handled by Flask
      step_index:     step === "feedback" ? 4 : 2,
      completed:      fd.lesson_complete || false,
      final_score:    fd.score || null,
      session_stats:  fd.session_stats,
      audioBase64:    fd.audio || null,
      aiResponseJSON: {
        teacher_response: fd.text || "",
        advance_step:     fd.lesson_complete || false,
        errors_detected:  [],
        praise:           "",
        correction:       null,
        student_score:    fd.score || null,
        anchor: { type: "letter", content: ALPHABET[idx] || "A", translation: lesson_topic },
      },
    });
  } catch (err) {
    console.error("[A0 Turn Error]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── STEP 2: TURN ROUTE ──────────────────────────────────────────────────────
router.post("/turn", upload.single("audio"), async (req, res) => {

  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });

  let transcript = "";
  let pronunciation_score = 0;
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
      pronunciation_score = transcribeRes.data?.pronunciation_score || 0;
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
Pronunciation Accuracy Score: ${pronunciation_score}/100

Rules:
1. Keep response under 50 words
2. Use simple vocabulary for ${cefrLevel} level
3. Use sandwich feedback method:
   - Praise what they did well
   - Correct one specific error
   - Encourage next attempt
4. End with a question or clear instruction
5. Never break teacher character
6. Provide a Visual Anchor relating to what is being taught (e.g., if teaching 'apple', type='word', content='apple', translation='a red fruit'). Set type to 'none' if no direct concept is being introduced.
7. If Pronunciation Accuracy Score < 70, dedicate your feedback entirely to encouraging phonetic correction.

Return ONLY this JSON:
{
  "teacher_response": "your response here",
  "advance_step": true or false,
  "errors_detected": ["error1", "error2"],
  "praise": "what student did well",
  "correction": "specific correction or null",
  "student_score": 85,
  "focus_word": "single most important word here",
  "anchor": {
    "type": "word | letter | sentence | none",
    "content": "<the text>",
    "translation": "<simple definition or example>"
  },
  "new_vocabulary": [
    { "word": "example", "definition": "the meaning", "example_sentence": "I ate an apple" }
  ]
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
  const audioBase64 = await generateAudioBase64(aiResJson.teacher_response, accent, nativeLang);

  // Update session
  const newTurn = {
    turn: sessionData.turns.length,
    user_transcript: transcript,
    ai_response: aiResJson.teacher_response,
    errors_detected: aiResJson.errors_detected || [],
    score: aiResJson.student_score || 50,
    pronunciation_score: pronunciation_score,
    timestamp: new Date().toISOString()
  };

  sessionData.turns.push(newTurn);
  if (aiResJson.errors_detected && aiResJson.errors_detected.length > 0) {
    sessionData.errors_history.push(...aiResJson.errors_detected);
  }
  sessionData.current_step_index = curStepIdx;

  // Auto-Save New Vocabulary asynchronously to avoid blocking the user loop
  if (aiResJson.new_vocabulary && Array.isArray(aiResJson.new_vocabulary)) {
    const db = admin.firestore();
    const vocabRef = db.collection("users").doc(decoded.uid).collection("vocabulary");
    
    // We execute async but don't await blocking
    Promise.all(aiResJson.new_vocabulary.slice(0, 2).map(async (v) => {
       if(!v.word) return;
       const docId = v.word.toLowerCase().replace(/[^a-z0-9]/g, '');
       if (!docId) return;
       
       const docTarget = vocabRef.doc(docId);
       const doc = await docTarget.get();
       // Don't overwrite if existing, just let it be. If we wanted to, we could bump review count.
       if (!doc.exists) {
          const d = new Date();
          d.setHours(0,0,0,0);
          const midnight = d.toISOString();
          await docTarget.set({
            word: v.word,
            definition: v.definition || "No definition",
            example_sentence: v.example_sentence || "No example",
            first_seen_date: midnight,
            last_reviewed_date: midnight,
            review_count: 0,
            ease_factor: 2.5,
            interval: 1,
            next_review_date: midnight,
            source_module: sessionData.module_id || "Lesson"
          });
       }
    })).catch(e => console.error("[Auto-Vocab Injection Error]", e));
  }

  if (curStepIdx >= 4 && aiResJson.advance_step) { // completed
    sessionData.completed = true;
    sessionData.completed_at = admin.firestore.FieldValue.serverTimestamp();
    const sumScores = sessionData.turns.reduce((acc, t) => acc + (t.score || 50), 0);
    sessionData.final_score = Math.round(sumScores / Math.max(sessionData.turns.length, 1));
    
    // Recap Trigger 
    const turnsText = sessionData.turns.map(t => `Student: ${t.user_transcript}\nTeacher: ${t.ai_response}`).join("\n\n");
    const pronScores = sessionData.turns.map(t => t.pronunciation_score).filter(s => s !== undefined);
    const recapPrompt = `You are an encouraging English tutor. The student just completed a lesson. Here is the full transcript of the lesson:\n${turnsText}\n\nTheir pronunciation scores per turn were: ${JSON.stringify(pronScores)}\n\nGenerate a lesson recap in JSON with these fields:\n- summary: a 2-sentence warm summary of what was covered\n- words_practiced: array of up to 6 words the student used or was taught (each with 'word' and 'definition')\n- top_strength: one specific thing the student did well (1 sentence)\n- focus_for_next: one specific thing to practice before the next lesson (1 sentence)\n- overall_grade: a letter grade A/B/C/D based on aggregate score\n\nReturn only valid JSON.`;
    
    try {
      const recapRes = await axios.post(`${FLASK_URL}/generate_response`, {
        system_prompt: "You output restricted JSON.",
        user_message: recapPrompt,
      }, { timeout: 60000 });
      
      let rText = recapRes.data.response;
      let startIdx = rText.indexOf("{");
      let endIdx = rText.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1) {
         sessionData.recap = JSON.parse(rText.substring(startIdx, endIdx + 1));
      } else {
         throw new Error("No JSON boundaries found");
      }
    } catch (e) {
      console.error("[Recap Gen Error]", e.message);
      sessionData.recap = {
        summary: "Fantastic work completing the lesson! We covered a lot of great conversational ground today.",
        words_practiced: [],
        top_strength: "Great effort and communication flow.",
        focus_for_next: "Keep practicing pronunciation and timing.",
        overall_grade: "B"
      };
    }

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
    
    // ─── Gamification Hook ───
    const accuracyHistory = prog.accuracy_history || [];
    const isFirstLesson = accuracyHistory.length === 1;
    
    let xpResults = [];
    
    // 1. Base Lesson Reward
    xpResults.push(await awardXP(decoded.uid, "LESSON_COMPLETE"));
    
    // 2. First Lesson Bonus
    if (isFirstLesson) {
      xpResults.push(await awardXP(decoded.uid, "FIRST_LESSON_BONUS"));
    }
    
    // 3. Pronunciation Bonus
    if (avgPronunciation >= 90) {
      xpResults.push(await awardXP(decoded.uid, "PRONUNCIATION_90_100"));
    } else if (avgPronunciation >= 75) {
      xpResults.push(await awardXP(decoded.uid, "PRONUNCIATION_75_89"));
    }
    
    // Merge results for the frontend (take the latest state)
    const finalResult = xpResults[xpResults.length - 1];
    // Sum up total XP awarded in this session for the toast
    finalResult.xp_awarded = xpResults.reduce((sum, res) => sum + res.xp_awarded, 0);
    // Collect all new badges
    finalResult.new_badges = xpResults.reduce((all, res) => [...all, ...res.new_badges], []);
    
    aiResJson.xp_payload = finalResult;
  }

  await sessionRef.set(sessionData);

  return res.json({
    transcript,
    pronunciation_score,
    aiResponseJSON: aiResJson,
    audioBase64,
    step_index: curStepIdx,
    completed: sessionData.completed,
    final_score: sessionData.final_score,
    recap: sessionData.recap || null
  });

});

// ─── POST /pronounce ────────────────────────────────────────────────────────
router.post("/pronounce", async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });

  const { word } = req.body;
  
  const db = admin.firestore();
  let userSnap = await db.collection("users").doc(decoded.uid).get();
  const accent = userSnap.exists ? (userSnap.data().preferred_accent || "american") : "american";

  if (!word) return res.status(400).json({ error: "Provide a 'word'" });

  try {
    const pronRes = await axios.post(`${FLASK_URL}/pronounce`, { word, accent }, { timeout: 30000 });
    return res.json(pronRes.data);
  } catch (err) {
    console.error("[Pronounce Proxy Error]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
