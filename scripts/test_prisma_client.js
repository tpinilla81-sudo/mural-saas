const fs = require('fs');
const envText = fs.readFileSync('.env', 'utf8');
const lines = envText.split('\n');
for (const line of lines) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}
console.log('DB host:', process.env.DATABASE_URL?.match(/ep-[a-z0-9-]+/)?.[0]);
console.log('DIRECT host:', process.env.DIRECT_URL?.match(/ep-[a-z0-9-]+/)?.[0]);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const users = await prisma.user.findMany({ select: { email: true, pin: true, isActive: true } });
  console.log('prisma.user.findMany result:');
  users.forEach(u => console.log(' -', u.email, '| pin:', u.pin, '| isActive:', u.isActive));
  await prisma.$disconnect();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
