const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const plans = await db.plan.findMany({ select: { professionalAlias: true, date: true } });
  console.log('Total plans:', plans.length);
  const byAlias = {};
  plans.forEach(p => {
    const key = p.professionalAlias || '(null)';
    byAlias[key] = (byAlias[key] || 0) + 1;
  });
  console.log('\nPlans per professional:');
  Object.entries(byAlias).sort((a,b) => b[1] - a[1]).forEach(([alias, count]) => {
    console.log(`  ${alias}: ${count}`);
  });
  // Also check the dates range
  const dates = plans.map(p => p.date).sort();
  if (dates.length > 0) {
    console.log(`\nDate range: ${dates[0]} → ${dates[dates.length-1]}`);
  }
  await db.$disconnect();
})();
