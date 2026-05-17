import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionToken, validateSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { valid, clientId } = await validateSession(token);
  if (!valid || !clientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  const configSnap = await adminDb.collection("businessConfig").doc("main").get();
  const tz = configSnap.exists ? configSnap.data()!.timezone || "Europe/Kyiv" : "Europe/Kyiv";

  const snap = await adminDb
    .collection("appointments")
    .where("clientId", "==", clientId)
    .where("dateTime", ">=", now)
    .orderBy("dateTime", "asc")
    .get();

  const appointments = snap.docs
    .filter((doc) => ["booked", "confirmed"].includes(doc.data().status as string))
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        dateTime: d.dateTime.toDate().toISOString(),
        createdAt: d.createdAt?.toDate().toISOString(),
        updatedAt: d.updatedAt?.toDate().toISOString(),
      };
    });

  return NextResponse.json({ appointments, timezone: tz });
}
