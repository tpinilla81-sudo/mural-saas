import { NextResponse } from "next/server";
import { requireCompanyUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════
// 🔔 ESTADO DE LA CAMPANA en ESTE dispositivo.
// GET  ?endpoint=…  → { exists, enabled }  (exists=false: nunca activado aquí)
// POST { endpoint, enabled } → activa/desactiva ESTE dispositivo
// (la campana tachada en rojo = enabled:false → NO le llegan pushes)
// ═══════════════════════════════════════════════════════════

export async function GET(req: Request) {
  const { error, status } = await requireCompanyUser();
  if (error) return NextResponse.json({ error }, { status });

  const endpoint = new URL(req.url).searchParams.get("endpoint") || "";
  if (!endpoint) return NextResponse.json({ exists: false, enabled: false });

  const row = await db.pushSub.findUnique({ where: { endpoint }, select: { enabled: true, userId: true } });
  if (!row) return NextResponse.json({ exists: false, enabled: false });
  return NextResponse.json({ exists: true, enabled: row.enabled });
}

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyUser();
  if (error || !user) return NextResponse.json({ error: error || "No autenticado" }, { status });

  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const enabled = !!body?.enabled;
  if (!endpoint) return NextResponse.json({ error: "Falta endpoint" }, { status: 400 });

  const res = await db.pushSub.updateMany({
    where: { endpoint, userId: user.id }, // solo el dueño puede tocar SU dispositivo
    data: { enabled },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Este dispositivo no está registrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, enabled });
}
