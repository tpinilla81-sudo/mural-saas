import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════
// PATCH  /api/company/alert-rules/[id]  → { enabled?, keyword?, daysBefore? }
// DELETE /api/company/alert-rules/[id]
// ═══════════════════════════════════════════════════════════

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error || !user) return NextResponse.json({ error }, { status });
  const { id } = await params;

  const existing = await db.alertRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
  if (user.role !== "SUPER_ADMIN" && existing.companyId !== user.companyId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: { enabled?: boolean; keyword?: string; daysBefore?: number } = {};
  if (body.enabled !== undefined) data.enabled = !!body.enabled;
  if (body.keyword !== undefined) {
    const kw = String(body.keyword).trim();
    if (!kw) return NextResponse.json({ error: "La palabra no puede estar vacía" }, { status: 400 });
    data.keyword = kw;
  }
  if (body.daysBefore !== undefined) {
    data.daysBefore = Math.max(0, Math.min(365, parseInt(body.daysBefore, 10) || 1));
  }
  const rule = await db.alertRule.update({ where: { id }, data });
  return NextResponse.json(rule);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error || !user) return NextResponse.json({ error }, { status });
  const { id } = await params;

  const existing = await db.alertRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
  if (user.role !== "SUPER_ADMIN" && existing.companyId !== user.companyId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  await db.alertRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
