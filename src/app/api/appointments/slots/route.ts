import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAvailableSlots, getNowLocalForSlots } from "@/lib/slots";
import { startOfDayInTimeZone, endOfDayInTimeZone } from "@/lib/date-utils";
import { parse } from "date-fns";
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
  const tz = config.timezone || "Europe/Kyiv";

  const dayStart = startOfDayInTimeZone(dateStr, tz);
  const dayEnd = endOfDayInTimeZone(dateStr, tz);

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

  const nowLocal = getNowLocalForSlots(date, tz);
  const slots = getAvailableSlots(date, config, appointments, nowLocal);

  return NextResponse.json({ slots });
}
