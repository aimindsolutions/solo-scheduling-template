import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { createCalendarEvent, confirmCalendarEvent } from "@/lib/calendar/google";
import { bookingFormSchema } from "@/lib/validators";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { Query } from "firebase-admin/firestore";
import { parseInTimeZone, startOfDayInTimeZone, endOfDayInTimeZone } from "@/lib/date-utils";
import { getAvailableSlots, getNowLocalForSlots } from "@/lib/slots";
import { parse } from "date-fns";
import type { BusinessConfig, Appointment } from "@/types";
import { verifyAdminAuth } from "@/lib/api-auth";
import { normalizePhone } from "@/lib/utils";
import { getSessionToken, validateSession } from "@/lib/auth/session";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = bookingFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid form data", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { firstName, lastName, phone: rawPhone, email, notes, date, time, consentGiven } =
    parsed.data;
  const phone = normalizePhone(rawPhone);
  const locale = body.locale || "uk";

  const configSnap = await adminDb.collection("businessConfig").doc("main").get();
  if (!configSnap.exists) {
    return NextResponse.json(
      { error: "Business not configured" },
      { status: 500 }
    );
  }
  const config = configSnap.data()!;
  const durationMinutes = config.defaultDurationMinutes || 30;
  const serviceName = config.serviceName || "Appointment";

  const tz = config.timezone || "Europe/Kyiv";
  const dateTime = parseInTimeZone(`${date} ${time}`, tz);

  const bookingDate = parse(date, "yyyy-MM-dd", new Date());
  const dayStart = startOfDayInTimeZone(date, tz);
  const dayEnd = endOfDayInTimeZone(date, tz);

  let clientId: string;
  let clientQuery = await adminDb
    .collection("clients")
    .where("phone", "==", phone)
    .limit(1)
    .get();
  if (clientQuery.empty && phone.startsWith("+")) {
    clientQuery = await adminDb
      .collection("clients")
      .where("phone", "==", phone.slice(1))
      .limit(1)
      .get();
  }

  if (clientQuery.empty) {
    const clientRef = await adminDb.collection("clients").add({
      firstName,
      lastName: lastName || null,
      phone,
      email: email || null,
      language: locale,
      consentGiven,
      consentTimestamp: Timestamp.now(),
      consentLanguage: locale,
      consentJurisdiction: config.jurisdiction || "UA",
      totalAppointments: 0,
      confirmedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    clientId = clientRef.id;
  } else {
    clientId = clientQuery.docs[0].id;
    await adminDb.collection("clients").doc(clientId).update({
      firstName,
      ...(lastName && { lastName }),
      ...(email && { email }),
      updatedAt: Timestamp.now(),
    });
  }

  // Logged-in clients get auto-confirmed — they already verified identity via Telegram
  const sessionToken = getSessionToken(request);
  let autoConfirm = false;
  if (sessionToken) {
    const { valid, clientId: sessionClientId } = await validateSession(sessionToken);
    if (valid && sessionClientId === clientId) autoConfirm = true;
  }

  let googleCalendarEventId: string | undefined;
  try {
    googleCalendarEventId = await createCalendarEvent({
      summary: `${serviceName} — ${firstName}${lastName ? " " + lastName : ""}`,
      startTime: dateTime,
      durationMinutes,
      description: `Phone: ${phone}${notes ? "\n" + notes : ""}`,
    });
    if (autoConfirm && googleCalendarEventId) {
      await confirmCalendarEvent(googleCalendarEventId);
    }
  } catch {
    // Calendar sync is optional — don't block booking
  }

  const appointmentRef = adminDb.collection("appointments").doc();

  const slotTaken = await adminDb.runTransaction(async (tx) => {
    const existingSnap = await tx.get(
      adminDb
        .collection("appointments")
        .where("dateTime", ">=", dayStart)
        .where("dateTime", "<=", dayEnd)
    );

    const existingAppointments = existingSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      dateTime: doc.data().dateTime.toDate(),
    })) as Appointment[];

    const nowLocal = getNowLocalForSlots(bookingDate, tz);
    const availableSlots = getAvailableSlots(bookingDate, config as BusinessConfig, existingAppointments, nowLocal);

    if (!availableSlots.includes(time)) {
      return true;
    }

    tx.set(appointmentRef, {
      clientId,
      clientName: `${firstName}${lastName ? " " + lastName : ""}`,
      clientPhone: phone,
      dateTime: Timestamp.fromDate(dateTime),
      durationMinutes,
      status: autoConfirm ? "confirmed" : "booked",
      source: "web",
      googleCalendarEventId: googleCalendarEventId || null,
      reminder24hSent: false,
      reminder2hSent: false,
      notes: notes || null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    tx.update(adminDb.collection("clients").doc(clientId), {
      totalAppointments: FieldValue.increment(1),
      ...(autoConfirm ? { confirmedAppointments: FieldValue.increment(1) } : {}),
      updatedAt: Timestamp.now(),
    });

    return false;
  });

  if (slotTaken) {
    return NextResponse.json(
      { error: "Selected time slot is not available" },
      { status: 409 }
    );
  }

  let telegramSent = false;
  try {
    const { notifyOwnerOfNewBooking, sendAppointmentConfirmationRequest } = await import("@/lib/telegram/notifications");
    await notifyOwnerOfNewBooking({
      clientName: `${firstName}${lastName ? " " + lastName : ""}`,
      dateTime: Timestamp.fromDate(dateTime),
      phone,
    });
    // For non-logged-in clients who have a linked Telegram, proactively send confirmation
    if (!autoConfirm) {
      telegramSent = await sendAppointmentConfirmationRequest({
        clientId,
        appointmentId: appointmentRef.id,
        dateTime: Timestamp.fromDate(dateTime),
      });
    }
  } catch {}

  return NextResponse.json({
    appointmentId: appointmentRef.id,
    clientId,
    status: autoConfirm ? "confirmed" : "booked",
    telegramSent,
  });
}

export async function GET(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const cursorId = searchParams.get("cursor");
  const clientIdFilter = searchParams.get("clientId");
  const pageSize = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  const configSnap = await adminDb.collection("businessConfig").doc("main").get();
  const tz = configSnap.exists ? configSnap.data()!.timezone || "Europe/Kyiv" : "Europe/Kyiv";

  let query: Query = adminDb.collection("appointments");

  if (clientIdFilter) {
    query = query
      .where("clientId", "==", clientIdFilter)
      .orderBy("dateTime", "desc"); // most recent first for client history
  } else {
    query = query.orderBy("dateTime", "asc"); // upcoming first for main dashboard
  }

  query = query.limit(pageSize);

  if (cursorId) {
    const cursorDoc = await adminDb.collection("appointments").doc(cursorId).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snapshot = await query.get();

  const appointments = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    dateTime: doc.data().dateTime.toDate().toISOString(),
    createdAt: doc.data().createdAt?.toDate().toISOString(),
    updatedAt: doc.data().updatedAt?.toDate().toISOString(),
  }));

  const nextCursor = snapshot.size === pageSize
    ? snapshot.docs[snapshot.docs.length - 1].id
    : null;

  return NextResponse.json({ appointments, nextCursor, timezone: tz });
}
