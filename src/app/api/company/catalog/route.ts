import { NextResponse } from "next/server";
import { requireCompanyAdmin, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const items = await db.catalogItem.findMany({
    where: { companyId },
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const body = await req.json();

  const item = await db.catalogItem.create({
    data: {
      companyId,
      name: body.name,
      sedeId: body.sedeId || null,
      turn: body.turn || "MANANA",
      price: parseFloat(body.price) || 0,
      taxRate: parseFloat(body.taxRate) || 21,
      description: body.description || "",
      isActive: body.isActive !== false,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
