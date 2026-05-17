import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionToken, validateSession } from "@/lib/auth/session";
import { createPhoneVerifyToken } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { valid, clientId } = await validateSession(token);
  if (!valid || !clientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb.collection("clients").doc(clientId).get();
  if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = snap.data()!;

  // Already connected
  if (data.telegramChatId) return NextResponse.json({ error: "Already connected" }, { status: 400 });

  const phone = data.phone as string;
  if (!phone) return NextResponse.json({ error: "No phone on record" }, { status: 400 });

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
  const verifyToken = await createPhoneVerifyToken(phone, clientId, false, 60);
  const telegramUrl = `https://t.me/${botUsername}?start=verify_${verifyToken}`;

  return NextResponse.json({ telegramUrl });
}
