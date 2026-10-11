import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPushToUsers } from "@/lib/push";

// ═══════════════════════════════════════════════════════════
// GET /api/cron/backup — JOB DIARIO a las 22:00 (Vercel Cron 21:00 UTC)
//
// Para cada empresa:
//   1. Crea un backup AUTOMÁTICO (auto=true) con todos los datos.
//   2. Si ya hay 5 backups, sobreescribe el manual más antiguo (los
//      automáticos no se tocan — julio pidió que no se puedan borrar).
//   3. Envía un push al ADMIN de la empresa: "💾 Nueva copia de seguridad
//      disponible — ya puedes descargarla".
// Endpoint idempotente: rellamarlo no duplica backups (solo crea 1 por empresa por ejecución).
// ═══════════════════════════════════════════════════════════

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

export async function GET() {
  try {
    await ensureBackupTable();
    // Solo empresas activas (no super-admin sin empresa)
    const companies = await db.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    let total = 0;
    let notified = 0;
    for (const c of companies) {
      try {
        // 1) Recoger TODOS los datos de la empresa
        const [sedes, professionals, plans, avisos, holidays] = await Promise.all([
          db.sede.findMany({ where: { companyId: c.id }, orderBy: { order: "asc" } }),
          db.professional.findMany({ where: { companyId: c.id }, orderBy: { alias: "asc" } }),
          db.plan.findMany({ where: { companyId: c.id }, orderBy: { date: "asc" } }),
          db.aviso.findMany({ where: { companyId: c.id }, orderBy: { date: "asc" } }),
          db.holiday.findMany({ where: { companyId: c.id }, orderBy: { date: "asc" } }),
        ]);

        const clean = <T extends { id?: string; companyId?: string; createdAt?: any; updatedAt?: any }>(arr: T[]) =>
          arr.map(({ id, companyId, createdAt, updatedAt, ...rest }) => rest);

        const payload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          company: { id: c.id },
          sedes: clean(sedes),
          professionals: clean(professionals),
          plans: plans.map(p => {
            const sede = sedes.find(s => s.id === p.sedeId);
            return {
              sedeName: sede?.name || "",
              sedeTask: sede?.task || "",
              date: p.date, turn: p.turn, professionalAlias: p.professionalAlias,
              notes: p.notes, order: p.order,
            };
          }),
          avisos: avisos.map(a => {
            const sede = sedes.find(s => s.id === a.sedeId);
            const pro = professionals.find(pp => pp.id === a.professionalId);
            return {
              date: a.date, professionalAlias: pro?.alias || null,
              sedeName: sede?.name || "",
              sedeTask: sede?.task || "",
              turn: a.turn, reason: a.reason,
              note: a.note, order: a.order,
            };
          }),
          holidays: clean(holidays),
        };

        const json = JSON.stringify(payload, null, 2);
        const size = Buffer.byteLength(json, "utf8");
        const now = new Date();
        const tsLabel = now.toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
        const tsFile = now.toISOString().slice(0, 19).replace(/[T:]/g, "-");
        const label = `Backup automático ${tsLabel}`;
        const filename = `mural-backup-${tsFile}.json`;

        // 2) Si ya hay 5 backups, borrar los MANUALES más antiguos (los automáticos NO se tocan)
        const existing = await db.backup.findMany({
          where: { companyId: c.id },
          orderBy: { createdAt: "asc" },
          select: { id: true, auto: true },
        });
        if (existing.length >= 5) {
          const toDelete = existing.filter(b => !b.auto).slice(0, existing.length - 4);
          for (const b of toDelete) {
            await db.backup.delete({ where: { id: b.id } });
          }
        }

        // 3) Crear el backup automático
        await db.backup.create({
          data: { companyId: c.id, label, filename, data: json, size, auto: true },
        });
        total++;

        // 4) Notificar a los admins de la empresa (push + bandeja)
        const admins = await db.user.findMany({
          where: { companyId: c.id, role: "COMPANY_ADMIN", isActive: true },
          select: { id: true },
        });
        if (admins.length > 0) {
          await sendPushToUsers(admins.map(a => a.id), {
            title: "💾 Nueva copia de seguridad",
            body: `Backup automático creado (${plans.length} turnos, ${avisos.length} avisos). Ya puedes descargarlo en Configuración.`,
            url: "/?tab=config",
            tag: "backup-daily",
            source: "backup",
          });
          notified++;
        }
      } catch (e) {
        // Si falla una empresa, seguir con las demás
        console.error(`Backup fallido para empresa ${c.id}:`, e);
      }
    }

    return NextResponse.json({ ok: true, total, notified });
  } catch (e: any) {
    return NextResponse.json({ error: "Cron backup fallido: " + (e?.message || String(e)) }, { status: 500 });
  }
}
