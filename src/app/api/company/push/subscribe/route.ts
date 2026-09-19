import { NextResponse } from "next/server";
import { requireCompanyUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════
// POST /api/company/push/subscribe
// Body: PushSubscription JSON del navegador { endpoint, keys: { p256dh, auth } }
// Guarda/actualiza la suscripción de ESTE dispositivo.
// ═══════════════════════════════════════════════════════════

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyUser();
  if (error) return NextResponse.json({ error }, { status });

  const sub = await req.json().catch(() => null);
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  }

  const userAgent = (req.headers.get("user-agent") || "").slice(0, 250);
  await db.pushSub.upsert({
    where: { endpoint },
    update: { p256dh: String(p256dh), auth: String(auth), userAgent },
    create: {
      endpoint,
      p256dh: String(p256dh),
      auth: String(auth),
      companyId: user.companyId || null,
      userAgent,
    },
  });
  return NextResponse.json({ ok: true });
}
