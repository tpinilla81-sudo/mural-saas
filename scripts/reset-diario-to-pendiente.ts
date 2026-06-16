// Reset existing CUMPLIDA diario items to PENDIENTE (so user can re-validate them properly)
import { db } from "../src/lib/db";

async function main() {
  const result = await db.billDiarioItem.updateMany({
    where: { status: "CUMPLIDA" },
    data: { status: "PENDIENTE" },
  });
  console.log(`Reset ${result.count} items from CUMPLIDA → PENDIENTE`);

  // Also remove all existing lineas (since they were created with old logic)
  const lineasDeleted = await db.billDiarioLine.deleteMany({});
  console.log(`Deleted ${lineasDeleted.count} lineas (will be re-created on validate)`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
