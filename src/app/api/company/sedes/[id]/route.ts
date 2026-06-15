import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;

  // Ownership check: only allow updating sedes belonging to the user's company
  const existing = await db.sede.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Sede no encontrada" }, { status: 404 });
  if (user!.role !== "SUPER_ADMIN" && existing.companyId !== user!.companyId) {
    return NextResponse.json({ error: "Sin permisos sobre esta sede" }, { status: 403 });
  }

  const body = await req.json();
  // Filter allowed fields only
  const allowedFields = ["name", "city", "province", "task", "email", "phone", "morningEnabled", "afternoonEnabled", "color"];
  const data: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  const sede = await db.sede.update({ where: { id }, data });
  return NextResponse.json(sede);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;

  // Ownership check: only allow deleting sedes belonging to the user's company
  const existing = await db.sede.findUnique({ where: { id }, include: { plans: true } });
  if (!existing) return NextResponse.json({ error: "Sede no encontrada" }, { status: 404 });
  if (user!.role !== "SUPER_ADMIN" && existing.companyId !== user!.companyId) {
    return NextResponse.json({ error: "Sin permisos sobre esta sede" }, { status: 403 });
  }

  try {
    await db.sede.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error deleting sede:", err);
    return NextResponse.json(
      { error: "Error al eliminar la sede. Puede tener planes asociados.", detail: err.message },
      { status: 500 }
    );
  }
}
