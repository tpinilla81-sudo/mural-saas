const fs = require('fs');
const envText = fs.readFileSync('.env', 'utf8');
const lines = envText.split('\n');
for (const line of lines) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const users = await prisma.user.findMany({
    select: { email: true, pin: true, name: true, isActive: true, role: true }
  });
  if (users.length === 0) { console.log('No hay usuarios.'); return; }
  console.log('=== Estado de PIN por usuario ===\n');
  users.forEach(u => {
    const pinStatus = u.pin ? '[PIN ACTIVO · hash bcrypt ' + u.pin.length + ' chars]' : '(sin PIN)';
    console.log(`${u.email.padEnd(40)} | role=${(u.role||'').padEnd(10)} | active=${u.isActive} | ${pinStatus}`);
  });
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
