import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { checkRateLimit, recordAttempt } from "@/lib/auth/rate-limit";
import { createPhoneVerifyToken } from "@/lib/auth/tokens";
import { sendMessage, buildInlineKeyboard } from "@/lib/telegram/bot";
import { normalizePhone } from "@/lib/utils";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function ipHash(request: NextRequest): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex");
}

async function findClientByPhone(phone: string) {
  let snap = await adminDb
    .collection("clients")
    .where("phone", "==", phone)
    .limit(1)
    .get();
  if (snap.empty && phone.startsWith("+")) {
    snap = await adminDb
      .collection("clients")
      .where("phone", "==", phone.slice(1))
      .limit(1)
      .get();
  }
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Record<string, unknown> & { id: string };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const phone = normalizePhone(body.phone || "");
  const rememberMe = body.rememberMe === true;

  if (!phone) {
    return NextResponse.json({ error: "Missing phone" }, { status: 400 });
  }

  const ipKey = `ip:${ipHash(request)}`;
  const phoneKey = `phone:${phone}`;

  const [ipLimit, phoneLimit] = await Promise.all([
    checkRateLimit(ipKey),
    checkRateLimit(phoneKey),
  ]);

  if (!ipLimit.allowed || !phoneLimit.allowed) {
    await recordAttempt(ipKey);
    await recordAttempt(phoneKey);
    return NextResponse.json({ error: "Too many attempts", status: "rate_limited" }, { status: 429 });
  }

  const client = await findClientByPhone(phone);

  if (!client) {
    await recordAttempt(phoneKey);
    await recordAttempt(ipKey);
    return NextResponse.json({ status: "not_found" }, { status: 400 });
  }

  const telegramChatId = client.telegramChatId as string | undefined;

  if (!telegramChatId) {
    return NextResponse.json({ status: "unverified_no_telegram" }, { status: 400 });
  }

  const token = await createPhoneVerifyToken(phone, client.id, rememberMe);

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
  const telegramUrl = `https://t.me/${botUsername}?start=verify_${token}`;

  try {
    await sendMessage(telegramChatId, "🔐 Підтвердіть ваш номер телефону:", {
      replyMarkup: buildInlineKeyboard([[{ text: "✅ Підтвердити вхід", url: telegramUrl }]]),
    });
  } catch {
    // Non-fatal — client can still tap the link on the verify page
  }

  return NextResponse.json({ status: "telegram_sent", telegramUrl, verifyToken: token });
}
