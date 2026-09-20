import { NextResponse } from "next/server";
import { requireCompanyUser } from "@/lib/api-auth";
import { sendPushToAll } from "@/lib/push";

// ═══════════════════════════════════════════════════════════
// POST /api/company/push/test
// Envía una notificación de PRUEBA a TODOS los móviles activados.
// Devuelve { sent } = cuántos dispositivos la recibieron.
// Si no hay ninguno → 409 con mensaje claro.
// ═══════════════════════════════════════════════════════════

export async function POST() {
  const { error, status } = await requireCompanyUser();
  if (error) return NextResponse.json({ error }, { status });

  try {
    const sent = await sendPushToAll({
      title: "🔔 Prueba de MURAL",
      body: "¡Funciona! Así te avisaremos de los eventos programados.",
      url: "/",
      tag: "prueba",
    });
    if (sent === 0) {
      return NextResponse.json(
        { error: "Ningún móvil lo recibió: no hay dispositivos activados o el registro caducó. Vuelve a pulsar 🔔 ACTIVAR." },
        { status: 409 }
      );
    }
    return NextResponse.json({ sent });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Fallo al enviar: ${msg}`.slice(0, 300) }, { status: 500 });
  }
}
