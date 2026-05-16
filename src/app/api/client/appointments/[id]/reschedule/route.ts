import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getSessionToken, validateSession } from "@/lib/auth/session";
import { parseInTimeZone, startOfDayInTimeZone, endOfDayInTimeZone } from "@/lib/date-utils";
import { getAvailableSlots, getNowLocalForSlots } from "@/lib/slots";
import { parse } from "date-fns";
import { deleteCalendarEvent, createCalendarEvent } from "@/lib/calendar/google";
import { notifyOwnerOfNewBooking } from "@/lib/telegram/notifications";
import type { BusinessConfig, Appointment } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getSessionToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { valid, clientId } = await validateSession(token);
  if (!valid || !clientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { date, time } = body; // date: "YYYY-MM-DD", time: "HH:mm"

  if (!date || !time) {
    return NextResponse.json({ error: "Missing date or time" }, { status: 400 });
  }

  const doc = await adminDb.collection("appointments").doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apt = doc.data()!;
  if (apt.clientId !== clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["booked", "confirmed"].includes(apt.status)) {
    return NextResponse.json({ error: "Cannot reschedule this appointment" }, { status: 400 });
  }

  const configSnap = await adminDb.collection("businessConfig").doc("main").get();
  if (!configSnap.exists) return NextResponse.json({ error: "Business not configured" }, { status: 500 });
  const config = configSnap.data()!;
  const tz = config.timezone || "Europe/Kyiv";
  const durationMinutes = config.defaultDurationMinutes || 30;

  const newDateTime = parseInTimeZone(`${date} ${time}`, tz);
  const dayStart = startOfDayInTimeZone(date, tz);
  const dayEnd = endOfDayInTimeZone(date, tz);
  const bookingDate = parse(date, "yyyy-MM-dd", new Date());

  const newAptRef = adminDb.collection("appointments").doc();
  const wasConfirmed = apt.status === "confirmed";

  const slotTaken = await adminDb.runTransaction(async (tx) => {
    const existingSnap = await tx.get(
      adminDb
        .collection("appointments")
        .where("dateTime", ">=", dayStart)
        .where("dateTime", "<=", dayEnd)
    );

    const existingAppointments = existingSnap.docs
      .filter((d) => d.id !== id) // exclude the current appointment being rescheduled
      .map((d) => ({
        id: d.id,
        ...d.data(),
        dateTime: d.data().dateTime.toDate(),
      })) as Appointment[];

    const nowLocal = getNowLocalForSlots(bookingDate, tz);
    const availableSlots = getAvailableSlots(bookingDate, config as BusinessConfig, existingAppointments, nowLocal);

    if (!availableSlots.includes(time)) return true;

    // Cancel old appointment
    tx.update(doc.ref, {
      status: "cancelled",
      cancellationReason: "rescheduled",
      updatedAt: Timestamp.now(),
    });

    // Create new appointment
    tx.set(newAptRef, {
      clientId,
      clientName: apt.clientName,
      clientPhone: apt.clientPhone,
      dateTime: Timestamp.fromDate(newDateTime),
      durationMinutes,
      status: "booked",
      source: apt.source,
      googleCalendarEventId: null,
      reminder24hSent: false,
      reminder2hSent: false,
      notes: apt.notes ?? null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Update counters
    const counterUpdate: Record<string, unknown> = {
      cancelledAppointments: FieldValue.increment(1),
      totalAppointments: FieldValue.increment(1),
      updatedAt: Timestamp.now(),
    };
    if (wasConfirmed) {
      counterUpdate.confirmedAppointments = FieldValue.increment(-1);
    }
    tx.update(adminDb.collection("clients").doc(clientId), counterUpdate);

    return false;
  });

  if (slotTaken) {
    return NextResponse.json({ error: "Selected time slot is not available" }, { status: 409 });
  }

  // Delete old calendar event
  if (apt.googleCalendarEventId) {
    try {
      await deleteCalendarEvent(apt.googleCalendarEventId);
    } catch {}
  }

  // Create new calendar event
  try {
    const calendarId = await createCalendarEvent({
      summary: `${config.serviceName || "Appointment"} — ${apt.clientName}`,
      startTime: newDateTime,
      durationMinutes,
      description: `Phone: ${apt.clientPhone}`,
    });
    if (calendarId) {
      await adminDb.collection("appointments").doc(newAptRef.id).update({
        googleCalendarEventId: calendarId,
      });
    }
  } catch {}

  try {
    await notifyOwnerOfNewBooking({
      clientName: apt.clientName,
      dateTime: Timestamp.fromDate(newDateTime),
      phone: apt.clientPhone,
    });
  } catch {}

  return NextResponse.json({ ok: true, newAppointmentId: newAptRef.id });
}
