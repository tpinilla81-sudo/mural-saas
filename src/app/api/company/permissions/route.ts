import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Permission keys stored as CSV in User.permissions
const PERM_KEYS = ["view_diario", "view_mensual", "view_own_only", "view_assigned_sedes"] as const;
type PermKey = (typeof PERM_KEYS)[number];

function parsePerms(csv: string): Record<PermKey, boolean> {
  const set = new Set((csv || "").split(",").map(s => s.trim()).filter(Boolean));
  return {
    view_diario: set.has("view_diario"),
    view_mensual: set.has("view_mensual"),
    view_own_only: set.has("view_own_only"),
    view_assigned_sedes: set.has("view_assigned_sedes"),
  };
}

function permsToCsv(p: Record<PermKey, boolean>): string {
  return PERM_KEYS.filter(k => p[k]).join(",");
}

// GET /api/company/permissions
// Returns all professionals of the company with their associated User (if any) and parsed permissions.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 });

  const pros = await db.professional.findMany({
    where: { companyId: user.companyId },
    orderBy: [{ alias: "asc" }],
  });

  const proIds = pros.map(p => p.id);
  const linkedUsers = await db.user.findMany({
    where: {
      companyId: user.companyId,
      OR: [
        { professionalId: { in: proIds } },
        { email: { in: pros.map(p => p.email).filter(Boolean) } },
      ],
    },
  });

  const userByProId = new Map<string, any>();
  for (const u of linkedUsers) {
    if (u.professionalId) userByProId.set(u.professionalId, u);
  }
  for (const p of pros) {
    if (userByProId.has(p.id)) continue;
    if (!p.email) continue;
    const byEmail = linkedUsers.find(u => u.email === p.email);
    if (byEmail) userByProId.set(p.id, byEmail);
  }

  const result = pros.map(p => {
    const u = userByProId.get(p.id);
    return {
      professional: {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        alias: p.alias,
        email: p.email,
        phone: p.phone,
        assignedSedes: p.assignedSedes,
      },
      user: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        isActive: u.isActive,
        permissions: parsePerms(u.permissions),
      } : null,
      canLogin: !!u && u.isActive,
    };
  });

  return NextResponse.json(result);
}

// PUT /api/company/permissions
// Body: { professionalId, canLogin, view_diario, view_mensual, view_own_only, view_assigned_sedes }
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 });
  if (user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { professionalId, canLogin, view_diario, view_mensual, view_own_only, view_assigned_sedes } = body;
  if (!professionalId) return NextResponse.json({ error: "Falta professionalId" }, { status: 400 });

  const pro = await db.professional.findFirst({
    where: { id: professionalId, companyId: user.companyId },
  });
  if (!pro) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });

  if (!pro.email || !pro.email.includes("@")) {
    return NextResponse.json({ error: "El profesional necesita un email válido" }, { status: 400 });
  }

  let linked = await db.user.findFirst({
    where: {
      companyId: user.companyId,
      OR: [
        { professionalId: pro.id },
        { email: pro.email },
      ],
    },
  });

  const perms: Record<PermKey, boolean> = {
    view_diario: !!view_diario,
    view_mensual: !!view_mensual,
    view_own_only: !!view_own_only,
    view_assigned_sedes: !!view_assigned_sedes,
  };
  const permsCsv = permsToCsv(perms);

  if (canLogin) {
    if (!linked) {
      const collision = await db.user.findUnique({ where: { email: pro.email } });
      if (collision) {
        return NextResponse.json(
          { error: `El email ${pro.email} ya está usado por otro usuario` },
          { status: 400 }
        );
      }
    }

    if (linked) {
      linked = await db.user.update({
        where: { id: linked.id },
        data: {
          isActive: true,
          role: "USER",
          companyId: user.companyId,
          professionalId: pro.id,
          name: `${pro.firstName} ${pro.lastName}`.trim(),
          permissions: permsCsv,
        },
      });
    } else {
      linked = await db.user.create({
        data: {
          email: pro.email,
          name: `${pro.firstName} ${pro.lastName}`.trim(),
          password: Math.random().toString(36).slice(2) + Date.now().toString(36),
          role: "USER",
          companyId: user.companyId,
          professionalId: pro.id,
          isActive: true,
          permissions: permsCsv,
        },
      });
    }
  } else {
    if (linked) {
      linked = await db.user.update({
        where: { id: linked.id },
        data: { isActive: false, permissions: permsCsv },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    professionalId: pro.id,
    canLogin: canLogin && !!linked?.isActive,
    user: linked ? {
      id: linked.id,
      email: linked.email,
      name: linked.name,
      isActive: linked.isActive,
      permissions: parsePerms(linked.permissions),
    } : null,
  });
}
