import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import type { NextRequest } from "next/server";

function handler(req: NextRequest) {
  // Fix NEXTAUTH_URL to match the actual request host
  // Vercel sets it to the deployment URL which differs from production URL
  const host = req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  if (host) {
    process.env.NEXTAUTH_URL = `${protocol}://${host}`;
  }
  return NextAuth(authOptions)(req as any);
}

export { handler as GET, handler as POST };
