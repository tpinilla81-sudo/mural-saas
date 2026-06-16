// Set AUTH_TRUST_HOST before NextAuth loads - this makes NextAuth use the request's
// host header instead of NEXTAUTH_URL, which is critical on Vercel where 
// NEXTAUTH_URL gets set to the deployment URL instead of the production URL
process.env.AUTH_TRUST_HOST = "true";

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
