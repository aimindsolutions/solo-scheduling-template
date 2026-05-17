import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function ipFrom(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { idToken } = body;

  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  let decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
  }

  const { uid: googleUid, email, name, picture } = decoded;

  // Find existing client by googleUid, then fall back to email match
  let clientId: string | null = null;

  const byUid = await adminDb
    .collection("clients")
    .where("googleUid", "==", googleUid)
    .limit(1)
    .get();

  if (!byUid.empty) {
    clientId = byUid.docs[0].id;
    await adminDb.collection("clients").doc(clientId).update({
      googleUid,
      googleEmail: email ?? null,
      updatedAt: Timestamp.now(),
    });
  } else if (email) {
    const byEmail = await adminDb
      .collection("clients")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!byEmail.empty) {
      clientId = byEmail.docs[0].id;
      await adminDb.collection("clients").doc(clientId).update({
        googleUid,
        googleEmail: email,
        updatedAt: Timestamp.now(),
      });
    }
  }

  // New client — create from Google profile
  if (!clientId) {
    const parts = (name || "").trim().split(/\s+/);
    const firstName = parts[0] || email?.split("@")[0] || "Client";
    const lastName = parts.slice(1).join(" ") || null;
    const now = Timestamp.now();

    const configSnap = await adminDb.collection("businessConfig").doc("main").get();
    const config = configSnap.exists ? configSnap.data()! : {};

    const ref = await adminDb.collection("clients").add({
      firstName,
      lastName,
      phone: null,
      email: email ?? null,
      googleUid,
      googleEmail: email ?? null,
      profilePicture: picture ?? null,
      telegramChatId: null,
      language: "uk",
      phoneVerified: false,
      googleVerified: true,
      emailVerified: true,
      authMethods: ["google"],
      consentGiven: true,
      consentTimestamp: now,
      consentLanguage: "uk",
      consentJurisdiction: config.jurisdiction || "UA",
      totalAppointments: 0,
      confirmedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      createdAt: now,
      updatedAt: now,
    });
    clientId = ref.id;
  }

  const ip = ipFrom(request);
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
  const { token, expiresAt } = await createSession(clientId, "google", true, ipHash);

  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, token, expiresAt);
  return res;
}
