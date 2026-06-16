import { NextResponse } from "next/server";
import { requireCompanyAdmin, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const url = new URL(req.url);
  const proAlias = url.searchParams.get("professional");
  const invStatus = url.searchParams.get("status");

  const where: any = { companyId };
  if (proAlias) where.professionalAlias = proAlias;
  if (invStatus) where.status = invStatus;

  const invoices = await db.invoice.findMany({
    where,
    include: { lines: { orderBy: { date: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invoices);
}
