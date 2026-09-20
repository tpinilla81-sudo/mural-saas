import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════
// Email — envío de correos de los AVISOS PROGRAMADOS vía Resend.
// Si RESEND_API_KEY no está configurada en el servidor, el email
// queda encolado en OutboxNotification con status "pending"
// (traza en BD) y NO sale. emailConfigured() permite avisar en la UI.
// ═══════════════════════════════════════════════════════════

const RESEND_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "MURAL <avisos@resend.dev>";

/** ¿Hay clave de Resend configurada en el servidor? */
export function emailConfigured(): boolean {
  return !!RESEND_KEY;
}

export interface EmailResult {
  sent: number;
  failed: number;
  /** correos encolados sin enviar (falta RESEND_API_KEY) */
  pending: number;
}

/** Envía un email a cada uno de los usuarios indicados (User.id). */
export async function sendEmailToUsers(
  userIds: string[],
  opts: { companyId: string; subject: string; body: string }
): Promise<EmailResult> {
  const ids = (userIds || []).filter(Boolean);
  const result: EmailResult = { sent: 0, failed: 0, pending: 0 };
  if (ids.length === 0) return result;

  const users = await db.user.findMany({
    where: { id: { in: ids }, companyId: opts.companyId },
    select: { email: true },
  });
  const targets = [...new Set(users.map((u) => u.email).filter(Boolean))];
  if (targets.length === 0) return result;

  await Promise.all(
    targets.map(async (to) => {
      try {
        const row = await db.outboxNotification.create({
          data: {
            companyId: opts.companyId,
            channel: "email",
            target: to,
            subject: opts.subject,
            body: opts.body,
            status: "pending",
          },
        });
        if (!RESEND_KEY) {
          result.pending++;
          return;
        }
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
          body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject: opts.subject, text: opts.body }),
        });
        if (res.ok) {
          await db.outboxNotification.update({
            where: { id: row.id },
            data: { status: "sent", sentAt: new Date() },
          });
          result.sent++;
        } else {
          await db.outboxNotification.update({
            where: { id: row.id },
            data: { status: "failed", error: `HTTP ${res.status}` },
          });
          result.failed++;
        }
      } catch (e) {
        result.failed++;
        try {
          await db.outboxNotification.create({
            data: {
              companyId: opts.companyId,
              channel: "email",
              target: to,
              subject: opts.subject,
              body: opts.body,
              status: "failed",
              error: String(e).slice(0, 200),
            },
          });
        } catch {
          // sin traza posible: nunca bloquear el cron
        }
      }
    })
  );
  return result;
}
