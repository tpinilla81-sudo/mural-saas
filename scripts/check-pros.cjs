const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const pros = await db.professional.findMany({ select: { id: true, firstName: true, lastName: true, alias: true, companyId: true } });
  console.log('Total professionals:', pros.length);
  console.log('By company:');
  const byCompany = {};
  pros.forEach(p => { byCompany[p.companyId] = (byCompany[p.companyId] || 0) + 1; });
  console.log(byCompany);
  console.log('\nAll pros:');
  pros.forEach(p => console.log(`  ${p.alias} - ${p.firstName} ${p.lastName} (companyId=${p.companyId})`));
  await db.$disconnect();
})();
