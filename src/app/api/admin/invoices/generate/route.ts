import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });

  const body = await req.json();
  const { companyId, periodStart, periodEnd } = body;

  if (!companyId) return NextResponse.json({ error: "companyId requerido" }, { status: 400 });

  // Get the company's subscription
  const subscription = await db.subscription.findUnique({
    where: { companyId },
    include: { company: true },
  });

  if (!subscription) return NextResponse.json({ error: "Sin suscripción" }, { status: 404 });

  // Calculate billing amounts
  const subtotal = subscription.price;
  const taxRate = 21.0;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

  // Generate invoice number
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const countPayments = await db.payment.count({
    where: { companyId, createdAt: { gte: new Date(`${year}-01-01`) } },
  });
  const invoiceNumber = `INV-${year}-${String(countPayments + 1).padStart(3, "0")}`;

  // Determine due date based on billing method
  const startDate = periodStart ? new Date(periodStart) : new Date();
  let dueDate: Date;
  const billingMethod = subscription.billingMethod;

  if (billingMethod === "MONTHLY") {
    dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + 1);
  } else if (billingMethod === "QUARTERLY") {
    dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + 3);
  } else {
    dueDate = new Date(startDate);
    dueDate.setFullYear(dueDate.getFullYear() + 1);
  }

  const periodEndDate = periodEnd ? new Date(periodEnd) : dueDate;

  // Determine concept based on plan
  const planLabels: Record<string, string> = {
    BASIC: "Plan BASIC",
    PRO: "Plan PRO",
    ENTERPRISE: "Plan ENTERPRISE",
  };
  const billingLabels: Record<string, string> = {
    MONTHLY: "Mensual",
    QUARTERLY: "Trimestral",
    ANNUAL: "Anual",
  };
  const concept = `Suscripción ${billingLabels[billingMethod] || "Mensual"} - ${planLabels[subscription.planName] || subscription.planName}`;

  const payment = await db.payment.create({
    data: {
      subscriptionId: subscription.id,
      companyId,
      amount: totalAmount,
      currency: subscription.currency || "EUR",
      status: "PENDING",
      dueDate,
      method: "CARD",
      invoiceNumber,
      concept,
      taxRate,
      taxAmount,
      subtotal,
      periodStart: startDate,
      periodEnd: periodEndDate,
    },
    include: { subscription: { include: { company: true } } },
  });

  // Update subscription period
  await db.subscription.update({
    where: { companyId },
    data: {
      currentPeriodStart: startDate,
      currentPeriodEnd: periodEndDate,
    },
  });

  return NextResponse.json(payment, { status: 201 });
}

// Generate invoices for all active subscriptions
export async function GET() {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });

  const activeSubscriptions = await db.subscription.findMany({
    where: { status: { in: ["ACTIVE", "TRIAL"] } },
    include: { company: true },
  });

  const generated: any[] = [];
  const now = new Date();
  const year = now.getFullYear();

  for (const sub of activeSubscriptions) {
    // Check if there's already a pending invoice for this period
    const existingPending = await db.payment.findFirst({
      where: {
        companyId: sub.companyId,
        status: "PENDING",
        periodStart: sub.currentPeriodStart,
      },
    });

    if (existingPending) continue; // Skip if already has pending invoice

    const subtotal = sub.price;
    const taxRate = 21.0;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    const countPayments = await db.payment.count({
      where: { companyId: sub.companyId, createdAt: { gte: new Date(`${year}-01-01`) } },
    });
    const invoiceNumber = `INV-${year}-${String(countPayments + 1).padStart(3, "0")}`;

    let dueDate: Date;
    if (sub.billingMethod === "MONTHLY") {
      dueDate = new Date(sub.currentPeriodEnd);
      dueDate.setMonth(dueDate.getMonth() + 1);
    } else if (sub.billingMethod === "QUARTERLY") {
      dueDate = new Date(sub.currentPeriodEnd);
      dueDate.setMonth(dueDate.getMonth() + 3);
    } else {
      dueDate = new Date(sub.currentPeriodEnd);
      dueDate.setFullYear(dueDate.getFullYear() + 1);
    }

    const planLabels: Record<string, string> = { BASIC: "Plan BASIC", PRO: "Plan PRO", ENTERPRISE: "Plan ENTERPRISE" };
    const billingLabels: Record<string, string> = { MONTHLY: "Mensual", QUARTERLY: "Trimestral", ANNUAL: "Anual" };

    const payment = await db.payment.create({
      data: {
        subscriptionId: sub.id,
        companyId: sub.companyId,
        amount: totalAmount,
        currency: sub.currency || "EUR",
        status: "PENDING",
        dueDate,
        method: "CARD",
        invoiceNumber,
        concept: `Suscripción ${billingLabels[sub.billingMethod] || "Mensual"} - ${planLabels[sub.planName] || sub.planName}`,
        taxRate,
        taxAmount,
        subtotal,
        periodStart: sub.currentPeriodEnd,
        periodEnd: dueDate,
      },
    });

    generated.push(payment);
  }

  return NextResponse.json({ generated: generated.length, invoices: generated });
}
