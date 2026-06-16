import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const userCount = await db.user.count();
    const sedeCount = await db.sede.count();
    return NextResponse.json({ 
      status: "connected", 
      users: userCount, 
      sedes: sedeCount,
      dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) + "..."
    });
  } catch (e: any) {
    return NextResponse.json({ 
      status: "error", 
      message: e.message?.substring(0, 300),
      dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) + "..."
    }, { status: 500 });
  }
}
