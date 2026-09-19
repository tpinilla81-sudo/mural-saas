import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPushToAll } from "@/lib/push";

// ═══════════════════════════════════════════════════════════
// GET /api/cron/alerts — JOB DIARIO (Vercel Cron 08:00 UTC ≈ 10:00 Madrid)
//
// Para cada regla activa (palabra + días antes):
//   1. Busca tarjetas (Plan.notes) y avisos (Aviso.note) FUTUROS cuya nota
//      contenga la palabra (sin distinguir mayúsculas).
//   2. Si faltan ≤ daysBefore días para su fecha (y aún no llegó),
//      envía la notificación push a todos los móviles suscritos.
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

export async function GET() {
  const today = todayStr();
  const rules = await db.alertRule.findMany({ where: { enabled: true } });
  let sent = 0;
  const details: string[] = [];

  for (const rule of rules) {
    const kw = rule.keyword.toLowerCase().trim();
    if (!kw) continue;

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
      const n = await sendPushToAll({
        title: `🔔 ${rule.keyword.toUpperCase()} — ${labelWhen(diff)}`,
        body: `TARJETA ${labelDate(p.date)} · ${p.sede?.name || "sede"} · ${p.turn === "MANANA" ? "Mañana" : "Tarde"} — ${p.notes || ""}`.trim(),
        url: "/",
        tag: `alert-${rule.id}-${p.id}`,
      });
      await db.alertSent.create({
        data: { source: "plan", sourceId: p.id, ruleId: rule.id, targetDate: p.date },
      });
      sent += n;
      details.push(`plan ${p.date} "${kw}" → ${n} dispositivo(s)`);
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
      const n = await sendPushToAll({
        title: `🔔 ${rule.keyword.toUpperCase()} — ${labelWhen(diff)}`,
        body: `AVISO ${labelDate(a.date)} · ${a.sede?.name || "sede"} · ${who} · ${a.turn === "M" ? "Mañana" : "Tarde"} — ${a.note || ""}`.trim(),
        url: "/",
        tag: `alert-${rule.id}-${a.id}`,
      });
      await db.alertSent.create({
        data: { source: "aviso", sourceId: a.id, ruleId: rule.id, targetDate: a.date },
      });
      sent += n;
      details.push(`aviso ${a.date} "${kw}" → ${n} dispositivo(s)`);
    }
  }

  return NextResponse.json({ ok: true, today, rules: rules.length, sent, details });
}
