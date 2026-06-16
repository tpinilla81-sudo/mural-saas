import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── POST /api/company/bill/diario/transfer ──
// Transfers selected BillDiarioItems (status=CUMPLIDA) into BillRegistros
// (pasadoRegistro=true, ready for invoicing in REGISTROS view).
//
// Body: { ids: string[] }
// - For each item, creates a BillRegistro with the same fecha/cliente/c1/c2/cant/precioUnitario/obs
// - Marks the BillDiarioItem as status=FACTURADA, sets registroId and facturadoAt
// - Idempotent: items already in FACTURADA status are skipped
// - Items without a clienteId will still be transferred (cliente name only)
export async function POST(req: NextRequest) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Se requiere al menos un id" },
        { status: 400 }
      );
    }

    const items = await db.billDiarioItem.findMany({
      where: { id: { in: ids }, companyId },
    });

    let transferred = 0;
    let skipped = 0;
    const created: { itemId: string; registroId: string }[] = [];

    for (const item of items) {
      if (item.status === "FACTURADA" && item.registroId) {
        skipped++;
        continue;
      }

      // Create the BillRegistro (pasadoRegistro=true so it appears in REGISTROS, not ENTRADA)
      const registro = await db.billRegistro.create({
        data: {
          companyId,
          fecha: item.fecha,
          clienteId: item.clienteId,
          cliente: item.cliente,
          c1: item.c1,
          c2: item.c2,
          cant: item.cant,
          precioUnitario: item.precioUnitario,
          obs: item.obs,
          pasadoRegistro: true,
          facturado: false,
        },
      });

      // Mark the diario item as transferred
      await db.billDiarioItem.update({
        where: { id: item.id },
        data: {
          status: "FACTURADA",
          registroId: registro.id,
          facturadoAt: new Date(),
        },
      });

      created.push({ itemId: item.id, registroId: registro.id });
      transferred++;
    }

    return NextResponse.json({
      transferred,
      skipped,
      total: items.length,
      items: created,
    });
  } catch (err) {
    console.error("[BILL_DIARIO_TRANSFER]", err);
    return NextResponse.json(
      { error: "Error al transferir items a facturación" },
      { status: 500 }
    );
  }
}
