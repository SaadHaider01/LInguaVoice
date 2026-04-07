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
  if (!userDoc) return children; // Guest/Auth handled by ProtectedRoute

  // Step 1 check: Basic User Info (Lang + ZK preference)
  const EXCLUDED_LANGS = ["", "other", "other_unset", "unknown"];
  const hasLanguage = userDoc.native_language && !EXCLUDED_LANGS.includes(userDoc.native_language);
  const finishedOnboardingPage = !!(hasLanguage && (userDoc.is_zero_knowledge !== undefined));

  // Step 2 check: Level Assessment (Diagnostic or Zero-Knowledge path)
  const hasLevel = (userDoc.is_zero_knowledge === true) || !!userDoc.cefr_level || !!userDoc.assessment?.level;

  // Step 3 check: Accent Selection
  const hasAccent = !!(userDoc.preferred_accent || userDoc.accent_preference);

  const pathname = location.pathname;

  // -- REDIRECT LOGIC (The Funnel) --

  // 1. If basic onboarding not done (no language) -> force /onboarding
  if (!hasLanguage && pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // 2. If has language but no level (Diagnostic needed) -> stays on /onboarding (Step 3)
  //    OR if they manually visit /diagnostic, redirect them to /onboarding (unified flow)
  if (hasLanguage && !hasLevel && userDoc.is_zero_knowledge !== true) {
    if (pathname === "/diagnostic") {
      return <Navigate to="/onboarding" replace />;
    }
    if (pathname !== "/onboarding") {
      return <Navigate to="/onboarding" replace />;
    }
  }

  // 3. If has level but no accent selected -> force /accent
  if (hasLevel && !hasAccent) {
     if (pathname !== "/accent") {
       return <Navigate to="/accent" replace />;
     }
  }

  // 4. If fully finished and trying to visit onboarding routes -> go to dashboard
  const fullyComplete = finishedOnboardingPage && hasLevel && hasAccent;
  const isOnboardingRoute = ["/onboarding", "/diagnostic", "/accent"].includes(pathname);
  if (fullyComplete && isOnboardingRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
