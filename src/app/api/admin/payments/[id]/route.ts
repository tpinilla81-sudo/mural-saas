import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const payment = await db.payment.findUnique({
    where: { id },
    include: { subscription: { include: { company: true } } },
  });

  if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  return NextResponse.json(payment);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const body = await req.json();

  const updateData: any = {};

  if (body.status) updateData.status = body.status;
  if (body.method) updateData.method = body.method;
  if (body.amount !== undefined) updateData.amount = body.amount;
  if (body.concept) updateData.concept = body.concept;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.invoiceNumber) updateData.invoiceNumber = body.invoiceNumber;

  // Calculate tax if subtotal provided
  if (body.subtotal !== undefined) {
    const taxRate = body.taxRate ?? 21.0;
    updateData.subtotal = body.subtotal;
    updateData.taxRate = taxRate;
    updateData.taxAmount = Math.round(body.subtotal * (taxRate / 100) * 100) / 100;
    updateData.amount = Math.round((body.subtotal + updateData.taxAmount) * 100) / 100;
  }

  // If marking as paid, set paidAt
  if (body.status === "PAID") {
    updateData.paidAt = new Date();
    updateData.paymentDate = new Date();
  }

  const payment = await db.payment.update({
    where: { id },
    data: updateData,
    include: { subscription: { include: { company: true } } },
  });

  return NextResponse.json(payment);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireRole("SUPER_ADMIN");
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  await db.payment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
