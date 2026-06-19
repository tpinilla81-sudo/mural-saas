import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── POST /api/company/bill/diario/[id]/no-cumplida ──
// Marks a PENDIENTE salida as NO_CUMPLIDA (the planned salida didn't happen).
// Side effects:
//   - Changes item.status from PENDIENTE → NO_CUMPLIDA
//   - NO_CUMPLIDA items are excluded from billing flows (cannot be transferred)
//   - Item is kept in the DB for audit/tracking
// Idempotent: if the item is already NO_CUMPLIDA, returns 200.
//   - FACTURADA items cannot be marked as no-cumplida.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const item = await db.billDiarioItem.findFirst({
      where: { id, companyId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }

    if (item.status === "FACTURADA") {
      return NextResponse.json(
        { error: "El item ya está facturado, no se puede marcar como no cumplida" },
        { status: 400 }
      );
    }

    // If going back from CUMPLIDA → NO_CUMPLIDA, also remove the auto-created default line
    // (only the one with obs matching "<professional> — <turn>" and orden=0)
    if (item.status === "CUMPLIDA") {
      await db.billDiarioLine.deleteMany({
        where: {
          diarioItemId: id,
          orden: 0,
          obs: {
            contains: item.turn === "MANANA" ? "Mañana" : "Tarde",
          },
        },
      });
    }

    const updated = await db.billDiarioItem.update({
      where: { id },
      data: { status: "NO_CUMPLIDA" },
    });

    return NextResponse.json({
      ok: true,
      message: "Marcada como no cumplida",
      item: updated,
    });
  } catch (err) {
    console.error("[BILL_DIARIO_NO_CUMPLIDA]", err);
    return NextResponse.json(
      { error: "Error al marcar item como no cumplida" },
      { status: 500 }
    );
  }
}
