import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });

  const [totalCompanies, activeSubs, totalRevenue, totalProfessionals, totalSedes] = await Promise.all([
    db.company.count(),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    db.professional.count(),
    db.sede.count(),
  ]);

  const paymentsByMethod = await db.payment.groupBy({
    by: ["method"],
    where: { status: "PAID" },
    _sum: { amount: true },
    _count: true,
  });

  const paymentsByPlan = await db.subscription.groupBy({
    by: ["planName"],
    _sum: { price: true },
    _count: true,
  });

  return NextResponse.json({
    totalCompanies,
    activeSubs,
    totalRevenue: totalRevenue._sum.amount || 0,
    totalProfessionals,
    totalSedes,
    paymentsByMethod,
    paymentsByPlan,
  });
}
