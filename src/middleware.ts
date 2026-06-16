import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Set NEXTAUTH_URL dynamically from the request host
  const host = request.headers.get("host") || "";
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const url = `${protocol}://${host}`;
  
  // Store in a request header that the auth handler can read
  const response = NextResponse.next();
  response.headers.set("x-auth-url", url);
  
  // Also set NEXTAUTH_URL for this serverless function invocation
  process.env.NEXTAUTH_URL = url;
  
  return response;
}

export const config = {
  matcher: ["/api/auth/:path*"],
};
