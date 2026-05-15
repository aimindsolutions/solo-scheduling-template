import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Firebase client is initialized lazily — only on first actual usage at runtime.
// During 'next build', NEXT_PUBLIC_* env vars are undefined which causes
// auth/invalid-api-key if initialized at module load time.
function getClientApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0];

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_API_KEY is not set. " +
      "Ensure all NEXT_PUBLIC_FIREBASE_* environment variables are configured."
    );
  }

  return initializeApp({
    apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

export const db = new Proxy({} as Firestore, {
  get(_target, prop: string) {
    const instance = getFirestore(getClientApp());
    const value = (instance as any)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export const auth = new Proxy({} as Auth, {
  get(_target, prop: string) {
    const instance = getAuth(getClientApp());
    const value = (instance as any)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
