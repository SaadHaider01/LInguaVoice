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
import "./onboarding.css";

const ONBOARDING_STEPS = 3;

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

export default function OnboardingPage() {
  const { currentUser, refreshUserDoc } = useAuth();
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

  // When Step 1 mounts, try autoplay once.
  // Modern browsers only allow autoplay after a user gesture, so this will
  // usually be blocked — but if it works (e.g. low-restrictions setting) great.
  // Either way the ▶ Hear Luna button always works because it IS a user gesture.
  useEffect(() => {
    if (step !== 1) return;
    // Small delay so the <audio> element has time to load
    const t = setTimeout(() => {
      const el = audioElRef.current;
      if (!el) return;
      el.play()
        .then(() => { /* autoplay succeeded */ })
        .catch(() => { /* blocked — user will tap the button */ });
    }, 400);
    return () => clearTimeout(t);
  }, [step]);

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

  // ── Step 3: zero-knowledge path ──────────────────────────────
  // Do NOT call navigate() here — that races against React state update.
  // OnboardingGate reacts to refreshUserDoc() and redirects automatically.
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
      // State update → OnboardingGate sees onboarding_complete:true → /dashboard
      await refreshUserDoc();
    } catch (err) {
      console.error("Onboarding completion failed", err);
      setSavingComplete(false); // only reset on error; component unmounts on success
    }
  };

  // ── Step 3: normal diagnostic path ───────────────────────────
  const handleContinueToDiagnostic = async () => {
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
          is_zero_knowledge: false,
        }),
      });
      localStorage.removeItem("onboarding_step");
      localStorage.removeItem("onboarding_language");
      // Condition B not met yet → onboarding_complete still false.
      // Navigate directly — OnboardingGate passes through to /diagnostic.
      navigate("/diagnostic", { replace: true });
    } catch (err) {
      console.error("Failed to proceed to diagnostic", err);
      setSavingComplete(false);
    }
  };

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

        {/* ── Step 3: Native Language + Zero Knowledge ─────────── */}
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
              <div className="zero-knowledge-section fade-in">
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
                    {ZERO_KNOWLEDGE_LABELS[selectedLanguage] || ZERO_KNOWLEDGE_LABELS.other_lang}
                  </span>
                </label>

                {isZeroKnowledge && (
                  <p
                    className={`zk-confirmation fade-in ${isRTL(selectedLanguage) ? "rtl-text" : ""}`}
                    dir={isRTL(selectedLanguage) ? "rtl" : undefined}
                  >
                    {ZERO_KNOWLEDGE_CONFIRMATIONS[selectedLanguage] ||
                      ZERO_KNOWLEDGE_CONFIRMATIONS.other_lang}
                  </p>
                )}
              </div>
            )}

            {/* CTA button — changes based on zero-knowledge toggle */}
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
                    onClick={handleContinueToDiagnostic}
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
