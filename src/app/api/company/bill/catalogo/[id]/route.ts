import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const { id } = await params;
  const body = await req.json();

  const existing = await db.billCatalogo.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const coste = body.coste !== undefined ? parseFloat(body.coste) : existing.coste;
  const inc = body.inc !== undefined ? parseFloat(body.inc) : existing.inc;
  const final = coste * (1 + inc / 100);

  const updated = await db.billCatalogo.update({
    where: { id },
    data: {
      clienteId: body.clienteId !== undefined ? (body.clienteId || null) : existing.clienteId,
      c1: body.c1 ?? existing.c1,
      c2: body.c2 ?? existing.c2,
      coste,
      inc,
      final,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const { id } = await params;

  const existing = await db.billCatalogo.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.billCatalogo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
