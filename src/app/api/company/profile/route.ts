import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      subscription: {
        select: {
          planName: true,
          status: true,
          billingMethod: true,
          price: true,
        },
      },
    },
  });

  if (!company) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  return NextResponse.json(company);
}

export async function PUT(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const body = await req.json();

  const updated = await db.company.update({
    where: { id: companyId },
    data: {
      name: body.name,
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
    include: {
      subscription: {
        select: {
          planName: true,
          status: true,
          billingMethod: true,
          price: true,
        },
      },
    },
  });

  return NextResponse.json(updated);
}
