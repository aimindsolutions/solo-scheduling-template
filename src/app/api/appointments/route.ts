import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { createCalendarEvent } from "@/lib/calendar/google";
import { bookingFormSchema } from "@/lib/validators";
import { Timestamp } from "firebase-admin/firestore";
import { parseInTimeZone } from "@/lib/date-utils";
import { getAvailableSlots } from "@/lib/slots";
import { parse, startOfDay, endOfDay } from "date-fns";
import type { BusinessConfig, Appointment } from "@/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = bookingFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid form data", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { firstName, lastName, phone, email, notes, date, time, consentGiven } =
    parsed.data;
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

  const dateTime = parseInTimeZone(`${date} ${time}`, config.timezone || "Europe/Kyiv");

  const bookingDate = parse(date, "yyyy-MM-dd", new Date());
  const dayStart = startOfDay(bookingDate);
  const dayEnd = endOfDay(bookingDate);

  const existingSnap = await adminDb
    .collection("appointments")
    .where("dateTime", ">=", dayStart)
    .where("dateTime", "<=", dayEnd)
    .get();

  const existingAppointments = existingSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    dateTime: doc.data().dateTime.toDate(),
  })) as Appointment[];

  const availableSlots = getAvailableSlots(bookingDate, config as BusinessConfig, existingAppointments, new Date());

  if (!availableSlots.includes(time)) {
    return NextResponse.json(
      { error: "Selected time slot is not available" },
      { status: 409 }
    );
  }

  let clientId: string;
  const clientQuery = await adminDb
    .collection("clients")
    .where("phone", "==", phone)
    .limit(1)
    .get();

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

  let googleCalendarEventId: string | undefined;
  try {
    googleCalendarEventId = await createCalendarEvent({
      summary: `${serviceName} — ${firstName}${lastName ? " " + lastName : ""}`,
      startTime: dateTime,
      durationMinutes,
      description: `Phone: ${phone}${notes ? "\n" + notes : ""}`,
    });
  } catch {
    // Calendar sync is optional — don't block booking
  }

  const appointmentRef = await adminDb.collection("appointments").add({
    clientId,
    clientName: `${firstName}${lastName ? " " + lastName : ""}`,
    clientPhone: phone,
    dateTime: Timestamp.fromDate(dateTime),
    durationMinutes,
    status: "booked",
    source: "web",
    googleCalendarEventId: googleCalendarEventId || null,
    reminder24hSent: false,
    reminder2hSent: false,
    notes: notes || null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  await adminDb
    .collection("clients")
    .doc(clientId)
    .update({
      totalAppointments: (clientQuery.empty ? 0 : clientQuery.docs[0].data().totalAppointments || 0) + 1,
      updatedAt: Timestamp.now(),
    });

  try {
    const { notifyOwnerOfNewBooking } = await import("@/lib/telegram/notifications");
    await notifyOwnerOfNewBooking({
      clientName: `${firstName}${lastName ? " " + lastName : ""}`,
      dateTime: Timestamp.fromDate(dateTime),
      phone,
    });
  } catch {}

  return NextResponse.json({
    appointmentId: appointmentRef.id,
    clientId,
    status: "booked",
  });
}

export async function GET() {
  const snapshot = await adminDb
    .collection("appointments")
    .orderBy("dateTime", "asc")
    .limit(100)
    .get();

  const appointments = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    dateTime: doc.data().dateTime.toDate().toISOString(),
    createdAt: doc.data().createdAt?.toDate().toISOString(),
    updatedAt: doc.data().updatedAt?.toDate().toISOString(),
  }));

  return NextResponse.json({ appointments });
}
