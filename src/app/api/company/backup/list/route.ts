import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// Lista los backups de la empresa (máximo 5, del más nuevo al más antiguo).
// ensureBackupTable crea la tabla si no existe (Vercel no ejecuta migraciones).
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
  } catch {}
}

export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const companyId = user!.companyId!;

  try {
    await ensureBackupTable();
    const backups = await db.backup.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, filename: true, size: true, auto: true, createdAt: true },
    });
    return NextResponse.json(backups);
  } catch (e: any) {
    return NextResponse.json({ error: "No se pudo listar los backups: " + (e?.message || String(e)) }, { status: 500 });
  }
}
