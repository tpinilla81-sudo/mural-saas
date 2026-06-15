import { NextResponse } from "next/server";
import { requireCompanyAdmin, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.role === "SUPER_ADMIN" 
    ? undefined 
    : user!.companyId;

  if (!companyId) {
    // Super admin: return all or filtered
    const sedes = await db.sede.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(sedes);
  }

  const sedes = await db.sede.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(sedes);
}

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const body = await req.json();

  const sede = await db.sede.create({
    data: {
      companyId,
      name: body.name?.toUpperCase(),
      city: body.city?.toUpperCase(),
      province: body.province?.toUpperCase(),
      task: body.task,
      email: body.email,
      phone: body.phone,
      morningEnabled: body.morningEnabled ?? true,
      afternoonEnabled: body.afternoonEnabled ?? true,
      color: body.color || "#3b82f6",
    },
  });

  return NextResponse.json(sede, { status: 201 });
}
