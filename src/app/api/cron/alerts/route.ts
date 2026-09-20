import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPushToAll, sendPushToUsers } from "@/lib/push";
import { sendEmailToUsers } from "@/lib/email";

// ═══════════════════════════════════════════════════════════
// GET /api/cron/alerts — JOB DIARIO (Vercel Cron 08:00 UTC ≈ 10:00 Madrid)
//
// Para cada regla activa (palabra + días antes):
//   1. Busca tarjetas (Plan.notes) y avisos (Aviso.note) FUTUROS cuya nota
//      contenga la palabra (sin distinguir mayúsculas).
//   2. Si faltan ≤ daysBefore días para su fecha (y aún no llegó), envía el
//      aviso según la CONFIGURACIÓN DE LA REGLA:
//        · ¿A QUIÉN?  recipients (CSV de User.id; "" = TODOS)
//        · ¿POR DÓNDE? channel: push (📱 móvil) | email (✉️ correo) | both
//          - 📱 con "" (TODOS) → broadcast a TODOS los móviles registrados
//          - 📱 con usuarios elegidos → solo los móviles de esos usuarios
//   3. Dedupe: cada (tarjeta, regla) notifica UNA sola vez (tabla AlertSent).
// Endpoint idempotente: rellamarlo no duplica avisos.
// ═══════════════════════════════════════════════════════════

const TZ = "Europe/Madrid";

/** Fecha de hoy en YYYY-MM-DD según el huso horario de la empresa (Madrid). */
function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Días que faltan de hoy(YYYY-MM-DD) hasta target(YYYY-MM-DD). */
function daysUntil(target: string, today: string): number {
  const [ty, tm, td] = target.split("-").map(Number);
  const [oy, om, od] = today.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(oy, om - 1, od)) / 86400000);
}

function labelWhen(diff: number): string {
  if (diff <= 0) return "HOY";
  if (diff === 1) return "MAÑANA";
  return `en ${diff} días`;
}

