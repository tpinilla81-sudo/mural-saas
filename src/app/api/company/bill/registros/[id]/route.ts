import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const { id } = await params;
  const body = await req.json();

  const existing = await db.billRegistro.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const updated = await db.billRegistro.update({
    where: { id },
    data: {
      fecha: body.fecha ?? existing.fecha,
      clienteId: body.clienteId !== undefined ? (body.clienteId || null) : existing.clienteId,
      cliente: body.cliente ?? existing.cliente,
      c1: body.c1 ?? existing.c1,
      c2: body.c2 ?? existing.c2,
      cant: body.cant !== undefined ? parseInt(body.cant) : existing.cant,
      precioUnitario: body.precioUnitario !== undefined ? parseFloat(body.precioUnitario) : existing.precioUnitario,
      obs: body.obs ?? existing.obs,
      pasadoRegistro: body.pasadoRegistro !== undefined ? body.pasadoRegistro : existing.pasadoRegistro,
      facturado: body.facturado !== undefined ? body.facturado : existing.facturado,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const { id } = await params;

  const existing = await db.billRegistro.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.billRegistro.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
