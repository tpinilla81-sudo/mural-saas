import { NextResponse } from "next/server";
import { requireCompanyAdmin, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") || new Date().getFullYear().toString());
  const month = parseInt(url.searchParams.get("month") || new Date().getMonth().toString());

  const m = (month + 1).toString().padStart(2, "0");
  const datePrefix = `${year}-${m}`;

  const [plans, sedes, professionals, holidays] = await Promise.all([
    db.plan.findMany({ where: { companyId, date: { startsWith: datePrefix } }, include: { sede: true } }),
    db.sede.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    db.professional.findMany({ where: { companyId }, orderBy: { firstName: "asc" } }),
    db.holiday.findMany({ where: { companyId } }),
  ]);

  return NextResponse.json({ plans, sedes, professionals, holidays });
}
