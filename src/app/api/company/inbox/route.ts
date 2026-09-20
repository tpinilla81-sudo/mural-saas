import { NextResponse } from "next/server";
import { requireCompanyUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════
// 📩 BANDEJA DEL SOBRE — mensajes (avisos) del usuario actual.
// GET → { unread, messages: [últimos 50] }
// ═══════════════════════════════════════════════════════════

export async function GET() {
  const { error, status, user } = await requireCompanyUser();
  if (error || !user) return NextResponse.json({ error: error || "No autenticado" }, { status });

  const [unread, messages] = await Promise.all([
    db.inboxMessage.count({ where: { userId: user.id, readAt: null } }),
    db.inboxMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  return NextResponse.json({ unread, messages });
}
