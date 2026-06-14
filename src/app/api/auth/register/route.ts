import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json();
  const { email, password, name, companyId, role } = body;

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Email, contraseña y nombre requeridos" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email ya registrado" }, { status: 400 });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: { email, password: hashedPassword, name, role: role || "USER", companyId: companyId || null },
  });

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role }, { status: 201 });
}
