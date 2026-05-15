import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return;
  }

  const response = intlMiddleware(request);

  // Cloud Run serves internally on :8080, which next-intl bakes into redirect
  // Location headers. Strip it so clients see the correct public HTTPS URL.
  if (response) {
    const location = response.headers.get("location");
    if (location) {
      try {
        const loc = new URL(location);
        if (loc.port === "8080") {
          loc.port = "";
          const patched = new NextResponse(null, {
            status: response.status,
            headers: response.headers,
          });
          patched.headers.set("location", loc.href);
          return patched;
        }
      } catch {}
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
