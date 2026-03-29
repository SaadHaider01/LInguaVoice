// ============================================================
// frontend/src/pages/ResetPage.jsx
// ============================================================
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./auth.css";

export default function ResetPage() {
  const { resetPassword } = useAuth();

  const [email,   setEmail]   = useState("");
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!email.trim()) return setError("Please enter your email address.");

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSuccess(true);
    } catch (err) {
      const map = {
        "auth/user-not-found": "No account found with this email.",
        "auth/invalid-email":  "Please enter a valid email address.",
      };
      setError(map[err.code] || "Failed to send reset email. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">🔑</span>
          <h1>Reset your password</h1>
          <p>We'll send a reset link to your email</p>
        </div>

        {error   && <div className="auth-error"   role="alert">{error}</div>}
        {success && (
          <div className="auth-success" role="status">
            ✅ Check your email for a reset link. It may take a minute.
          </div>
        )}

        {!success && (
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="reset-email">Email address</label>
              <input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button id="reset-submit" type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Sending…</> : "Send Reset Link →"}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <Link to="/login">← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
