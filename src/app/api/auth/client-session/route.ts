import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { validateSession, getSessionToken, createSession, setSessionCookie } from "@/lib/auth/session";
import { markTokenUsed } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

interface VerifyTokenDoc {
  clientId: string;
  rememberMe: boolean;
  verified: boolean;
  used: boolean;
  expiresAt: Timestamp;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const verifyToken = searchParams.get("verifyToken");

  // Polling path: verify page checks if Telegram has confirmed the token
  if (verifyToken) {
    const snap = await adminDb.collection("phoneVerifyTokens").doc(verifyToken).get();

    if (!snap.exists) {
      return NextResponse.json({ error: "expired" }, { status: 401 });
    }

    const data = snap.data() as VerifyTokenDoc;
    const expiresAt = data.expiresAt.toDate();

    if (expiresAt < new Date()) {
      return NextResponse.json({ error: "expired" }, { status: 401 });
    }

    if (data.used) {
      // Session was already created — shouldn't happen if browser redirected
      return NextResponse.json({ error: "already_used" }, { status: 401 });
    }

    if (!data.verified) {
      return NextResponse.json({ pending: true }, { status: 401 });
    }

    // Token verified by Telegram — atomically create session and mark used
    let sessionToken: string;
    let expiresAtDate: Date;

    try {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        request.headers.get("x-real-ip") ??
        "unknown";

      const { token, expiresAt: sessionExpiry } = await createSession(
        data.clientId,
        "phone_telegram",
        data.rememberMe,
        ip
      );
      sessionToken = token;
      expiresAtDate = sessionExpiry;
    } catch {
      return NextResponse.json({ error: "session_create_failed" }, { status: 500 });
    }

    await markTokenUsed(verifyToken);

    const response = NextResponse.json({ valid: true, clientId: data.clientId });
    setSessionCookie(response, sessionToken, expiresAtDate);
    return response;
  }

  // Normal path: check existing session cookie (used by dashboard auth guard)
  const token = getSessionToken(request);
  if (!token) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  const result = await validateSession(token);
  if (!result.valid) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  return NextResponse.json({ valid: true, clientId: result.clientId });
}
