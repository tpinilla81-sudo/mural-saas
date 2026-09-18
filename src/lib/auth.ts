import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// Simple single-password login flow:
//   1. The login form presents ONE password input (no user picker).
//   2. authorize() fetches all active users and returns the first one whose
//      bcrypt-hashed password matches the supplied value. We prefer
//      SUPER_ADMIN > COMPANY_ADMIN > USER to make the match deterministic
//      when more than one user shares the same password.
//   3. If no user matches, login fails with the generic "Credenciales
//      incorrectas" error that NextAuth surfaces to the form.
//
// The previous PIN flow (per-user 4-digit PIN) is removed: the admin can
// still rotate the login password by changing it directly in the database
// for the relevant user.
const ROLE_PRIORITY: Record<string, number> = {
  SUPER_ADMIN: 0,
  COMPANY_ADMIN: 1,
  USER: 2,
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Contraseña",
      credentials: {
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.password) return null;

        try {
          const users = await db.user.findMany({
            where: { isActive: true },
            include: { company: true },
            orderBy: { email: "asc" },
          });

          // Sort by role priority so SUPER_ADMIN wins ties.
          users.sort(
            (a, b) =>
              (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99),
          );

          for (const user of users) {
            if (!user.password) continue;
            const ok = await bcrypt.compare(credentials.password, user.password);
            if (!ok) continue;

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
              allowedSedes: user.allowedSedes || "",
              allowedPros: user.allowedPros || "",
              showNotes: user.showNotes !== false,
              showVacaciones: user.showVacaciones !== false,
            } as any;
          }

          return null;
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
        token.allowedSedes = (user as any).allowedSedes;
        token.allowedPros = (user as any).allowedPros;
        token.showNotes = (user as any).showNotes;
        token.showVacaciones = (user as any).showVacaciones;
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
        (session.user as any).allowedSedes = token.allowedSedes || "";
        (session.user as any).allowedPros = token.allowedPros || "";
        (session.user as any).showNotes = token.showNotes !== false;
        (session.user as any).showVacaciones = token.showVacaciones !== false;
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
