import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════
// PATCH  /api/company/alert-rules/[id]  → { enabled?, keyword?, daysBefore?, recipients?, channel? }
// DELETE /api/company/alert-rules/[id]
// ═══════════════════════════════════════════════════════════

const CHANNELS = ["push", "email", "both"];

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
  const data: {
    enabled?: boolean; keyword?: string; daysBefore?: number;
    recipients?: string; channel?: string;
  } = {};
  if (body.enabled !== undefined) data.enabled = !!body.enabled;
  if (body.keyword !== undefined) {
    const kw = String(body.keyword).trim();
    if (!kw) return NextResponse.json({ error: "La palabra no puede estar vacía" }, { status: 400 });
    data.keyword = kw;
  }
  if (body.daysBefore !== undefined) {
    data.daysBefore = Math.max(0, Math.min(365, parseInt(body.daysBefore, 10) || 1));
  }
  // Destinatarios: array de userIds (vacío = TODOS) o CSV
  if (body.recipients !== undefined) {
    let list: string[] = Array.isArray(body.recipients)
      ? body.recipients.map((r: unknown) => String(r))
      : String(body.recipients).split(",");
    list = list.map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) {
      data.recipients = ""; // TODOS
    } else {
      const companyUsers = await db.user.findMany({
        where: { companyId: user.companyId! },
        select: { id: true },
      });
      const valid = new Set(companyUsers.map((u) => u.id));
      data.recipients = [...new Set(list.filter((r) => valid.has(r)))].join(",");
    }
  }
  // Canal: push | email | both
  if (body.channel !== undefined) {
    if (!CHANNELS.includes(body.channel)) {
      return NextResponse.json({ error: "Canal inválido" }, { status: 400 });
    }
    data.channel = body.channel;
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
