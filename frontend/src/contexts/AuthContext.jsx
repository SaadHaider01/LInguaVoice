// ============================================================
// frontend/src/contexts/AuthContext.jsx
// Wraps Firebase Auth state and exposes it to the entire app.
// Also handles creating the Firestore user doc on first signup.
// ============================================================
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

const AuthContext = createContext(null);

// ─── Helper: call backend to create Firestore user document ──────────────────
async function ensureUserDoc(firebaseUser) {
  try {
    const token = await firebaseUser.getIdToken();
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({
        displayName:    firebaseUser.displayName || "Learner",
        email:          firebaseUser.email,
        nativeLanguage: "unknown",  // updated later in onboarding
      }),
    });
    const data = await res.json();
    return data.user;
  } catch (err) {
    console.error("[AuthContext] Failed to ensure user doc:", err.message);
    return null;
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userDoc,     setUserDoc]     = useState(null);   // Firestore user document
  const [loading,     setLoading]     = useState(true);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const doc = await ensureUserDoc(user);
        setUserDoc(doc);
      } else {
        setUserDoc(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // ─── Auth actions ──────────────────────────────────────────────────────────

  async function signup(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Set display name on the Firebase Auth profile
    await updateProfile(cred.user, { displayName });
    // Create Firestore doc
    const doc = await ensureUserDoc(cred.user);
    setUserDoc(doc);
    return cred;
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithGoogle() {
    const cred = await signInWithPopup(auth, googleProvider);
    const doc  = await ensureUserDoc(cred.user);
    setUserDoc(doc);
    return cred;
  }

  async function logout() {
    await signOut(auth);
    setUserDoc(null);
  }

  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  const value = {
    currentUser,
    userDoc,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
  };

  // Don't render children until Firebase has resolved auth state (prevents flash)
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
