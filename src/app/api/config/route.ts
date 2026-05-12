import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyAdminAuth } from "@/lib/api-auth";

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

  const updates: Record<string, unknown> = {};
  if (businessName !== undefined) updates.businessName = businessName;
  if (serviceName !== undefined) updates.serviceName = serviceName;
  if (defaultDurationMinutes !== undefined) updates.defaultDurationMinutes = defaultDurationMinutes;
  if (timezone !== undefined) updates.timezone = timezone;
  if (workingHours !== undefined) updates.workingHours = workingHours;
  if (breakSlots !== undefined) updates.breakSlots = breakSlots;
  if (vacationDays !== undefined) updates.vacationDays = vacationDays;
  if (ownerEmail !== undefined) updates.ownerEmail = ownerEmail;
  if (jurisdiction !== undefined) updates.jurisdiction = jurisdiction;
  if (languages !== undefined) updates.languages = languages;

  const docRef = adminDb.collection("businessConfig").doc("main");
  const doc = await docRef.get();

  if (doc.exists) {
    await docRef.update(updates);
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
      ...updates,
    });
  }

  return NextResponse.json({ success: true });
}
