import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCustomToken as firebaseSignInWithCustomToken,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "./client";

const googleProvider = new GoogleAuthProvider();

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithCustomToken(token: string) {
  return firebaseSignInWithCustomToken(auth, token);
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getGoogleIdToken(): Promise<string> {
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  await firebaseSignOut(auth);
  return idToken;
}

export async function signInWithGoogleRedirect(): Promise<void> {
  return signInWithRedirect(auth, googleProvider);
}

// Call on page load to capture the ID token after a redirect sign-in completes.
// Returns null on normal page loads (no pending redirect).
export async function getGoogleIdTokenFromRedirect(): Promise<string | null> {
  const result = await getRedirectResult(auth);
  if (!result) return null;
  const idToken = await result.user.getIdToken();
  await firebaseSignOut(auth);
  return idToken;
}
