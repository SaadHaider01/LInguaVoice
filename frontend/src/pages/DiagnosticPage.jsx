// ============================================================
// frontend/src/pages/DiagnosticPage.jsx
// Step 3 — Speaking Diagnostic Assessment
//
// Flow:
//   intro → recording (mic + waveform + timer) → analyzing → results
//
// Audio: MediaRecorder → Blob → POST /api/diagnostic (never stored)
// Notes:
//   - If assessment already complete, redirects to /dashboard
//   - Minimum 10 seconds recording before submit is allowed
// ============================================================
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate }                              from "react-router-dom";
import { useAuth }                                  from "../contexts/AuthContext";
import "./diagnostic.css";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_SECONDS = 180;  // 3-minute cap
const MIN_SECONDS = 10;   // min before "Stop & Analyse" is enabled

const SPEAKING_PROMPTS = [
  "Tell us your name and where you're from. What do you do for work or study?",
  "Describe your daily routine. What does a typical day look like for you?",
  "What are your hobbies or interests? What do you enjoy doing in your free time?",
  "Talk about a place you like — your city, a favourite spot, or somewhere you've visited.",
];

function fmt(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Mic Icon ─────────────────────────────────────────────────────────────────
const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10a7 7 0 0 1-14 0"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8"  y1="23" x2="16" y2="23"/>
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2"/>
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function DiagnosticPage() {
  const { currentUser, userDoc } = useAuth();
  const navigate = useNavigate();

  // phases: intro | recording | analyzing | results | error
  const [phase,       setPhase]       = useState("intro");
  const [timeLeft,    setTimeLeft]    = useState(MAX_SECONDS);
  const [elapsed,     setElapsed]     = useState(0);
  const [assessment,  setAssessment]  = useState(null);
  const [errMsg,      setErrMsg]      = useState("");
  const [analyzeStep, setAnalyzeStep] = useState(0); // 0=init,1=whisper,2=mistral,3=done
  const [promptIdx,   setPromptIdx]   = useState(0);

  // Refs
  const mediaRecorder  = useRef(null);
  const audioChunks    = useRef([]);
  const timerRef       = useRef(null);
  const promptTimer    = useRef(null);
  const streamRef      = useRef(null);
  const audioCtxRef    = useRef(null);
  const analyserRef    = useRef(null);
  const animFrameRef   = useRef(null);
  const canvasRef      = useRef(null);

  // ─── Redirect if already assessed ─────────────────────────────────────────
  useEffect(() => {
    if (userDoc?.assessment?.completed === true) {
      navigate("/dashboard", { replace: true });
    }
  }, [userDoc, navigate]);

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(promptTimer.current);
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  // ─── Waveform animation ────────────────────────────────────────────────────
  const drawWaveform = useCallback(() => {
    const canvas   = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx    = canvas.getContext("2d");
    const W      = canvas.width;
    const H      = canvas.height;
    const data   = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    ctx.clearRect(0, 0, W, H);

    const barCount = 48;
    const step     = Math.floor(data.length / barCount);
    const barW     = W / barCount;

    for (let i = 0; i < barCount; i++) {
      const v       = data[i * step] / 128.0 - 1;
      const barH    = Math.max(2, Math.abs(v) * (H * 0.9));
      const x       = i * barW + barW * 0.1;
      const opacity = 0.5 + Math.abs(v) * 0.5;

      ctx.fillStyle = `rgba(168,85,247,${opacity})`;
      ctx.beginPath();
      ctx.roundRect(x, (H - barH) / 2, barW * 0.8, barH, 2);
      ctx.fill();
    }

    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  // ─── Start recording ───────────────────────────────────────────────────────
  async function startRecording() {
    setErrMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Waveform analyser
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      // MediaRecorder — accept webm or ogg depending on browser support
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.current = recorder;
      audioChunks.current   = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.start(250); // collect chunks every 250ms
      setPhase("recording");
      setElapsed(0);
      setTimeLeft(MAX_SECONDS);
      setPromptIdx(0);

      // Countdown timer
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            stopAndAnalyze();
            return 0;
          }
          return prev - 1;
        });
        setElapsed(prev => prev + 1);
      }, 1000);

      // Rotate speaking prompts every 45s
      promptTimer.current = setInterval(() => {
        setPromptIdx(prev => (prev + 1) % SPEAKING_PROMPTS.length);
      }, 45_000);

      // Start waveform
      drawWaveform();

    } catch (err) {
      if (err.name === "NotAllowedError") {
        setErrMsg("Microphone access denied. Please allow microphone access in your browser and try again.");
      } else {
        setErrMsg("Could not access microphone: " + err.message);
      }
    }
  }

  // ─── Stop and send to backend ─────────────────────────────────────────────
  async function stopAndAnalyze() {
    // Stop recording machinery
    clearInterval(timerRef.current);
    clearInterval(promptTimer.current);
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();

    const recorder = mediaRecorder.current;
    if (!recorder || recorder.state === "inactive") return;

    // Collect final chunks then analyze
    recorder.onstop = async () => {
      const mimeType = audioChunks.current[0]?.type || "audio/webm";
      const blob     = new Blob(audioChunks.current, { type: mimeType });
      await sendToBackend(blob, mimeType);
    };
    recorder.stop();
    setPhase("analyzing");
    setAnalyzeStep(1);
  }

  // ─── POST audio to backend ────────────────────────────────────────────────
  async function sendToBackend(blob, mimeType) {
    try {
      const token = await currentUser.getIdToken();
      const ext   = mimeType.includes("ogg") ? ".ogg" : ".webm";

      const formData = new FormData();
      formData.append("audio", blob, `recording${ext}`);

      setAnalyzeStep(1); // Whisper running

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/diagnostic`,
        {
          method:  "POST",
          headers: { Authorization: `Bearer ${token}` },
          body:    formData,
        }
      );

      setAnalyzeStep(2); // Mistral running

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      setAnalyzeStep(3);

      // Small delay so user sees "Assessment complete" step
      await new Promise(r => setTimeout(r, 800));
      setAssessment(data.assessment);
      setPhase("results");

    } catch (err) {
      setErrMsg(err.message);
      setPhase("error");
    }
  }

  // ─── Render helpers ───────────────────────────────────────────────────────
  function renderIntro() {
    return (
      <>
        <div className="diag-header">
          <h1>🎤 Speaking Assessment</h1>
          <p>
            We'll listen to you speak English for up to 3 minutes.<br />
            Just talk naturally — there are no right or wrong answers.
          </p>
        </div>

        <div className="prompt-card">
          <span>💡</span>
          You can talk about yourself, your daily life, hobbies, or anything you like.
          Don't worry about mistakes — just speak freely!
        </div>

        <div className="mic-wrap">
          <div className="diag-timer">{fmt(MAX_SECONDS)}</div>
          <button id="diag-start" className="mic-btn idle" onClick={startRecording}>
            <MicIcon />
          </button>
          <span className="mic-label">Tap to start</span>
        </div>

        {errMsg && <div className="diag-error">{errMsg}</div>}
      </>
    );
  }

  function renderRecording() {
    const canStop = elapsed >= MIN_SECONDS;
    return (
      <>
        <div className="diag-header">
          <h1>🔴 Recording…</h1>
          <p>Speak clearly into your microphone</p>
        </div>

        <div className="prompt-card">
          <span>💬</span>
          {SPEAKING_PROMPTS[promptIdx]}
        </div>

        {/* Waveform */}
        <div className="waveform-wrap">
          <canvas
            ref={canvasRef}
            className="waveform-canvas"
            width={480}
            height={64}
          />
        </div>

        <div className={`diag-timer${timeLeft <= 30 ? " urgent" : ""}`}>
          {fmt(timeLeft)}
        </div>

        <div className="mic-wrap">
          <button
            id="diag-stop"
            className="mic-btn recording"
            onClick={stopAndAnalyze}
            title={canStop ? "Stop and analyse" : `Please speak for at least ${MIN_SECONDS}s`}
          >
            <StopIcon />
          </button>
          <span className="mic-label">
            {canStop ? "Stop & Analyse" : `Keep speaking… (${MIN_SECONDS - elapsed}s more)`}
          </span>
        </div>

        {!canStop && (
          <p className="min-notice">Speak for at least {MIN_SECONDS} seconds to submit</p>
        )}
      </>
    );
  }

  function renderAnalyzing() {
    const steps = [
      { label: "Transcribing your speech…",    id: 1 },
      { label: "Analysing your English level…", id: 2 },
      { label: "Assessment complete!",          id: 3 },
    ];
    return (
      <>
        <div className="diag-header">
          <h1>⚙️ Analysing…</h1>
          <p>
            Analyzing your speech… This may take up to 3 minutes on first run.<br />
            <span style={{ fontSize: "0.8rem", opacity: 0.5 }}>Please keep this tab open.</span>
          </p>
        </div>
        <div className="analyzing-wrap">
          <div className="analyzing-spinner" />
          <div className="analyzing-steps">
            {steps.map(s => (
              <div
                key={s.id}
                className={`step-item${analyzeStep === s.id ? " active" : analyzeStep > s.id ? " done" : ""}`}
              >
                <span className="step-dot" />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  function renderResults() {
    const a = assessment;
    if (!a) return null;
    return (
      <>
        <div className="diag-header">
          <h1>🎉 Assessment Complete</h1>
          <p>Here's your English profile</p>
        </div>

        <div className="results-wrap">
          {/* Level badge */}
          <div className="level-badge">
            <div className="level-label">Your CEFR Level</div>
            <div className="level-value">{a.level || "A1"}</div>
            {a.summary && <div className="level-summary">{a.summary}</div>}
          </div>

          {/* Scores */}
          <div className="scores-grid">
            {[
              { label: "Grammar",    val: a.grammar_score },
              { label: "Vocab",      val: a.vocabulary_score },
              { label: "Fluency",    val: a.fluency_score },
            ].map(s => (
              <div key={s.label} className="score-item">
                <div className="s-label">{s.label}</div>
                <div className="s-value">{s.val ?? "—"}</div>
              </div>
            ))}
          </div>

          {/* Detected accent */}
          {a.detected_native_accent && (
            <div style={{ textAlign: "center" }}>
              <span className="accent-pill">
                🌍 Native accent detected: {a.detected_native_accent}
              </span>
            </div>
          )}

          {/* Strengths */}
          {a.strengths?.length > 0 && (
            <div className="feedback-section">
              <h4>✅ Your Strengths</h4>
              <ul className="feedback-list">
                {a.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {a.improvements?.length > 0 && (
            <div className="feedback-section">
              <h4>📈 Areas to Improve</h4>
              <ul className="feedback-list improvements">
                {a.improvements.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {/* CTA */}
          <button
            id="diag-next"
            className="diag-btn"
            onClick={() => navigate("/accent")}
          >
            Choose Your Accent →
          </button>
        </div>
      </>
    );
  }

  function renderError() {
    return (
      <>
        <div className="diag-header">
          <h1>❌ Something went wrong</h1>
        </div>
        <div className="diag-error">{errMsg}</div>
        <button id="diag-retry" className="diag-btn" onClick={() => {
          setPhase("intro");
          setErrMsg("");
          setElapsed(0);
          setTimeLeft(MAX_SECONDS);
        }}>
          Try Again
        </button>
      </>
    );
  }

  return (
    <div className="diag-page">
      <div className="diag-card">
        {phase === "intro"     && renderIntro()}
        {phase === "recording" && renderRecording()}
        {phase === "analyzing" && renderAnalyzing()}
        {phase === "results"   && renderResults()}
        {phase === "error"     && renderError()}
      </div>
    </div>
  );
}
