import { NextResponse } from "next/server";
import { requireCompanyUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════
// 📩 MARCAR COMO LEÍDOS — al abrir el sobre se leen todos:
// readAt = ahora → el contador de no leídos se limpia.
// Body opcional { ids: string[] } para marcar solo algunos.
// ═══════════════════════════════════════════════════════════

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyUser();
  if (error || !user) return NextResponse.json({ error: error || "No autenticado" }, { status });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];

  const res = await db.inboxMessage.updateMany({
    where: ids.length > 0 ? { userId: user.id, id: { in: ids }, readAt: null } : { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true, marked: res.count });
}
