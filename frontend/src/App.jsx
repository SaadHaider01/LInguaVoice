import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute   from "./components/ProtectedRoute";

// ─── Pages ───────────────────────────────────────────────────────────────────
import SignupPage      from "./pages/SignupPage";
import LoginPage       from "./pages/LoginPage";
import ResetPage       from "./pages/ResetPage";
import DashboardPage   from "./pages/DashboardPage";
import DiagnosticPage  from "./pages/DiagnosticPage";
import AccentPage      from "./pages/AccentPage";
import LessonPage      from "./pages/LessonPage";

function NotFound() {
  return (
    <div style={styles.center}>
      <h1 style={{ color: "#fff" }}>404 — Page Not Found</h1>
      <a href="/" style={styles.btn}>Go Home</a>
    </div>
  );
}

function Stub({ title, step, next }) {
  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <h2 style={{ color: "#fff", marginBottom: 8 }}>{title}</h2>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>
          🔧 Built in Step {step}
        </p>
        <a href={next} style={styles.btn}>Continue →</a>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/"       element={<Navigate to="/login" replace />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/reset"  element={<ResetPage />} />

          {/* Protected routes — redirect to /login if not authenticated */}
          <Route path="/diagnostic" element={
            <ProtectedRoute><DiagnosticPage /></ProtectedRoute>
          } />
          <Route path="/accent" element={
            <ProtectedRoute><AccentPage /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/lesson/:moduleId/:lessonId?" element={
            <ProtectedRoute><LessonPage /></ProtectedRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

// ─── Minimal styles for stubs ─────────────────────────────────────────────────
const styles = {
  center: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', sans-serif",
    background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
  },
  card: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: "2.5rem 3rem",
    textAlign: "center",
  },
  btn: {
    display: "inline-block",
    padding: "10px 24px",
    borderRadius: 8,
    background: "linear-gradient(90deg, #7c3aed, #a855f7)",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 14,
  },
};
