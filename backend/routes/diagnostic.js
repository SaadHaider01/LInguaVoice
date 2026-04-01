// ============================================================
// backend/routes/diagnostic.js
// LinguaVoice — Step 3: Diagnostic Assessment Route
//
// POST /api/diagnostic
//   - Accepts: multipart audio blob (in-memory, never saved to disk)
//   - Forwards to Flask /transcribe (Whisper)
//   - Sends transcript to Flask /generate_response (Mistral)
//   - Parses JSON assessment, saves to Firestore
//   - Returns assessment to frontend
// ============================================================
const router   = require("express").Router();
const admin    = require("firebase-admin");
const multer   = require("multer");
const FormData = require("form-data");
const axios    = require("axios");
const ffmpeg   = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const { Readable } = require("stream");
const fs       = require("fs");
const path     = require("path");
const os       = require("os");

ffmpeg.setFfmpegPath(ffmpegPath);

const FLASK_URL = process.env.FLASK_URL || "http://localhost:5000";

// In-memory storage — audio never touches disk on Node side
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },   // 50 MB cap
});

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function verifyToken(req) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return await admin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
}

// ─── JSON parser — robust against Mistral adding prose around JSON ────────────
function parseAssessmentJSON(raw) {
  // 1. Try direct parse
  try { return JSON.parse(raw); } catch {}

  // 2. Extract first {...} block
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }

  // 3. Fallback — return a safe default so the user can still continue
  console.warn("[Diagnostic] Mistral returned unparseable response, using A1 default");
  return {
    level:                 "A1",
    grammar_score:         50,
    vocabulary_score:      50,
    fluency_score:         50,
    pronunciation_score:   null,
    detected_native_accent: "unknown",
    strengths:             ["You made an attempt to communicate in English"],
    improvements:          ["Focus on building basic vocabulary", "Practise simple sentence structures"],
    recommended_accent:    "american",
    summary:               "You are at the beginning of your English learning journey. Let's build your skills together!",
  };
}

// ─── Build the Mistral diagnostic prompt (accurate CEFR assessment) ──────────
function buildDiagnosticPrompt(transcript) {
  return `You are an English language assessment expert.
Analyze this spoken English transcript and assess the CEFR level accurately.

TRANSCRIPT: "${transcript}"

CEFR CRITERIA:
A1: Only basic phrases, many errors, very limited vocabulary
A2: Simple sentences, basic communication possible, frequent errors  
B1: Can discuss familiar topics, some errors, decent vocabulary
B2: Fluent on most topics, occasional errors, good vocabulary
C1: Very fluent, rare errors, wide vocabulary, natural expression
C2: Native-like fluency, near perfect grammar, rich vocabulary

Be accurate — do NOT default to A1. 
Analyze the actual grammar complexity, 
vocabulary range, and sentence structure used.

Return ONLY this JSON, no other text:
{
  "level": "A1|A2|B1|B2|C1|C2",
  "grammar_score": 0-100,
  "vocabulary_score": 0-100,
  "fluency_score": 0-100,
  "detected_native_accent": "Indian|Pakistani|Spanish|Arabic|Chinese|unclear",
  "strengths": ["specific strength 1", "specific strength 2"],
  "improvements": ["specific area 1", "specific area 2"],
  "summary": "One honest sentence about this speaker"
}`;
}

// ─── POST /api/diagnostic ─────────────────────────────────────────────────────
router.post("/", upload.single("audio"), async (req, res) => {
  console.log('=== DIAGNOSTIC ROUTE HIT ===');
  console.log('File received:', req.file ? 'YES' : 'NO');
  console.log('File details:', req.file);
  console.log('Flask URL:', FLASK_URL);

  // 1. Verify auth
  const decoded = await verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const uid = decoded.uid;

  // 2. Validate audio
  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    return res.status(400).json({ error: "No audio received. Send as multipart field 'audio'." });
  }

  console.log(`[Diagnostic] uid=${uid} | audio size=${(req.file.buffer.length / 1024).toFixed(1)}KB | mime=${req.file.mimetype}`);

  try {
    // 2.5 Convert WebM buffer to WAV using embedded ffmpeg
    async function convertWebmToWav(inputBuffer) {
      return new Promise((resolve, reject) => {
        const tmpInput  = path.join(os.tmpdir(), `input_${Date.now()}.webm`);
        const tmpOutput = path.join(os.tmpdir(), `output_${Date.now()}.wav`);
        
        fs.writeFileSync(tmpInput, inputBuffer);
        
        ffmpeg(tmpInput)
          .toFormat('wav')
          .on('end', () => {
            const wavBuffer = fs.readFileSync(tmpOutput);
            fs.unlinkSync(tmpInput);
            fs.unlinkSync(tmpOutput);
            resolve(wavBuffer);
          })
          .on('error', (err) => {
            reject(err);
          })
          .save(tmpOutput);
      });
    }

    const wavBuffer = await convertWebmToWav(req.file.buffer);

    // 3. Forward audio buffer to Flask /transcribe (Whisper)
    const audioForm = new FormData();
    audioForm.append("audio", wavBuffer, {
      filename:    "recording.wav",
      contentType: "audio/wav",
    });

    let transcript;
    try {
      const transcribeRes = await axios.post(`${FLASK_URL}/transcribe`, audioForm, {
        headers: audioForm.getHeaders(),
        timeout: 90_000,   // Whisper can take up to 90s on CPU
      });
      transcript = transcribeRes.data?.transcript || "";
      console.log(`[Diagnostic] Whisper transcript (${transcript.length} chars):`, transcript.slice(0, 120));
    } catch (err) {
      console.error("[Diagnostic] Whisper error:", err.message);
      return res.status(503).json({ error: "AI speech-to-text service unavailable. Is Flask running on port 5000?" });
    }

    if (!transcript.trim()) {
      return res.status(422).json({ error: "No speech detected in the recording. Please try again and speak clearly." });
    }

    // 4. Send transcript to Flask /generate_response (Mistral assessment)
    let rawMistralResponse;
    try {
      const mistralRes = await axios.post(`${FLASK_URL}/generate_response`, {
        system_prompt: "",
        user_message:  buildDiagnosticPrompt(transcript),
      }, { timeout: 300_000 });   // Mistral can take up to 2 min on CPU
      rawMistralResponse = mistralRes.data?.response || "";
      console.log("[Diagnostic] Mistral raw:", rawMistralResponse.slice(0, 300));
    } catch (err) {
      console.error("[Diagnostic] Mistral error:", err.message);
      return res.status(503).json({ error: "AI assessment service unavailable. Is Flask running on port 5000?" });
    }

    // 5. Parse assessment JSON
    const assessment = parseAssessmentJSON(rawMistralResponse);
    assessment.pronunciation_score = null;   // assessed during lessons
    assessment.completed            = true;
    assessment.completed_date       = new Date().toISOString();

    // 6. Save to Firestore
    await admin.firestore().collection("users").doc(uid).update({
      assessment:   assessment,
      last_active:  admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[Diagnostic] Saved to Firestore for uid=${uid} | level=${assessment.level}`);

    // 7. Return result to frontend
    return res.json({ success: true, assessment, transcript });

  } catch (err) {
    console.error("[Diagnostic] Unexpected error:", err.message);
    return res.status(500).json({ error: "Assessment failed: " + err.message });
  }
});

module.exports = router;
