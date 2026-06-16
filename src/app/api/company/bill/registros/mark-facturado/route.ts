import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const body = await req.json();
  const ids: string[] = body.ids || [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No se proporcionaron IDs" }, { status: 400 });
  }

  const result = await db.billRegistro.updateMany({
    where: { id: { in: ids }, companyId },
    data: { facturado: true },
  });

  return NextResponse.json({ updated: result.count });
}
