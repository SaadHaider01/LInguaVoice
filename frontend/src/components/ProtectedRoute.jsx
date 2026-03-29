// ============================================================
// frontend/src/components/ProtectedRoute.jsx
// Wraps any route that requires authentication.
// Redirects unauthenticated users to /login.
// ============================================================
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  const location        = useLocation();

  if (!currentUser) {
    // Preserve the attempted URL so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
