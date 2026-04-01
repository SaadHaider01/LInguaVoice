// ============================================================
// frontend/src/pages/AccentPage.jsx
// LinguaVoice — Step 4: Accent Selection
//
// Flow:
//   Two accent cards (American / British)
//   → Preview Voice button streams TTS audio from Flask
//   → Confirm button saves to Firestore via backend
//   → Redirect to /dashboard
// ============================================================
import { useState, useRef, useEffect } from "react";
import { useNavigate }                 from "react-router-dom";
import { useAuth }                     from "../contexts/AuthContext";
import "./accent.css";

const ACCENTS = [
  {
    id:      "american",
    flag:    "🇺🇸",
    name:    "American English",
    country: "United States",
    desc:    "Clear, confident, and globally recognised. Widely used in business, tech, and entertainment worldwide.",
    traits:  ["Rhotic R", "Flat vowels", "Television standard", "Silicon Valley"],
  },
  {
    id:      "british",
    flag:    "🇬🇧",
    name:    "British English",
    country: "United Kingdom",
    desc:    "Crisp, precise, and widely respected. The accent of Oxford, the BBC, and international academia.",
    traits:  ["Non-rhotic", "Received Pronunciation", "BBC standard", "Oxford English"],
  },
];

// Animated wave icon shown while audio plays
function WaveIcon() {
  return (
    <div className="wave-icon">
      {[1,2,3,4,5].map(i => <span key={i} />)}
    </div>
  );
}

// Speaker icon
const SpeakerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

export default function AccentPage() {
  const { currentUser, userDoc } = useAuth();
  const navigate = useNavigate();

  const [selected,   setSelected]   = useState(null);
  const [playing,    setPlaying]    = useState(null); // 'american' | 'british' | null
  const [saving,     setSaving]     = useState(false);
  const [errMsg,     setErrMsg]     = useState("");

  const audioRef = useRef(null);

  // Pre-select from Firestore if already chosen
  useEffect(() => {
    if (userDoc?.preferred_accent) {
      setSelected(userDoc.preferred_accent);
    }
  }, [userDoc]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  // ─── Preview TTS audio ───────────────────────────────────────
  async function handlePreview(accentId) {
    // Stop any playing audio first
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    if (playing === accentId) {
      setPlaying(null);
      return;
    }

    setPlaying(accentId);
    setErrMsg("");

    try {
      const token = await currentUser.getIdToken();
      const res   = await fetch(
        `${import.meta.env.VITE_API_URL}/api/accent/preview?accent=${accentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        throw new Error("TTS preview unavailable");
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPlaying(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPlaying(null);
        setErrMsg("Could not play audio preview. Is the Flask AI server running?");
      };

      await audio.play();
    } catch (err) {
      setPlaying(null);
      setErrMsg(err.message || "Preview failed. Is the Flask AI server running on port 5000?");
    }
  }

  // ─── Save selection and redirect ─────────────────────────────
  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    setErrMsg("");

    try {
      const token = await currentUser.getIdToken();
      const res   = await fetch(
        `${import.meta.env.VITE_API_URL}/api/accent/select`,
        {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ accent: selected }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save preference");
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setErrMsg(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="accent-page">
      <div className="accent-wrap">

        {/* Header */}
        <div className="accent-header">
          <h1>Choose Your Accent</h1>
          <p>Your AI coach will speak and teach in your selected accent throughout every lesson.</p>
        </div>

        {/* Cards */}
        <div className="accent-cards">
          {ACCENTS.map(a => (
            <div
              key={a.id}
              id={`accent-card-${a.id}`}
              className={`accent-card${selected === a.id ? " selected" : ""}`}
              onClick={() => setSelected(a.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === "Enter" && setSelected(a.id)}
            >
              {/* Tick badge */}
              <div className="accent-tick">✓</div>

              <div className="accent-flag">{a.flag}</div>
              <div className="accent-name">{a.name}</div>
              <div className="accent-country">{a.country}</div>
              <div className="accent-desc">{a.desc}</div>

              <div className="accent-traits">
                {a.traits.map(t => (
                  <span key={t} className="trait-pill">{t}</span>
                ))}
              </div>

              {/* Preview button */}
              <button
                id={`preview-${a.id}`}
                className={`preview-btn${playing === a.id ? " playing" : ""}`}
                onClick={e => { e.stopPropagation(); handlePreview(a.id); }}
                disabled={playing !== null && playing !== a.id}
                title="Preview this accent's voice"
              >
                {playing === a.id ? (
                  <><WaveIcon /> Stop preview</>
                ) : (
                  <><SpeakerIcon /> Preview voice</>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Error */}
        {errMsg && <div className="accent-error">{errMsg}</div>}

        {/* CTA */}
        <button
          id="accent-confirm"
          className="accent-cta"
          disabled={!selected || saving}
          onClick={handleConfirm}
        >
          {saving
            ? "Saving…"
            : selected
              ? `Continue with ${ACCENTS.find(a => a.id === selected)?.name} →`
              : "Select an accent to continue"
          }
        </button>

      </div>
    </div>
  );
}
