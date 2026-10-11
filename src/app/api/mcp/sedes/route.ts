import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

// GET /api/mcp/sedes — lista de sedes de la empresa.
export async function GET() {
  const { error, status, companyId } = await requireApiKey("read");
  if (error) return NextResponse.json({ error }, { status });
  const sedes = await db.sede.findMany({
    where: { companyId },
    orderBy: { order: "asc" },
    select: { id: true, name: true, city: true, province: true, task: true, color: true, morningEnabled: true, afternoonEnabled: true },
  });
  return NextResponse.json(sedes);
}
