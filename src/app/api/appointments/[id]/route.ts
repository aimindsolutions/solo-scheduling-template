import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { confirmCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "@/lib/calendar/google";
import { Timestamp } from "firebase-admin/firestore";
import { notifyClientOfCancellation, notifyClientOfConfirmation } from "@/lib/telegram/notifications";
import { verifyAdminAuth } from "@/lib/api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await adminDb.collection("appointments").doc(id).get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = doc.data()!;
  return NextResponse.json({
    id: doc.id,
    ...data,
    dateTime: data.dateTime.toDate().toISOString(),
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();
  const { status, dateTime, durationMinutes, notes } = body;

  const doc = await adminDb.collection("appointments").doc(id).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const appointment = doc.data()!;
  const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };

  if (status) {
    updates.status = status;

    if (status === "confirmed" && appointment.googleCalendarEventId) {
      try {
        await confirmCalendarEvent(appointment.googleCalendarEventId);
      } catch {}
    }

    if (status === "confirmed" && appointment.clientId) {
      try {
        await notifyClientOfConfirmation({
          clientId: appointment.clientId,
          dateTime: appointment.dateTime,
        });
      } catch {}
    }

    if (status === "cancelled" && appointment.googleCalendarEventId) {
      try {
        await deleteCalendarEvent(appointment.googleCalendarEventId);
      } catch {}
    }

    if (status === "cancelled" && appointment.clientId) {
      try {
        await notifyClientOfCancellation({
          clientId: appointment.clientId,
          dateTime: appointment.dateTime,
        });
      } catch {}
    }

    if (["confirmed", "cancelled", "completed", "no_show"].includes(status)) {
      const clientDoc = await adminDb.collection("clients").doc(appointment.clientId).get();
      if (clientDoc.exists) {
        const clientData = clientDoc.data()!;
        const counterMap: Record<string, string> = {
          confirmed: "confirmedAppointments",
          cancelled: "cancelledAppointments",
          completed: "completedAppointments",
          no_show: "noShowAppointments",
        };
        const field = counterMap[status];
        if (field) {
          await adminDb.collection("clients").doc(appointment.clientId).update({
            [field]: (clientData[field] || 0) + 1,
            updatedAt: Timestamp.now(),
          });
        }
      }
    }
  }

  if (dateTime) {
    updates.dateTime = Timestamp.fromDate(new Date(dateTime));
  }
  if (durationMinutes) {
    updates.durationMinutes = durationMinutes;
  }
  if (notes !== undefined) {
    updates.notes = notes;
  }

  if ((dateTime || durationMinutes) && appointment.googleCalendarEventId) {
    try {
      await updateCalendarEvent(appointment.googleCalendarEventId, {
        startTime: dateTime ? new Date(dateTime) : undefined,
        durationMinutes: durationMinutes || appointment.durationMinutes,
      });
    } catch {}
  }

  await adminDb.collection("appointments").doc(id).update(updates);

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const doc = await adminDb.collection("appointments").doc(id).get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const appointment = doc.data()!;

  if (appointment.googleCalendarEventId) {
    try {
      await deleteCalendarEvent(appointment.googleCalendarEventId);
    } catch {}
  }

  await adminDb.collection("appointments").doc(id).update({
    status: "cancelled",
    updatedAt: Timestamp.now(),
  });

  if (appointment.clientId) {
    try {
      const clientDoc = await adminDb.collection("clients").doc(appointment.clientId).get();
      if (clientDoc.exists) {
        await adminDb.collection("clients").doc(appointment.clientId).update({
          cancelledAppointments: (clientDoc.data()!.cancelledAppointments || 0) + 1,
          updatedAt: Timestamp.now(),
        });
      }
    } catch {}
  }

  if (appointment.clientId) {
    try {
      await notifyClientOfCancellation({
        clientId: appointment.clientId,
        dateTime: appointment.dateTime,
      });
    } catch {}
  }

  return NextResponse.json({ success: true });
}
