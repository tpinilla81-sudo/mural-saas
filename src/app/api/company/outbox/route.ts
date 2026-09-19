import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

/** GET: últimos 100 envíos de la cola de notificaciones */
export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const rows = await db.outboxNotification.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(rows);
}

/** POST: reintenta enviar los pendientes/fallidos (requiere RESEND_API_KEY) */
export async function POST() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const key = process.env.RESEND_API_KEY || "";
  if (!key) {
    return NextResponse.json({ error: "RESEND_API_KEY no configurada en el servidor" }, { status: 400 });
  }

  const pending = await db.outboxNotification.findMany({
    where: { companyId, status: { in: ["pending", "failed"] }, channel: "email" },
    take: 25,
    orderBy: { createdAt: "asc" },
  });

  let sent = 0;
  for (const row of pending) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "MURAL <avisos@resend.dev>",
          to: [row.target],
          subject: row.subject,
          text: row.body,
        }),
      });
      if (res.ok) {
        await db.outboxNotification.update({ where: { id: row.id }, data: { status: "sent", sentAt: new Date(), error: null } });
        sent++;
      } else {
        await db.outboxNotification.update({ where: { id: row.id }, data: { status: "failed", error: `HTTP ${res.status}` } });
      }
    } catch (e) {
      await db.outboxNotification.update({ where: { id: row.id }, data: { status: "failed", error: String(e).slice(0, 200) } });
    }
  }

  return NextResponse.json({ ok: true, attempted: pending.length, sent });
}
