import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAdminAuth } from "@/lib/api-auth";
import { Timestamp } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const doc = await adminDb.collection("businessConfig").doc("main").get();

  if (!doc.exists) {
    return NextResponse.json({ config: null });
  }

  return NextResponse.json({ config: doc.data() });
}

export async function PUT(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const body = await request.json();
  const {
    businessName,
    serviceName,
    defaultDurationMinutes,
    timezone,
    workingHours,
    breakSlots,
    vacationDays,
    ownerEmail,
    jurisdiction,
    languages,
  } = body;

  // Validate break slots if provided
  if (breakSlots !== undefined) {
    for (const slot of breakSlots as { start: string; end: string }[]) {
      if (slot.start >= slot.end) {
        return NextResponse.json(
          { error: "Each break slot must have start before end" },
          { status: 400 }
        );
      }
    }
    for (let i = 0; i < (breakSlots as { start: string; end: string }[]).length; i++) {
      for (let j = i + 1; j < (breakSlots as { start: string; end: string }[]).length; j++) {
        const a = (breakSlots as { start: string; end: string }[])[i];
        const b = (breakSlots as { start: string; end: string }[])[j];
        if (a.start < b.end && b.start < a.end) {
          return NextResponse.json(
            { error: `Break slots overlap: ${a.start}–${a.end} and ${b.start}–${b.end}` },
            { status: 400 }
          );
        }
      }
    }
  }

  const configUpdates: Record<string, unknown> = {};
  if (businessName !== undefined) configUpdates.businessName = businessName;
  if (serviceName !== undefined) configUpdates.serviceName = serviceName;
  if (defaultDurationMinutes !== undefined) configUpdates.defaultDurationMinutes = defaultDurationMinutes;
  if (timezone !== undefined) configUpdates.timezone = timezone;
  if (workingHours !== undefined) configUpdates.workingHours = workingHours;
  if (breakSlots !== undefined) configUpdates.breakSlots = breakSlots;
  if (vacationDays !== undefined) configUpdates.vacationDays = vacationDays;
  if (ownerEmail !== undefined) configUpdates.ownerEmail = ownerEmail;
  if (jurisdiction !== undefined) configUpdates.jurisdiction = jurisdiction;
  if (languages !== undefined) configUpdates.languages = languages;

  const docRef = adminDb.collection("businessConfig").doc("main");
  const doc = await docRef.get();
  const oldTimezone = doc.exists ? (doc.data()?.timezone as string | undefined) : undefined;

  if (doc.exists) {
    await docRef.update(configUpdates);
  } else {
    await docRef.set({
      businessName: businessName || "",
      serviceName: serviceName || "",
      defaultDurationMinutes: defaultDurationMinutes || 30,
      timezone: timezone || "Europe/Kyiv",
      workingHours: workingHours || {},
      breakSlots: breakSlots || [],
      vacationDays: vacationDays || [],
      ownerEmail: ownerEmail || "",
      jurisdiction: jurisdiction || "UA",
      languages: languages || ["uk", "en"],
      ...configUpdates,
    });
  }

  // When timezone changes, re-stamp the timeZone field on upcoming calendar events
  if (timezone !== undefined && oldTimezone && oldTimezone !== timezone) {
    try {
      const now = new Date();
      const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const snap = await adminDb
        .collection("appointments")
        .where("dateTime", ">=", Timestamp.fromDate(now))
        .where("dateTime", "<=", Timestamp.fromDate(ninetyDaysOut))
        .get();

      const { updateCalendarEventTimezone } = await import("@/lib/calendar/google");
      await Promise.all(
        snap.docs
          .filter((d) => d.data().googleCalendarEventId)
          .map((d) =>
            updateCalendarEventTimezone(
              d.data().googleCalendarEventId as string,
              d.data().dateTime.toDate() as Date,
              d.data().durationMinutes as number,
              timezone as string
            ).catch(() => {})
          )
      );
    } catch {}
  }

  return NextResponse.json({ success: true });
}
