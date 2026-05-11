import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { generateIcsFile, generateGoogleCalendarUrl } from "@/lib/calendar/client-links";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const doc = await adminDb.collection("appointments").doc(id).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const appointment = doc.data()!;
  const startTime = appointment.dateTime.toDate();
  const durationMinutes = appointment.durationMinutes;

  const configSnap = await adminDb.collection("businessConfig").doc("main").get();
  const config = configSnap.exists ? configSnap.data()! : {};
  const title = config.serviceName || "Appointment";

  if (type === "google") {
    const url = generateGoogleCalendarUrl({
      title: `${title} — ${appointment.clientName}`,
      startTime,
      durationMinutes,
    });
    return NextResponse.redirect(url);
  }

  if (type === "ics") {
    const icsContent = generateIcsFile({
      title: `${title}`,
      startTime,
      durationMinutes,
    });

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="appointment.ics"`,
      },
    });
  }

  return NextResponse.json({ error: "type must be 'google' or 'ics'" }, { status: 400 });
}
