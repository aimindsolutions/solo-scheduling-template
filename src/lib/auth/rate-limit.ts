import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Backoff schedule in minutes: attempt 6 → 1min, 7 → 5min, 8+ → 30min
function backoffMinutes(attempts: number): number {
  if (attempts === 6) return 1;
  if (attempts === 7) return 5;
  return 30;
}

interface RateLimitDoc {
  key: string;
  attempts: number;
  windowStart: Timestamp;
  blockedUntil?: Timestamp;
  expiresAt: Timestamp;
}

export interface RateLimitResult {
  allowed: boolean;
  attemptsLeft: number;
  blockedUntil?: Date;
}

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const snap = await adminDb.collection("authRateLimit").doc(key).get();
  if (!snap.exists) return { allowed: true, attemptsLeft: MAX_ATTEMPTS };

  const data = snap.data() as RateLimitDoc;

  if (data.blockedUntil) {
    const blockedUntil = data.blockedUntil.toDate();
    if (blockedUntil > new Date()) {
      return { allowed: false, attemptsLeft: 0, blockedUntil };
    }
  }

  const windowStart = data.windowStart.toDate();

  // Window expired — treat as fresh
  if (Date.now() - windowStart.getTime() > WINDOW_MS) {
    return { allowed: true, attemptsLeft: MAX_ATTEMPTS };
  }

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - data.attempts);
  return { allowed: data.attempts < MAX_ATTEMPTS, attemptsLeft };
}

export async function recordAttempt(key: string): Promise<void> {
  const snap = await adminDb.collection("authRateLimit").doc(key).get();
  const now = new Date();
  const windowExpiry = new Date(now.getTime() + WINDOW_MS);

  if (!snap.exists) {
    await adminDb.collection("authRateLimit").doc(key).set({
      key,
      attempts: 1,
      windowStart: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(windowExpiry),
    });
    return;
  }

  const data = snap.data() as RateLimitDoc;
  const windowStart = data.windowStart.toDate();

  // Reset window if expired
  if (Date.now() - windowStart.getTime() > WINDOW_MS) {
    await adminDb.collection("authRateLimit").doc(key).set({
      key,
      attempts: 1,
      windowStart: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(windowExpiry),
    });
    return;
  }

  const newAttempts = data.attempts + 1;
  const update: Record<string, unknown> = {
    attempts: newAttempts,
    expiresAt: Timestamp.fromDate(windowExpiry),
  };

  if (newAttempts > MAX_ATTEMPTS) {
    const blockedMs = backoffMinutes(newAttempts) * 60 * 1000;
    update.blockedUntil = Timestamp.fromDate(new Date(now.getTime() + blockedMs));
  }

  await adminDb.collection("authRateLimit").doc(key).update(update);
}

export async function clearLimit(key: string): Promise<void> {
  await adminDb.collection("authRateLimit").doc(key).delete();
}
