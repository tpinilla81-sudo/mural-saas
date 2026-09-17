const fs = require('fs');
const envText = fs.readFileSync('.env', 'utf8');
const lines = envText.split('\n');
const env = {};
for (const line of lines) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}
console.log('DATABASE_URL project:', env.DATABASE_URL.match(/ep-[a-z0-9-]+/)?.[0]);
console.log('DIRECT_URL   project:', env.DIRECT_URL.match(/ep-[a-z0-9-]+/)?.[0]);
console.log('DATABASE_URL params:', env.DATABASE_URL.split('?')[1]);
console.log('DIRECT_URL   params:', env.DIRECT_URL.split('?')[1]);

// Test connection to DATABASE_URL
process.env.DATABASE_URL = env.DATABASE_URL;
delete process.env.DIRECT_URL;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const plans = await prisma.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Plan','Sede','Professional','User','Aviso','Holiday') ORDER BY table_name`);
    console.log('\nTables at DATABASE_URL:');
    plans.forEach(p => console.log(' -', p.table_name));
  } catch (e) { console.error('DATABASE_URL query err:', e.message); }
  await prisma.$disconnect();
})();
