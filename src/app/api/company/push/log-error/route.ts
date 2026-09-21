import { NextResponse } from "next/server";
import { requireCompanyUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════
// POST /api/company/push/log-error
// Body: { device: "diagnóstico…", error: "fallo real…" }
// Soporte remoto: registra por qué la activación de notificaciones
// falla en cada dispositivo (y también los éxitos: error "OK …").
// ═══════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    const { error, user } = await requireCompanyUser();
    if (error) return NextResponse.json({ error }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    await db.pushErrorLog.create({
      data: {
        userId: user?.id || null,
        device: String(body?.device || "").slice(0, 400),
        error: String(body?.error || "").slice(0, 600),
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Nunca bloquear por un fallo del propio log
    return NextResponse.json({ ok: false });
  }
}
