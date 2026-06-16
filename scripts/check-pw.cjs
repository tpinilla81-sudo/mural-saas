const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const db = new PrismaClient();
(async () => {
  const users = await db.user.findMany({ select: { id: true, email: true, name: true, role: true, password: true, companyId: true } });
  console.log('Users in DB:', users.length);
  for (const u of users) {
    const pw = u.password || '';
    const isBcrypt = pw.startsWith('$2a$') || pw.startsWith('$2b$') || pw.startsWith('$2y$');
    let match = false;
    if (u.email === 'admin@mural.es') {
      match = await bcrypt.compare('Mural2024!', pw);
    }
    console.log(`  ${u.email} | role=${u.role} | pwLen=${pw.length} | isBcrypt=${isBcrypt} | matchesMural2024=${match}`);
  }
  await db.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
