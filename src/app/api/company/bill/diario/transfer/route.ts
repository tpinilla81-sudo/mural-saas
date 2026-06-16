import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── POST /api/company/bill/diario/transfer ──
// Transfers selected BillDiarioItems (status=CUMPLIDA) into BillRegistros
// (pasadoRegistro=true, ready for invoicing in REGISTROS view).
//
// Body: { ids: string[] }
// For each item:
//   - If item has líneas: creates one BillRegistro per línea (with the line's c1/c2/cant/precio)
//   - If item has no líneas: falls back to creating one BillRegistro with the item's c1/c2/cant/precio
//   - Marks the BillDiarioItem as status=FACTURADA, sets registroId (first one) and facturadoAt
//   - Idempotent: items already in FACTURADA status are skipped
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
      include: {
        lineas: {
          orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    let transferred = 0;
    let skipped = 0;
    let notCumplida = 0;
    let registrosCreated = 0;
    const created: { itemId: string; registroIds: string[] }[] = [];

    for (const item of items) {
      if (item.status === "FACTURADA") {
        skipped++;
        continue;
      }
      // Only CUMPLIDA items can be transferred to facturación
      if (item.status !== "CUMPLIDA") {
        notCumplida++;
        continue;
      }

      const registroIds: string[] = [];

      // Determine the source lines for registros
      const lineasToTransfer =
        item.lineas.length > 0
          ? item.lineas.map((l) => ({
              c1: l.c1,
              c2: l.c2,
              cant: l.cant,
              precioUnitario: l.precioUnitario,
              obs: l.obs,
            }))
          : [
              {
                c1: item.c1,
                c2: item.c2,
                cant: item.cant,
                precioUnitario: item.precioUnitario,
                obs: item.obs,
              },
            ];

      for (const line of lineasToTransfer) {
        const registro = await db.billRegistro.create({
          data: {
            companyId,
            fecha: item.fecha,
            clienteId: item.clienteId,
            cliente: item.cliente,
            c1: line.c1,
            c2: line.c2,
            cant: line.cant,
            precioUnitario: line.precioUnitario,
            obs: line.obs,
            pasadoRegistro: true,
            facturado: false,
          },
        });
        registroIds.push(registro.id);
        registrosCreated++;
      }

      // Mark the diario item as transferred (store first registro id as back-ref)
      await db.billDiarioItem.update({
        where: { id: item.id },
        data: {
          status: "FACTURADA",
          registroId: registroIds[0] ?? null,
          facturadoAt: new Date(),
        },
      });

      created.push({ itemId: item.id, registroIds });
      transferred++;
    }

    return NextResponse.json({
      transferred,
      skipped,
      notCumplida,
      total: items.length,
      registrosCreated,
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
