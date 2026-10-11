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

// Restaura un backup por su id (carga los datos guardados en la empresa actual).
// Opción ?mode=merge (por defecto): añade los datos del backup a los actuales (sin borrar).
// Opción ?mode=replace: BORRA primero los datos actuales y los reemplaza por los del backup.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") || "merge") as "merge" | "replace";

    const payload = JSON.parse(backup.data) as {
      sedes: Array<{ name: string; city?: string; province?: string; task?: string; color?: string; order?: number; morningEnabled?: boolean; afternoonEnabled?: boolean }>;
      professionals: Array<{ alias: string; firstName: string; lastName: string; type?: string; category?: string; permissions?: string; assignedSedes?: string; startDate?: string; endDate?: string }>;
      plans: Array<{ sedeName: string; date: string; turn: string; professionalAlias: string; notes?: string; order?: number }>;
      avisos: Array<{ date: string; professionalAlias: string | null; sedeName: string; turn: string; reason?: string; note?: string; order?: number }>;
      holidays: Array<{ province: string; date: string }>;
    };

    // Si mode=replace, borrar primero los datos actuales
    if (mode === "replace") {
      await db.plan.deleteMany({ where: { companyId } });
      await db.aviso.deleteMany({ where: { companyId } });
      await db.holiday.deleteMany({ where: { companyId } });
      await db.sede.deleteMany({ where: { companyId } });
      await db.professional.deleteMany({ where: { companyId } });
    }

    // Restaurar sedes — casar por name + task (algunas empresas tienen varias sedes
    // con el mismo nombre pero task distinto, ej. "VIT" Consulta + "VIT" Quirófano).
    const sedeMap = new Map<string, string>(); // "name | task" -> id real
    const sedeKey = (name: string, task: string) => `${name} | ${task}`;
    const existingSedes = await db.sede.findMany({ where: { companyId } });
    for (const s of existingSedes) sedeMap.set(sedeKey(s.name, s.task), s.id);
    for (const s of payload.sedes || []) {
      const k = sedeKey(s.name, s.task || "");
      if (!sedeMap.has(k)) {
        const created = await db.sede.create({
          data: {
            companyId,
            name: s.name,
            city: s.city || "",
            province: s.province || "",
            task: s.task || "",
            color: s.color || "#3b82f6",
            order: s.order ?? 0,
            morningEnabled: s.morningEnabled ?? true,
            afternoonEnabled: s.afternoonEnabled ?? true,
          },
        });
        sedeMap.set(k, created.id);
      }
    }

    // Restaurar profesionales (crear los que no existan por alias; casar los existentes por alias)
    const proMap = new Map<string, string>(); // alias -> id real
    const existingPros = await db.professional.findMany({ where: { companyId } });
    for (const p of existingPros) proMap.set(p.alias, p.id);
    for (const p of payload.professionals || []) {
      if (!proMap.has(p.alias)) {
        const created = await db.professional.create({
          data: {
            companyId,
            alias: p.alias,
            firstName: p.firstName,
            lastName: p.lastName,
            type: p.type || "USER",
            category: p.category || "",
            permissions: p.permissions || "",
            assignedSedes: p.assignedSedes || "",
            startDate: p.startDate || "",
            endDate: p.endDate || "INDEFINIDO",
          },
        });
        proMap.set(p.alias, created.id);
      }
    }

    // Restaurar planes — casar sede por name+task (algunas empresas tienen varias sedes con
    // el mismo nombre, ej. "VIT" Consulta + "VIT" Quirófano). Si el plan no tiene sedeTask
    // (backups antiguos), usar solo sedeName como fallback.
    const sedeKey2 = (name: string, task: string) => `${name} | ${task}`;
    let plansOk = 0, plansSkip = 0;
    for (const p of payload.plans || []) {
      let sedeId: string | undefined;
      if (p.sedeTask) {
        sedeId = sedeMap.get(sedeKey2(p.sedeName, p.sedeTask));
      }
      if (!sedeId) {
        // Fallback: buscar por nombre solo (para backups antiguos sin sedeTask)
        // Si hay varias sedes con el mismo nombre, coger la primera
        for (const [k, v] of sedeMap) {
          if (k.startsWith(p.sedeName + ' | ')) { sedeId = v; break; }
        }
      }
      if (!sedeId) { plansSkip++; continue; }
      try {
        await db.plan.upsert({
          where: { sedeId_date_turn: { sedeId, date: p.date, turn: p.turn } },
          create: {
            companyId, sedeId, date: p.date, turn: p.turn,
            professionalAlias: p.professionalAlias,
            notes: p.notes || "",
            order: p.order ?? -1,
          },
          update: {
            professionalAlias: p.professionalAlias,
            notes: p.notes || "",
            order: p.order ?? -1,
          },
        });
        plansOk++;
      } catch { plansSkip++; }
    }

    // Restaurar avisos (no hay unique constraint claro; en mode=merge evitamos duplicar comparando date+sede+turn+pro)
    let avisosOk = 0, avisosSkip = 0;
    for (const a of payload.avisos || []) {
      let sedeId: string | undefined;
      if (a.sedeTask) {
        sedeId = sedeMap.get(sedeKey2(a.sedeName, a.sedeTask));
      }
      if (!sedeId) {
        for (const [k, v] of sedeMap) {
          if (k.startsWith(a.sedeName + ' | ')) { sedeId = v; break; }
        }
      }
      if (!sedeId) { avisosSkip++; continue; }
      const professionalId = a.professionalAlias ? proMap.get(a.professionalAlias) || null : null;
      // En mode=merge, saltar si ya existe uno idéntico
      if (mode === "merge") {
        const existing = await db.aviso.findFirst({
          where: { companyId, date: a.date, sedeId, turn: a.turn, professionalId, reason: a.reason || "" },
        });
        if (existing) { avisosSkip++; continue; }
      }
      try {
        await db.aviso.create({
          data: {
            companyId, date: a.date, sedeId, professionalId,
            turn: a.turn, reason: a.reason || "", note: a.note || "",
            order: a.order ?? -1,
          },
        });
        avisosOk++;
      } catch { avisosSkip++; }
    }

    // Restaurar holidays (unique [companyId, province, date] → upsert)
    let holidaysOk = 0;
    for (const h of payload.holidays || []) {
      try {
        await db.holiday.upsert({
          where: { companyId_province_date: { companyId, province: h.province, date: h.date } },
          create: { companyId, province: h.province, date: h.date },
          update: {},
        });
        holidaysOk++;
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      mode,
      counts: {
        sedes: sedeMap.size,
        professionals: proMap.size,
        plans: plansOk,
        plansSkip,
        avisos: avisosOk,
        avisosSkip,
        holidays: holidaysOk,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "No se pudo restaurar: " + (e?.message || String(e)) }, { status: 500 });
  }
}
