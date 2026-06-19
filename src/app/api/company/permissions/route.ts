import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// ───────────────────────────────────────────────────────────
// Permission catalog (kept in sync with ConfigTab.tsx + UserView.tsx)
// ───────────────────────────────────────────────────────────
export const PERM_KEYS = [
  "view_diario",
  "edit_diario",
  "view_mensual",
  "edit_mensual",
  "view_sedes",
  "edit_sedes",
  "view_own_only",
  "view_assigned_sedes",
  "can_print",
  "can_send",
] as const;
export type PermKey = (typeof PERM_KEYS)[number];

export function parsePerms(csv: string): Record<PermKey, boolean> {
  const set = new Set((csv || "").split(",").map(s => s.trim()).filter(Boolean));
  const out = {} as Record<PermKey, boolean>;
  for (const k of PERM_KEYS) out[k] = set.has(k);
  return out;
}

export function permsToCsv(p: Record<PermKey, boolean>): string {
  return PERM_KEYS.filter(k => p[k]).join(",");
}

// GET /api/company/permissions
// Returns all professionals of the company with their associated User (if any)
// and parsed permissions.
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
        hasPin: !!u.pin,
        permissions: parsePerms(u.permissions),
      } : null,
      canLogin: !!u && u.isActive,
    };
  });

  return NextResponse.json(result);
}

// PUT /api/company/permissions
// Body: {
//   professionalId,
//   canLogin: boolean,
//   email?: string,         // overrides pro.email if provided (used as login identifier)
//   pin?: string | null,   // 4-digit PIN to set; null/"" to clear; undefined to leave unchanged
//   view_diario, edit_diario,
//   view_mensual, edit_mensual,
//   view_sedes, edit_sedes,
//   view_own_only, view_assigned_sedes,
//   can_print, can_send
// }
// Note: login is passwordless. The User.password column is required NOT NULL by
// the schema, so we store a random placeholder hash that is never checked.
// The PIN is optional and stored as a bcrypt hash.
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 });
  if (user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { professionalId, canLogin, email, pin } = body;
  if (!professionalId) return NextResponse.json({ error: "Falta professionalId" }, { status: 400 });

  // Validate PIN if explicitly provided (string or null). `undefined` means "leave unchanged".
  let pinHash: string | null | undefined = undefined;
  if (pin !== undefined) {
    if (pin === null || pin === "") {
      pinHash = null; // clear
    } else {
      const pinStr = String(pin).trim();
      if (!/^\d{4}$/.test(pinStr)) {
        return NextResponse.json({ error: "El PIN debe ser 4 dígitos" }, { status: 400 });
      }
      pinHash = await bcrypt.hash(pinStr, 10);
    }
  }

  const pro = await db.professional.findFirst({
    where: { id: professionalId, companyId: user.companyId },
  });
  if (!pro) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });

  // Resolve final email: body.email > pro.email
  const finalEmail = (typeof email === "string" ? email.trim() : "") || pro.email;
  if (!finalEmail || !finalEmail.includes("@")) {
    return NextResponse.json({ error: "El profesional necesita un email válido" }, { status: 400 });
  }

  // Look for an existing linked User
  let linked = await db.user.findFirst({
    where: {
      companyId: user.companyId,
      OR: [
        { professionalId: pro.id },
        { email: finalEmail },
        ...(pro.email ? [{ email: pro.email }] : []),
      ],
    },
  });

  // Build perms object from body
  const perms: Record<PermKey, boolean> = {
    view_diario: !!body.view_diario,
    edit_diario: !!body.edit_diario,
    view_mensual: !!body.view_mensual,
    edit_mensual: !!body.edit_mensual,
    view_sedes: !!body.view_sedes,
    edit_sedes: !!body.edit_sedes,
    view_own_only: !!body.view_own_only,
    view_assigned_sedes: !!body.view_assigned_sedes,
    can_print: !!body.can_print,
    can_send: !!body.can_send,
  };
  const permsCsv = permsToCsv(perms);

  if (canLogin) {
    // Email collision check across the whole users table
    const collision = await db.user.findUnique({ where: { email: finalEmail } });
    if (collision && (!linked || collision.id !== linked.id)) {
      return NextResponse.json(
        { error: `El email ${finalEmail} ya está usado por otro usuario` },
        { status: 400 }
      );
    }

    if (linked) {
      linked = await db.user.update({
        where: { id: linked.id },
        data: {
          email: finalEmail,
          isActive: true,
          role: "USER",
          companyId: user.companyId,
          professionalId: pro.id,
          name: `${pro.firstName} ${pro.lastName}`.trim(),
          permissions: permsCsv,
          ...(pinHash !== undefined ? { pin: pinHash } : {}),
        },
      });
    } else {
      linked = await db.user.create({
        data: {
          email: finalEmail,
          name: `${pro.firstName} ${pro.lastName}`.trim(),
          // Schema requires NOT NULL; password is never checked (passwordless login)
          password: Math.random().toString(36).slice(2) + Date.now().toString(36),
          role: "USER",
          companyId: user.companyId,
          professionalId: pro.id,
          isActive: true,
          permissions: permsCsv,
          ...(pinHash !== undefined && pinHash !== null ? { pin: pinHash } : {}),
        },
      });
    }

    // Also sync the professional's email so the pro record stays consistent
    await db.professional.update({
      where: { id: pro.id },
      data: { email: finalEmail },
    });
  } else {
    if (linked) {
      linked = await db.user.update({
        where: { id: linked.id },
        data: {
          isActive: false,
          permissions: permsCsv,
          ...(pinHash !== undefined ? { pin: pinHash } : {}),
        },
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
      hasPin: !!linked.pin,
      permissions: parsePerms(linked.permissions),
    } : null,
  });
}
