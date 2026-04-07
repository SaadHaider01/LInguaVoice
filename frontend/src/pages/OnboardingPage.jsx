// ============================================================
// frontend/src/pages/OnboardingPage.jsx
// 3-step onboarding flow:
//   Step 1: Meet Luna      — static preloaded audio, no backend call
//   Step 2: How It Works
//   Step 3: Native Language + Zero Knowledge Detection
// ============================================================
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LANGUAGES,
  ZERO_KNOWLEDGE_LABELS,
  ZERO_KNOWLEDGE_CONFIRMATIONS,
  LANGUAGE_SUBHEADINGS,
  A0_BUTTON_LABELS,
} from "../config/languages";
import { loadNativeFont, isRTL } from "../utils/fontLoader";
import { guessNativeLanguage }     from "../utils/languageDetector";
import "./onboarding.css";

const ONBOARDING_STEPS = 3;
const MAX_SECONDS = 180;
const MIN_SECONDS = 10;

const SPEAKING_PROMPTS = [
  "Tell us your name and where you're from. What do you do for work or study?",
  "Describe your daily routine. What does a typical day look like for you?",
  "What are your hobbies or interests? What do you enjoy doing in your free time?",
  "Talk about a place you like — your city, a favourite spot, or somewhere you've visited.",
];

// ── Static intro: served from /public/audio/ by Vite ──────────────
// Pre-generated via Flask TTS — no backend call, no cold-start delay.
const LUNA_INTRO_SRC  = "/audio/luna_intro.wav";
const LUNA_INTRO_TEXT =
  "Hi! I'm Luna, your personal English tutor. I'm here to listen to you " +
  "speak and understand your level — then we'll build a learning path made " +
  "just for you. Let's get started!";

const Waveform = ({ isPlaying }) => (
  <div className={`onboarding-waveform ${isPlaying ? "playing" : ""}`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="waveform-bar" />
    ))}
  </div>
);

