import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { generateToken } from "./tokens";
import type { AuthMethod } from "@/types";

const COOKIE_NAME = "client_session";
const SESSION_TTL_DAYS = 7;
const SESSION_REMEMBER_TTL_DAYS = 30;

interface SessionDoc {
  clientId: string;
  rememberMe: boolean;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export async function createSession(
  clientId: string,
  authMethod: AuthMethod,
  rememberMe: boolean,
  ip: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const ttlDays = rememberMe ? SESSION_REMEMBER_TTL_DAYS : SESSION_TTL_DAYS;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  const ipHash = await hashIp(ip);

  await adminDb.collection("clientSessions").doc(token).set({
    clientId,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(expiresAt),
    authMethod,
    rememberMe,
    ipHash,
  });
  return { token, expiresAt };
}

export async function validateSession(
  token: string
): Promise<{ valid: boolean; clientId?: string }> {
  if (!token) return { valid: false };

  const snap = await adminDb.collection("clientSessions").doc(token).get();
  if (!snap.exists) return { valid: false };

  const data = snap.data() as SessionDoc;
  const expiresAt = data.expiresAt.toDate();

  if (expiresAt < new Date()) {
    await adminDb.collection("clientSessions").doc(token).delete();
    return { valid: false };
  }

  // Auto-extend if more than 50% of TTL elapsed
  const createdAt = data.createdAt.toDate();
  const totalTtlMs = expiresAt.getTime() - createdAt.getTime();
  const elapsedMs = Date.now() - createdAt.getTime();
  if (elapsedMs > totalTtlMs * 0.5) {
    const ttlDays = data.rememberMe ? SESSION_REMEMBER_TTL_DAYS : SESSION_TTL_DAYS;
    const newExpiry = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    await adminDb.collection("clientSessions").doc(token).update({
      expiresAt: Timestamp.fromDate(newExpiry),
    });
  }

  return { valid: true, clientId: data.clientId };
}

export async function deleteSession(token: string): Promise<void> {
  await adminDb.collection("clientSessions").doc(token).delete();
}

export function getSessionToken(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value ?? null;
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date
): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

async function hashIp(ip: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(ip).digest("hex");
}
