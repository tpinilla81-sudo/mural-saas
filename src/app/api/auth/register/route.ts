import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// Password is optional now — auth is passwordless.
// If not provided, a random one is generated and stored (unused, but DB column is NOT NULL).
export async function POST(req: Request) {
  const body = await req.json();
  const { email, name, companyId, role } = body;

  if (!email || !name) {
    return NextResponse.json({ error: "Email y nombre requeridos" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email ya registrado" }, { status: 400 });

  const password = body.password || Math.random().toString(36).slice(2) + Date.now().toString(36);
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: { email, password: hashedPassword, name, role: role || "USER", companyId: companyId || null },
  });

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role }, { status: 201 });
}
