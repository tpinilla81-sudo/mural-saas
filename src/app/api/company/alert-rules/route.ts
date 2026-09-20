import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { emailConfigured } from "@/lib/email";

// ═══════════════════════════════════════════════════════════
// AVISOS PROGRAMADOS — reglas (palabra en notas + días antes)
// GET  /api/company/alert-rules  → { rules, emailConfigured, users }
// POST /api/company/alert-rules  → crear { keyword, daysBefore, recipients, channel }
// ═══════════════════════════════════════════════════════════

const CHANNELS = ["push", "email", "both"];

/** Usuarios de la empresa (destinatarios posibles de los avisos). */
export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error || !user) return NextResponse.json({ error }, { status });
  const [rules, users] = await Promise.all([
    db.alertRule.findMany({
      where: { companyId: user.companyId! },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: { companyId: user.companyId! },
      select: {
        id: true, email: true, name: true, role: true, isActive: true,
        professionalId: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);
  return NextResponse.json({
    rules,
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
    })),
    emailConfigured: emailConfigured(),
  });
}

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error || !user) return NextResponse.json({ error }, { status });
  const body = await req.json().catch(() => ({}));
  const keyword = String(body.keyword || "").trim();
  const daysBefore = Math.max(0, Math.min(365, parseInt(body.daysBefore, 10) || 1));
  if (!keyword) return NextResponse.json({ error: "Escribe la palabra o texto" }, { status: 400 });

  // Destinatarios: CSV de userIds ("" = TODOS los usuarios de la empresa)
  let recipients = "";
  if (Array.isArray(body.recipients) && body.recipients.length > 0) {
    const companyUsers = await db.user.findMany({
      where: { companyId: user.companyId! },
      select: { id: true },
    });
    const valid = new Set(companyUsers.map((u) => u.id));
    const list = body.recipients.map((r: unknown) => String(r)).filter((r: string) => valid.has(r));
    recipients = [...new Set(list)].join(",");
  }
  // Canal: push | email | both
  const channel = CHANNELS.includes(body.channel) ? body.channel : "both";

  const rule = await db.alertRule.create({
    data: { companyId: user.companyId!, keyword, daysBefore, recipients, channel },
  });
  return NextResponse.json(rule, { status: 201 });
}
