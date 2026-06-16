import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const { error, status, user } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });

  const companies = await db.company.findMany({
    include: {
      subscription: true,
      _count: { select: { users: true, sedes: true, professionals: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(companies);
}

export async function POST(req: Request) {
  const { error, status, user } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });

  const body = await req.json();
  const { name, slug, planName, billingMethod, price } = body;

  if (!name || !slug) return NextResponse.json({ error: "Nombre y slug requeridos" }, { status: 400 });

  const existing = await db.company.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "Slug ya existe" }, { status: 400 });

  const plan = planName || "BASIC";
  const maxPro = plan === "ENTERPRISE" ? 999 : plan === "PRO" ? 15 : 5;
  const maxSedes = plan === "ENTERPRISE" ? 999 : plan === "PRO" ? 10 : 3;

  const company = await db.company.create({
    data: {
      name,
      slug,
      phone: body.phone || "",
      email: body.email || "",
      website: body.website || "",
      nif: body.nif || "",
      address: body.address || "",
      city: body.city || "",
      province: body.province || "",
      postalCode: body.postalCode || "",
      logoUrl: body.logoUrl || "",
      subscription: {
        create: {
          planName: plan,
          billingMethod: billingMethod || "MONTHLY",
          price: price || (plan === "ENTERPRISE" ? 199.99 : plan === "PRO" ? 79.99 : 29.99),
          status: "TRIAL",
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          maxProfessionals: maxPro,
          maxSedes: maxSedes,
        },
      },
    },
    include: { subscription: true },
  });

  return NextResponse.json(company, { status: 201 });
}
