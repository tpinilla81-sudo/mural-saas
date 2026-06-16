import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { date: "asc" } } },
  });

  if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const body = await req.json();

  try {
    // If marking as ISSUED
    if (body.action === "issue") {
      // First validate all lines are validated
      const invoice = await db.invoice.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

      const unvalidated = invoice.lines.filter(l => !l.validated);
      if (unvalidated.length > 0) {
        return NextResponse.json({ error: `Hay ${unvalidated.length} líneas sin validar` }, { status: 400 });
      }

      // Recalculate totals from validated lines
      const subtotal = invoice.lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const taxRate = invoice.taxRate;
      const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const total = Math.round((subtotal + taxAmount) * 100) / 100;

      const updated = await db.invoice.update({
        where: { id },
        data: {
          status: "ISSUED",
          issuedAt: new Date(),
          subtotal,
          taxAmount,
          total,
        },
        include: { lines: true },
      });
      return NextResponse.json(updated);
    }

    // If marking as PAID
    if (body.action === "pay") {
      const updated = await db.invoice.update({
        where: { id },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
        include: { lines: true },
      });
      return NextResponse.json(updated);
    }

    // If cancelling
    if (body.action === "cancel") {
      const updated = await db.invoice.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: { lines: true },
      });
      return NextResponse.json(updated);
    }

    // Generic update
    const updated = await db.invoice.update({
      where: { id },
      data: {
        notes: body.notes,
        taxRate: body.taxRate !== undefined ? parseFloat(body.taxRate) : undefined,
      },
      include: { lines: true },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;

  try {
    // Only allow deleting DRAFT invoices
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    if (invoice.status !== "DRAFT") {
      return NextResponse.json({ error: "Solo se pueden eliminar facturas en borrador" }, { status: 400 });
    }

    await db.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await db.invoice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
