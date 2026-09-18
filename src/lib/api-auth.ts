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
  professionalId?: string;
  permissions?: string;
  allowedSedes?: string;
  allowedPros?: string;
  showNotes?: boolean;
  showVacaciones?: boolean;
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

// Any authenticated user that belongs to a company (SUPER_ADMIN, COMPANY_ADMIN, USER).
// Used by read-only GET endpoints that restricted accesses also need (plans, sedes,
// holidays, professionals, avisos). Writes still go through requireCompanyAdmin().
export async function requireCompanyUser() {
  const user = await getSessionUser();
  if (!user) return { error: "No autenticado", status: 401, user: null };
  if (!user.companyId) return { error: "Sin empresa", status: 403, user: null };
  return { error: null, status: 200, user };
}
