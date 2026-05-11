import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { sendMessage, buildInlineKeyboard } from "@/lib/telegram/bot";
import { reminderMessage } from "@/lib/telegram/messages";
import { generateGoogleCalendarUrl } from "@/lib/calendar/client-links";
import { Timestamp } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const configSnap = await adminDb.collection("businessConfig").doc("main").get();
  const config = configSnap.exists ? configSnap.data()! : {};
  const serviceName = config.serviceName || "Appointment";

  let sent24h = 0;
  let sent2h = 0;

  // 24h reminders: appointments between 23-25 hours from now
  const reminder24Start = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const reminder24End = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const snap24 = await adminDb
    .collection("appointments")
    .where("status", "==", "confirmed")
    .where("reminder24hSent", "==", false)
    .where("dateTime", ">=", Timestamp.fromDate(reminder24Start))
    .where("dateTime", "<=", Timestamp.fromDate(reminder24End))
    .get();

  for (const doc of snap24.docs) {
    const apt = doc.data();
    const client = await adminDb.collection("clients").doc(apt.clientId).get();
    const clientData = client.data();

    if (clientData?.telegramChatId) {
      const lang = clientData.language || "uk";
      const appointmentDate = apt.dateTime.toDate();

      const googleUrl = generateGoogleCalendarUrl({
        title: serviceName,
        startTime: appointmentDate,
        durationMinutes: apt.durationMinutes,
      });

      await sendMessage(
        clientData.telegramChatId,
        reminderMessage(lang, { date: appointmentDate, serviceName, hoursLeft: 24 }),
        {
          replyMarkup: buildInlineKeyboard([
            [{ text: "📅 Google Calendar", url: googleUrl }],
            [{ text: "❌ " + (lang === "uk" ? "Скасувати" : "Cancel"), callbackData: `cancel:${doc.id}` }],
          ]),
        }
      );

      await adminDb.collection("appointments").doc(doc.id).update({
        reminder24hSent: true,
      });
      sent24h++;
    }
  }

  // 2h reminders: appointments between 1.5-2.5 hours from now
  const reminder2Start = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
  const reminder2End = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

  const snap2 = await adminDb
    .collection("appointments")
    .where("status", "==", "confirmed")
    .where("reminder2hSent", "==", false)
    .where("dateTime", ">=", Timestamp.fromDate(reminder2Start))
    .where("dateTime", "<=", Timestamp.fromDate(reminder2End))
    .get();

  for (const doc of snap2.docs) {
    const apt = doc.data();
    const client = await adminDb.collection("clients").doc(apt.clientId).get();
    const clientData = client.data();

    if (clientData?.telegramChatId) {
      const lang = clientData.language || "uk";
      const appointmentDate = apt.dateTime.toDate();

      await sendMessage(
        clientData.telegramChatId,
        reminderMessage(lang, { date: appointmentDate, serviceName, hoursLeft: 2 }),
        {
          replyMarkup: buildInlineKeyboard([
            [{ text: "❌ " + (lang === "uk" ? "Скасувати" : "Cancel"), callbackData: `cancel:${doc.id}` }],
          ]),
        }
      );

      await adminDb.collection("appointments").doc(doc.id).update({
        reminder2hSent: true,
      });
      sent2h++;
    }
  }

  return NextResponse.json({ sent24h, sent2h });
}
