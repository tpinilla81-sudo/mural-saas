import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

// GET /api/mcp/turnos?fecha=YYYY-MM-DD — lista de turnos (planes) de un día.
// Si no se pasa fecha, devuelve los próximos 7 días desde hoy.
export async function GET(req: Request) {
  const { error, status, companyId } = await requireApiKey("read");
  if (error) return NextResponse.json({ error }, { status });
  const url = new URL(req.url);
  const fecha = url.searchParams.get("fecha");
  let where: any = { companyId };
  if (fecha) {
    where.date = fecha;
  } else {
    // Próximos 7 días desde hoy (Madrid)
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + 7);
    const future = d.toISOString().slice(0, 10);
    where.date = { gte: today, lte: future };
  }
  const planes = await db.plan.findMany({
    where,
    orderBy: { date: "asc" },
    include: { sede: { select: { name: true } } },
  });
  // Limpiar y formatear
  return NextResponse.json(planes.map(p => ({
    id: p.id,
    fecha: p.date,
    turno: p.turn === "MANANA" ? "Mañana" : p.turn === "TARDE" ? "Tarde" : "Mañana y Tarde",
    sede: p.sede?.name || "",
    profesional: p.professionalAlias,
    nota: p.notes || "",
  })));
}

// POST /api/mcp/turnos — crea un turno.
// Body: { fecha: "YYYY-MM-DD", sede: "VIT" (nombre), profesional: "AS" (alias), turno: "MANANA"|"TARDE"|"AMBOS", nota?: "" }
export async function POST(req: Request) {
  const { error, status, companyId } = await requireApiKey("write");
  if (error) return NextResponse.json({ error }, { status });
  try {
    const body = await req.json();
    const fecha = body.fecha;
    const sedeName = body.sede;
    const proAlias = body.profesional;
    const turno = (body.turno || "MANANA").toUpperCase();
    const nota = body.nota || "";
    if (!fecha || !sedeName || !proAlias) {
      return NextResponse.json({ error: "Faltan campos: fecha, sede, profesional" }, { status: 400 });
    }
    if (!["MANANA", "TARDE", "AMBOS"].includes(turno)) {
      return NextResponse.json({ error: "Turno inválido. Usa: MANANA, TARDE, AMBOS" }, { status: 400 });
    }
    const sede = await db.sede.findFirst({ where: { companyId, name: sedeName } });
    if (!sede) return NextResponse.json({ error: `Sede "${sedeName}" no encontrada` }, { status: 404 });
    // Verificar que el profesional existe
    const pro = await db.professional.findFirst({ where: { companyId, alias: proAlias } });
    if (!pro) return NextResponse.json({ error: `Profesional "${proAlias}" no encontrado` }, { status: 404 });
    // Upsert (maneja conflictos)
    try {
      const plan = await db.plan.upsert({
        where: { sedeId_date_turn: { sedeId: sede.id, date: fecha, turn: turno } },
        create: { companyId, sedeId: sede.id, date: fecha, turn: turno, professionalAlias: proAlias, notes: nota },
        update: { professionalAlias: proAlias, notes: nota },
      });
      return NextResponse.json({ ok: true, id: plan.id, msg: `Turno creado: ${fecha} ${turno} ${sedeName} ${proAlias}` });
    } catch (e: any) {
      return NextResponse.json({ error: "No se pudo crear el turno: " + (e?.message || String(e)) }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: "Body inválido: " + (e?.message || String(e)) }, { status: 400 });
  }
}
