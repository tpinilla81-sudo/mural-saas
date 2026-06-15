import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  const sub = await db.subscription.findUnique({ where: { companyId: id } });
  if (!sub) return NextResponse.json({ error: "Sin suscripción" }, { status: 404 });
  return NextResponse.json(sub);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });
  const { id } = await params;
  const body = await req.json();
  const plan = body.planName || "BASIC";
  const maxPro = plan === "ENTERPRISE" ? 999 : plan === "PRO" ? 15 : 5;
  const maxSedes = plan === "ENTERPRISE" ? 999 : plan === "PRO" ? 10 : 3;
  const sub = await db.subscription.update({
    where: { companyId: id },
    data: {
      planName: plan,
      billingMethod: body.billingMethod,
      price: body.price,
      status: body.status,
      maxProfessionals: maxPro,
      maxSedes: maxSedes,
    },
  });
  return NextResponse.json(sub);
}
