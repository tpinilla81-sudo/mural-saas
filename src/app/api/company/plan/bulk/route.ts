import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { error, status, user } = await requireCompanyAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const companyId = user!.companyId!;
  const body = await req.json(); // { assignments: [{ sedeId, date, turn, professionalAlias }], removals: [id] }

  const results = { created: 0, updated: 0, removed: 0 };

  // Remove assignments
  if (body.removals?.length) {
    for (const id of body.removals) {
      await db.plan.delete({ where: { id } }).catch(() => {});
      results.removed++;
    }
  }

  // Create/update assignments
  if (body.assignments?.length) {
    for (const a of body.assignments) {
      try {
        await db.plan.create({
          data: { companyId, sedeId: a.sedeId, date: a.date, turn: a.turn, professionalAlias: a.professionalAlias },
        });
        results.created++;
      } catch (e: any) {
        if (e.code === "P2002") {
          await db.plan.update({
            where: { sedeId_date_turn: { sedeId: a.sedeId, date: a.date, turn: a.turn } },
            data: { professionalAlias: a.professionalAlias },
          });
          results.updated++;
        }
      }
    }
  }

  return NextResponse.json(results);
}
