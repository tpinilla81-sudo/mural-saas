const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const db = new PrismaClient();
(async () => {
  const newPassword = 'Mural2024!';
  const hash = await bcrypt.hash(newPassword, 10);
  const result = await db.user.updateMany({
    where: { email: { in: ['mural@mural.app', 'juliomurillozardoya@gmail.com', 'admin@mural.es'] } },
    data: { password: hash }
  });
  console.log('Users updated:', result.count);
  // Verify
  const users = await db.user.findMany({ select: { email: true, role: true } });
  console.log('All users now:');
  users.forEach(u => console.log(`  ${u.email} (${u.role}) -> password: Mural2024!`));
  await db.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
