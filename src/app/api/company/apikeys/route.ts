import { NextResponse } from "next/server";
import { requireCompanyAdmin, generateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

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

// Lista las API keys de la empresa (sin mostrar la key real, solo el prefijo).
export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const companyId = user!.companyId!;
  await ensureApiKeyTable();
  const keys = await db.apiKey.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, prefix: true, scope: true, createdAt: true, lastUsedAt: true },
  });
  return NextResponse.json(keys);
}

// Crea una nueva API key. Body: { label, scope }.
// Devuelve la key en claro UNA sola vez (no se puede volver a ver).
export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const companyId = user!.companyId!;
  await ensureApiKeyTable();
  try {
    const body = await req.json();
    const label = (body.label || "API key").toString().slice(0, 60);
    const scope = (body.scope || "read,write").toString();
    // Validar scope: solo read, write, delete, backup
    const validScopes = ["read", "write", "delete", "backup"];
    const scopes = scope.split(",").map((s: string) => s.trim()).filter((s: string) => validScopes.includes(s));
    if (scopes.length === 0) return NextResponse.json({ error: "Scope inválido. Usa: read, write, delete, backup" }, { status: 400 });

    const { key, prefix, keyHash } = generateApiKey();
    const created = await db.apiKey.create({
      data: { companyId, label, prefix, keyHash, scope: scopes.join(",") },
    });
    // Devolver la key UNA sola vez
    return NextResponse.json({ ok: true, id: created.id, label, prefix, scope: scopes.join(","), key, msg: "Guarda esta key ahora, no se volverá a mostrar." });
  } catch (e: any) {
    return NextResponse.json({ error: "No se pudo crear la API key: " + (e?.message || String(e)) }, { status: 500 });
  }
}

// Revoca (borra) una API key por id.
export async function DELETE(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const companyId = user!.companyId!;
  await ensureApiKeyTable();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const existing = await db.apiKey.findUnique({ where: { id } });
  if (!existing || existing.companyId !== companyId) return NextResponse.json({ error: "API key no encontrada" }, { status: 404 });
  await db.apiKey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
