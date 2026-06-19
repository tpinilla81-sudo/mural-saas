import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    
    const envInfo = {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT SET",
      VERCEL_URL: process.env.VERCEL_URL || "NOT SET",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "SET" : "NOT SET (using fallback)",
      DATABASE_URL_prefix: process.env.DATABASE_URL?.substring(0, 30) || "NOT SET",
    };
    
    // 1. Find user
    const user = await db.user.findUnique({ 
      where: { email },
      include: { company: true }
    });
    
    if (!user) return NextResponse.json({ step: "find_user", error: "User not found", email, env: envInfo });
    if (!user.isActive) return NextResponse.json({ step: "active_check", error: "User inactive", env: envInfo });
    
    // 2. Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return NextResponse.json({ step: "password_check", error: "Invalid password", email, env: envInfo });
    
    // 3. Return user data (without password)
    const { password: _, ...safeUser } = user;
    return NextResponse.json({ step: "success", user: safeUser, env: envInfo });
  } catch (e: any) {
    return NextResponse.json({ step: "exception", error: e.message?.substring(0, 300) }, { status: 500 });
  }
}
