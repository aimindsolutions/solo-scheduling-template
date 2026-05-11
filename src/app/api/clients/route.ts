import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const limit = parseInt(searchParams.get("limit") || "50");

  let query = adminDb.collection("clients").orderBy("createdAt", "desc").limit(limit);

  const snapshot = await query.get();

  let clients = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate().toISOString(),
    updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    consentTimestamp: doc.data().consentTimestamp?.toDate().toISOString(),
  }));

  if (search) {
    const lower = search.toLowerCase();
    clients = clients.filter(
      (c) =>
        (c as Record<string, string>).firstName?.toLowerCase().includes(lower) ||
        (c as Record<string, string>).lastName?.toLowerCase().includes(lower) ||
        (c as Record<string, string>).phone?.includes(search)
    );
  }

  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { firstName, lastName, phone, email, language } = body;

  if (!firstName || !phone) {
    return NextResponse.json({ error: "firstName and phone are required" }, { status: 400 });
  }

  const existing = await adminDb
    .collection("clients")
    .where("phone", "==", phone)
    .limit(1)
    .get();

  if (!existing.empty) {
    return NextResponse.json({ error: "Client with this phone already exists", clientId: existing.docs[0].id }, { status: 409 });
  }

  const ref = await adminDb.collection("clients").add({
    firstName,
    lastName: lastName || null,
    phone,
    email: email || null,
    language: language || "uk",
    consentGiven: true,
    consentTimestamp: Timestamp.now(),
    consentLanguage: language || "uk",
    consentJurisdiction: "UA",
    totalAppointments: 0,
    confirmedAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return NextResponse.json({ clientId: ref.id });
}
