import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/lib/auth.config";

// Edge-safe middleware — uses the DB-free authConfig so no Prisma/bcrypt is
// bundled into the Edge runtime. It only checks whether a valid session token
// is present; role-based authorization happens in server components/actions.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    // Machine-to-machine webhook — authenticates itself via a Bearer token
    // (see lib/ingestion.ts), not the browser session cookie.
    pathname.startsWith("/api/ingest") ||
    // Dev-only echo receiver for testing the outbound webhook contract —
    // called server-to-server (no session cookie), never contains real data.
    pathname.startsWith("/api/dev/echo") ||
    // Machine-to-machine reply-correlation lookup — same Bearer-token auth as
    // /api/ingest, called by the Power Automate reply-capture flow.
    pathname.startsWith("/api/questions/lookup") ||
    // Machine-to-machine reply-answer receiver — same Bearer-token auth,
    // called by the "Post adaptive card and wait for a response" flow once
    // the stakeholder submits the card.
    pathname.startsWith("/api/questions/answer") ||
    // Machine-to-machine drive-sync comparison endpoint — same Bearer-token
    // auth, called by the Power Automate drive-sync flow before it fetches
    // any file content. See app/api/drive-sync/compare/route.ts.
    pathname.startsWith("/api/drive-sync") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg";

  if (isPublic) {
    if (pathname === "/login" && isLoggedIn) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
