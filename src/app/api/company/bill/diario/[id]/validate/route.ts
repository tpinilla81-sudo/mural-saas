import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── POST /api/company/bill/diario/[id]/validate ──
// Validates a PENDIENTE salida as cumplida.
// Side effects:
//   - Changes item.status from PENDIENTE → CUMPLIDA
//   - Creates 1 default línea as a reference, based on the item's turn:
//     * MANANA → c1="Servicios", c2="Mañana"
//     * TARDE  → c1="Servicios", c2="Tarde"
//   - The línea's precioUnitario is auto-resolved from BillCatalogo
//     (client-specific first, then generic). If no catalog match, price=0.
//   - The línea's obs is the professional name + turn label.
// Idempotent: if the item is already CUMPLIDA, returns 200 with the existing lineas.
//   - FACTURADA items cannot be re-validated.
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
      include: { lineas: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }

    // Already validated
    if (item.status === "CUMPLIDA") {
      return NextResponse.json({
        ok: true,
        message: "Ya estaba validada",
        item,
      });
    }

    // Cannot validate an already-factured item
    if (item.status === "FACTURADA") {
      return NextResponse.json(
        { error: "El item ya está facturado" },
        { status: 400 }
      );
    }

    // Determine the default línea based on turn
    const c1 = "Servicios";
    const c2 = item.turn === "MANANA" ? "Mañana" : item.turn === "TARDE" ? "Tarde" : "";

    // Look up price from catalog (client-specific first, then generic)
    let precioUnitario = 0;
    let catalogoId: string | null = null;
    if (c2) {
      const clientItem = item.clienteId
        ? await db.billCatalogo.findFirst({
            where: { companyId, clienteId: item.clienteId, c1, c2 },
            select: { id: true, final: true },
          })
        : null;
      if (clientItem) {
        precioUnitario = clientItem.final;
        catalogoId = clientItem.id;
      } else {
        const generic = await db.billCatalogo.findFirst({
          where: { companyId, clienteId: null, c1, c2 },
          select: { id: true, final: true },
        });
        if (generic) {
          precioUnitario = generic.final;
          catalogoId = generic.id;
        }
      }
    }

    // Update status + create the default línea in a transaction
    const updated = await db.$transaction(async (tx) => {
      // If the item already has lineas (e.g., from a previous partial validation),
      // don't add another default — just bump the status.
      if ((item.lineas?.length ?? 0) === 0 && c2) {
        await tx.billDiarioLine.create({
          data: {
            diarioItemId: id,
            companyId,
            catalogoId,
            c1,
            c2,
            cant: 1,
            precioUnitario,
            obs: `${item.professionalName} — ${item.turn === "MANANA" ? "Mañana" : "Tarde"}`,
            orden: 0,
          },
        });
      }
      return tx.billDiarioItem.update({
        where: { id },
        data: { status: "CUMPLIDA" },
        include: { lineas: { orderBy: [{ orden: "asc" }, { createdAt: "asc" }] } },
      });
    });

    return NextResponse.json({
      ok: true,
      message: "Validada — línea de referencia añadida",
      item: updated,
    });
  } catch (err) {
    console.error("[BILL_DIARIO_VALIDATE]", err);
    return NextResponse.json(
      { error: "Error al validar item de diario" },
      { status: 500 }
    );
  }
}
