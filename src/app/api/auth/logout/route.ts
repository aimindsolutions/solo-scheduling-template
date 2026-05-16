import { NextRequest, NextResponse } from "next/server";
import { deleteSession, getSessionToken, clearSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = getSessionToken(request);

  if (token) {
    await deleteSession(token).catch(() => {});
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
