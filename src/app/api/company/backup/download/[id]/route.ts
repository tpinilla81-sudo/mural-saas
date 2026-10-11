import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

async function ensureBackupTable() {
  try {
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Backup" (
        "id" TEXT NOT NULL,
        "companyId" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "filename" TEXT NOT NULL,
        "data" TEXT NOT NULL,
        "size" INTEGER NOT NULL DEFAULT 0,
        "auto" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
      );
    `;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "Backup_companyId_idx" ON "Backup"("companyId");`;
    // ALTER TABLE para anadir la columna 'auto' si la tabla ya existia sin ella (migracion)
    try { await db.$executeRaw`ALTER TABLE "Backup" ADD COLUMN IF NOT EXISTS "auto" BOOLEAN NOT NULL DEFAULT false;`; } catch {}
  } catch {}
}

// Descarga un backup por su id como archivo .json (Content-Disposition: attachment).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const companyId = user!.companyId!;
  const { id } = await params;

  try {
    await ensureBackupTable();
    const backup = await db.backup.findUnique({ where: { id } });
    if (!backup || backup.companyId !== companyId) {
      return NextResponse.json({ error: "Backup no encontrado" }, { status: 404 });
    }
    return new NextResponse(backup.data, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${backup.filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "No se pudo descargar: " + (e?.message || String(e)) }, { status: 500 });
  }
}

// Borrar un backup por su id.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const companyId = user!.companyId!;
  const { id } = await params;

  try {
    await ensureBackupTable();
    const backup = await db.backup.findUnique({ where: { id } });
    if (!backup || backup.companyId !== companyId) {
      return NextResponse.json({ error: "Backup no encontrado" }, { status: 404 });
    }
    await db.backup.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "No se pudo borrar: " + (e?.message || String(e)) }, { status: 500 });
  }
}
