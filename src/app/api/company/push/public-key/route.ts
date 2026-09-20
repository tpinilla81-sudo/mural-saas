import { NextResponse } from "next/server";
import { requireCompanyUser } from "@/lib/api-auth";
import { getVapid } from "@/lib/push";

// ═══════════════════════════════════════════════════════════
// GET /api/company/push/public-key → { publicKey }
// Clave VAPID pública para suscribir el dispositivo (se genera sola).
// Cualquier usuario con sesión puede activar las notificaciones.
// ═══════════════════════════════════════════════════════════

export async function GET() {
  const { error, status } = await requireCompanyUser();
  if (error) return NextResponse.json({ error }, { status });
  const vapid = await getVapid();
  return NextResponse.json({ publicKey: vapid.publicKey });
}
