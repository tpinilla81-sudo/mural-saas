import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * GET: estadísticas de avisos de la empresa.
 * ?year=YYYY (por defecto el actual) — agrupa por mes, profesional y sede.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = user.companyId;
  if (!companyId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || "") || new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const avisos = await db.aviso.findMany({
    where: { companyId, date: { gte: from, lte: to } },
    include: { professional: { select: { alias: true } }, sede: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  const byMonth = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][i],
    total: 0,
    morning: 0,
    afternoon: 0,
  }));
  const byPro = new Map<string, number>();
  const bySede = new Map<string, number>();
  const byReason = new Map<string, number>();

  for (const a of avisos) {
    const m = parseInt(a.date.slice(5, 7), 10) - 1;
    if (m >= 0 && m <= 11) {
      byMonth[m].total++;
      if (a.turn === "M") byMonth[m].morning++;
      else if (a.turn === "T") byMonth[m].afternoon++;
    }
    const pk = a.professional?.alias || "(toda la sede)";
    byPro.set(pk, (byPro.get(pk) || 0) + 1);
    const sk = a.sede?.name || "?";
    bySede.set(sk, (bySede.get(sk) || 0) + 1);
    const rk = (a.reason || "AUSENCIA").toUpperCase();
    byReason.set(rk, (byReason.get(rk) || 0) + 1);
  }

  const sortDesc = (m: Map<string, number>) =>
    [...m.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);

  return NextResponse.json({
    year,
    total: avisos.length,
    byMonth,
    byPro: sortDesc(byPro).slice(0, 12),
    bySede: sortDesc(bySede),
    byReason: sortDesc(byReason),
  });
}
