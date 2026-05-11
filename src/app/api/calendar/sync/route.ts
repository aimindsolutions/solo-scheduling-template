import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { listCalendarEvents } from "@/lib/calendar/google";
import { Timestamp } from "firebase-admin/firestore";
import { startOfDay, endOfDay, addDays } from "date-fns";
import { notifyClientOfCancellation } from "@/lib/telegram/notifications";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { daysAhead = 14 } = body;

  const now = new Date();
  const timeMin = startOfDay(now);
  const timeMax = endOfDay(addDays(now, daysAhead));

  const calendarEvents = await listCalendarEvents(timeMin, timeMax);
  const calendarEventIds = new Set(calendarEvents.map((e) => e.id).filter(Boolean));

  const appointmentsSnap = await adminDb.collection("appointments")
    .where("dateTime", ">=", Timestamp.fromDate(timeMin))
    .where("dateTime", "<=", Timestamp.fromDate(timeMax))
    .get();

  const existingEventIds = new Set(
    appointmentsSnap.docs
      .map((doc) => doc.data().googleCalendarEventId)
      .filter(Boolean)
  );

  let imported = 0;
  let cancelled = 0;

  for (const event of calendarEvents) {
    if (!event.id || existingEventIds.has(event.id)) continue;
    if (!event.start?.dateTime) continue;

    const startTime = new Date(event.start.dateTime);
    const endTime = event.end?.dateTime ? new Date(event.end.dateTime) : new Date(startTime.getTime() + 30 * 60 * 1000);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    await adminDb.collection("appointments").add({
      clientId: "",
      clientName: event.summary || "Calendar Event",
      clientPhone: "",
      dateTime: Timestamp.fromDate(startTime),
      durationMinutes,
      status: "confirmed",
      source: "admin",
      googleCalendarEventId: event.id,
      reminder24hSent: false,
      reminder2hSent: false,
      notes: event.description || null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    imported++;
  }

  for (const doc of appointmentsSnap.docs) {
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
          await notifyClientOfCancellation({ clientId: data.clientId, dateTime: data.dateTime });
        } catch {}
      }

      cancelled++;
    }
  }

  return NextResponse.json({ imported, cancelled, total: calendarEvents.length });
}