function fmt(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

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

export default function OnboardingPage() {
  const { currentUser, userDoc, refreshUserDoc } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(
    () => parseInt(localStorage.getItem("onboarding_step")) || 1
  );
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [showContinue, setShowContinue] = useState(false);

  // Step 3 state
  const [selectedLanguage, setSelectedLanguage] = useState(
    () => localStorage.getItem("onboarding_language") || null
  );
  const [isZeroKnowledge, setIsZeroKnowledge] = useState(false);
  const [showCheckbox,    setShowCheckbox]     = useState(false);
  const [savingLanguage,  setSavingLanguage]   = useState(false);
  const [savingComplete,  setSavingComplete]   = useState(false);
  const [showLanguageGrid, setShowLanguageGrid] = useState(false);

  // Diagnostic sub-states (within step 3)
  const [diagPhase,   setDiagPhase]   = useState("auto_detect"); // auto_detect | recording | analyzing | results | error
  const [timeLeft,    setTimeLeft]    = useState(MAX_SECONDS);
  const [elapsed,     setElapsed]     = useState(0);
  const [assessment,  setAssessment]  = useState(null);
  const [errMsg,      setErrMsg]      = useState("");
  const [analyzeStep, setAnalyzeStep] = useState(0); 
  const [promptIdx,   setPromptIdx]   = useState(0);

  // Refs for MediaRecorder
  const mediaRecorder  = useRef(null);
  const audioChunks    = useRef([]);
  const timerRef       = useRef(null);
  const promptTimer    = useRef(null);
  const streamRef      = useRef(null);
  const audioCtxRef    = useRef(null);
  const analyserRef    = useRef(null);
  const animFrameRef   = useRef(null);
  const canvasRef      = useRef(null);

  // Hidden <audio> element — loaded by the browser as soon as Step 1 mounts
  const audioElRef = useRef(null);

  // Persist current step
  useEffect(() => {
    localStorage.setItem("onboarding_step", step);
  }, [step]);

  // Restore font + checkbox if user resumes on Step 3
  useEffect(() => {
    if (selectedLanguage) {
      loadNativeFont(selectedLanguage);
      setShowCheckbox(true);
    }
  }, []);

  // ─── Step 3 Auto-detection ──────────────────────────────
  useEffect(() => {
    if (step === 3 && !selectedLanguage) {
      const guessed = guessNativeLanguage();
      handleLanguageSelect(guessed);
    }
  }, [step]);

  // ─── Cleanup on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(promptTimer.current);
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  // When Step 1 mounts, try autoplay once.

  // ── Audio handlers ────────────────────────────────────────────
  const handlePlay = () => {
    const el = audioElRef.current;
    if (!el) return;
    if (!el.paused) { el.pause(); el.currentTime = 0; }
    el.currentTime = 0;
    el.play().catch((e) => console.warn("[Luna audio] play() blocked:", e));
  };

  const handleNext = () => {
    if (step < ONBOARDING_STEPS) {
      // Pause audio when leaving Step 1
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current.currentTime = 0;
      }
      setStep(step + 1);
      setShowContinue(false);
      setIsPlaying(false);
    }
  };

  // ─── Waveform animation ────────────────────────────────────
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
      if (ctx.roundRect) ctx.roundRect(x, (H - barH) / 2, barW * 0.8, barH, 2);
      else ctx.rect(x, (H - barH) / 2, barW * 0.8, barH);
      ctx.fill();
    }

    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  // ─── Start recording ───────────────────────────────────────
  async function startRecording() {
    setErrMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.current = recorder;
      audioChunks.current   = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.start(250);
      setDiagPhase("recording");
      setElapsed(0);
      setTimeLeft(MAX_SECONDS);
      setPromptIdx(0);

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

      promptTimer.current = setInterval(() => {
        setPromptIdx(prev => (prev + 1) % SPEAKING_PROMPTS.length);
      }, 45_000);

      drawWaveform();
    } catch (err) {
      setErrMsg(err.name === "NotAllowedError" ? "Microphone access denied." : err.message);
      setDiagPhase("error");
    }
  }

  // ─── Stop and analyze ──────────────────────────────────────
  async function stopAndAnalyze() {
    clearInterval(timerRef.current);
    clearInterval(promptTimer.current);
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();

    const recorder = mediaRecorder.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.onstop = async () => {
      const mimeType = audioChunks.current[0]?.type || "audio/webm";
      const blob     = new Blob(audioChunks.current, { type: mimeType });
      await sendDiagnosticToBackend(blob, mimeType);
    };
    recorder.stop();
    setDiagPhase("analyzing");
    setAnalyzeStep(1);
  }

  // ─── POST audio to backend ─────────────────────────────────
  async function sendDiagnosticToBackend(blob, mimeType) {
    try {
      const token = await currentUser.getIdToken();
      const ext   = mimeType.includes("ogg") ? ".ogg" : ".webm";
      const formData = new FormData();
      formData.append("audio", blob, `recording${ext}`);

      setAnalyzeStep(1); 

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/diagnostic`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });

      setAnalyzeStep(2); 

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      setAnalyzeStep(3);

      await new Promise(r => setTimeout(r, 800));
      setAssessment(data.assessment);
      setDiagPhase("results");

      // Sync user data since cefr_level was updated on backend
      await refreshUserDoc(); 
      
    } catch (err) {
      setErrMsg(err.message);
      setDiagPhase("error");
    }
  }

  // ── Step 3: language card clicked ────────────────────────────
  const handleLanguageSelect = async (langKey) => {
    if (langKey === selectedLanguage) return;
    setSelectedLanguage(langKey);
    setIsZeroKnowledge(false);
    localStorage.setItem("onboarding_language", langKey);
    loadNativeFont(langKey);

    setShowCheckbox(false);
    setTimeout(() => setShowCheckbox(true), 150);

    // Non-blocking: persist native_language to Firestore immediately
    setSavingLanguage(true);
    try {
      const token = await currentUser.getIdToken();
      await fetch(`${import.meta.env.VITE_API_URL}/api/settings/language`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ native_language: langKey }),
      });
    } catch (err) {
      console.error("Language save failed", err);
    } finally {
      setSavingLanguage(false);
    }
  };

  // ── Step 3: zero-knowledge path (A0) ────────────────────────
  const handleStartLearning = async () => {
    if (!selectedLanguage) return;
    setSavingComplete(true);
    try {
      const token = await currentUser.getIdToken();
      await fetch(`${import.meta.env.VITE_API_URL}/api/onboarding/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          native_language:   selectedLanguage,
          is_zero_knowledge: true,
          cefr_level:        "A0",
        }),
      });
      localStorage.removeItem("onboarding_step");
      localStorage.removeItem("onboarding_language");
      
      // Update global user state then navigate to /dashboard
      await refreshUserDoc();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Onboarding completion failed", err);
      setSavingComplete(false);
    }
  };

  // ── Step 3 Render Helpers ──────────────────────────────────
  function renderStep3AutoDetect() {
    const lang = LANGUAGES.find(l => l.key === selectedLanguage);
    if (!lang) return <div className="analyzing-spinner" />;

    return (
      <div className="step-3-detect fade-up">
        <h2>What's your first language?</h2>
        <div className="detected-card">
          <div className="detected-info">
            <span className="lang-flag">{lang.flag}</span>
            <div className="lang-text">
              <span className="lang-english">{lang.english}</span>
              <span className={`lang-native ${isRTL(lang.key) ? "rtl-text" : ""}`} dir={isRTL(lang.key) ? "rtl" : undefined}>
                {lang.native}
              </span>
            </div>
          </div>
          <button className="change-lang-link" onClick={() => setShowLanguageGrid(true)}>
            Not {lang.english}? Change
          </button>
        </div>

        {showLanguageGrid && (
          <div className="language-grid mini fade-in">
            {LANGUAGES.map((l) => (
              <button
                key={l.key}
                className={`language-card mini ${selectedLanguage === l.key ? "selected" : ""}`}
                onClick={() => { handleLanguageSelect(l.key); setShowLanguageGrid(false); }}
              >
                <span>{l.flag} {l.english}</span>
              </button>
            ))}
          </div>
        )}

        <div className="zero-knowledge-section premium">
          <label className="zk-checkbox-label">
            <div className="zk-checkbox-wrapper">
              <input
                type="checkbox"
                className="zk-checkbox-input"
                checked={isZeroKnowledge}
                onChange={(e) => setIsZeroKnowledge(e.target.checked)}
              />
              <div className={`zk-custom-checkbox ${isZeroKnowledge ? "checked" : ""}`}>
                {isZeroKnowledge && <span className="zk-check">✓</span>}
              </div>
            </div>
            <span className={`zk-label-text ${isRTL(lang.key) ? "rtl-text" : ""}`} dir={isRTL(lang.key) ? "rtl" : undefined}>
              {ZERO_KNOWLEDGE_LABELS[lang.key] || ZERO_KNOWLEDGE_LABELS.other_lang}
            </span>
          </label>
        </div>

        <div className="step-3-actions">
          {isZeroKnowledge ? (
            <button className="onboarding-btn" onClick={handleStartLearning} disabled={savingComplete}>
              {savingComplete ? "Starting..." : (A0_BUTTON_LABELS.start_learning[lang.key] || "Start Learning")} →
            </button>
          ) : (
            <button className="onboarding-btn" onClick={startRecording}>
              Start Voice Test →
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderStep3Recording() {
    const canStop = elapsed >= MIN_SECONDS;
    return (
      <div className="step-3-diag recording fade-in">
        <h2>Recording Voice Test...</h2>
        <p className="diag-instruction">Speak naturally about anything. Luna is listening.</p>
        
        <div className="prompt-card mini">
          <span>💬</span> {SPEAKING_PROMPTS[promptIdx]}
        </div>

        <div className="waveform-outer">
          <canvas ref={canvasRef} className="waveform-canvas" width={400} height={60} />
        </div>

        <div className="diag-timer-row">
          <span className={`diag-time ${timeLeft < 30 ? "urgent" : ""}`}>{fmt(timeLeft)}</span>
        </div>

        <div className="mic-wrap onboarding-mic">
          <button className="mic-btn recording" onClick={stopAndAnalyze}>
            <StopIcon />
          </button>
          <span className="mic-label">
            {canStop ? "Stop & Analyse" : `Speak for ${MIN_SECONDS - elapsed}s more...`}
          </span>
        </div>
      </div>
    );
  }

  function renderStep3Analyzing() {
    const steps = [
      { label: "Transcribing speech...",    id: 1 },
      { label: "Analysing your level...",   id: 2 },
      { label: "Ready!",                    id: 3 },
    ];
    return (
      <div className="step-3-diag analyzing fade-in">
        <h2>Luna is thinking...</h2>
        <div className="analyzing-wrap mini">
          <div className="analyzing-spinner" />
          <div className="analyzing-steps">
            {steps.map(s => (
              <div key={s.id} className={`step-item ${analyzeStep === s.id ? "active" : analyzeStep > s.id ? "done" : ""}`}>
                <span className="step-dot" /> {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderStep3Results() {
    if (!assessment) return null;
    return (
      <div className="step-3-diag results fade-up">
        <h2>Assessment Complete!</h2>
        <div className="onboarding-result-card">
          <div className="res-level">{assessment.level}</div>
          <p className="res-summary">{assessment.summary}</p>
          <div className="res-accent">Native Accent: {assessment.detected_native_accent || "detected"}</div>
        </div>
        <button className="onboarding-btn" onClick={() => navigate("/dashboard", { replace: true })}>
          Enter Dashboard →
        </button>
      </div>
    );
  }

  const startLearningLabel = selectedLanguage
    ? (A0_BUTTON_LABELS.start_learning[selectedLanguage] || "Start Learning")
    : "Start Learning";

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="onboarding-page">
      {/* Hidden audio element — preloaded by browser immediately */}
      <audio
        ref={audioElRef}
        src={LUNA_INTRO_SRC}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onEnded={() => { setIsPlaying(false); setShowContinue(true); }}
        onPause={() => setIsPlaying(false)}
        onError={() => { setIsPlaying(false); setShowContinue(true); }}
        style={{ display: "none" }}
      />

      {/* Progress dots */}
      <div className="onboarding-progress">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`step-dot ${step === i ? "active" : ""} ${step > i ? "completed" : ""}`}
          />
        ))}
      </div>

      <div className="onboarding-container">

        {/* ── Step 1: Meet Luna ───────────────────────────────── */}
        {step === 1 && (
          <div className="onboarding-step step-1 fade-up">
            <div className="luna-avatar">
              <div className="avatar-circle">L</div>
              <div className="pulse-ring" />
            </div>

            <h2>Hi, I'm Luna</h2>

            <div className="chat-bubble">{LUNA_INTRO_TEXT}</div>

            {/* Waveform + play button */}
            <div className="step1-audio-row">
              <Waveform isPlaying={isPlaying} />
              <button
                id="luna-play-btn"
                className="luna-play-btn"
                onClick={handlePlay}
                disabled={isPlaying}
                title="Play Luna's voice"
                aria-label="Hear Luna speak"
              >
                {isPlaying ? "🔈 Playing..." : "▶ Hear Luna"}
              </button>
            </div>

            {/* Continue always visible — user can skip audio */}
            <button
              className="onboarding-btn bottom-fixed"
              onClick={handleNext}
            >
              Continue
            </button>
          </div>
        )}

        {/* ── Step 2: How It Works ─────────────────────────────── */}
        {step === 2 && (
          <div className="onboarding-step step-2 fade-up">
            <h2>Here is how Luna teaches you</h2>
            <div className="cards-stack">
              <div className="info-card stagger-1">
                <div className="card-icon">👂</div>
                <div className="card-content">
                  <h3>I listen to you speak</h3>
                  <p>Just talk naturally. Luna listens and understands your current English level in real time.</p>
                </div>
              </div>
              <div className="info-card stagger-2">
                <div className="card-icon">🎯</div>
                <div className="card-content">
                  <h3>I understand your level</h3>
                  <p>Luna places you on the CEFR scale — from beginner to advanced — so lessons are always the right difficulty.</p>
                </div>
              </div>
              <div className="info-card stagger-3">
                <div className="card-icon">🗣️</div>
                <div className="card-content">
                  <h3>We practice together every day</h3>
                  <p>Short daily lessons, real conversations, pronunciation feedback. Like a private tutor, every day.</p>
                </div>
              </div>
            </div>
            <button className="onboarding-btn bottom-fixed" onClick={handleNext}>
              Got it!
            </button>
          </div>
        )}

        {/* ── Step 3: Combined Language & Level Check ────────────────── */}
        {step === 3 && (
          <div className="onboarding-step step-3 fade-up">
            {diagPhase === "auto_detect" && renderStep3AutoDetect()}
            {diagPhase === "recording"   && renderStep3Recording()}
            {diagPhase === "analyzing"   && renderStep3Analyzing()}
            {diagPhase === "results"     && renderStep3Results()}
            {diagPhase === "error" && (
              <div className="diag-error-wrap fade-in">
                <h2>Something went wrong</h2>
                <p className="diag-error-msg">{errMsg}</p>
                <button className="onboarding-btn" onClick={() => setDiagPhase("auto_detect")}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
