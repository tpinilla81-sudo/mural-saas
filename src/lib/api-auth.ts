import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";
import { headers } from "next/headers";

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

// ── API KEY (para integraciones externas: Claude, automatizaciones) ──
// El header Authorization: Bearer <key> identifica la key. La validamos con SHA256
// (no guardamos la key en claro, solo su hash). Devuelve el companyId + scope.
async function ensureApiKeyTable() {
  try {
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ApiKey" (
        "id" TEXT NOT NULL,
        "companyId" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "keyHash" TEXT NOT NULL,
        "prefix" TEXT NOT NULL,
        "scope" TEXT NOT NULL DEFAULT 'read,write',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastUsedAt" TIMESTAMP(3),
        CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
      );
    `;
    await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "ApiKey_companyId_idx" ON "ApiKey"("companyId");`;
  } catch {}
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

// Valida una API key. Devuelve { companyId, scope } o { error }.
// Marca lastUsedAt. Si la key no tiene un scope, devuelve 403.
export async function requireApiKey(requiredScope: "read" | "write" | "delete" | "backup") {
  await ensureApiKeyTable();
  // Leer el header Authorization de cualquier manera compatible
  const auth = (typeof headers === "function" ? headers() : null) as Headers | null;
  let bearer = "";
  if (auth && typeof auth.get === "function") {
    bearer = auth.get("authorization") || auth.get("Authorization") || "";
  }
  if (!bearer || !/^bearer\s+/i.test(bearer)) {
    return { error: "Falta Authorization: Bearer <api-key>", status: 401, companyId: null, scope: null };
  }
  const key = bearer.replace(/^bearer\s+/i, "").trim();
  if (!key) return { error: "API key vacía", status: 401, companyId: null, scope: null };

  const keyHash = hashKey(key);
  let row: any = null;
  try {
    row = await db.apiKey.findUnique({ where: { keyHash } });
  } catch (e: any) {
    return { error: "No se pudo validar la API key: " + (e?.message || String(e)), status: 500, companyId: null, scope: null };
  }
  if (!row) return { error: "API key inválida o revocada", status: 401, companyId: null, scope: null };

  const scopes = (row.scope || "read,write").split(",").map((s: string) => s.trim());
  if (!scopes.includes(requiredScope)) {
    return { error: `Esta API key no tiene el permiso '${requiredScope}' (scopes: ${scopes.join(",")})`, status: 403, companyId: null, scope: null };
  }
  // Actualizar lastUsedAt (mejor esfuerzo)
  try { await db.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }); } catch {}

  return { error: null, status: 200, companyId: row.companyId, scope: row.scope };
}

// Genera una API key nueva (formato: mur_live_<32 hex chars>).
// Devuelve { key, prefix, keyHash } — la key solo se devuelve una vez al crearla.
export function generateApiKey(): { key: string; prefix: string; keyHash: string } {
  const random = crypto.randomBytes(24).toString("hex");
  const key = `mur_live_${random}`;
  return { key, prefix: key.slice(0, 12), keyHash: hashKey(key) };
}
