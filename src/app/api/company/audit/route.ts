import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

/** GET: últimos 150 eventos de auditoría de la empresa */
export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const rows = await db.auditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  return NextResponse.json(rows);
}
