import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;

  // Ownership check
  const existing = await db.holiday.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Festivo no encontrado" }, { status: 404 });
  if (user!.role !== "SUPER_ADMIN" && existing.companyId !== user!.companyId) {
    return NextResponse.json({ error: "Sin permisos sobre este festivo" }, { status: 403 });
  }

  try {
    await db.holiday.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error deleting holiday:", err);
    return NextResponse.json(
      { error: "Error al eliminar el festivo.", detail: err.message },
      { status: 500 }
    );
  }
}
