import { NextResponse } from "next/server";
import { getSessionUser, requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!user.companyId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // Editable: note/reason/date (admin) y seenAt (swipe "visto", cualquier usuario)
  const data: { note?: string; reason?: string; seenAt?: Date | null; date?: string } = {};
  if (typeof body.note === "string") data.note = body.note;
  if (typeof body.reason === "string") data.reason = body.reason;
  if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) data.date = body.date;
  if (body.seenAt === "now") data.seenAt = new Date();
  else if (body.seenAt === "clear") data.seenAt = null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  // Solo admin/editores cambian note/reason/date; seenAt lo marca cualquiera con sesión
  if (data.note !== undefined || data.reason !== undefined || data.date !== undefined) {
    const { error, status } = await requireCompanyAdmin();
    if (error) return NextResponse.json({ error }, { status });
  }

  const aviso = await db.aviso.update({
    where: { id },
    data,
    include: { professional: true, sede: true },
  });

  if (data.seenAt) {
    void logAudit({
      companyId: user.companyId,
      userId: user.id,
      userName: user.email || "",
      action: "AVISO_SEEN",
      entity: "Aviso",
      entityId: aviso.id,
      detail: `${aviso.date} · ${aviso.turn} · ${aviso.sede?.name || ""}`,
    });
  }
  return NextResponse.json(aviso);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!user.companyId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 });
  const { error, status } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const aviso = await db.aviso.delete({
    where: { id },
    include: { professional: true, sede: true },
  }).catch(() => null);

  void logAudit({
    companyId: user.companyId,
    userId: user.id,
    userName: user.email || "",
    action: "AVISO_DELETE",
    entity: "Aviso",
    entityId: id,
    detail: aviso ? `${aviso.date} · ${aviso.turn} · ${aviso.sede?.name || ""}` : id,
  });
  return NextResponse.json({ ok: true });
}
