import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// Login flow:
//   1. User picks an identity from the login dropdown (passwordless by default).
//   2. If the user has a PIN configured, the login form also sends `pin` and we
//      verify it with bcrypt.compare. If it's missing or wrong, login fails.
//   3. If no PIN is configured, login is open (only requires `email`).
// The COMPANY_ADMIN controls WHO can log in (isActive) and whether a PIN is
// required, from the Configuración tab.
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Selector",
      credentials: {
        email: { label: "Email", type: "email" },
        pin: { label: "PIN", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        try {
          const user = await db.user.findUnique({
            where: { email: credentials.email },
            include: { company: true },
          });

          if (!user || !user.isActive) return null;

          // If a PIN is configured for this user, verify it
          if (user.pin) {
            const providedPin = (credentials.pin || "").trim();
            if (!providedPin) return null;
            const ok = await bcrypt.compare(providedPin, user.pin);
            if (!ok) return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId || undefined,
            companyName: user.company?.name || undefined,
            companySlug: user.company?.slug || undefined,
            professionalId: user.professionalId || undefined,
            permissions: user.permissions || "",
          } as any;
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
        token.professionalId = (user as any).professionalId;
        token.permissions = (user as any).permissions;
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
        (session.user as any).professionalId = token.professionalId;
        (session.user as any).permissions = token.permissions;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  // No hardcoded fallback — the deployment MUST provide NEXTAUTH_SECRET.
  // If it is missing, NextAuth will throw at startup, which is the desired
  // behavior: never silently fall back to a known value.
  secret: process.env.NEXTAUTH_SECRET,
};
