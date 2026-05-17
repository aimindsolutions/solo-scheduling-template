import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAdminAuth } from "@/lib/api-auth";
import { createPhoneVerifyToken } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const doc = await adminDb.collection("clients").doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = doc.data()!;
  const phone = data.phone as string;
  if (!phone) return NextResponse.json({ error: "Client has no phone" }, { status: 400 });

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
  const token = await createPhoneVerifyToken(phone, id, false, 60);
  const telegramUrl = `https://t.me/${botUsername}?start=verify_${token}`;

  return NextResponse.json({ telegramUrl });
}
