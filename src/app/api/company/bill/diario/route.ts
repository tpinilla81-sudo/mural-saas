import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── GET /api/company/bill/diario ──
// Returns diario items (salida cumplida).
// Query params:
//   ?status=CUMPLIDA|FACTURADA|all
//   ?from=YYYY-MM-DD
//   ?to=YYYY-MM-DD
//   ?sedeId=xxx
//   ?clienteId=xxx
export async function GET(req: NextRequest) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") ?? "all";
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const sedeId = searchParams.get("sedeId") ?? undefined;
    const clienteId = searchParams.get("clienteId") ?? undefined;

    const where: Record<string, unknown> = { companyId };

    if (statusFilter !== "all") {
      where.status = statusFilter;
    }
    if (sedeId) {
      where.sedeId = sedeId;
    }
    if (clienteId) {
      where.clienteId = clienteId;
    }
    if (from || to) {
      const fechaFilter: Record<string, string> = {};
      if (from) fechaFilter.gte = from;
      if (to) fechaFilter.lte = to;
      where.fecha = fechaFilter;
    }

    const items = await db.billDiarioItem.findMany({
      where,
      include: {
        lineas: {
          orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(items);
  } catch (err) {
    console.error("[BILL_DIARIO_GET]", err);
    return NextResponse.json(
      { error: "Error al obtener items de diario" },
      { status: 500 }
    );
  }
}

// ── POST /api/company/bill/diario ──
// Two modes:
//   1) Sync from Diario plans: body = { syncFrom: "plans", from?, to?, turn? }
//      - Pulls Plan entries (with optional date range) and creates BillDiarioItem
//      - Dedupes via @@unique([sourceType, sourceId])
//      - Auto-maps Sede → BillCliente (by name match)
//      - Auto-looks up precioUnitario from BillCatalogo using c1="Servicios" c2=turn
//
//   2) Manual creation: body = { fecha, sedeId?, sedeName?, professionalId?,
//      professionalName?, turn?, clienteId?, c1?, c2?, cant?, precioUnitario?, obs? }
export async function POST(req: NextRequest) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  try {
    const body = await req.json();

    // ── SYNC MODE ──
    if (body.syncFrom === "plans") {
      const from = body.from as string | undefined;
      const to = body.to as string | undefined;

      // Build plan query
      const planWhere: Record<string, unknown> = { companyId };
      if (from || to) {
        const dateFilter: Record<string, string> = {};
        if (from) dateFilter.gte = from;
        if (to) dateFilter.lte = to;
        planWhere.date = dateFilter;
      }

      const plans = await db.plan.findMany({
        where: planWhere,
        include: { sede: true },
        orderBy: { date: "asc" },
      });

      // Pre-load all BillClientes for this company for sede→cliente mapping
      const clientes = await db.billCliente.findMany({
        where: { companyId },
        select: { id: true, nombre: true },
      });
      const clienteByName = new Map(
        clientes.map((c) => [c.nombre.trim().toLowerCase(), c])
      );

      // Pre-load catalog for price lookup (c1="Servicios" c2=turn)
      const catalogo = await db.billCatalogo.findMany({
        where: { companyId },
        select: { clienteId: true, c1: true, c2: true, final: true },
      });

      // Existing diario items by sourceId to skip
      const existing = await db.billDiarioItem.findMany({
        where: { companyId, sourceType: "plan" },
        select: { sourceId: true },
      });
      const existingSet = new Set(existing.map((e) => e.sourceId));

      // Pre-load professionals to map alias → id/name
      const professionals = await db.professional.findMany({
        where: { companyId },
        select: { id: true, firstName: true, lastName: true, alias: true },
      });
      const profByAlias = new Map(
        professionals.map((p) => [p.alias, p])
      );

      let created = 0;
      let skipped = 0;

      for (const plan of plans) {
        if (existingSet.has(plan.id)) {
          skipped++;
          continue;
        }

        const sedeName = plan.sede?.name ?? "";
        // Match BillCliente by sede name (case-insensitive, trimmed)
        const matchedCliente = clienteByName.get(sedeName.trim().toLowerCase());
        const clienteId = matchedCliente?.id ?? null;
        const cliente = matchedCliente?.nombre ?? sedeName;

        // Resolve professional
        const prof = profByAlias.get(plan.professionalAlias);
        const professionalId = prof?.id ?? null;
        const professionalName =
          prof && (prof.firstName || prof.lastName)
            ? `${prof.firstName} ${prof.lastName}`.trim()
            : plan.professionalAlias;

        // Default c1/c2 from turn
        const c1 = "Servicios";
        const c2 = plan.turn === "MANANA" ? "Mañana" : plan.turn === "TARDE" ? "Tarde" : plan.turn;

        // Price lookup: client-specific first, then generic
        let precioUnitario = 0;
        const clientItem = clienteId
          ? catalogo.find(
              (x) => x.clienteId === clienteId && x.c1 === c1 && x.c2 === c2
            )
          : null;
        if (clientItem) {
          precioUnitario = clientItem.final;
        } else {
          const genericItem = catalogo.find(
            (x) => !x.clienteId && x.c1 === c1 && x.c2 === c2
          );
          if (genericItem) precioUnitario = genericItem.final;
        }

        try {
          await db.billDiarioItem.create({
            data: {
              companyId,
              fecha: plan.date,
              sedeId: plan.sedeId,
              sedeName,
              professionalId,
              professionalName,
              turn: plan.turn,
              clienteId,
              cliente,
              c1,
              c2,
              cant: 1,
              precioUnitario,
              obs: `${professionalName} — ${plan.turn === "MANANA" ? "Mañana" : "Tarde"}`,
              status: "CUMPLIDA",
              sourceType: "plan",
              sourceId: plan.id,
            },
          });
          created++;
        } catch (e: any) {
          // P2002 = unique constraint (already exists) - skip
          if (e?.code === "P2002") {
            skipped++;
          } else {
            console.error("[BILL_DIARIO_SYNC_ITEM]", e);
          }
        }
      }

      return NextResponse.json({
        synced: created,
        skipped,
        total: plans.length,
      });
    }

    // ── MANUAL MODE ──
    if (!body.fecha || !String(body.fecha).trim()) {
      return NextResponse.json(
        { error: "La fecha es obligatoria" },
        { status: 400 }
      );
    }

    // Resolve sede name if sedeId provided
    let sedeName = String(body.sedeName ?? "");
    if (body.sedeId && !sedeName) {
      const sede = await db.sede.findFirst({
        where: { id: body.sedeId, companyId },
        select: { name: true },
      });
      sedeName = sede?.name ?? "";
    }

    // Resolve professional name if professionalId provided
    let professionalName = String(body.professionalName ?? "");
    if (body.professionalId && !professionalName) {
      const prof = await db.professional.findFirst({
        where: { id: body.professionalId, companyId },
        select: { firstName: true, lastName: true, alias: true },
      });
      professionalName = prof
        ? `${prof.firstName} ${prof.lastName}`.trim() || prof.alias
        : "";
    }

    // Validate clienteId ownership if provided
    const clienteId = body.clienteId ? String(body.clienteId) : null;
    let clienteName = "";
    if (clienteId) {
      const exists = await db.billCliente.findFirst({
        where: { id: clienteId, companyId },
        select: { nombre: true },
      });
      if (!exists) {
        return NextResponse.json(
          { error: "clienteId no pertenece a la empresa" },
          { status: 400 }
        );
      }
      clienteName = exists.nombre;
    }

    // Auto-lookup price from catalog if not provided
    let precioUnitario = Number(body.precioUnitario ?? 0);
    const c1 = String(body.c1 ?? "Servicios");
    const c2 = String(body.c2 ?? "");
    if (precioUnitario === 0 && c2) {
      const clientItem = clienteId
        ? await db.billCatalogo.findFirst({
            where: { companyId, clienteId, c1, c2 },
            select: { final: true },
          })
        : null;
      if (clientItem) {
        precioUnitario = clientItem.final;
      } else {
        const generic = await db.billCatalogo.findFirst({
          where: { companyId, clienteId: null, c1, c2 },
          select: { final: true },
        });
        if (generic) precioUnitario = generic.final;
      }
    }

    const item = await db.billDiarioItem.create({
      data: {
        companyId,
        fecha: String(body.fecha),
        sedeId: body.sedeId ? String(body.sedeId) : null,
        sedeName,
        professionalId: body.professionalId ? String(body.professionalId) : null,
        professionalName,
        turn: String(body.turn ?? ""),
        clienteId,
        cliente: clienteName || String(body.cliente ?? ""),
        c1,
        c2,
        cant: Number(body.cant ?? 1),
        precioUnitario,
        obs: String(body.obs ?? ""),
        status: "CUMPLIDA",
        sourceType: "manual",
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("[BILL_DIARIO_POST]", err);
    return NextResponse.json(
      { error: "Error al crear/sincronizar items de diario" },
      { status: 500 }
    );
  }
}
