import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";

// Passwordless auth: the user picks an identity from the login dropdown.
// This app is for internal use only and runs behind a known URL.
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Selector",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        try {
          const user = await db.user.findUnique({
            where: { email: credentials.email },
            include: { company: true },
          });

          if (!user || !user.isActive) return null;

          // Passwordless: just return the user. The login picker lists all active users.
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId || undefined,
            companyName: user.company?.name || undefined,
            companySlug: user.company?.slug || undefined,
          };
        } catch (error) {
          console.error("[AUTH] authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.companyId = (user as any).companyId;
        token.companyName = (user as any).companyName;
        token.companySlug = (user as any).companySlug;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).companyId = token.companyId;
        (session.user as any).companyName = token.companyName;
        (session.user as any).companySlug = token.companySlug;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  secret: process.env.NEXTAUTH_SECRET || "mural-saas-secret-key-2024-stable",
};
