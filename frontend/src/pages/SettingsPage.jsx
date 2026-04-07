// ============================================================
// frontend/src/pages/SettingsPage.jsx
// User settings: Luna's voice accent, native language, account.
// Matches existing deep purple glassmorphism aesthetic.
// ============================================================
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LANGUAGES } from "../config/languages";
import { loadNativeFont, isRTL } from "../utils/fontLoader";
import "./settings.css";

const API_URL = import.meta.env.VITE_API_URL;

// Floating success toast
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="settings-toast" role="alert">
      <span className="settings-toast-icon">✓</span>
      {message}
    </div>
  );
}

// Destructive confirmation dialog
function DeleteDialog({ onCancel, onConfirm, loading }) {
  return (
    <div className="settings-dialog-overlay">
      <div className="settings-dialog">
        <h3>Delete Account</h3>
        <p>
          Are you sure? This will permanently delete your account and all
          progress. <strong>This cannot be undone.</strong>
        </p>
        <div className="settings-dialog-actions">
          <button className="settings-btn settings-btn-ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="settings-btn settings-btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete Forever"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { currentUser, userDoc, refreshUserDoc, logout } = useAuth();
  const navigate = useNavigate();

  const [toast, setToast] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ── Section 1: Accent ─────────────────────────────────────────
  const [selectedAccent, setSelectedAccent] = useState(
    () => localStorage.getItem("accent_preference") || userDoc?.accent_preference || "american"
  );
  const [previewingAccent, setPreviewingAccent] = useState(null);
  const [savingAccent, setSavingAccent] = useState(false);

  // ── Section 2: Language ───────────────────────────────────────
  const [selectedLanguage, setSelectedLanguage] = useState(
    userDoc?.native_language || null
  );
  const [savingLanguage, setSavingLanguage] = useState(false);
  const isA0User = userDoc?.cefr_level === "A0";

  // ── Section 3: Account ────────────────────────────────────────
  const [displayName, setDisplayName] = useState(
    userDoc?.display_name || currentUser?.displayName || ""
  );
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef(null);

  // Sync accent from userDoc on load
  useEffect(() => {
    if (userDoc?.accent_preference) setSelectedAccent(userDoc.accent_preference);
    if (userDoc?.native_language)   setSelectedLanguage(userDoc.native_language);
    if (userDoc?.display_name)      setDisplayName(userDoc.display_name);
  }, [userDoc]);

  // Load font when language is set
  useEffect(() => {
    if (selectedLanguage) loadNativeFont(selectedLanguage);
  }, [selectedLanguage]);

  const showToast = (msg) => setToast(msg);

  // ── Accent handlers ───────────────────────────────────────────
  const handleAccentSelect = async (accent) => {
    if (accent === selectedAccent || savingAccent) return;
    setSelectedAccent(accent);
    setSavingAccent(true);
    try {
      const token = await currentUser.getIdToken();
      await fetch(`${API_URL}/api/settings/accent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accent }),
      });
      localStorage.setItem("accent_preference", accent);
      showToast("Luna's voice updated!");
      await refreshUserDoc();
    } catch (err) {
      console.error("[Settings] Accent save failed:", err);
      showToast("Failed to save — please try again.");
    } finally {
      setSavingAccent(false);
    }
  };

  const handleAccentPreview = async (accent) => {
    if (previewingAccent === accent) return;
    setPreviewingAccent(accent);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    await audioCtx.resume();

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_URL}/api/accent/preview?accent=${accent}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(raw.slice(0));
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        setPreviewingAccent(null);
        audioCtx.close();
      };
      source.start(0);
    } catch (err) {
      console.error("[Settings] Accent preview failed:", err);
      setPreviewingAccent(null);
      audioCtx.close();
    }
  };

  // ── Language handlers ─────────────────────────────────────────
  const handleLanguageSelect = async (langKey) => {
    if (langKey === selectedLanguage || savingLanguage) return;
    setSelectedLanguage(langKey);
    loadNativeFont(langKey);
    setSavingLanguage(true);
    try {
      const token = await currentUser.getIdToken();
      await fetch(`${API_URL}/api/settings/language`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ native_language: langKey }),
      });
      showToast("Language updated!");
      await refreshUserDoc();
    } catch (err) {
      console.error("[Settings] Language save failed:", err);
      showToast("Failed to save language.");
    } finally {
      setSavingLanguage(false);
    }
  };

  // ── Name handlers ─────────────────────────────────────────────
  const handleNameSave = async () => {
    const trimmed = displayName.trim();
    if (!trimmed || trimmed === userDoc?.display_name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const token = await currentUser.getIdToken();
      await fetch(`${API_URL}/api/settings/display-name`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_name: trimmed }),
      });
      showToast("Name updated!");
      await refreshUserDoc();
    } catch (err) {
      console.error("[Settings] Name save failed:", err);
      showToast("Failed to save name.");
    } finally {
      setSavingName(false);
      setEditingName(false);
    }
  };

  const handlePasswordReset = async () => {
    const { sendPasswordResetEmail } = await import("firebase/auth");
    const { auth } = await import("../firebase");
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      showToast("Password reset email sent!");
    } catch (err) {
      console.error("[Settings] Password reset failed:", err);
      showToast("Failed to send reset email.");
    }
  };

  // ── Account deletion ──────────────────────────────────────────
  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const token = await currentUser.getIdToken();
      await fetch(`${API_URL}/api/settings/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await logout();
      navigate("/signup", { replace: true });
    } catch (err) {
      console.error("[Settings] Account deletion failed:", err);
      showToast("Failed to delete account. Please try again.");
      setDeletingAccount(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="settings-page">
      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* Delete dialog */}
      {showDeleteDialog && (
        <DeleteDialog
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteAccount}
          loading={deletingAccount}
        />
      )}

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="settings-nav">
        <button className="settings-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1 className="settings-title">Settings</h1>
        <div style={{ width: "60px" }} />
      </nav>

      <main className="settings-main">

        {/* ─────────────────────────────────────────────────────── */}
        {/* SECTION 1: Luna's Voice                                 */}
        {/* ─────────────────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">Luna's Voice</h2>
          <p className="settings-section-desc">
            Choose which accent Luna speaks in. You can preview each one before deciding.
          </p>

          <div className="accent-cards-row">
            {/* American English */}
            <div
              className={`accent-card ${selectedAccent === "american" ? "selected" : ""}`}
              onClick={() => handleAccentSelect("american")}
            >
              <span className="accent-card-flag">🇺🇸</span>
              <span className="accent-card-label">American English</span>
              <button
                className="accent-preview-btn"
                aria-label="Preview American accent"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAccentPreview("american");
                }}
                disabled={previewingAccent !== null}
              >
                {previewingAccent === "american" ? "🔈" : "▶"}
              </button>
            </div>

            {/* British English */}
            <div
              className={`accent-card ${selectedAccent === "british" ? "selected" : ""}`}
              onClick={() => handleAccentSelect("british")}
            >
              <span className="accent-card-flag">🇬🇧</span>
              <span className="accent-card-label">British English</span>
              <button
                className="accent-preview-btn"
                aria-label="Preview British accent"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAccentPreview("british");
                }}
                disabled={previewingAccent !== null}
              >
                {previewingAccent === "british" ? "🔈" : "▶"}
              </button>
            </div>
          </div>

          {savingAccent && <p className="settings-saving">Saving...</p>}
        </section>

        {/* ─────────────────────────────────────────────────────── */}
        {/* SECTION 2: Native Language                              */}
        {/* ─────────────────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">Your Native Language</h2>
          <p className="settings-section-desc">
            This helps Luna explain things in your language during early lessons.
          </p>

          {/* Warning banner for A0 users */}
          {isA0User && (
            <div className="settings-warning-banner" role="note">
              ⚠️ Changing your language won't reset your progress. Your lessons will continue in the new language.
            </div>
          )}

          <div className="settings-language-grid">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.key}
                className={`settings-language-card ${selectedLanguage === lang.key ? "selected" : ""}`}
                onClick={() => handleLanguageSelect(lang.key)}
                disabled={savingLanguage}
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

          {savingLanguage && <p className="settings-saving">Saving...</p>}
        </section>

        {/* ─────────────────────────────────────────────────────── */}
        {/* SECTION 3: Account                                      */}
        {/* ─────────────────────────────────────────────────────── */}
        <section className="settings-section">
          <h2 className="settings-section-title">Account</h2>

          {/* Display Name */}
          <div className="settings-field">
            <label className="settings-field-label">Display Name</label>
            {editingName ? (
              <div className="settings-name-edit">
                <input
                  ref={nameInputRef}
                  className="settings-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
                  autoFocus
                  maxLength={40}
                />
                <button className="settings-btn settings-btn-primary" onClick={handleNameSave} disabled={savingName}>
                  {savingName ? "Saving..." : "Save"}
                </button>
              </div>
            ) : (
              <div className="settings-field-row">
                <span className="settings-field-value">{displayName}</span>
                <button className="settings-btn settings-btn-ghost" onClick={() => setEditingName(true)}>
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="settings-field">
            <label className="settings-field-label">Email</label>
            <div className="settings-field-row">
              <span className="settings-field-value settings-field-muted">{currentUser?.email}</span>
            </div>
          </div>

          {/* Change Password */}
          <div className="settings-field">
            <label className="settings-field-label">Password</label>
            <div className="settings-field-row">
              <button className="settings-btn settings-btn-ghost" onClick={handlePasswordReset}>
                Send Reset Email
              </button>
            </div>
          </div>

          {/* Delete Account */}
          <div className="settings-field settings-danger-zone">
            <p className="settings-danger-label">Danger Zone</p>
            <button
              className="settings-btn settings-btn-danger"
              onClick={() => setShowDeleteDialog(true)}
            >
              Delete Account
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
