import { NextResponse } from "next/server";
import { requireCompanyAdmin, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// Placeholder hash — auth is passwordless now (login via user picker).
// We still store a hash because the DB column is NOT NULL (kept for backward compat).
const PLACEHOLDER_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function GET() {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const users = await db.user.findMany({
    where: { companyId },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const body = await req.json();
  const { email, name, role } = body;

  if (!email || !name) {
    return NextResponse.json({ error: "Email y nombre requeridos" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email ya registrado" }, { status: 400 });

  // Password is now optional — if provided we hash it, else use placeholder (unused).
  const password = body.password || Math.random().toString(36).slice(2) + Date.now().toString(36);
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: role || "USER",
      companyId,
    },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  return NextResponse.json(newUser, { status: 201 });
}
