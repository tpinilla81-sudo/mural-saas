import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });

  const payments = await db.payment.findMany({
    include: { subscription: { include: { company: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(payments);
}

export async function POST(req: Request) {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });

  const body = await req.json();
  const payment = await db.payment.create({
    data: {
      subscriptionId: body.subscriptionId,
      companyId: body.companyId,
      amount: body.amount,
      currency: body.currency || "EUR",
      status: body.status || "PENDING",
      dueDate: new Date(body.dueDate),
      method: body.method || "CARD",
      invoiceNumber: body.invoiceNumber,
      notes: body.notes,
    },
  });

  return NextResponse.json(payment, { status: 201 });
}
