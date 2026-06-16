import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── GET /api/company/bill/clientes ──
// List all clients for the company
export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    const clientes = await db.billCliente.findMany({
      where: { companyId },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(clientes);
  } catch (err) {
    console.error("[BILL_CLIENTES_GET]", err);
    return NextResponse.json(
      { error: "Error al obtener clientes" },
      { status: 500 }
    );
  }
}

// ── POST /api/company/bill/clientes ──
// Create a single client or batch of clients
// Body: single object { nombre, cif, ... } or array of objects
export async function POST(req: NextRequest) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    const body = await req.json();

    // ── Batch creation ──
    if (Array.isArray(body)) {
      if (body.length === 0) {
        return NextResponse.json(
          { error: "El array de clientes no puede estar vacío" },
          { status: 400 }
        );
      }

      const data = body.map((item: Record<string, unknown>) => ({
        companyId,
        nombre: String(item.nombre ?? ""),
        cif: String(item.cif ?? ""),
        dir: String(item.dir ?? ""),
        cp: String(item.cp ?? ""),
        ciudad: String(item.ciudad ?? ""),
        prov: String(item.prov ?? ""),
        mail: String(item.mail ?? ""),
        tel: String(item.tel ?? ""),
        customData: String(item.customData ?? ""),
      }));

      // Validate that every item has a nombre
      const missingNombre = data.some((d) => !d.nombre.trim());
      if (missingNombre) {
        return NextResponse.json(
          { error: "Todos los clientes deben tener un nombre" },
          { status: 400 }
        );
      }

      const created = await db.billCliente.createMany({ data });
      return NextResponse.json({ count: created.count }, { status: 201 });
    }

    // ── Single creation ──
    if (!body.nombre || !String(body.nombre).trim()) {
      return NextResponse.json(
        { error: "El nombre del cliente es obligatorio" },
        { status: 400 }
      );
    }

    const cliente = await db.billCliente.create({
      data: {
        companyId,
        nombre: String(body.nombre),
        cif: String(body.cif ?? ""),
        dir: String(body.dir ?? ""),
        cp: String(body.cp ?? ""),
        ciudad: String(body.ciudad ?? ""),
        prov: String(body.prov ?? ""),
        mail: String(body.mail ?? ""),
        tel: String(body.tel ?? ""),
        customData: String(body.customData ?? ""),
      },
    });

    return NextResponse.json(cliente, { status: 201 });
  } catch (err) {
    console.error("[BILL_CLIENTES_POST]", err);
    return NextResponse.json(
      { error: "Error al crear cliente(s)" },
      { status: 500 }
    );
  }
}
