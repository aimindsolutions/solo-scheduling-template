import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { sendMessage, buildInlineKeyboard } from "@/lib/telegram/bot";
import { reminderMessage } from "@/lib/telegram/messages";
import { generateGoogleCalendarUrl } from "@/lib/calendar/client-links";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { listCalendarEvents } from "@/lib/calendar/google";
import { notifyClientOfCancellation } from "@/lib/telegram/notifications";
import { startOfDay, endOfDay, addDays } from "date-fns";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const configSnap = await adminDb.collection("businessConfig").doc("main").get();
  const config = configSnap.exists ? configSnap.data()! : {};
  const serviceName = config.serviceName || "Appointment";
  const tz = config.timezone || "Europe/Kyiv";

  let sent24h = 0;
  let sent2h = 0;

  // 24h reminders: appointments between 23-25 hours from now
  const reminder24Start = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const reminder24End = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const snap24 = await adminDb
    .collection("appointments")
    .where("status", "in", ["booked", "confirmed"])
    .where("reminder24hSent", "==", false)
    .where("dateTime", ">=", Timestamp.fromDate(reminder24Start))
    .where("dateTime", "<=", Timestamp.fromDate(reminder24End))
    .get();

  const clientIds24 = [...new Set(snap24.docs.map(d => d.data().clientId).filter(Boolean))];
  const clientDocs24 = clientIds24.length > 0
    ? await adminDb.getAll(...clientIds24.map(id => adminDb.collection("clients").doc(id)))
    : [];
  const clientMap24 = new Map(clientDocs24.filter(d => d.exists).map(d => [d.id, d.data()!]));

  for (const doc of snap24.docs) {
    const apt = doc.data();
    if (apt.status === "cancelled") continue;
    const clientData = clientMap24.get(apt.clientId);

    if (clientData?.telegramChatId) {
      const lang = clientData.language || "uk";
      const appointmentDate = apt.dateTime.toDate();

      const googleUrl = generateGoogleCalendarUrl({
        title: serviceName,
        startTime: appointmentDate,
        durationMinutes: apt.durationMinutes,
      });

      try {
        await sendMessage(
          clientData.telegramChatId,
          reminderMessage(lang, { date: appointmentDate, serviceName, hoursLeft: 24, timezone: tz }),
          {
            replyMarkup: buildInlineKeyboard([
              [{ text: "📅 Google Calendar", url: googleUrl }],
              [{ text: "❌ " + (lang === "uk" ? "Скасувати" : "Cancel"), callbackData: `cancel:${doc.id}` }],
            ]),
          }
        );
      } catch {}

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
    .where("status", "in", ["booked", "confirmed"])
    .where("reminder2hSent", "==", false)
    .where("dateTime", ">=", Timestamp.fromDate(reminder2Start))
    .where("dateTime", "<=", Timestamp.fromDate(reminder2End))
    .get();

  const clientIds2 = [...new Set(snap2.docs.map(d => d.data().clientId).filter(Boolean))];
  const clientDocs2 = clientIds2.length > 0
    ? await adminDb.getAll(...clientIds2.map(id => adminDb.collection("clients").doc(id)))
    : [];
  const clientMap2 = new Map(clientDocs2.filter(d => d.exists).map(d => [d.id, d.data()!]));

  for (const doc of snap2.docs) {
    const apt = doc.data();
    if (apt.status === "cancelled") continue;
    const clientData = clientMap2.get(apt.clientId);

    if (clientData?.telegramChatId) {
      const lang = clientData.language || "uk";
      const appointmentDate = apt.dateTime.toDate();

      try {
        await sendMessage(
          clientData.telegramChatId,
          reminderMessage(lang, { date: appointmentDate, serviceName, hoursLeft: 2, timezone: tz }),
          {
            replyMarkup: buildInlineKeyboard([
              [{ text: "❌ " + (lang === "uk" ? "Скасувати" : "Cancel"), callbackData: `cancel:${doc.id}` }],
            ]),
          }
        );
      } catch {}

      await adminDb.collection("appointments").doc(doc.id).update({
        reminder2hSent: true,
      });
      sent2h++;
    }
  }

  // Calendar deletion sync: detect events deleted from Google Calendar
  let calendarCancelled = 0;
  try {
    const syncStart = startOfDay(now);
    const syncEnd = endOfDay(addDays(now, 90));
    const calendarEvents = await listCalendarEvents(syncStart, syncEnd);
    const calendarEventIds = new Set(calendarEvents.map((e) => e.id).filter(Boolean));

    const upcomingSnap = await adminDb.collection("appointments")
      .where("dateTime", ">=", Timestamp.fromDate(syncStart))
      .where("dateTime", "<=", Timestamp.fromDate(syncEnd))
      .get();

    for (const doc of upcomingSnap.docs) {
      const data = doc.data();
      if (
        data.googleCalendarEventId &&
        !calendarEventIds.has(data.googleCalendarEventId) &&
        data.status !== "cancelled"
      ) {
        await adminDb.collection("appointments").doc(doc.id).update({
          status: "cancelled",
          updatedAt: Timestamp.now(),
        });
        if (data.clientId) {
          try {
            await adminDb.collection("clients").doc(data.clientId).update({
              cancelledAppointments: FieldValue.increment(1),
              updatedAt: Timestamp.now(),
            });
          } catch {}
          try {
            await notifyClientOfCancellation({ clientId: data.clientId, dateTime: data.dateTime });
          } catch {}
        }
        calendarCancelled++;
      }
    }
  } catch {}

  // Clean up abandoned booking sessions older than 2 hours
  let sessionsDeleted = 0;
  try {
    const sessionCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const staleSnap = await adminDb
      .collection("bookingSessions")
      .where("createdAt", "<=", Timestamp.fromDate(sessionCutoff))
      .get();
    const batch = adminDb.batch();
    staleSnap.docs.forEach((doc) => batch.delete(doc.ref));
    if (staleSnap.size > 0) await batch.commit();
    sessionsDeleted = staleSnap.size;
  } catch {}

  return NextResponse.json({ sent24h, sent2h, calendarCancelled, sessionsDeleted });
}
