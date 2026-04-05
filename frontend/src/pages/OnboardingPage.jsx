// ============================================================
// frontend/src/pages/OnboardingPage.jsx
// 3-step onboarding flow:
//   Step 1: Meet Luna      (unchanged)
//   Step 2: How It Works   (unchanged)
//   Step 3: Native Language + Zero Knowledge Detection (NEW)
// Voice selection removed — now lives in /settings
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
import "./onboarding.css";

const ONBOARDING_STEPS = 3;

const Waveform = ({ isPlaying }) => (
  <div className={`onboarding-waveform ${isPlaying ? "playing" : ""}`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="waveform-bar" />
    ))}
  </div>
);

// Static intro — preloaded WAV in /public/audio/
// No backend call needed. Vite serves this directly.
const LUNA_INTRO_AUDIO = "/audio/luna_intro.wav";
const LUNA_INTRO_TEXT  = "Hi! I\u2019m Luna, your personal English tutor. I\u2019m here to listen to you speak and understand your level \u2014 then we\u2019ll build a learning path made just for you. Let\u2019s get started!";

export default function OnboardingPage() {
  const { currentUser, refreshUserDoc } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(() => {
    return parseInt(localStorage.getItem("onboarding_step")) || 1;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [showContinue, setShowContinue] = useState(false);

  // Step 3 state
  const [selectedLanguage, setSelectedLanguage] = useState(
    () => localStorage.getItem("onboarding_language") || null
  );
  const [isZeroKnowledge, setIsZeroKnowledge] = useState(false);
  const [showCheckbox, setShowCheckbox] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [savingComplete, setSavingComplete] = useState(false);

  const audioRef = useRef(null);      // Audio() instance
  const audioElRef = useRef(null);    // <audio> DOM element for preloading

  // Persist step to localStorage
  useEffect(() => {
    localStorage.setItem("onboarding_step", step);
  }, [step]);

  // Load Noto font if a language is already selected (resuming session)
  useEffect(() => {
    if (selectedLanguage) {
      loadNativeFont(selectedLanguage);
      setShowCheckbox(true);
    }
  }, []);

  // Try autoplay — returns true if succeeded, false if blocked
  const tryAutoplay = (base64) => {
    return new Promise((resolve) => {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(`data:audio/wav;base64,${base64}`);
      audioRef.current = audio;
      audio.onplay  = () => setIsPlaying(true);
      audio.onended = () => { setIsPlaying(false); setShowContinue(true); };
      audio.onerror = () => { setIsPlaying(false); setShowContinue(true); resolve(false); };
      audio.play()
        .then(() => resolve(true))
        .catch(() => { setIsPlaying(false); resolve(false); });
    });
  };

  // Manual replay triggered by user tap — always works (user gesture)
  const handlePlayAudio = () => {
    if (introData.audio) {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(`data:audio/wav;base64,${introData.audio}`);
      audioRef.current = audio;
      audio.onplay  = () => setIsPlaying(true);
      audio.onended = () => { setIsPlaying(false); setShowContinue(true); };
      audio.onerror = () => { setIsPlaying(false); setShowContinue(true); };
      audio.play().catch((e) => console.error("Play failed:", e));
    }
  };

  const playAudio = (base64) => {
    tryAutoplay(base64);
  };

  const handleNext = () => {
    if (step < ONBOARDING_STEPS) {
      setStep(step + 1);
      setShowContinue(false);
      setIsPlaying(false);
    }
  };

  // Step 3: Language card selected
  const handleLanguageSelect = async (langKey) => {
    if (langKey === selectedLanguage) return;
    setSelectedLanguage(langKey);
    setIsZeroKnowledge(false); // reset checkbox on language change
    localStorage.setItem("onboarding_language", langKey);
    loadNativeFont(langKey);

    // Fade-in checkbox after short delay
    setShowCheckbox(false);
    setTimeout(() => setShowCheckbox(true), 150);

    // Save native_language to Firestore immediately (non-blocking)
    setSavingLanguage(true);
    try {
      const token = await currentUser.getIdToken();
      await fetch(`${import.meta.env.VITE_API_URL}/api/settings/language`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ native_language: langKey }),
      });
    } catch (err) {
      console.error("Language save failed", err);
    } finally {
      setSavingLanguage(false);
    }
  };

  // Step 3: Zero-knowledge path — complete onboarding as A0
  // FIX: No explicit navigate() — let OnboardingGate handle the redirect.
  // Race condition: navigate() fired before refreshUserDoc() state update settled,
  // causing OnboardingGate to see stale userDoc and redirect back to /onboarding.
  const handleStartLearning = async () => {
    if (!selectedLanguage) return;
    setSavingComplete(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/onboarding/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          native_language:   selectedLanguage,
          is_zero_knowledge: true,
          cefr_level:        "A0",
        }),
      });
      const data = await res.json();
      localStorage.removeItem("onboarding_step");
      localStorage.removeItem("onboarding_language");
      // refreshUserDoc updates React state → OnboardingGate detects
      // onboarding_complete: true → automatically redirects to /dashboard.
      // Do NOT call navigate() here — that would race against state update.
      await refreshUserDoc();
      // OnboardingGate will redirect now that userDoc is updated.
    } catch (err) {
      console.error("Onboarding completion failed", err);
      setSavingComplete(false);
    }
    // Note: setSavingComplete(false) intentionally omitted on success path
    // because the component will unmount on redirect.
  };

  // Step 3: Normal diagnostic path
  // FIX: Same race condition fix — no explicit navigate before state update.
  const handleContinueToVoiceTest = async () => {
    if (!selectedLanguage) return;
    setSavingComplete(true);
    try {
      const token = await currentUser.getIdToken();
      await fetch(`${import.meta.env.VITE_API_URL}/api/onboarding/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          native_language:   selectedLanguage,
          is_zero_knowledge: false,
        }),
      });
      localStorage.removeItem("onboarding_step");
      localStorage.removeItem("onboarding_language");
      // Diagnostic path: onboarding_complete won't be set by this call
      // (Condition B not met yet). Navigate directly — OnboardingGate
      // will pass through to /diagnostic since complete=false is expected.
      navigate("/diagnostic", { replace: true });
    } catch (err) {
      console.error("Failed to proceed to diagnostic", err);
      setSavingComplete(false);
    }
  };

  const startLearningLabel = selectedLanguage
    ? (A0_BUTTON_LABELS.start_learning[selectedLanguage] || "Start Learning")
    : "Start Learning";

  return (
    <div className="onboarding-page">
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
        {/* ── Step 1: Meet Luna (unchanged) ───────────────────── */}
        {step === 1 && (
          <div className="onboarding-step step-1 fade-up">
            <div className="luna-avatar">
              <div className="avatar-circle">L</div>
              <div className="pulse-ring"></div>
            </div>
            <h2>Hi, I'm Luna</h2>
            {introData.message && (
              <div className="chat-bubble">{introData.message}</div>
            )}

            {/* Waveform + play button */}
            <div className="step1-audio-row">
              <Waveform isPlaying={isPlaying} />
              {introData.audio && (
                <button
                  className="luna-play-btn"
                  onClick={handlePlayAudio}
                  title="Play Luna's message"
                  aria-label="Play Luna's voice"
                  disabled={isPlaying}
                >
                  {isPlaying ? "🔈" : "▶ Hear Luna"}
                </button>
              )}
            </div>

            {/* Loading indicator while fetching intro */}
            {loading && (
              <p className="intro-loading">Luna is preparing her message...</p>
            )}

            {showContinue && (
              <button className="onboarding-btn bottom-fixed" onClick={handleNext}>
                Continue
              </button>
            )}
          </div>
        )}

        {/* ── Step 2: How It Works (unchanged) ────────────────── */}
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

        {/* ── Step 3: Native Language + Zero Knowledge (NEW) ─── */}
        {step === 3 && (
          <div className="onboarding-step step-3 fade-up">
            <h2>What's your first language?</h2>

            {selectedLanguage && LANGUAGE_SUBHEADINGS[selectedLanguage] && (
              <p
                className={`lang-subheading fade-in ${isRTL(selectedLanguage) ? "rtl-text" : ""}`}
                dir={isRTL(selectedLanguage) ? "rtl" : undefined}
              >
                {LANGUAGE_SUBHEADINGS[selectedLanguage]}
              </p>
            )}

            {/* Language card grid */}
            <div className="language-grid">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.key}
                  className={`language-card ${selectedLanguage === lang.key ? "selected" : ""}`}
                  onClick={() => handleLanguageSelect(lang.key)}
                >
                  <span className="lang-flag">{lang.flag}</span>
                  <span className="lang-english">{lang.english}</span>
                  <span
                    className={`lang-native ${isRTL(lang.key) ? "rtl-text" : ""}`}
                    dir={isRTL(lang.key) ? "rtl" : undefined}
                  >
                    {lang.native}
                  </span>
                </button>
              ))}
            </div>

            {/* Zero-knowledge checkbox — fades in after language selected */}
            {showCheckbox && selectedLanguage && (
              <div className={`zero-knowledge-section fade-in`}>
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
                  <span
                    className={`zk-label-text ${isRTL(selectedLanguage) ? "rtl-text" : ""}`}
                    dir={isRTL(selectedLanguage) ? "rtl" : undefined}
                  >
                    {ZERO_KNOWLEDGE_LABELS[selectedLanguage] || ZERO_KNOWLEDGE_LABELS.other}
                  </span>
                </label>

                {/* Confirmation text when checkbox is ticked */}
                {isZeroKnowledge && (
                  <p
                    className={`zk-confirmation fade-in ${isRTL(selectedLanguage) ? "rtl-text" : ""}`}
                    dir={isRTL(selectedLanguage) ? "rtl" : undefined}
                  >
                    {ZERO_KNOWLEDGE_CONFIRMATIONS[selectedLanguage] || ZERO_KNOWLEDGE_CONFIRMATIONS.other}
                  </p>
                )}
              </div>
            )}

            {/* Action button — conditional on zero-knowledge */}
            {selectedLanguage && (
              <div className="onboarding-actions bottom-fixed">
                {isZeroKnowledge ? (
                  <button
                    className="onboarding-btn"
                    onClick={handleStartLearning}
                    disabled={savingComplete}
                  >
                    {savingComplete ? "Starting..." : startLearningLabel}
                  </button>
                ) : (
                  <button
                    className="onboarding-btn"
                    onClick={handleContinueToVoiceTest}
                    disabled={savingComplete}
                  >
                    {savingComplete ? "Loading..." : "Continue to Voice Test"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
