import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return;
  }

  // On Cloud Run, the internal URL contains :8080 which leaks into redirects.
  // Rewrite the request URL using x-forwarded-host (the public hostname)
  // so next-intl generates correct redirect URLs without the port.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";

  if (forwardedHost && request.nextUrl.host !== forwardedHost) {
    const url = request.nextUrl.clone();
    url.host = forwardedHost;
    url.protocol = forwardedProto;
    url.port = ""; // strip the internal :8080
    const rewrittenRequest = new NextRequest(url, request);
    return intlMiddleware(rewrittenRequest);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
