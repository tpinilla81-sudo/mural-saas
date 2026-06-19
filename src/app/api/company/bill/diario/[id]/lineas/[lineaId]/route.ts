import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── DELETE /api/company/bill/diario/[id]/lineas/[lineaId] ──
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineaId: string }> }
) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  const { id, lineaId } = await params;

  // Verify ownership (via diario item)
  const item = await db.billDiarioItem.findFirst({
    where: { id, companyId },
  });
  if (!item) {
    return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
  }

  await db.billDiarioLine.deleteMany({
    where: { id: lineaId, diarioItemId: id },
  });

  return NextResponse.json({ ok: true });
}
