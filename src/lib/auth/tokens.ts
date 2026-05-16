import crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { PhoneVerifyToken } from "@/types";

interface TokenDoc {
  phone: string;
  clientId?: string;
  registrationData?: PhoneVerifyToken["registrationData"];
  createdAt: Timestamp;
  expiresAt: Timestamp;
  used: boolean;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createPhoneVerifyToken(
  phone: string,
  clientId?: string,
  registrationData?: PhoneVerifyToken["registrationData"],
  ttlMinutes = 15
): Promise<string> {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  const doc: TokenDoc = {
    phone,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(expiresAt),
    used: false,
  };

  if (clientId) doc.clientId = clientId;
  if (registrationData) doc.registrationData = registrationData;

  await adminDb.collection("phoneVerifyTokens").doc(token).set(doc);
  return token;
}

export async function validatePhoneVerifyToken(
  token: string
): Promise<(TokenDoc & { id: string }) | null> {
  const snap = await adminDb.collection("phoneVerifyTokens").doc(token).get();
  if (!snap.exists) return null;

  const data = snap.data() as TokenDoc;
  const expiresAt = data.expiresAt.toDate();

  if (data.used || expiresAt < new Date()) return null;
  return { ...data, id: snap.id };
}

export async function markTokenUsed(token: string): Promise<void> {
  await adminDb.collection("phoneVerifyTokens").doc(token).update({ used: true });
}
