import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── GET /api/company/bill/catalogo ──
// List all catalog items, ordered by c1, c2
// Optional: ?clienteId=xxx to filter by client-specific pricing
export async function GET(req: NextRequest) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("clienteId") ?? undefined;

    const where: Record<string, unknown> = { companyId };
    if (clienteId) {
      where.OR = [
        { clienteId },
        { clienteId: null }, // include generic items too
      ];
    }

    const catalogo = await db.billCatalogo.findMany({
      where,
      orderBy: [{ c1: "asc" }, { c2: "asc" }],
    });

    return NextResponse.json(catalogo);
  } catch (err) {
    console.error("[BILL_CATALOGO_GET]", err);
    return NextResponse.json(
      { error: "Error al obtener catálogo" },
      { status: 500 }
    );
  }
}

// ── POST /api/company/bill/catalogo ──
// Create a single catalog item or batch
// Body: { c1, c2, coste, inc, final, clienteId?, customData? } or array thereof
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
          { error: "El array de catálogo no puede estar vacío" },
          { status: 400 }
        );
      }

      const data = body.map((item: Record<string, unknown>) => ({
        companyId,
        clienteId: item.clienteId ? String(item.clienteId) : null,
        c1: String(item.c1 ?? ""),
        c2: String(item.c2 ?? ""),
        coste: Number(item.coste ?? 0),
        inc: Number(item.inc ?? 0),
        final: Number(item.final ?? 0),
        customData: String(item.customData ?? ""),
      }));

      // Validate required fields
      const invalid = data.some(
        (d) => !d.c1.trim() || !d.c2.trim()
      );
      if (invalid) {
        return NextResponse.json(
          { error: "Todos los items deben tener c1 y c2" },
          { status: 400 }
        );
      }

      // Validate clienteId ownership if provided
      const clienteIds = data
        .map((d) => d.clienteId)
        .filter(Boolean) as string[];
      if (clienteIds.length > 0) {
        const uniqueIds = [...new Set(clienteIds)];
        const count = await db.billCliente.count({
          where: { id: { in: uniqueIds }, companyId },
        });
        if (count !== uniqueIds.length) {
          return NextResponse.json(
            { error: "Uno o más clienteId no pertenecen a la empresa" },
            { status: 400 }
          );
        }
      }

      const created = await db.billCatalogo.createMany({ data });
      return NextResponse.json({ count: created.count }, { status: 201 });
    }

    // ── Single creation ──
    if (!body.c1 || !String(body.c1).trim()) {
      return NextResponse.json(
        { error: "c1 (grupo de concepto) es obligatorio" },
        { status: 400 }
      );
    }
    if (!body.c2 || !String(body.c2).trim()) {
      return NextResponse.json(
        { error: "c2 (servicio de concepto) es obligatorio" },
        { status: 400 }
      );
    }

    // Validate clienteId ownership if provided
    if (body.clienteId) {
      const cliente = await db.billCliente.findFirst({
        where: { id: String(body.clienteId), companyId },
      });
      if (!cliente) {
        return NextResponse.json(
          { error: "clienteId no pertenece a la empresa" },
          { status: 400 }
        );
      }
    }

    const catalogoItem = await db.billCatalogo.create({
      data: {
        companyId,
        clienteId: body.clienteId ? String(body.clienteId) : null,
        c1: String(body.c1),
        c2: String(body.c2),
        coste: Number(body.coste ?? 0),
        inc: Number(body.inc ?? 0),
        final: Number(body.final ?? 0),
        customData: String(body.customData ?? ""),
      },
    });

    return NextResponse.json(catalogoItem, { status: 201 });
  } catch (err) {
    console.error("[BILL_CATALOGO_POST]", err);
    return NextResponse.json(
      { error: "Error al crear item(s) de catálogo" },
      { status: 500 }
    );
  }
}
