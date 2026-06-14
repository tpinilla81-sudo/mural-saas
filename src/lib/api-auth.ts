import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId?: string;
  companyName?: string;
  companySlug?: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as unknown as SessionUser;
}

export async function requireRole(...roles: string[]) {
  const user = await getSessionUser();
  if (!user) return { error: "No autenticado", status: 401, user: null };
  if (!roles.includes(user.role)) return { error: "Sin permisos", status: 403, user: null };
  return { error: null, status: 200, user };
}

export async function requireCompanyAdmin() {
  return requireRole("SUPER_ADMIN", "COMPANY_ADMIN");
}
