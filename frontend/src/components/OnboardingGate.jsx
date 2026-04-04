import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function OnboardingGate({ children }) {
  const { userDoc, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // or a loading spinner

  // If userDoc exists and onboarding is explicitly false, redirect to /onboarding
  if (userDoc && userDoc.onboarding_complete === false && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // If onboarding is complete and they try to go to /onboarding, send them to dashboard
  if (userDoc && userDoc.onboarding_complete === true && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
