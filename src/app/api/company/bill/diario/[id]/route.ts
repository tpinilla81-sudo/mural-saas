import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── PUT /api/company/bill/diario/[id] ──
// Update an existing diario item (e.g., edit price, cliente, c1/c2, obs)
export async function PUT(
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
    const existing = await db.billDiarioItem.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Item no encontrado" },
        { status: 404 }
      );
    }

    const body = await req.json();

    // Validate clienteId ownership if provided
    const clienteId =
      body.clienteId !== undefined
        ? body.clienteId
          ? String(body.clienteId)
          : null
        : existing.clienteId;
    if (clienteId) {
      const exists = await db.billCliente.findFirst({
        where: { id: clienteId, companyId },
      });
      if (!exists) {
        return NextResponse.json(
          { error: "clienteId no pertenece a la empresa" },
          { status: 400 }
        );
      }
    }

    // Resolve cliente name
    let clienteName = existing.cliente;
    if (body.clienteId !== undefined) {
      if (clienteId) {
        const c = await db.billCliente.findFirst({
          where: { id: clienteId, companyId },
          select: { nombre: true },
        });
        clienteName = c?.nombre ?? "";
      } else {
        clienteName = "";
      }
    }

    const updated = await db.billDiarioItem.update({
      where: { id },
      data: {
        fecha: body.fecha !== undefined ? String(body.fecha) : existing.fecha,
        sedeId:
          body.sedeId !== undefined
            ? body.sedeId
              ? String(body.sedeId)
              : null
            : existing.sedeId,
        sedeName:
          body.sedeName !== undefined ? String(body.sedeName) : existing.sedeName,
        professionalId:
          body.professionalId !== undefined
            ? body.professionalId
              ? String(body.professionalId)
              : null
            : existing.professionalId,
        professionalName:
          body.professionalName !== undefined
            ? String(body.professionalName)
            : existing.professionalName,
        turn: body.turn !== undefined ? String(body.turn) : existing.turn,
        clienteId,
        cliente: clienteName,
        c1: body.c1 !== undefined ? String(body.c1) : existing.c1,
        c2: body.c2 !== undefined ? String(body.c2) : existing.c2,
        cant: body.cant !== undefined ? Number(body.cant) : existing.cant,
        precioUnitario:
          body.precioUnitario !== undefined
            ? Number(body.precioUnitario)
            : existing.precioUnitario,
        obs: body.obs !== undefined ? String(body.obs) : existing.obs,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[BILL_DIARIO_PUT]", err);
    return NextResponse.json(
      { error: "Error al actualizar item de diario" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/company/bill/diario/[id] ──
export async function DELETE(
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
    const existing = await db.billDiarioItem.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Item no encontrado" },
        { status: 404 }
      );
    }

    await db.billDiarioItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[BILL_DIARIO_DELETE]", err);
    return NextResponse.json(
      { error: "Error al eliminar item de diario" },
      { status: 500 }
    );
  }
}
