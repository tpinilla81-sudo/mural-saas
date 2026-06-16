import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

// Force NEXTAUTH_URL from request headers for proper cookie domain
async function handler(req: NextRequest) {
  // Auto-detect the correct URL from the request
  const host = req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  if (host && !process.env.NEXTAUTH_URL?.includes(host)) {
    process.env.NEXTAUTH_URL = `${protocol}://${host}`;
  }
  return NextAuth(authOptions)(req as any);
}

export { handler as GET, handler as POST };
