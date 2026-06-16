import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// Validate/unvalidate individual invoice lines
export async function PUT(req: Request) {
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const body = await req.json();

  // Validate a single line
  if (body.lineId) {
    const line = await db.invoiceLine.update({
      where: { id: body.lineId },
      data: { validated: body.validated },
    });
    return NextResponse.json(line);
  }

  // Validate all lines for an invoice
  if (body.invoiceId) {
    const updated = await db.invoiceLine.updateMany({
      where: { invoiceId: body.invoiceId },
      data: { validated: body.validated !== false },
    });
    return NextResponse.json({ updated: updated.count });
  }

  // Bulk validate by professional + date range
  if (body.professionalAlias && body.dateFrom && body.dateTo) {
    // Find all DRAFT invoices for this pro in range
    const invoices = await db.invoice.findMany({
      where: {
        professionalAlias: body.professionalAlias,
        status: "DRAFT",
      },
      include: { lines: true },
    });

    let totalUpdated = 0;
    for (const inv of invoices) {
      const result = await db.invoiceLine.updateMany({
        where: {
          invoiceId: inv.id,
          date: { gte: body.dateFrom, lte: body.dateTo },
        },
        data: { validated: body.validated !== false },
      });
      totalUpdated += result.count;
    }

    return NextResponse.json({ updated: totalUpdated });
  }

  return NextResponse.json({ error: "Parámetros insuficientes" }, { status: 400 });
}