function labelDate(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/** Quita el "@5" o "@5:ana,pepe" de la nota antes de mostrarla. */
function stripInline(t: string): string {
  return (t || "").replace(/@\s?\d{1,2}(:[^\n]*)?/g, "").replace(/\s{2,}/g, " ").trim();
}

/** URLs de deep-link: al tocar la notificación se abre la app EN ese aviso. */
function cardUrl(source: string, id: string, date: string): string {
  return `/?fecha=${date}&card=${id}&t=${source}`;
}

/** Destinatarios inline "@5:ana,pepe": busca usuarios por nombre o email.
 *  Sin ":…" (o si nadie coincide) → TODOS los usuarios de la empresa. */
async function inlineRecipients(companyId: string, spec: string | null): Promise<string[]> {
  const users = await db.user.findMany({
    where: { companyId },
    select: { id: true, name: true, email: true },
  });
  const tokens = (spec || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) return users.map(u => u.id);
  const matched = users.filter(u => {
    const name = (u.name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    return tokens.some(tk => name.includes(tk) || email.includes(tk));
  }).map(u => u.id);
  return matched.length > 0 ? matched : users.map(u => u.id);
}

/** Usuarios destinatarios de una regla: los elegidos o TODOS los de la empresa. */
async function recipientsOf(rule: { companyId: string; recipients: string }): Promise<string[]> {
  const ids = (rule.recipients || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length > 0) return ids;
  const users = await db.user.findMany({
    where: { companyId: rule.companyId },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function GET() {
  const today = todayStr();
  const rules = await db.alertRule.findMany({ where: { enabled: true } });
  let sent = 0;
  const details: string[] = [];

  for (const rule of rules) {
    const kw = rule.keyword.toLowerCase().trim();
    if (!kw) continue;
    const channel = rule.channel || "both";
    const doPush = channel === "push" || channel === "both";
    const doEmail = channel === "email" || channel === "both";
    const userIds = await recipientsOf(rule);

    // ── 1) TARJETAS DE TURNO con nota que contiene la palabra ──
    const plans = await db.plan.findMany({
      where: {
        companyId: rule.companyId,
        date: { gte: today },
        notes: { contains: kw, mode: "insensitive" },
      },
      include: { sede: true },
    });
    for (const p of plans) {
      const diff = daysUntil(p.date, today);
      if (diff < 0 || diff > rule.daysBefore) continue;
      const dupe = await db.alertSent.findUnique({
        where: {
          source_sourceId_ruleId_targetDate: {
            source: "plan", sourceId: p.id, ruleId: rule.id, targetDate: p.date,
          },
        },
      });
      if (dupe) continue;
      const title = `🔔 ${rule.keyword.toUpperCase()} — ${labelWhen(diff)}`;
      const body = `${p.sede?.name || "sede"} · ${p.professionalAlias || "—"} · ${labelDate(p.date)} ${p.turn === "MANANA" ? "Mañana" : "Tarde"} — ${stripInline(p.notes)}`.trim();
      let n = 0;
      if (doPush) {
        n += rule.recipients
          ? await sendPushToUsers(userIds, { title, body, url: cardUrl("plan", p.id, p.date), tag: `alert-${rule.id}-${p.id}` })
          : await sendPushToAll({ title, body, url: cardUrl("plan", p.id, p.date), tag: `alert-${rule.id}-${p.id}` });
      }
      if (doEmail) {
        const email = await sendEmailToUsers(userIds, {
          companyId: rule.companyId,
          subject: title,
          body: `${body}\n\n— MURAL · ${labelDate(p.date)}`,
        });
        n += email.sent;
      }
      await db.alertSent.create({
        data: { source: "plan", sourceId: p.id, ruleId: rule.id, targetDate: p.date },
      });
      sent += n;
      details.push(`plan ${p.date} "${kw}" → ${n} envío(s) [${channel}]`);
    }

    // ── 2) AVISOS (ausencias) con nota que contiene la palabra ──
    const avisos = await db.aviso.findMany({
      where: {
        companyId: rule.companyId,
        date: { gte: today },
        note: { contains: kw, mode: "insensitive" },
      },
      include: { sede: true, professional: true },
    });
    for (const a of avisos) {
      const diff = daysUntil(a.date, today);
      if (diff < 0 || diff > rule.daysBefore) continue;
      const dupe = await db.alertSent.findUnique({
        where: {
          source_sourceId_ruleId_targetDate: {
            source: "aviso", sourceId: a.id, ruleId: rule.id, targetDate: a.date,
          },
        },
      });
      if (dupe) continue;
      const who = a.professional ? a.professional.alias : "Toda la sede";
      const title = `🔔 ${rule.keyword.toUpperCase()} — ${labelWhen(diff)}`;
      const body = `${a.sede?.name || "sede"} · ${who} · ${labelDate(a.date)} ${a.turn === "M" ? "Mañana" : "Tarde"} — ${stripInline(a.note)} (ausencia)`.trim();
      let n = 0;
      if (doPush) {
        n += rule.recipients
          ? await sendPushToUsers(userIds, { title, body, url: cardUrl("aviso", a.id, a.date), tag: `alert-${rule.id}-${a.id}` })
          : await sendPushToAll({ title, body, url: cardUrl("aviso", a.id, a.date), tag: `alert-${rule.id}-${a.id}` });
      }
      if (doEmail) {
        const email = await sendEmailToUsers(userIds, {
          companyId: rule.companyId,
          subject: title,
          body: `${body}\n\n— MURAL · ${labelDate(a.date)}`,
        });
        n += email.sent;
      }
      await db.alertSent.create({
        data: { source: "aviso", sourceId: a.id, ruleId: rule.id, targetDate: a.date },
      });
      sent += n;
      details.push(`aviso ${a.date} "${kw}" → ${n} envío(s) [${channel}]`);
    }
  }

  // ══ 3) RECORDATORIOS EN LÍNEA: "@N" dentro de la nota ══
  // Cualquier tarjeta/aviso FUTURO cuya nota contiene @N (0-60) avisa a TODO el
  // personal de su empresa (📱 push) cuando faltan ≤ N días — sin configurar nada.
  // Dedupe propio con ruleId "inline". La nota se muestra SIN el "@N".
  const stripInline = (t: string) => (t || "").replace(/@\s?\d{1,2}/g, "").replace(/\s{2,}/g, " ").trim();

  const inlinePlans = await db.plan.findMany({
    where: { date: { gte: today }, notes: { contains: "@" } },
    include: { sede: true },
  });
  for (const p of inlinePlans) {
    const m = (p.notes || "").match(/@(\d{1,2})/);
    if (!m) continue;
    const remDays = Math.min(60, parseInt(m[1], 10));
    const diff = daysUntil(p.date, today);
    if (diff < 0 || diff > remDays) continue;
    const dupe = await db.alertSent.findUnique({
      where: { source_sourceId_ruleId_targetDate: { source: "plan", sourceId: p.id, ruleId: "inline", targetDate: p.date } },
    });
    if (dupe) continue;
    const userIds = (await db.user.findMany({ where: { companyId: p.companyId }, select: { id: true } })).map(u => u.id);
    const nSent = await sendPushToUsers(userIds, {
      title: `🔔 RECORDATORIO — ${labelWhen(diff)}`,
      body: `${p.sede?.name || "sede"} · ${p.professionalAlias || "—"} · ${labelDate(p.date)} ${p.turn === "MANANA" ? "Mañana" : "Tarde"} — ${stripInline(p.notes)}`.trim(),
      url: "/",
      tag: `inline-${p.id}`,
    });
    await db.alertSent.create({ data: { source: "plan", sourceId: p.id, ruleId: "inline", targetDate: p.date } });
    sent += nSent;
    details.push(`plan ${p.date} @${remDays} → ${nSent} envío(s) [push]`);
  }

  const inlineAvisos = await db.aviso.findMany({
    where: { date: { gte: today }, note: { contains: "@" } },
    include: { sede: true, professional: true },
  });
  for (const a of inlineAvisos) {
    const m = (a.note || "").match(/@(\d{1,2})/);
    if (!m) continue;
    const remDays = Math.min(60, parseInt(m[1], 10));
    const diff = daysUntil(a.date, today);
    if (diff < 0 || diff > remDays) continue;
    const dupe = await db.alertSent.findUnique({
      where: { source_sourceId_ruleId_targetDate: { source: "aviso", sourceId: a.id, ruleId: "inline", targetDate: a.date } },
    });
    if (dupe) continue;
    const who = a.professional ? a.professional.alias : "Toda la sede";
    const userIds = (await db.user.findMany({ where: { companyId: a.companyId }, select: { id: true } })).map(u => u.id);
    const nSent = await sendPushToUsers(userIds, {
      title: `🔔 RECORDATORIO — ${labelWhen(diff)}`,
      body: `${a.sede?.name || "sede"} · ${who} · ${labelDate(a.date)} ${a.turn === "M" ? "Mañana" : "Tarde"} — ${stripInline(a.note)} (ausencia)`.trim(),
      url: "/",
      tag: `inline-${a.id}`,
    });
    await db.alertSent.create({ data: { source: "aviso", sourceId: a.id, ruleId: "inline", targetDate: a.date } });
    sent += nSent;
    details.push(`aviso ${a.date} @${remDays} → ${nSent} envío(s) [push]`);
  }

  return NextResponse.json({ ok: true, today, rules: rules.length, sent, details });
}
