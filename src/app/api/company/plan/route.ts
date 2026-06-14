import { NextResponse } from "next/server";
import { requireCompanyAdmin, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") || new Date().getFullYear().toString());
  const month = url.searchParams.get("month");

  let where: any = { companyId };
  if (year) {
    where.date = { startsWith: year.toString() };
  }
  if (month) {
    const m = (parseInt(month) + 1).toString().padStart(2, "0");
    where.date = { startsWith: `${year}-${m}` };
  }

  const plans = await db.plan.findMany({
    where,
    include: { sede: true },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(plans);
}

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const body = await req.json();

  try {
    const plan = await db.plan.create({
      data: {
        companyId,
        sedeId: body.sedeId,
        date: body.date,
        turn: body.turn,
        professionalAlias: body.professionalAlias,
      },
    });
    return NextResponse.json(plan, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      // Unique constraint - upsert instead
      const plan = await db.plan.update({
        where: { sedeId_date_turn: { sedeId: body.sedeId, date: body.date, turn: body.turn } },
        data: { professionalAlias: body.professionalAlias },
      });
      return NextResponse.json(plan);
    }
    throw e;
  }
}
