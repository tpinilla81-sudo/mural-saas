import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;

  const avisos = await db.aviso.findMany({
    where: { companyId },
    include: { professional: true, sede: true },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(avisos);
}

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const body = await req.json();

  if (!body.date || !body.professionalId || !body.sedeId || !body.turn) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const aviso = await db.aviso.create({
    data: {
      companyId,
      date: body.date,
      professionalId: body.professionalId,
      sedeId: body.sedeId,
      turn: body.turn, // M or T
    },
  });

  return NextResponse.json(aviso, { status: 201 });
}
