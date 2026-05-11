import { NextRequest, NextResponse } from "next/server";
import { setWebhook, setupBotCommands } from "@/lib/telegram/bot";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (appUrl && webhookSecret) {
    await setWebhook(`${appUrl}/api/telegram/webhook`, webhookSecret);
  }

  const configSnap = await adminDb.collection("businessConfig").doc("main").get();
  const ownerChatId = configSnap.data()?.ownerTelegramChatId;
  await setupBotCommands(ownerChatId);

  return NextResponse.json({ success: true });
}
