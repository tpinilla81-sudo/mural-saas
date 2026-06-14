import { NextResponse } from "next/server";
import { requireCompanyAdmin, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  const body = await req.json();
  const sede = await db.sede.update({ where: { id }, data: body });
  return NextResponse.json(sede);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  await db.sede.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
