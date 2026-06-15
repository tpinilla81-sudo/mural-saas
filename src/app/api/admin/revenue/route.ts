import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });

  try {
    // Total revenue
    const totalRevenue = await db.payment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
      _count: true,
    });

    // Pending revenue
    const pendingRevenue = await db.payment.aggregate({
      where: { status: { in: ["PENDING", "OVERDUE"] } },
      _sum: { amount: true },
      _count: true,
    });

    // Fetch all paid payments for monthly grouping
    const paidPayments = await db.payment.findMany({
      where: { status: "PAID", paidAt: { not: null } },
      select: { amount: true, method: true, paidAt: true },
    });

    // Group by month in JavaScript (last 12 months)
    const now = new Date();
    const monthlyRevenue = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const monthPayments = paidPayments.filter((p) => {
        if (!p.paidAt) return false;
        const d = new Date(p.paidAt);
        return d >= monthStart && d <= monthEnd;
      });

      const total = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const byMethod: Record<string, number> = {};
      monthPayments.forEach((p) => {
        byMethod[p.method] = (byMethod[p.method] || 0) + (p.amount || 0);
      });

      monthlyRevenue.push({
        month: monthStart.toISOString().slice(0, 7),
        label: monthStart.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
        total: Math.round(total * 100) / 100,
        count: monthPayments.length,
        byMethod,
      });
    }

    // Revenue by payment method
    const revenueByMethod = await db.payment.groupBy({
      by: ["method"],
      where: { status: "PAID" },
      _sum: { amount: true },
      _count: true,
    });

    // Revenue by plan
    const subscriptions = await db.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIAL"] } },
      select: { planName: true, billingMethod: true, price: true },
    });

    const revenueByPlan: Record<string, { count: number; mrr: number }> = {};
    subscriptions.forEach((s) => {
      if (!revenueByPlan[s.planName]) revenueByPlan[s.planName] = { count: 0, mrr: 0 };
      revenueByPlan[s.planName].count++;
      let monthly = s.price;
      if (s.billingMethod === "QUARTERLY") monthly = s.price / 3;
      if (s.billingMethod === "ANNUAL") monthly = s.price / 12;
      revenueByPlan[s.planName].mrr += monthly;
    });

    // Overdue payments
    const overduePayments = await db.payment.findMany({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { lt: now },
      },
      include: { subscription: { include: { company: true } } },
      orderBy: { dueDate: "asc" },
    });

    // MRR & ARR
    const mrr = Object.values(revenueByPlan).reduce((sum, p) => sum + p.mrr, 0);
    const arr = mrr * 12;

    return NextResponse.json({
      totalRevenue: totalRevenue._sum.amount || 0,
      totalPaidCount: totalRevenue._count,
      pendingRevenue: pendingRevenue._sum.amount || 0,
      pendingCount: pendingRevenue._count,
      monthlyRevenue,
      revenueByMethod,
      revenueByPlan,
      overduePayments,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
    });
  } catch (e: any) {
    console.error("Revenue API error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
