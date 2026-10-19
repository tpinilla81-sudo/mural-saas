import { NextResponse } from "next/server";
import { requireCompanyAdmin, requireCompanyUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  // Read access is available to any company user (USER accesses need this for their views)
  const { error, status, user } = await requireCompanyUser();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") || new Date().getFullYear().toString());
  const month = url.searchParams.get("month");

  let where: any = { companyId };
  if (year) {
    where.date = { startsWith: year.toString() };
  }
  if (month) {
    const m = (parseInt(month) + 1).toString().padStart(2, "0");
    where.date = { startsWith: `${year}-${m}` };
  }

  const plans = await db.plan.findMany({
    where,
    include: { sede: true },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(plans);
}

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const body = await req.json();

  try {
    // ANTES de crear o sobrescribir, comprobar si ya existe un turno en esa sede/fecha/turno.
    // Si existe y es de OTRO profesional, NO sobrescribir — devolver error.
    // Si existe y es del MISMO profesional, sobrescribir (es un update normal).
    // Si no existe, crear nuevo.
    const existing = await db.plan.findUnique({
      where: { sedeId_date_turn: { sedeId: body.sedeId, date: body.date, turn: body.turn } },
    });
    if (existing && existing.professionalAlias !== body.professionalAlias) {
      // Ya hay un turno de otro profesional en esa sede/fecha/turno.
      // Buscar el nombre de la sede para el mensaje.
      const sede = await db.sede.findUnique({ where: { id: body.sedeId }, select: { name: true, task: true } });
      return NextResponse.json({
        error: `Ya existe un turno de ${existing.professionalAlias} en ${sede?.name || ''} / ${sede?.task || ''} el ${body.date} (${body.turn === 'MANANA' ? 'Mañana' : 'Tarde'}). No se puede sobrescribir.`,
        conflict: true,
        existingId: existing.id,
        existingPro: existing.professionalAlias,
      }, { status: 409 });
    }
    if (existing) {
      // Mismo profesional: sobrescribir (actualizar nota si viene)
      const plan = await db.plan.update({
        where: { id: existing.id },
        data: { professionalAlias: body.professionalAlias },
      });
      return NextResponse.json(plan);
    }
    const plan = await db.plan.create({
      data: {
        companyId,
        sedeId: body.sedeId,
        date: body.date,
        turn: body.turn,
        professionalAlias: body.professionalAlias,
      },
    });
    return NextResponse.json(plan, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: "No se pudo crear el turno: " + (e?.message || String(e)) }, { status: 500 });
  }
}
