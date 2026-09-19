import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";
import { db } from "@/lib/db";

/** GET: branding ligero de la empresa (logo, color, nombre) — cualquier usuario autenticado */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!user.companyId) return NextResponse.json({});

  const company = await db.company.findUnique({
    where: { id: user.companyId },
    select: { name: true, logoUrl: true, brandColor: true },
  });
  return NextResponse.json(company || {});
}
