import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const { error, status, user } = await requireRole("COMPANY_ADMIN", "SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId;
  if (!companyId) return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });

  const [subscription, payments, professionals, sedes] = await Promise.all([
    db.subscription.findUnique({
      where: { companyId },
    }),
    db.payment.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    }),
    db.professional.count({ where: { companyId } }),
    db.sede.count({ where: { companyId } }),
  ]);

  const activeSubs = subscription?.status === "ACTIVE" || subscription?.status === "TRIAL";

  // Calculate next billing date
  let nextBillingDate: string | null = null;
  if (subscription) {
    const periodEnd = subscription.currentPeriodEnd;
    if (periodEnd) {
      nextBillingDate = new Date(periodEnd).toISOString().split("T")[0];
    }
  }

  // Calculate usage percentages
  const maxPro = subscription?.maxProfessionals || 5;
  const maxSedes = subscription?.maxSedes || 3;
  const proUsage = Math.round((professionals / maxPro) * 100);
  const sedeUsage = Math.round((sedes / maxSedes) * 100);

  // Revenue totals for company
  const paidPayments = payments.filter((p) => p.status === "PAID");
  const pendingPayments = payments.filter((p) => p.status === "PENDING" || p.status === "OVERDUE");
  const totalPaid = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPending = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return NextResponse.json({
    subscription,
    payments,
    usage: {
      professionals,
      sedes,
      maxProfessionals: maxPro,
      maxSedes: maxSedes,
      proUsage,
      sedeUsage,
    },
    billing: {
      totalPaid,
      totalPending,
      nextBillingDate,
      isActive: activeSubs,
    },
  });
}
