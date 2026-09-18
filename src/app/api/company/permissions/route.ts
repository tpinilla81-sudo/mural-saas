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
// and parsed permissions + mensual view restrictions.
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
        hasPassword: !!u.password && u.password.startsWith("$2"),
        permissions: parsePerms(u.permissions),
        allowedSedes: u.allowedSedes || "",
        allowedPros: u.allowedPros || "",
        showNotes: u.showNotes !== false,
        showVacaciones: u.showVacaciones !== false,
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
//   email?: string,          // login identifier (auto-generated if missing)
//   password?: string,       // plain password to set (bcrypt-hashed). Required when
//                            // enabling login on a user that has no password yet.
//   passwordCleared?: boolean, // true → reset to a random unknown hash (login impossible)
//   view_diario, edit_diario, view_mensual, edit_mensual,
//   view_sedes, edit_sedes, view_own_only, view_assigned_sedes,
//   can_print, can_send,
//   allowedSedes?: string,   // CSV of sede names visible in Mensual ("" = all)
//   allowedPros?: string,    // CSV of pro aliases visible in Mensual ("" = all)
//   showNotes?: boolean,     // can see notes on cards
//   showVacaciones?: boolean // can see vacation/absence cards
// }
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 });
  if (user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { professionalId, canLogin, email, password, passwordCleared } = body;
  if (!professionalId) return NextResponse.json({ error: "Falta professionalId" }, { status: 400 });

  // Password handling:
  //  - password (non-empty string) → hash and store (the login password for this access)
  //  - passwordCleared === true → store a random unknown hash so the access can't log in
  //  - undefined → leave unchanged
  let passwordHash: string | undefined | null = undefined;
  if (typeof password === "string" && password.trim() !== "") {
    const pw = password.trim();
    if (pw.length < 4) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 4 caracteres" }, { status: 400 });
    }
    passwordHash = await bcrypt.hash(pw, 10);
  } else if (passwordCleared === true) {
    passwordHash = "revoked_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  const pro = await db.professional.findFirst({
    where: { id: professionalId, companyId: user.companyId },
  });
  if (!pro) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });

  // Resolve final email: body.email > pro.email > auto-generated from alias
  let finalEmail = (typeof email === "string" ? email.trim() : "") || pro.email;
  if (!finalEmail || !finalEmail.includes("@")) {
    finalEmail = `${(pro.alias || "acceso").toLowerCase().replace(/[^a-z0-9]/g, "")}@acceso.mural`;
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

  // Mensual view restrictions
  const allowedSedes = typeof body.allowedSedes === "string" ? body.allowedSedes : "";
  const allowedPros = typeof body.allowedPros === "string" ? body.allowedPros : "";
  const showNotes = body.showNotes !== false;
  const showVacaciones = body.showVacaciones !== false;

  if (canLogin) {
    // Email collision check across the whole users table
    const collision = await db.user.findUnique({ where: { email: finalEmail } });
    if (collision && (!linked || collision.id !== linked.id)) {
      return NextResponse.json(
        { error: `El email ${finalEmail} ya está usado por otro usuario` },
        { status: 400 }
      );
    }

    // A password is mandatory to enable login (either a new one or one set previously)
    const existing = linked ? await db.user.findUnique({ where: { id: linked.id } }) : null;
    const hasExistingPw = !!existing && existing.password.startsWith("$2");
    if (!passwordHash && !hasExistingPw) {
      return NextResponse.json(
        { error: "Introduce una contraseña para este acceso (mínimo 4 caracteres)" },
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
          allowedSedes,
          allowedPros,
          showNotes,
          showVacaciones,
          ...(passwordHash ? { password: passwordHash } : {}),
        },
      });
    } else {
      linked = await db.user.create({
        data: {
          email: finalEmail,
          name: `${pro.firstName} ${pro.lastName}`.trim(),
          password: passwordHash || Math.random().toString(36).slice(2) + Date.now().toString(36),
          role: "USER",
          companyId: user.companyId,
          professionalId: pro.id,
          isActive: true,
          permissions: permsCsv,
          allowedSedes,
          allowedPros,
          showNotes,
          showVacaciones,
        },
      });
    }

    // Also sync the professional's email so the pro record stays consistent
    if (finalEmail.includes("@") && !finalEmail.endsWith("@acceso.mural")) {
      await db.professional.update({
        where: { id: pro.id },
        data: { email: finalEmail },
      });
    }
  } else {
    if (linked) {
      linked = await db.user.update({
        where: { id: linked.id },
        data: {
          isActive: false,
          permissions: permsCsv,
          allowedSedes,
          allowedPros,
          showNotes,
          showVacaciones,
          ...(passwordHash ? { password: passwordHash } : {}),
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
      hasPassword: !!linked.password && linked.password.startsWith("$2"),
      permissions: parsePerms(linked.permissions),
      allowedSedes: linked.allowedSedes || "",
      allowedPros: linked.allowedPros || "",
      showNotes: linked.showNotes !== false,
      showVacaciones: linked.showVacaciones !== false,
    } : null,
  });
}
