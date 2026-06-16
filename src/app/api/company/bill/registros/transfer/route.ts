import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── POST /api/company/bill/registros/transfer ──
// Transfer registros from Entrada to Registros (set pasadoRegistro=true).
// Body options:
//   { ids: string[] }            → transfer specific registros by ID
//   {} (no ids)                  → transfer ALL un-transferred registros
//   ?before=YYYY-MM-DD           → only transfer registros with fecha <= before (when no ids)
export async function POST(req: NextRequest) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const ids: string[] | undefined = body.ids;

    if (ids && ids.length > 0) {
      // Transfer specific registros by ID
      const result = await db.billRegistro.updateMany({
        where: { id: { in: ids }, companyId, pasadoRegistro: false },
        data: { pasadoRegistro: true },
      });
      return NextResponse.json({
        transferred: result.count,
        message: `${result.count} registro(s) transferido(s) correctamente`,
      });
    }

    // Transfer all un-transferred registros
    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before") ?? undefined;

    const where: Record<string, unknown> = {
      companyId,
      pasadoRegistro: false,
    };

    if (before) {
      where.fecha = { lte: before };
    }

    const result = await db.billRegistro.updateMany({
      where,
      data: { pasadoRegistro: true },
    });

    return NextResponse.json({
      transferred: result.count,
      message: `${result.count} registro(s) transferido(s) correctamente`,
    });
  } catch (err) {
    console.error("[BILL_REGISTROS_TRANSFER_POST]", err);
    return NextResponse.json(
      { error: "Error al transferir registros" },
      { status: 500 }
    );
  }
}
