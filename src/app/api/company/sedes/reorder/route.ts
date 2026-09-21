import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// POST /api/company/sedes/reorder  { ids: [id1, id2, ...] } en el ORDEN deseado
export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "Faltan ids" }, { status: 400 });

  // Ownership: solo sedes de la empresa del usuario (SUPER_ADMIN cualquiera)
  const owned = await db.sede.findMany({
    where: { id: { in: ids }, ...(user!.role !== "SUPER_ADMIN" ? { companyId: user!.companyId! } : {}) },
    select: { id: true },
  });
  const valid = new Set(owned.map(s => s.id));
  const ordered = ids.filter(id => valid.has(id));

  await db.$transaction(
    ordered.map((id, i) => db.sede.update({ where: { id }, data: { order: i } }))
  );

  return NextResponse.json({ ok: true, updated: ordered.length });
}
