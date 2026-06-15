import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  const body = await req.json();
  const plan = await db.plan.update({ where: { id }, data: { professionalAlias: body.professionalAlias } });
  return NextResponse.json(plan);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  await db.plan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
