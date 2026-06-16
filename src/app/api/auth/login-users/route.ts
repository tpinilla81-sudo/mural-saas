import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public endpoint: returns the list of active users for the passwordless login selector.
// Returns: [{ id, email, name, role, companyName? }]
export async function GET() {
  const users = await db.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company: { select: { name: true } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const list = users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name || u.email,
    role: u.role,
    companyName: u.company?.name || null,
  }));

  return NextResponse.json(list);
}
