import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const body = await req.json();

  // Editable fields: note (and optionally reason)
  const data: { note?: string; reason?: string } = {};
  if (typeof body.note === "string") data.note = body.note;
  if (typeof body.reason === "string") data.reason = body.reason;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const aviso = await db.aviso.update({ where: { id }, data });
  return NextResponse.json(aviso);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  await db.aviso.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
