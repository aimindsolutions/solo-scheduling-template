import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { chatId } = body;

  if (!chatId) {
    return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
  }

  const configSnap = await adminDb.collection("businessConfig").doc("main").get();
  const ownerChatId = configSnap.data()?.ownerTelegramChatId;

  if (String(chatId) !== String(ownerChatId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await adminDb.collection("magicTokens").doc(token).set({
    chatId: String(chatId),
    expiresAt: Timestamp.fromDate(expiresAt),
    used: false,
    createdAt: Timestamp.now(),
  });

  return NextResponse.json({ token });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const doc = await adminDb.collection("magicTokens").doc(token).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const data = doc.data()!;
  if (data.used || data.expiresAt.toDate() < new Date()) {
    return NextResponse.json({ error: "Token expired" }, { status: 403 });
  }

  await adminDb.collection("magicTokens").doc(token).update({ used: true });

  const configSnap = await adminDb.collection("businessConfig").doc("main").get();
  const ownerEmail = configSnap.data()?.ownerEmail;
  const uid = ownerEmail || `telegram:${data.chatId}`;

  const customToken = await adminAuth.createCustomToken(uid);

  return NextResponse.json({ customToken });
}
