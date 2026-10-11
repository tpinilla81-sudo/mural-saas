import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

// GET /api/mcp/avisos?fecha=YYYY-MM-DD — lista de avisos de un día.
// Si no se pasa fecha, devuelve los próximos 7 días.
export async function GET(req: Request) {
  const { error, status, companyId } = await requireApiKey("read");
  if (error) return NextResponse.json({ error }, { status });
  const url = new URL(req.url);
  const fecha = url.searchParams.get("fecha");
  let where: any = { companyId };
  if (fecha) {
    where.date = fecha;
  } else {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + 7);
    const future = d.toISOString().slice(0, 10);
    where.date = { gte: today, lte: future };
  }
  const avisos = await db.aviso.findMany({
    where,
    orderBy: { date: "asc" },
    include: {
      sede: { select: { name: true } },
      professional: { select: { alias: true, firstName: true, lastName: true } },
    },
  });
  return NextResponse.json(avisos.map(a => ({
    id: a.id,
    fecha: a.date,
    turno: a.turn === "M" ? "Mañana" : a.turn === "T" ? "Tarde" : "Ambas",
    sede: a.sede?.name || "",
    profesional: a.professional ? `${a.professional.firstName} ${a.professional.lastName}`.trim() || a.professional.alias : "(sede completa)",
    motivo: a.reason || "",
    nota: a.note || "",
  })));
}

// POST /api/mcp/avisos — crea un aviso.
// Body: {
//   fecha: "YYYY-MM-DD" (o "desde=YYYY-MM-DD&hasta=YYYY-MM-DD" para rango),
//   sede: "VIT" (nombre),
//   profesional: "AS" (alias) o null (sede completa),
//   turno: "M"|"T"|"" (mañana, tarde, ambas),
//   motivo: "VACACIONES"|"BAJA"|"FORMACION"|"PERMISO"|"AUSENCIA"|custom,
//   nota?: ""
// }
// Soporta rango de fechas: si body.desde y body.hasta, crea avisos en cada día laborable del rango.
export async function POST(req: Request) {
  const { error, status, companyId } = await requireApiKey("write");
  if (error) return NextResponse.json({ error }, { status });
  try {
    const body = await req.json();
    const sedeName = body.sede;
    const proAlias = body.profesional; // puede ser null/empty para sede completa
    const turno = (body.turno || "").toUpperCase() === "M" ? "M"
      : (body.turno || "").toUpperCase() === "T" ? "T"
      : (body.turno || "").toUpperCase() === "AMBAS" || (body.turno || "").toUpperCase() === "" ? ""
      : "";
    const motivo = (body.motivo || "AUSENCIA").toString().toUpperCase();
    const nota = body.nota || "";

    const desde = body.desde || body.fecha;
    const hasta = body.hasta || body.desde || body.fecha;
    if (!desde || !sedeName) {
      return NextResponse.json({ error: "Faltan campos: desde (o fecha) y sede" }, { status: 400 });
    }

    const sede = await db.sede.findFirst({ where: { companyId, name: sedeName } });
    if (!sede) return NextResponse.json({ error: `Sede "${sedeName}" no encontrada` }, { status: 404 });
    let proId: string | null = null;
    if (proAlias) {
      const pro = await db.professional.findFirst({ where: { companyId, alias: proAlias } });
      if (!pro) return NextResponse.json({ error: `Profesional "${proAlias}" no encontrado` }, { status: 404 });
      proId = pro.id;
    }

    // Generar lista de fechas desde→hasta (excluye domingos por defecto; sin fines de semana)
    const fechas: string[] = [];
    const start = new Date(desde + "T00:00:00");
    const end = new Date(hasta + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0) continue; // saltar domingos
      fechas.push(d.toISOString().slice(0, 10));
    }

    let creados = 0, saltados = 0;
    for (const f of fechas) {
      // Verificar si ya existe un aviso idéntico (no duplicar en merge)
      const existing = await db.aviso.findFirst({
        where: { companyId, date: f, sedeId: sede.id, professionalId: proId, turn: turno, reason: motivo },
      });
      if (existing) { saltados++; continue; }
      try {
        await db.aviso.create({
          data: { companyId, date: f, sedeId: sede.id, professionalId: proId, turn: turno, reason: motivo, note: nota },
        });
        creados++;
      } catch (e) { saltados++; }
    }

    return NextResponse.json({
      ok: true,
      creados,
      saltados,
      fechas_total: fechas.length,
      rango: fechas.length > 1 ? `${desde} → ${hasta}` : desde,
      sede: sedeName,
      profesional: proAlias || "(sede completa)",
      motivo,
      msg: `Avisos creados: ${creados} (${saltados} ya existían).`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "No se pudo crear el aviso: " + (e?.message || String(e)) }, { status: 500 });
  }
}
