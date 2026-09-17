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
  // Check current column state
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'Plan' AND column_name = 'notes'
  `);
  console.log('Existing notes column:', cols);
  if (cols.length === 0) {
    console.log('Adding notes column...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Plan" ADD COLUMN "notes" TEXT NOT NULL DEFAULT ''`);
    console.log('Added.');
  } else {
    console.log('Notes column already exists, skipping.');
  }
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
