import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const url = new URL(req.url);
  const province = url.searchParams.get("province");
  
  const holidays = await db.holiday.findMany({
    where: { companyId, ...(province ? { province } : {}) },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(holidays);
}

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const body = await req.json();

  const holiday = await db.holiday.create({
    data: { companyId, province: body.province?.toUpperCase(), date: body.date },
  });

  return NextResponse.json(holiday, { status: 201 });
}
