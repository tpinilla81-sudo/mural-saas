import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── GET /api/company/bill/factura-seq ──
// Return the current factura sequence for the company. Auto-create with seq=1 if missing.
export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    let seq = await db.billFacturaSeq.findUnique({
      where: { companyId },
    });

    // Auto-create if missing
    if (!seq) {
      seq = await db.billFacturaSeq.create({
        data: { companyId, seq: 1 },
      });
    }

    return NextResponse.json(seq);
  } catch (err) {
    console.error("[BILL_FACTURA_SEQ_GET]", err);
    return NextResponse.json(
      { error: "Error al obtener secuencia de factura" },
      { status: 500 }
    );
  }
}

// ── PUT /api/company/bill/factura-seq ──
// Upsert the factura sequence number for the company.
// Body: { seq: number }
export async function PUT(req: NextRequest) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    const body = await req.json();

    if (body.seq === undefined || body.seq === null) {
      return NextResponse.json(
        { error: "El campo 'seq' es obligatorio" },
        { status: 400 }
      );
    }

    const seqValue = Number(body.seq);
    if (isNaN(seqValue) || seqValue < 1 || !Number.isInteger(seqValue)) {
      return NextResponse.json(
        { error: "El valor de 'seq' debe ser un número entero positivo" },
        { status: 400 }
      );
    }

    const seqRecord = await db.billFacturaSeq.upsert({
      where: { companyId },
      update: { seq: seqValue },
      create: { companyId, seq: seqValue },
    });

    return NextResponse.json(seqRecord);
  } catch (err) {
    console.error("[BILL_FACTURA_SEQ_PUT]", err);
    return NextResponse.json(
      { error: "Error al actualizar secuencia de factura" },
      { status: 500 }
    );
  }
}
