// ============================================================
// frontend/src/components/OnboardingGate.jsx
// Guards all protected routes. Redirects users to /onboarding
// if they haven't fully completed the onboarding flow.
//
// Onboarding is ONLY complete when BOTH conditions are met:
//   Condition A: native_language is set in Firestore
//   Condition B: is_zero_knowledge = true  OR  cefr_level is set
//
// Source of truth: Firestore (via userDoc from AuthContext).
// localStorage may be used as a performance cache but is NOT authoritative.
// ============================================================
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function isOnboardingComplete(userDoc) {
  if (!userDoc) return false;

  // Fast path: Firestore field explicitly set
  if (userDoc.onboarding_complete === true) return true;

  // Condition A: native_language must be a real user selection.
  // Exclude: null, empty string, "other" (init default), "other_unset", "unknown" (old schema)
  const EXCLUDED_LANGS = ["", "other", "other_unset", "unknown"];
  const hasLanguage = userDoc.native_language &&
    !EXCLUDED_LANGS.includes(userDoc.native_language);

  // Condition B: either zero-knowledge path OR diagnostic completed
  const hasLevel = userDoc.is_zero_knowledge === true || !!userDoc.cefr_level;

  return !!(hasLanguage && hasLevel);
}

export default function OnboardingGate({ children }) {
  const { userDoc, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  const complete = isOnboardingComplete(userDoc);

  // Not complete and not already on /onboarding → redirect
  if (userDoc && !complete && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // Already complete and trying to visit /onboarding → send to dashboard
  if (userDoc && complete && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
