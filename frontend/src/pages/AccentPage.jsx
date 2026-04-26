// ============================================================
// frontend/src/pages/AccentPage.jsx
// LinguaVoice — Step 4: Accent Selection
// ============================================================
import { useState, useEffect, useRef } from "react";
import { useNavigate }         from "react-router-dom";
import { useAuth }             from "../contexts/AuthContext";
import "./accent.css";

const ACCENTS = [
  {
    id:      "american",
    flag:    "🇺🇸",
    label:   "US",
    name:    "American English",
    country: "United States",
    desc:    "Clear, confident, and globally recognised. Widely used in business, tech, and entertainment worldwide.",
    traits:  ["Rhotic R", "Flat vowels", "Television standard", "Silicon Valley"],
    voice:   "en-US-AriaNeural"
  },
  {
    id:      "british",
    flag:    "🇬🇧",
    label:   "GB",
    name:    "British English",
    country: "United Kingdom",
    desc:    "Crisp, precise, and widely respected. The accent of Oxford, the BBC, and international academia.",
    traits:  ["Non-rhotic", "Received Pronunciation", "BBC standard", "Oxford English"],
    voice:   "en-GB-SoniaNeural"
  },
];

function WaveIcon() {
  return (
    <div className="wave-icon">
      {[1,2,3,4,5].map(i => <span key={i} />)}
    </div>
  );
}

const SpeakerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

export default function AccentPage() {
  const { currentUser, userDoc, refreshUserDoc } = useAuth();
  const navigate = useNavigate();

  const [selected,         setSelected]         = useState(null);
  const [previewingAccent, setPreviewingAccent] = useState(null);
  const [saving,           setSaving]           = useState(false);
  const [errMsg,           setErrMsg]           = useState("");

  // Pre-fetched ArrayBuffers keyed by accent id (loaded silently on mount)
  const preloadCache = useRef({});   // { american: ArrayBuffer, british: ArrayBuffer }

  // Pre-select from Firestore if already chosen
  useEffect(() => {
    if (userDoc?.preferred_accent) setSelected(userDoc.preferred_accent);
  }, [userDoc]);

  // ─── Silently preload both audio buffers on mount ────────────
  useEffect(() => {
    if (!currentUser) return;
    ['american', 'british'].forEach(async (accent) => {
      try {
        const token = await currentUser.getIdToken();
        const res   = await fetch(
          `${import.meta.env.VITE_API_URL}/api/accent/preview?accent=${accent}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        preloadCache.current[accent] = await res.arrayBuffer();
        console.log(`[Preload] ${accent} cached (${Math.round(preloadCache.current[accent].byteLength/1024)}KB)`);
      } catch (e) {
        console.warn(`[Preload] ${accent} failed silently:`, e.message);
      }
    });
  }, [currentUser]);

  // ─── Preview TTS audio ───────────────────────────────────────
  const handlePreview = async (e, accent) => {
    e.preventDefault();
    e.stopPropagation();

    if (previewingAccent === accent) { setPreviewingAccent(null); return; }

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    await audioCtx.resume();

    setPreviewingAccent(accent);
    setErrMsg('');

    try {
      // Use preloaded buffer (instant) or fallback to live fetch
      let raw = preloadCache.current[accent];
      if (raw) {
        console.log(`[Preview] Cache hit — instant`);
      } else {
        console.log(`[Preview] Cache miss — fetching now`);
        const token = await currentUser.getIdToken();
        const res   = await fetch(
          `${import.meta.env.VITE_API_URL}/api/accent/preview?accent=${accent}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        raw = await res.arrayBuffer();
      }

      const audioBuffer = await audioCtx.decodeAudioData(raw.slice(0));
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => { setPreviewingAccent(null); audioCtx.close(); };
      source.start(0);

    } catch (err) {
      console.error('[Preview] failed:', err);
      setPreviewingAccent(null);
      audioCtx.close();
      setErrMsg('Preview failed — is the Flask AI server running on port 5000?');
    }
  };

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

      await refreshUserDoc();          // update context before navigating
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
          <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "rgba(255,255,255,0.6)", fontStyle: "italic" }}>
            Note: You can change your accent later from Profile Settings.
          </p>
        </div>

        {/* Cards */}
        <div className="accent-cards">
          {ACCENTS.map(a => (
            <div
              key={a.id}
              id={`accent-card-${a.id}`}
              className={`accent-card${selected === a.id ? " selected" : ""}`}
              onClick={() => setSelected(a.id)}
            >
              <div className="accent-tick">✓</div>
              <div className="accent-flag">{a.label}</div>
              <div className="accent-name">{a.name}</div>
              <div className="accent-country">{a.country}</div>
              <div className="accent-desc">{a.desc}</div>

              <div className="accent-traits">
                {a.traits.map(t => (
                  <span key={t} className="trait-pill">{t}</span>
                ))}
              </div>

              <button
                id={`preview-${a.id}`}
                type="button"
                className={`preview-btn${previewingAccent === a.id ? " playing" : ""}`}
                onClick={(e) => { e.stopPropagation(); handlePreview(e, a.id); }}
                title="Preview this accent's voice"
              >
                {previewingAccent === a.id
                  ? <><WaveIcon /> Playing {a.voice}...</>
                  : <><SpeakerIcon /> Preview {a.voice}</>
                }
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
