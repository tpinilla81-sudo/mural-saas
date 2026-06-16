import { NextResponse } from "next/server";
import { requireCompanyAdmin, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const body = await req.json();

  try {
    const item = await db.catalogItem.update({
      where: { id },
      data: {
        name: body.name,
        sedeId: body.sedeId || null,
        turn: body.turn,
        price: body.price !== undefined ? parseFloat(body.price) : undefined,
        taxRate: body.taxRate !== undefined ? parseFloat(body.taxRate) : undefined,
        description: body.description,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
      },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "Concepto no encontrado" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;

  try {
    await db.catalogItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Concepto no encontrado" }, { status: 404 });
  }
}
