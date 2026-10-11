import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// Restaura desde un archivo .json subido por el usuario (no guardado en el listado).
// Body: { data: <objeto JSON del backup>, mode: "merge" | "replace" }
// O alternativamente: el body entero es el JSON del backup (raw).
export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const companyId = user!.companyId!;

  try {
    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") || "merge") as "merge" | "replace";

    // Leer el body como texto y parsear el JSON
    const text = await req.text();
    let payload: any;
    try {
      payload = JSON.parse(text);
      // Si viene envuelto en { data: ... }, desenvolver
      if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object" && payload.data.sedes) {
        payload = payload.data;
      }
    } catch {
      return NextResponse.json({ error: "El archivo no es un JSON válido" }, { status: 400 });
    }

    if (!payload || !payload.sedes || !Array.isArray(payload.sedes)) {
      return NextResponse.json({ error: "El archivo no tiene la estructura de un backup de MURAL (falta 'sedes')" }, { status: 400 });
    }

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
    const sedeMap = new Map<string, string>();
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

    // Restaurar profesionales
    const proMap = new Map<string, string>();
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

    // Restaurar planes — casar sede por name+task; fallback a name solo para backups antiguos
    const sedeKey2 = (name: string, task: string) => `${name} | ${task}`;
    let plansOk = 0, plansSkip = 0;
    for (const p of payload.plans || []) {
      let sedeId: string | undefined;
      if (p.sedeTask) sedeId = sedeMap.get(sedeKey2(p.sedeName, p.sedeTask));
      if (!sedeId) {
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

    // Restaurar avisos
    let avisosOk = 0, avisosSkip = 0;
    for (const a of payload.avisos || []) {
      let sedeId: string | undefined;
      if (a.sedeTask) sedeId = sedeMap.get(sedeKey2(a.sedeName, a.sedeTask));
      if (!sedeId) {
        for (const [k, v] of sedeMap) {
          if (k.startsWith(a.sedeName + ' | ')) { sedeId = v; break; }
        }
      }
      if (!sedeId) { avisosSkip++; continue; }
      const professionalId = a.professionalAlias ? proMap.get(a.professionalAlias) || null : null;
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

    // Restaurar holidays
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
    return NextResponse.json({ error: "No se pudo restaurar el archivo: " + (e?.message || String(e)) }, { status: 500 });
  }
}
