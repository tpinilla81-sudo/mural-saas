import { db } from "@/lib/db";

/** Escribe una entrada de auditoría (fire-and-forget: nunca rompe la petición). */
export async function logAudit(opts: {
  companyId: string;
  userId?: string | null;
  userName?: string;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: string;
}) {
  try {
    await db.auditLog.create({
      data: {
        companyId: opts.companyId,
        userId: opts.userId || null,
        userName: opts.userName || "",
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId || null,
        detail: opts.detail || "",
      },
    });
  } catch {
    // la auditoría no debe bloquear nunca la operación principal
  }
}

const RESEND_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "MURAL <avisos@resend.dev>";

/**
 * Encola el email de un aviso nuevo y lo intenta enviar si hay RESEND_API_KEY.
 * Sin clave, queda "pending" (visible en Configuración → Avisos por email).
 */
export async function queueAvisoEmail(opts: {
  companyId: string;
  date: string;
  turn: string;
  sedeName: string;
  proName: string;
  note: string;
}) {
  try {
    const company = await db.company.findUnique({
      where: { id: opts.companyId },
      select: { name: true, notifyEmail: true, email: true },
    });
    const target = company?.notifyEmail || company?.email || "";
    if (!target) return; // sin destinatario configurado: no encolamos

    const turnTxt = opts.turn === "M" ? "Mañana" : "Tarde";
    const body = [
      `Nuevo aviso en ${company?.name || "MURAL"}`,
      ``,
      `📅 Fecha: ${opts.date}`,
      `🌤️ Turno: ${turnTxt}`,
      `📍 Sede: ${opts.sedeName}`,
      `👤 Profesional: ${opts.proName || "Toda la sede"}`,
      opts.note ? `📝 Nota: ${opts.note}` : "",
    ].filter(Boolean).join("\n");

    const row = await db.outboxNotification.create({
      data: {
        companyId: opts.companyId,
        channel: "email",
        target,
        subject: `Aviso ${opts.date} · ${turnTxt} · ${opts.sedeName}`,
        body,
        status: "pending",
      },
    });

    if (!RESEND_KEY) return; // sin clave: queda pendiente de envío manual

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({ from: EMAIL_FROM, to: [target], subject: row.subject, text: body }),
      });
      if (res.ok) {
        await db.outboxNotification.update({ where: { id: row.id }, data: { status: "sent", sentAt: new Date() } });
      } else {
        await db.outboxNotification.update({ where: { id: row.id }, data: { status: "failed", error: `HTTP ${res.status}` } });
      }
    } catch (e) {
      await db.outboxNotification.update({ where: { id: row.id }, data: { status: "failed", error: String(e).slice(0, 200) } });
    }
  } catch {
    // nunca bloquear la creación del aviso
  }
}
