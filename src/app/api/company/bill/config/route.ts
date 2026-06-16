import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── GET /api/company/bill/config ──
// Return the BillConfig for the company. Auto-create with defaults if missing.
export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    let config = await db.billConfig.findUnique({
      where: { companyId },
    });

    // Auto-create if missing
    if (!config) {
      config = await db.billConfig.create({
        data: { companyId },
      });
    }

    return NextResponse.json(config);
  } catch (err) {
    console.error("[BILL_CONFIG_GET]", err);
    return NextResponse.json(
      { error: "Error al obtener configuración" },
      { status: 500 }
    );
  }
}

// ── PUT /api/company/bill/config ──
// Update the BillConfig for the company. Creates if missing (upsert).
export async function PUT(req: NextRequest) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    const body = await req.json();

    // Build update data — only allow known fields
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "companyFullName",
      "companyAddress",
      "companyCity",
      "companyProvince",
      "companyCif",
      "logo",
      "currency",
      "defaultIva",
      "appName",
      "sectionEntrada",
      "sectionRegistros",
      "sectionClientes",
      "sectionCatalogo",
      "sectionFacturas",
      "fieldsEntrada",
      "fieldsClientes",
      "fieldsCatalogo",
      "fieldsRegistros",
      "fieldsFacturas",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const config = await db.billConfig.upsert({
      where: { companyId },
      update: updateData,
      create: {
        companyId,
        ...updateData,
      },
    });

    return NextResponse.json(config);
  } catch (err) {
    console.error("[BILL_CONFIG_PUT]", err);
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    );
  }
}
