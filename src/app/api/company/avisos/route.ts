import { NextResponse } from "next/server";
import { requireCompanyUser, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { logAudit, queueAvisoEmail } from "@/lib/audit";

export async function GET() {
  // Read access available to any company user (restricted accesses need it)
  const { error, status, user } = await requireCompanyUser();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;

  const avisos = await db.aviso.findMany({
    where: { companyId },
    include: { professional: true, sede: true },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(avisos);
}

export async function POST(req: Request) {
  // Admins siempre pueden; los accesos restringidos (USER) solo si tienen el
  // permiso elegible "can_voice_avisos" (Configuración de Accesos → Acciones).
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!user.companyId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 });

  const isAdmin = user.role === "COMPANY_ADMIN" || user.role === "SUPER_ADMIN";
  if (!isAdmin) {
    const perms = new Set((user.permissions || "").split(",").map(s => s.trim()).filter(Boolean));
    if (!perms.has("can_voice_avisos")) {
      return NextResponse.json({ error: "Sin permisos para crear avisos" }, { status: 403 });
    }
  }

  const companyId = user.companyId!;
  const body = await req.json();

  if (!body.date || !body.sedeId || !body.turn) {
    return NextResponse.json({ error: "Faltan campos requeridos (date, sedeId, turn)" }, { status: 400 });
  }

  const aviso = await db.aviso.create({
    data: {
      companyId,
      date: body.date,
      professionalId: body.professionalId || null, // nullable for sede-level absences
      sedeId: body.sedeId,
      turn: body.turn, // M or T
      reason: body.reason || "",
      note: typeof body.note === "string" ? body.note : "",
    },
    include: { professional: true, sede: true },
  });

  // Auditoría + email automático (fire-and-forget, nunca bloquean)
  void logAudit({
    companyId,
    userId: user.id,
    userName: user.email || "",
    action: "AVISO_CREATE",
    entity: "Aviso",
    entityId: aviso.id,
    detail: `${aviso.date} · ${aviso.turn} · ${aviso.sede?.name || ""} · ${aviso.professional?.alias || "toda la sede"}${aviso.note ? ` · nota: ${aviso.note}` : ""}`,
  });
  void queueAvisoEmail({
    companyId,
    date: aviso.date,
    turn: aviso.turn,
    sedeName: aviso.sede?.name || "",
    proName: aviso.professional ? aviso.professional.alias : "",
    note: aviso.note || "",
  });

  return NextResponse.json(aviso, { status: 201 });
}
