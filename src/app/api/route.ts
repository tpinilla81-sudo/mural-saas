import { NextResponse } from "next/server";

// Generic root endpoint — intentionally returns no identifying information.
export async function GET() {
  return NextResponse.json({ ok: true });
}
