import { NextResponse } from "next/server";
import { requireCompanyAdmin, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  const body = await req.json();

  // Update professionalAlias only
  if (body.professionalAlias !== undefined) {
    const plan = await db.plan.update({
      where: { id },
      data: { professionalAlias: body.professionalAlias },
    });
    return NextResponse.json(plan);
  }

  // Update notes only (string, max 2000 chars; empty string clears the note)
  if (body.notes !== undefined) {
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : "";
    // Ensure the plan belongs to the caller's company (security)
    const existing = await db.plan.findUnique({ where: { id }, select: { companyId: true } });
    if (!existing || existing.companyId !== user!.companyId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const plan = await db.plan.update({ where: { id }, data: { notes } });
    return NextResponse.json(plan);
  }

  // Move card to another day (drag & drop o botón MOVER)
  if (body.date !== undefined) {
    const date = String(body.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
    const existing = await db.plan.findUnique({ where: { id }, select: { companyId: true } });
    if (!existing || existing.companyId !== user!.companyId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const plan = await db.plan.update({ where: { id }, data: { date } });
    return NextResponse.json(plan);
  }

  return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  await db.plan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
