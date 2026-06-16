import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ── GET /api/company/bill/diario/[id]/lineas ──
// Returns all líneas for a Diario item
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  const { id } = await params;

  // Verify ownership
  const item = await db.billDiarioItem.findFirst({
    where: { id, companyId },
  });
  if (!item) {
    return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
  }

  const lineas = await db.billDiarioLine.findMany({
    where: { diarioItemId: id },
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(lineas);
}

// ── POST /api/company/bill/diario/[id]/lineas ──
// Adds a new línea to a Diario item
// Body: { catalogoId?, c1?, c2?, cant?, precioUnitario?, obs?, orden? }
// - If catalogoId provided, auto-fills c1/c2/precioUnitario from catalog
// - If c1+c2 provided without catalogoId, looks up price from catalog (client-specific first)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  const { id } = await params;

  // Verify ownership
  const item = await db.billDiarioItem.findFirst({
    where: { id, companyId },
  });
  if (!item) {
    return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
  }
  if (item.status === "FACTURADA") {
    return NextResponse.json(
      { error: "No se pueden añadir líneas a un item ya facturado" },
      { status: 400 }
    );
  }

  const body = await req.json();
  let c1 = String(body.c1 ?? "");
  let c2 = String(body.c2 ?? "");
  let precioUnitario = Number(body.precioUnitario ?? 0);
  let catalogoId = body.catalogoId ? String(body.catalogoId) : null;

  // If catalogoId provided, fetch from catalog
  if (catalogoId) {
    const cat = await db.billCatalogo.findFirst({
      where: { id: catalogoId, companyId },
    });
    if (!cat) {
      return NextResponse.json(
        { error: "Item de catálogo no encontrado" },
        { status: 404 }
      );
    }
    c1 = cat.c1;
    c2 = cat.c2;
    if (precioUnitario === 0) precioUnitario = cat.final;
  } else if (c1 && c2 && precioUnitario === 0) {
    // Auto-lookup price from catalog (client-specific first, then generic)
    const clientItem = item.clienteId
      ? await db.billCatalogo.findFirst({
          where: { companyId, clienteId: item.clienteId, c1, c2 },
          select: { id: true, final: true },
        })
      : null;
    if (clientItem) {
      precioUnitario = clientItem.final;
      catalogoId = clientItem.id;
    } else {
      const generic = await db.billCatalogo.findFirst({
        where: { companyId, clienteId: null, c1, c2 },
        select: { id: true, final: true },
      });
      if (generic) {
        precioUnitario = generic.final;
        catalogoId = generic.id;
      }
    }
  }

  // Get next orden
  const maxOrden = await db.billDiarioLine.aggregate({
    where: { diarioItemId: id },
    _max: { orden: true },
  });
  const orden = body.orden !== undefined ? Number(body.orden) : (maxOrden._max.orden ?? -1) + 1;

  const linea = await db.billDiarioLine.create({
    data: {
      diarioItemId: id,
      companyId,
      catalogoId,
      c1,
      c2,
      cant: Number(body.cant ?? 1),
      precioUnitario,
      obs: String(body.obs ?? ""),
      orden,
    },
  });

  return NextResponse.json(linea, { status: 201 });
}

// ── PUT /api/company/bill/diario/[id]/lineas (batch) ──
// Replaces all líneas of an item (for inline editing in the UI)
// Body: { lineas: [{ id?, catalogoId?, c1, c2, cant, precioUnitario, obs, orden? }] }
// - Existing líneas not in the array are deleted
// - New líneas (without id) are created
// - Existing líneas with id are updated
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  if (!companyId) {
    return NextResponse.json({ error: "Sin empresa asociada" }, { status: 400 });
  }

  const { id } = await params;

  // Verify ownership
  const item = await db.billDiarioItem.findFirst({
    where: { id, companyId },
  });
  if (!item) {
    return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
  }
  if (item.status === "FACTURADA") {
    return NextResponse.json(
      { error: "No se pueden editar líneas de un item ya facturado" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const incomingLineas: any[] = Array.isArray(body.lineas) ? body.lineas : [];

  // Fetch existing líneas
  const existing = await db.billDiarioLine.findMany({
    where: { diarioItemId: id },
  });
  const existingMap = new Map(existing.map((l) => [l.id, l]));

  // Track which existing IDs are in the incoming list
  const keepIds = new Set<string>();
  const toCreate: any[] = [];
  const toUpdate: { id: string; data: any }[] = [];

  for (let i = 0; i < incomingLineas.length; i++) {
    const l = incomingLineas[i];
    const lid = l.id ? String(l.id) : null;

    // Resolve catalogo if needed
    let catalogoId = l.catalogoId ? String(l.catalogoId) : null;
    let c1 = String(l.c1 ?? "");
    let c2 = String(l.c2 ?? "");
    let precioUnitario = Number(l.precioUnitario ?? 0);

    if (catalogoId) {
      const cat = await db.billCatalogo.findFirst({
        where: { id: catalogoId, companyId },
      });
      if (cat) {
        c1 = cat.c1;
        c2 = cat.c2;
        if (precioUnitario === 0) precioUnitario = cat.final;
      }
    } else if (c1 && c2 && precioUnitario === 0) {
      const clientItem = item.clienteId
        ? await db.billCatalogo.findFirst({
            where: { companyId, clienteId: item.clienteId, c1, c2 },
            select: { id: true, final: true },
          })
        : null;
      if (clientItem) {
        precioUnitario = clientItem.final;
        catalogoId = clientItem.id;
      } else {
        const generic = await db.billCatalogo.findFirst({
          where: { companyId, clienteId: null, c1, c2 },
          select: { id: true, final: true },
        });
        if (generic) {
          precioUnitario = generic.final;
          catalogoId = generic.id;
        }
      }
    }

    const data = {
      c1,
      c2,
      cant: Number(l.cant ?? 1),
      precioUnitario,
      obs: String(l.obs ?? ""),
      orden: l.orden !== undefined ? Number(l.orden) : i,
    };

    if (lid && existingMap.has(lid)) {
      keepIds.add(lid);
      toUpdate.push({ id: lid, data });
    } else {
      toCreate.push({ ...data, catalogoId });
    }
  }

  // Delete líneas not in keepIds
  const toDelete = existing.filter((l) => !keepIds.has(l.id)).map((l) => l.id);

  // Execute in a transaction
  await db.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.billDiarioLine.deleteMany({
        where: { id: { in: toDelete } },
      });
    }
    for (const u of toUpdate) {
      await tx.billDiarioLine.update({
        where: { id: u.id },
        data: u.data,
      });
    }
    for (const c of toCreate) {
      await tx.billDiarioLine.create({
        data: {
          diarioItemId: id,
          companyId,
          catalogoId: c.catalogoId,
          c1: c.c1,
          c2: c.c2,
          cant: c.cant,
          precioUnitario: c.precioUnitario,
          obs: c.obs,
          orden: c.orden,
        },
      });
    }
  });

  // Return updated list
  const updated = await db.billDiarioLine.findMany({
    where: { diarioItemId: id },
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(updated);
}
