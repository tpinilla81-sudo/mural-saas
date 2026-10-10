import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// Crea una copia de seguridad completa de los datos de la empresa y la guarda en el
// listado de máximo 5 backups (si ya hay 5, borra el más antiguo antes de insertar).
// Incluye un CREATE TABLE IF NOT EXISTS al inicio para garantizar que la tabla existe
// en producción (Vercel no ejecuta migraciones automáticamente).
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
  } catch (e) {
    // Si la tabla ya existe o falla, continuar — el error real saltará en el insert
  }
}

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const companyId = user!.companyId!;
  const url = new URL(req.url);
  const isAuto = url.searchParams.get("auto") === "1"; // cron diario lo usa

  try {
    await ensureBackupTable();
    // 1) Recoger TODOS los datos de la empresa (sedes, profesionales, planes, avisos, holidays)
    const [sedes, professionals, plans, avisos, holidays] = await Promise.all([
      db.sede.findMany({ where: { companyId }, orderBy: { order: "asc" } }),
      db.professional.findMany({ where: { companyId }, orderBy: { alias: "asc" } }),
      db.plan.findMany({ where: { companyId }, orderBy: { date: "asc" } }),
      db.aviso.findMany({ where: { companyId }, orderBy: { date: "asc" } }),
      db.holiday.findMany({ where: { companyId }, orderBy: { date: "asc" } }),
    ]);

    // 2) Limpiar campos internos (id, companyId, createdAt, updatedAt) — al restaurar se generan nuevos
    const clean = <T extends { id?: string; companyId?: string; createdAt?: any; updatedAt?: any }>(arr: T[]) =>
      arr.map(({ id, companyId, createdAt, updatedAt, ...rest }) => rest as Omit<T, "id" | "companyId" | "createdAt" | "updatedAt">);

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      company: { id: companyId },
      sedes: clean(sedes),
      professionals: clean(professionals),
      plans: plans.map(p => {
        // Plan tiene sedeId (relación), pero sedeId referencia un id que cambiará al restaurar.
        // Guardamos sedeName para casar por nombre al restaurar.
        const sede = sedes.find(s => s.id === p.sedeId);
        return {
          sedeName: sede?.name || "",
          date: p.date,
          turn: p.turn,
          professionalAlias: p.professionalAlias,
          notes: p.notes,
          order: p.order,
        };
      }),
      avisos: avisos.map(a => {
        const sede = sedes.find(s => s.id === a.sedeId);
        const pro = professionals.find(pp => pp.id === a.professionalId);
        return {
          date: a.date,
          professionalAlias: pro?.alias || null, // null = aviso de sede completa
          sedeName: sede?.name || "",
          turn: a.turn,
          reason: a.reason,
          note: a.note,
          order: a.order,
        };
      }),
      holidays: clean(holidays),
    };

    const json = JSON.stringify(payload, null, 2);
    const size = Buffer.byteLength(json, "utf8");
    const now = new Date();
    const tsLabel = now.toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
    const tsFile = now.toISOString().slice(0, 19).replace(/[T:]/g, "-");
    const label = isAuto ? `Backup automático ${tsLabel}` : `Backup ${tsLabel}`;
    const filename = `mural-backup-${tsFile}.json`;

    // 3) Si ya hay 5 backups, borrar los más antiguos. Pero NO borrar los automáticos
    //    (julio pidió que no se puedan borrar). Si todos los 5 son automáticos, no borramos
    //    ninguno y el nuevo se añade igual (puede haber 6+ automáticos).
    const existing = await db.backup.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, auto: true },
    });
    if (existing.length >= 5) {
      // Borrar los MANUALES más antiguos hasta dejar 4 (para hacer sitio al nuevo)
      const toDelete = existing.filter(b => !b.auto).slice(0, existing.length - 4);
      for (const b of toDelete) {
        await db.backup.delete({ where: { id: b.id } });
      }
    }

    // 4) Crear el nuevo backup
    const backup = await db.backup.create({
      data: { companyId, label, filename, data: json, size, auto: isAuto },
    });

    return NextResponse.json({
      ok: true,
      id: backup.id,
      label,
      filename,
      size,
      counts: {
        sedes: sedes.length,
        professionals: professionals.length,
        plans: plans.length,
        avisos: avisos.length,
        holidays: holidays.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "No se pudo crear el backup: " + (e?.message || String(e)) }, { status: 500 });
  }
}
