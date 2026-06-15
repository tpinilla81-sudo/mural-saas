import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const pros = await db.professional.findMany({
    where: { companyId },
    orderBy: [{ firstName: "asc" }],
  });
  return NextResponse.json(pros);
}

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const body = await req.json();

  const pro = await db.professional.create({
    data: {
      companyId,
      firstName: body.firstName?.toUpperCase(),
      lastName: body.lastName?.toUpperCase(),
      alias: body.alias?.toUpperCase(),
      type: body.type || "USER",
      category: body.category?.toUpperCase(),
      username: body.username,
      email: body.email,
      phone: body.phone,
      permissions: body.permissions,
      assignedSedes: body.assignedSedes,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate || "INDEFINIDO",
    },
  });

  return NextResponse.json(pro, { status: 201 });
}
