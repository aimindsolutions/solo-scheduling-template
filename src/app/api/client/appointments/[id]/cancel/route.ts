import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getSessionToken, validateSession } from "@/lib/auth/session";
import { deleteCalendarEvent } from "@/lib/calendar/google";
import { notifyOwnerOfCancellation } from "@/lib/telegram/notifications";

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

  if (!["booked", "confirmed"].includes(apt.status)) {
    return NextResponse.json({ error: "Cannot cancel this appointment" }, { status: 400 });
  }

  const wasConfirmed = apt.status === "confirmed";
  const body = await request.json().catch(() => ({}));
  const reason = body.reason as string | undefined;

  await adminDb.collection("appointments").doc(id).update({
    status: "cancelled",
    cancellationReason: reason ?? null,
    updatedAt: Timestamp.now(),
  });

  const counterUpdate: Record<string, unknown> = {
    cancelledAppointments: FieldValue.increment(1),
    updatedAt: Timestamp.now(),
  };
  if (wasConfirmed) {
    counterUpdate.confirmedAppointments = FieldValue.increment(-1);
  }
  await adminDb.collection("clients").doc(clientId).update(counterUpdate);

  if (apt.googleCalendarEventId) {
    try {
      await deleteCalendarEvent(apt.googleCalendarEventId);
    } catch {}
  }

  try {
    await notifyOwnerOfCancellation({
      clientName: apt.clientName,
      dateTime: apt.dateTime,
      reason,
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
