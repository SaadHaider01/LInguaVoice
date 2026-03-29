// ============================================================
// src/firebase.js
// Firebase SDK initialisation — reads all config from .env vars
// NEVER hard-code API keys here.
//
// NOTE: Firebase Storage is intentionally NOT used in this project.
// Audio is processed in-memory only (Whisper) and streamed directly
// from Flask to the browser. No audio files are persisted.
// ============================================================
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialise Firebase app
const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore — only data store used in this project
export const db = getFirestore(app);

export default app;
