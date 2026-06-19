import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// Email + password auth. The company admin manages user credentials from
// the Configuración tab; super admins still use this same flow.
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await db.user.findUnique({
            where: { email: credentials.email },
            include: { company: true },
          });

          if (!user || !user.isActive) return null;

          // Verify bcrypt hash. If for some reason the stored hash is a legacy
          // random placeholder (length <= 20), reject — the admin must set a
          // real password from Configuración.
          if (!user.password || user.password.length <= 20) return null;
          const ok = await bcrypt.compare(credentials.password, user.password);
          if (!ok) return null;

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
  secret: process.env.NEXTAUTH_SECRET || "mural-saas-secret-key-2024-stable",
};
