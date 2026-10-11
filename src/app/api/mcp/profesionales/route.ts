import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

// GET /api/mcp/profesionales — lista de profesionales de la empresa.
export async function GET() {
  const { error, status, companyId } = await requireApiKey("read");
  if (error) return NextResponse.json({ error }, { status });
  const pros = await db.professional.findMany({
    where: { companyId },
    orderBy: { alias: "asc" },
    select: { id: true, alias: true, firstName: true, lastName: true, type: true, category: true, assignedSedes: true },
  });
  return NextResponse.json(pros);
}
