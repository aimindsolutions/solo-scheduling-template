import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getSessionToken, validateSession } from "@/lib/auth/session";
import { confirmCalendarEvent } from "@/lib/calendar/google";
import { notifyOwnerOfConfirmation } from "@/lib/telegram/notifications";

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
  const doc = await adminDb.collection("appointments").doc(id).get();

  if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apt = doc.data()!;

  if (apt.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (apt.status !== "booked") {
    return NextResponse.json({ error: "Appointment cannot be confirmed" }, { status: 400 });
  }

  await adminDb.collection("appointments").doc(id).update({
    status: "confirmed",
    updatedAt: Timestamp.now(),
  });

  await adminDb.collection("clients").doc(clientId).update({
    confirmedAppointments: FieldValue.increment(1),
    updatedAt: Timestamp.now(),
  });

  if (apt.googleCalendarEventId) {
    try {
      await confirmCalendarEvent(apt.googleCalendarEventId);
    } catch {}
  }

  try {
    await notifyOwnerOfConfirmation({
      clientName: apt.clientName,
      dateTime: apt.dateTime,
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
