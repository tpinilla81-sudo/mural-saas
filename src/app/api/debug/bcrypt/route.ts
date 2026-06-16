import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Test bcrypt on Vercel
    const hash = await bcrypt.hash("test123", 10);
    const match = await bcrypt.compare("test123", hash);
    
    // Test against the known mural@mural.app password
    const user = await db.user.findUnique({ where: { email: "mural@mural.app" } });
    const passwordMatch = user ? await bcrypt.compare("mural123", user.password) : false;
    
    return NextResponse.json({
      bcryptWorks: match,
      userExists: !!user,
      passwordMatch,
      hashPrefix: user?.password?.substring(0, 20),
      userRole: user?.role,
      userActive: user?.isActive,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message?.substring(0, 300) }, { status: 500 });
  }
}
