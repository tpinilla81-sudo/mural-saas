import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════
// AVISOS PROGRAMADOS — reglas (palabra en notas + días antes)
// GET  /api/company/alert-rules  → lista
// POST /api/company/alert-rules  → crear { keyword, daysBefore }
// ═══════════════════════════════════════════════════════════

export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error || !user) return NextResponse.json({ error }, { status });
  const rules = await db.alertRule.findMany({
    where: { companyId: user.companyId! },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rules);
}

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error || !user) return NextResponse.json({ error }, { status });
  const body = await req.json().catch(() => ({}));
  const keyword = String(body.keyword || "").trim();
  const daysBefore = Math.max(0, Math.min(365, parseInt(body.daysBefore, 10) || 1));
  if (!keyword) return NextResponse.json({ error: "Escribe la palabra o texto" }, { status: 400 });
  const rule = await db.alertRule.create({
    data: { companyId: user.companyId!, keyword, daysBefore },
  });
  return NextResponse.json(rule, { status: 201 });
}
