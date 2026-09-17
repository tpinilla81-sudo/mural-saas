const fs = require('fs');
const envText = fs.readFileSync('.env', 'utf8');
const lines = envText.split('\n');
for (const line of lines) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // User table columns
  const userCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'User' ORDER BY ordinal_position
  `);
  console.log('=== User table columns ===');
  userCols.forEach(c => console.log(' -', c.column_name, '(', c.data_type, ')'));
  
  // Check for Plan table (case-insensitive)
  const planTables = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name ILIKE '%plan%'
  `);
  console.log('\n=== Tables matching "plan" ===');
  planTables.forEach(t => console.log(' -', t.table_name));
  
  // Count users
  const userCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as n FROM "User"`);
  console.log('\nUser count:', userCount[0].n);
  
  // User rows
  const users = await prisma.$queryRawUnsafe(`SELECT email, name, role FROM "User" LIMIT 5`);
  console.log('\nUsers:', users);
  
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
