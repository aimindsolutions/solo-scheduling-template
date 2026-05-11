import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAvailableSlots } from "@/lib/slots";
import { parse, startOfDay, endOfDay } from "date-fns";
import type { BusinessConfig, Appointment } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");

  if (!dateStr) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const date = parse(dateStr, "yyyy-MM-dd", new Date());

  const configSnap = await adminDb.collection("businessConfig").doc("main").get();
  if (!configSnap.exists) {
    return NextResponse.json({ slots: [] });
  }

  const config = configSnap.data() as BusinessConfig;

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const appointmentsSnap = await adminDb
    .collection("appointments")
    .where("dateTime", ">=", dayStart)
    .where("dateTime", "<=", dayEnd)
    .get();

  const appointments = appointmentsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    dateTime: doc.data().dateTime.toDate(),
  })) as Appointment[];

  const slots = getAvailableSlots(date, config, appointments);

  return NextResponse.json({ slots });
}
