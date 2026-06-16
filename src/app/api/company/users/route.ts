import { NextResponse } from "next/server";
import { requireCompanyAdmin, getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

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
  const { email, password, name, role } = body;

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Email, contraseña y nombre requeridos" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email ya registrado" }, { status: 400 });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await db.user.create({
    data: { email, password: hashedPassword, name, role: role || "USER", companyId },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  return NextResponse.json(newUser, { status: 201 });
}
