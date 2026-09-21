import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// POST /api/company/cards/reorder
// 1) { date, items: [{ kind: "plan"|"aviso", id, order }] } → guarda el orden MANUAL de las tarjetas de ese día
// 2) { date, auto: true } → resetea ese día al orden AUTOMÁTICO (order=-1: mañanas → tardes → ambas)
export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });
  const companyId = user!.companyId!;

  const body = await req.json().catch(() => ({}));
  const date: string = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : "";
  if (!date) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  // Reset a orden automático
  if (body.auto === true) {
    const [p, a] = await db.$transaction([
      db.plan.updateMany({ where: { companyId, date }, data: { order: -1 } }),
      db.aviso.updateMany({ where: { companyId, date }, data: { order: -1 } }),
    ]);
    return NextResponse.json({ ok: true, auto: true, plans: p.count, avisos: a.count });
  }

  // Orden manual: lista de items con su posición
  const items: Array<{ kind?: string; id?: string; order?: number }> = Array.isArray(body.items) ? body.items : [];
  const valid = items.filter((x: any) =>
    (x.kind === "plan" || x.kind === "aviso") && typeof x.id === "string" && Number.isFinite(x.order)
  );
  if (valid.length === 0) return NextResponse.json({ error: "Sin items válidos" }, { status: 400 });

  const ops: Promise<unknown>[] = [];
  for (const it of valid) {
    const order = Math.max(0, Math.min(500, Math.trunc(it.order!)));
    if (it.kind === "plan") {
      ops.push(
        db.plan.updateMany({ where: { id: it.id!, companyId, date }, data: { order } })
      );
    } else {
      ops.push(
        db.aviso.updateMany({ where: { id: it.id!, companyId, date }, data: { order } })
      );
    }
  }
  await db.$transaction(ops);
  return NextResponse.json({ ok: true, updated: valid.length });
}
