import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionToken, validateSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { valid, clientId } = await validateSession(token);
  if (!valid || !clientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb.collection("clients").doc(clientId).get();
  if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const d = snap.data()!;
  return NextResponse.json({
    clientId,
    firstName: d.firstName as string,
    lastName: (d.lastName as string) || "",
    phone: d.phone as string,
    email: (d.email as string) || "",
    telegramChatId: (d.telegramChatId as string) || null,
  });
}
