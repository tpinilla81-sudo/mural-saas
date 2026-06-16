import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  
  // Always set NEXTAUTH_URL to match the actual request host
  // This fixes the issue where Vercel sets NEXTAUTH_URL to the deployment URL
  // instead of the production URL that the user is accessing
  process.env.NEXTAUTH_URL = `${protocol}://${host}`;
  
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/:path*"],
};
