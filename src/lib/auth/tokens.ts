import crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

interface TokenDoc {
  phone: string;
  clientId: string;
  rememberMe: boolean;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  used: boolean;
  verified: boolean;
  telegramChatId?: string;
}

export interface TokenResult extends TokenDoc {
  id: string;
}

export function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function createPhoneVerifyToken(
  phone: string,
  clientId: string,
  rememberMe: boolean,
  ttlMinutes = 15
): Promise<string> {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  await adminDb.collection("phoneVerifyTokens").doc(token).set({
    phone,
    clientId,
    rememberMe,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(expiresAt),
    used: false,
    verified: false,
  });

  return token;
}

export async function getPhoneVerifyToken(token: string): Promise<TokenResult | null> {
  const snap = await adminDb.collection("phoneVerifyTokens").doc(token).get();
  if (!snap.exists) return null;

  const data = snap.data() as TokenDoc;
  const expiresAt = data.expiresAt.toDate();
  if (expiresAt < new Date()) return null;

  return { ...data, id: snap.id };
}

export async function markTokenVerified(
  token: string,
  telegramChatId: string
): Promise<void> {
  await adminDb.collection("phoneVerifyTokens").doc(token).update({
    verified: true,
    telegramChatId,
  });
}

export async function markTokenUsed(token: string): Promise<void> {
  await adminDb.collection("phoneVerifyTokens").doc(token).update({ used: true });
}
