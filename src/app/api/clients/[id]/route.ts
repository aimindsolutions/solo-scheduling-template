import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await adminDb.collection("clients").doc(id).get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = doc.data()!;
  return NextResponse.json({
    client: {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate().toISOString(),
      updatedAt: data.updatedAt?.toDate().toISOString(),
      consentTimestamp: data.consentTimestamp?.toDate().toISOString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const doc = await adminDb.collection("clients").doc(id).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
  const allowedFields = ["firstName", "lastName", "phone", "email", "language"];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  await adminDb.collection("clients").doc(id).update(updates);

  return NextResponse.json({ success: true });
}
