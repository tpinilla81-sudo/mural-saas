import { NextResponse } from "next/server";
import { requireCompanyAdmin, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const companyId = user!.companyId!;

  // Verify user belongs to this company
  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.companyId !== companyId) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Don't allow deleting yourself
  if (target.id === user!.id) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 });
  }

  await db.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const companyId = user!.companyId!;
  const body = await req.json();

  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.companyId !== companyId) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // ── Guard: never allow changing your own role (self-lockout protection) ──
  if (target.id === user!.id && body.role !== undefined && body.role !== target.role) {
    return NextResponse.json({ error: "No puedes cambiar tu propio rol de administrador" }, { status: 400 });
  }

  // ── Guard: company must always keep at least one active COMPANY_ADMIN ──
  const losesAdmin = target.role === "COMPANY_ADMIN" &&
    ((body.role !== undefined && body.role !== "COMPANY_ADMIN") || body.isActive === false);
  if (losesAdmin) {
    const otherAdmins = await db.user.count({
      where: { companyId, role: "COMPANY_ADMIN", isActive: true, NOT: { id: target.id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: "Debe existir al menos un administrador activo en la empresa" }, { status: 400 });
    }
  }

  const updated = await db.user.update({
    where: { id },
    data: {
      name: body.name,
      role: body.role !== undefined && ["USER", "COMPANY_ADMIN"].includes(body.role) ? body.role : undefined,
      isActive: body.isActive !== undefined ? body.isActive : undefined,
    },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  return NextResponse.json(updated);
}
