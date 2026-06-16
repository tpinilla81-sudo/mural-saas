import { NextResponse } from "next/server";
import { requireCompanyAdmin, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

// Generate invoice(s) from validated plans
export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const body = await req.json();

  const type = body.type || "MONTHLY"; // MONTHLY | DAILY
  const professionalAlias = body.professionalAlias;
  const year = body.year || new Date().getFullYear();
  const month = body.month !== undefined ? body.month : new Date().getMonth();
  const dateFrom = body.dateFrom; // for DAILY type
  const dateTo = body.dateTo;

  if (!professionalAlias) {
    return NextResponse.json({ error: "Especifica un profesional" }, { status: 400 });
  }

  // Determine date range
  let periodStart: string;
  let periodEnd: string;

  if (type === "DAILY" && dateFrom && dateTo) {
    periodStart = dateFrom;
    periodEnd = dateTo;
  } else {
    periodStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    periodEnd = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;
  }

  // Get plans for this professional in this period
  const plans = await db.plan.findMany({
    where: {
      companyId,
      professionalAlias,
      date: { gte: periodStart, lte: periodEnd },
    },
    include: { sede: true },
    orderBy: { date: "asc" },
  });

  if (plans.length === 0) {
    return NextResponse.json({ error: "No hay turnos para este profesional en el período" }, { status: 400 });
  }

  // Get catalog items for matching
  const catalog = await db.catalogItem.findMany({
    where: { companyId, isActive: true },
  });

  // Generate invoice number: FAC-2026-0001
  const existingCount = await db.invoice.count({
    where: { companyId, invoiceNumber: { startsWith: `FAC-${year}-` } },
  });
  const invoiceNumber = `FAC-${year}-${String(existingCount + 1).padStart(4, "0")}`;

  // Match each plan to a catalog item
  const lines: Array<{
    date: string;
    sedeId: string;
    sedeName: string;
    turn: string;
    catalogItemId: string | null;
    concept: string;
    unitPrice: number;
    taxRate: number;
    lineTotal: number;
  }> = [];

  for (const plan of plans) {
    // Find matching catalog item by sedeId + turn
    const catalogMatch = catalog.find(
      c => c.sedeId === plan.sedeId && c.turn === plan.turn
    );

    // Or fallback: match by sede name pattern
    const catalogFallback = !catalogMatch
      ? catalog.find(c => {
          if (!c.sedeId && c.name) {
            const sedeName = plan.sede?.name || "";
            const task = plan.sede?.task || "";
            return c.name.includes(sedeName) || c.name.includes(task);
          }
          return false;
        })
      : null;

    const match = catalogMatch || catalogFallback;
    const unitPrice = match ? match.price : 0;
    const taxRate = match ? match.taxRate : 21;
    const sedeName = `${plan.sede?.name || ""} / ${plan.sede?.task || ""}`.trim();
    const concept = match ? match.name : `${sedeName} · ${plan.turn === "MANANA" ? "Mañana" : "Tarde"}`;

    lines.push({
      date: plan.date,
      sedeId: plan.sedeId,
      sedeName,
      turn: plan.turn,
      catalogItemId: match?.id || null,
      concept,
      unitPrice,
      taxRate,
      lineTotal: unitPrice, // quantity = 1
    });
  }

  // Calculate totals
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const avgTaxRate = lines.length > 0 ? lines.reduce((sum, l) => sum + l.taxRate, 0) / lines.length : 21;
  const taxAmount = Math.round(subtotal * (avgTaxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  // Create invoice with lines
  const invoice = await db.invoice.create({
    data: {
      companyId,
      professionalAlias,
      invoiceNumber,
      type,
      status: "DRAFT",
      periodStart,
      periodEnd,
      subtotal,
      taxRate: avgTaxRate,
      taxAmount,
      total,
      lines: {
        create: lines.map(l => ({
          date: l.date,
          sedeId: l.sedeId,
          sedeName: l.sedeName,
          turn: l.turn,
          catalogItemId: l.catalogItemId,
          concept: l.concept,
          quantity: 1,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
          lineTotal: l.lineTotal,
          validated: false,
        })),
      },
    },
    include: { lines: true },
  });

  return NextResponse.json(invoice, { status: 201 });
}
