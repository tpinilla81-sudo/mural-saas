import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  const company = await db.company.findUnique({
    where: { id },
    include: { subscription: true, _count: { select: { users: true, sedes: true, professionals: true } } },
  });
  if (!company) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json(company);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  const body = await req.json();
  const company = await db.company.update({
    where: { id },
    data: {
      name: body.name,
      slug: body.slug,
      isActive: body.isActive,
      phone: body.phone,
      email: body.email,
      website: body.website,
      nif: body.nif,
      address: body.address,
      city: body.city,
      province: body.province,
      postalCode: body.postalCode,
      logoUrl: body.logoUrl,
    },
  });
  return NextResponse.json(company);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  await db.company.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
