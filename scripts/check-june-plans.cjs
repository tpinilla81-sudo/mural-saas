const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const plans = await db.plan.findMany({
    where: { date: { startsWith: '2026-06' } },
    include: { sede: true },
    orderBy: { date: 'asc' }
  });
  console.log('June 2026 plans:', plans.length);
  const byAlias = {};
  plans.forEach(p => {
    const key = p.professionalAlias || '(null)';
    byAlias[key] = (byAlias[key] || 0) + 1;
  });
  console.log('By professional:');
  Object.entries(byAlias).sort((a,b) => b[1] - a[1]).forEach(([alias, count]) => {
    console.log(`  ${alias}: ${count}`);
  });
  // Group by date
  console.log('\nSample by date (first 10 days):');
  const byDate = {};
  plans.forEach(p => {
    if (!byDate[p.date]) byDate[p.date] = [];
    byDate[p.date].push(`${p.professionalAlias}@${p.sede?.name || '?'}(${p.turn})`);
  });
  Object.keys(byDate).slice(0, 10).sort().forEach(d => {
    console.log(`  ${d}: ${byDate[d].join(', ')}`);
  });
  await db.$disconnect();
})();
