import { NextResponse, type NextRequest } from "next/server";

/**
 * Server components cannot read the current URL. This middleware copies the
 * requested path onto a request header so the protected workspace layout can
 * send a signed-out visitor to `/sign-in?next=…` and return them afterwards.
 *
 * It performs no authentication itself: the layout, which runs on the server
 * next to the database, is the security boundary.
 */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/preview/:path*"],
};
