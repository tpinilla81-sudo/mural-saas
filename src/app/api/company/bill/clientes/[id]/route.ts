import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const { id } = await params;
  const body = await req.json();

  const existing = await db.billCliente.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const updated = await db.billCliente.update({
    where: { id },
    data: {
      nombre: body.nombre ?? existing.nombre,
      cif: body.cif ?? existing.cif,
      dir: body.dir ?? existing.dir,
      cp: body.cp ?? existing.cp,
      ciudad: body.ciudad ?? existing.ciudad,
      prov: body.prov ?? existing.prov,
      mail: body.mail ?? existing.mail,
      tel: body.tel ?? existing.tel,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const { id } = await params;

  const existing = await db.billCliente.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.billCliente.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
