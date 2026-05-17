import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { verifyAdminAuth } from "@/lib/api-auth";
import { parseInTimeZone } from "@/lib/date-utils";
import { createCalendarEvent, confirmCalendarEvent } from "@/lib/calendar/google";
import {
  notifyClientOfConfirmation,
  sendAppointmentConfirmationRequest,
} from "@/lib/telegram/notifications";

export const dynamic = "force-dynamic";

// POST /api/admin/appointments
// Books one or more appointments for an existing client (admin-only).
// Body: { clientId, dateTimes: string[] ("yyyy-MM-dd HH:mm"), requireConfirmation: boolean }
export async function POST(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const { clientId, dateTimes, requireConfirmation } = body as {
    clientId: string;
    dateTimes: string[];
    requireConfirmation: boolean;
  };

  if (!clientId || !Array.isArray(dateTimes) || dateTimes.length === 0) {
    return NextResponse.json({ error: "clientId and dateTimes are required" }, { status: 400 });
  }

  const [configSnap, clientSnap] = await Promise.all([
    adminDb.collection("businessConfig").doc("main").get(),
    adminDb.collection("clients").doc(clientId).get(),
  ]);

  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const config = configSnap.data()!;
  const tz = config.timezone || "Europe/Kyiv";
  const durationMinutes = config.defaultDurationMinutes || 30;
  const serviceName = config.serviceName || "Appointment";
  const client = clientSnap.data()!;
  const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ");

  const status = requireConfirmation ? "booked" : "confirmed";
  const createdIds: string[] = [];

  for (const dtStr of dateTimes) {
    const dateTime = parseInTimeZone(dtStr, tz);
    const aptRef = adminDb.collection("appointments").doc();

    const aptData = {
      clientId,
      clientName,
      clientPhone: client.phone || "",
      dateTime: Timestamp.fromDate(dateTime),
      durationMinutes,
      status,
      source: "admin",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await aptRef.set(aptData);
    createdIds.push(aptRef.id);

    // Update client counters
    const counterUpdate: Record<string, unknown> = {
      totalAppointments: FieldValue.increment(1),
      updatedAt: Timestamp.now(),
    };
    if (!requireConfirmation) {
      counterUpdate.confirmedAppointments = FieldValue.increment(1);
    }
    await adminDb.collection("clients").doc(clientId).update(counterUpdate);

    // Google Calendar event
    let calendarEventId: string | undefined;
    try {
      calendarEventId = await createCalendarEvent({
        summary: `${serviceName} — ${clientName}`,
        startTime: dateTime,
        durationMinutes,
        timeZone: tz,
      });
      if (calendarEventId) {
        await aptRef.update({ googleCalendarEventId: calendarEventId });
        if (!requireConfirmation) {
          try { await confirmCalendarEvent(calendarEventId); } catch {}
        }
      }
    } catch {
      // Calendar is non-critical — continue
    }

    // Telegram notification
    try {
      if (requireConfirmation) {
        await sendAppointmentConfirmationRequest({
          clientId,
          appointmentId: aptRef.id,
          dateTime,
        });
      } else {
        await notifyClientOfConfirmation({ clientId, dateTime });
      }
    } catch {
      // Notification is non-critical — continue
    }
  }

  return NextResponse.json({ success: true, createdIds });
}
