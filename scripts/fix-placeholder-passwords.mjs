// fix-placeholder-passwords.mjs
// Los 8 Users creados en Task 39 tienen PLACEHOLDER_HASH (bcrypt válido pero
// desconocido). Eso hace que /api/company/permissions GET devuelva
// hasPassword=true → el panel diría "Contraseña activa configurada" y
// permitiría activar el login SIN pedir contraseña (imposible entrar).
//
// Fix: sustituir ese hash por un placeholder NO-bcrypt ("revoked_..."),
// exactamente lo que la propia API usa con passwordCleared=true.
// Así hasPassword=false → al activar "Puede iniciar sesión" el panel EXIGE
// escribir una contraseña nueva (mín. 4 chars).
//
// NO toca: julio (password real), alma@acceso.mural (password real del test),
// ni ningún otro usuario.

import { PrismaClient } from "@prisma/client";

const DATABASE_URL =
  "postgresql://neondb_owner:npg_HCYL46Awqtdy@ep-autumn-queen-aib605ks-pooler.c-4.us-east-1.aws.neon.tech/mural?channel_binding=require&sslmode=require";

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const PLACEHOLDER_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

(async () => {
  try {
    const victims = await prisma.user.findMany({
      where: { password: PLACEHOLDER_HASH },
      select: { id: true, email: true, isActive: true },
    });
    console.log(`Usuarios con placeholder hash: ${victims.length}`);
    for (const u of victims) {
      const revoked = "revoked_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      await prisma.user.update({
        where: { id: u.id },
        data: { password: revoked },
      });
      console.log(`  ✓ ${u.email} → password = "revoked_..." (requerirá contraseña nueva al activar)`);
    }
    if (victims.length === 0) console.log("  (nada que cambiar)");

    // Verificación
    const remain = await prisma.user.count({ where: { password: PLACEHOLDER_HASH } });
    console.log(`Quedan con placeholder hash: ${remain}`);
    const all = await prisma.user.findMany({ select: { email: true, isActive: true } });
    console.log(`Total users: ${all.length}`);
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
