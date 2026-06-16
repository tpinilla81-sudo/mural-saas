import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── GET /api/company/bill/registros ──
// Filter options:
//   ?filter=entrada   → pasadoRegistro=false (not yet transferred)
//   ?filter=registros → pasadoRegistro=true  (already transferred)
//   ?filter=all        → no filter (default)
//   ?clienteId=xxx     → filter by client
//   ?from=YYYY-MM-DD   → fecha >= from
//   ?to=YYYY-MM-DD     → fecha <= to
export async function GET(req: NextRequest) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") ?? "all";
    const clienteId = searchParams.get("clienteId") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const where: Record<string, unknown> = { companyId };

    // Apply pasadoRegistro filter
    if (filter === "entrada") {
      where.pasadoRegistro = false;
    } else if (filter === "registros") {
      where.pasadoRegistro = true;
    }
    // "all" → no filter on pasadoRegistro

    // Apply clienteId filter
    if (clienteId) {
      where.clienteId = clienteId;
    }

    // Apply date range filters
    if (from || to) {
      const fechaFilter: Record<string, string> = {};
      if (from) fechaFilter.gte = from;
      if (to) fechaFilter.lte = to;
      where.fecha = fechaFilter;
    }

    const registros = await db.billRegistro.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(registros);
  } catch (err) {
    console.error("[BILL_REGISTROS_GET]", err);
    return NextResponse.json(
      { error: "Error al obtener registros" },
      { status: 500 }
    );
  }
}

// ── POST /api/company/bill/registros ──
// Create single or batch registros.
// Auto-lookup: if clienteId is provided but cliente (name) is not, look up from BillCliente.
// Auto-lookup: if c1+c2 are provided but precioUnitario is 0/missing, look up from BillCatalogo.
export async function POST(req: NextRequest) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    const body = await req.json();

    // ── Helper: resolve client name ──
    async function resolveClienteName(
      clienteId: string | null | undefined,
      clienteName?: string
    ): Promise<string> {
      if (clienteName && String(clienteName).trim()) return String(clienteName);
      if (!clienteId) return "";
      const found = await db.billCliente.findFirst({
        where: { id: clienteId, companyId },
        select: { nombre: true },
      });
      return found?.nombre ?? "";
    }

    // ── Helper: resolve unit price from catalog ──
    async function resolvePrecioUnitario(
      clienteId: string | null | undefined,
      c1: string,
      c2: string,
      providedPrecio?: number
    ): Promise<number> {
      if (providedPrecio !== undefined && providedPrecio !== 0) return Number(providedPrecio);
      if (!c1.trim() || !c2.trim()) return 0;

      // Try client-specific pricing first
      if (clienteId) {
        const clientItem = await db.billCatalogo.findFirst({
          where: { companyId, clienteId, c1, c2 },
          select: { final: true },
        });
        if (clientItem) return clientItem.final;
      }

      // Fall back to generic pricing
      const genericItem = await db.billCatalogo.findFirst({
        where: { companyId, clienteId: null, c1, c2 },
        select: { final: true },
      });
      return genericItem?.final ?? 0;
    }

    // ── Batch creation ──
    if (Array.isArray(body)) {
      if (body.length === 0) {
        return NextResponse.json(
          { error: "El array de registros no puede estar vacío" },
          { status: 400 }
        );
      }

      const data = [];
      for (const item of body as Record<string, unknown>[]) {
        const clienteId = item.clienteId ? String(item.clienteId) : null;

        // Validate clienteId ownership
        if (clienteId) {
          const exists = await db.billCliente.findFirst({
            where: { id: clienteId, companyId },
          });
          if (!exists) {
            return NextResponse.json(
              { error: `clienteId "${clienteId}" no pertenece a la empresa` },
              { status: 400 }
            );
          }
        }

        const cliente = await resolveClienteName(clienteId, item.cliente as string | undefined);
        const c1 = String(item.c1 ?? "");
        const c2 = String(item.c2 ?? "");
        const precioUnitario = await resolvePrecioUnitario(
          clienteId,
          c1,
          c2,
          item.precioUnitario as number | undefined
        );

        data.push({
          companyId,
          fecha: String(item.fecha ?? new Date().toISOString().split("T")[0]),
          clienteId,
          cliente,
          c1,
          c2,
          cant: Number(item.cant ?? 1),
          precioUnitario,
          obs: String(item.obs ?? ""),
          pasadoRegistro: Boolean(item.pasadoRegistro ?? false),
          facturado: Boolean(item.facturado ?? false),
          customData: String(item.customData ?? ""),
        });
      }

      const created = await db.billRegistro.createMany({ data });
      return NextResponse.json({ count: created.count }, { status: 201 });
    }

    // ── Single creation ──
    if (!body.fecha || !String(body.fecha).trim()) {
      return NextResponse.json(
        { error: "La fecha es obligatoria" },
        { status: 400 }
      );
    }

    const clienteId = body.clienteId ? String(body.clienteId) : null;

    // Validate clienteId ownership
    if (clienteId) {
      const exists = await db.billCliente.findFirst({
        where: { id: clienteId, companyId },
      });
      if (!exists) {
        return NextResponse.json(
          { error: "clienteId no pertenece a la empresa" },
          { status: 400 }
        );
      }
    }

    const cliente = await resolveClienteName(clienteId, body.cliente as string | undefined);
    const c1 = String(body.c1 ?? "");
    const c2 = String(body.c2 ?? "");
    const precioUnitario = await resolvePrecioUnitario(
      clienteId,
      c1,
      c2,
      body.precioUnitario as number | undefined
    );

    const registro = await db.billRegistro.create({
      data: {
        companyId,
        fecha: String(body.fecha),
        clienteId,
        cliente,
        c1,
        c2,
        cant: Number(body.cant ?? 1),
        precioUnitario,
        obs: String(body.obs ?? ""),
        pasadoRegistro: Boolean(body.pasadoRegistro ?? false),
        facturado: Boolean(body.facturado ?? false),
        customData: String(body.customData ?? ""),
      },
    });

    return NextResponse.json(registro, { status: 201 });
  } catch (err) {
    console.error("[BILL_REGISTROS_POST]", err);
    return NextResponse.json(
      { error: "Error al crear registro(s)" },
      { status: 500 }
    );
  }
}
