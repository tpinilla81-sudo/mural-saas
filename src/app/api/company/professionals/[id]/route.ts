import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;

  // Ownership check
  const existing = await db.professional.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
  if (user!.role !== "SUPER_ADMIN" && existing.companyId !== user!.companyId) {
    return NextResponse.json({ error: "Sin permisos sobre este profesional" }, { status: 403 });
  }

  const body = await req.json();
  // Filter allowed fields only
  const allowedFields = ["firstName", "lastName", "alias", "type", "category", "username", "email", "phone", "permissions", "assignedSedes", "startDate", "endDate"];
  const data: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  const pro = await db.professional.update({ where: { id }, data });
  return NextResponse.json(pro);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;

  // Ownership check
  const existing = await db.professional.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
  if (user!.role !== "SUPER_ADMIN" && existing.companyId !== user!.companyId) {
    return NextResponse.json({ error: "Sin permisos sobre este profesional" }, { status: 403 });
  }

  try {
    await db.professional.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error deleting professional:", err);
    return NextResponse.json(
      { error: "Error al eliminar el profesional.", detail: err.message },
      { status: 500 }
    );
  }
}
