import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { createPhoneVerifyToken } from "@/lib/auth/tokens";
import { normalizePhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function phoneExists(phone: string): Promise<boolean> {
  let snap = await adminDb
    .collection("clients")
    .where("phone", "==", phone)
    .limit(1)
    .get();
  if (!snap.empty) return true;
  if (phone.startsWith("+")) {
    snap = await adminDb
      .collection("clients")
      .where("phone", "==", phone.slice(1))
      .limit(1)
      .get();
    if (!snap.empty) return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, consentText } = body;
  const phone = normalizePhone(body.phone || "");

  if (!name || !phone) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (await phoneExists(phone)) {
    return NextResponse.json({ status: "phone_exists" }, { status: 400 });
  }

  const configSnap = await adminDb.collection("businessConfig").doc("main").get();
  const config = configSnap.exists ? configSnap.data()! : {};
  const locale = body.locale || "uk";

  // Split name into first/last
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ") || undefined;

  const now = Timestamp.now();

  const clientRef = await adminDb.collection("clients").add({
    firstName,
    lastName: lastName ?? null,
    phone,
    email: email || null,
    telegramChatId: null,
    language: locale,
    phoneVerified: false,
    emailVerified: false,
    authMethods: [],
    consentGiven: true,
    consentTimestamp: now,
    consentLanguage: locale,
    consentJurisdiction: config.jurisdiction || "UA",
    consentText: consentText || "",
    totalAppointments: 0,
    confirmedAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,
    createdAt: now,
    updatedAt: now,
  });

  const token = await createPhoneVerifyToken(phone, clientRef.id, false);

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
  const telegramUrl = `https://t.me/${botUsername}?start=verify_${token}`;

  // Notify owner of new unverified client
  try {
    const { notifyOwnerOfUnverifiedClient } = await import("@/lib/telegram/notifications");
    await notifyOwnerOfUnverifiedClient({ name, phone });
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ status: "telegram_sent", telegramUrl, verifyToken: token });
}
