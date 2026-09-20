// sync-10-users.mjs
// Hace que la empresa Mural Plastic Surgery tenga exactamente 10 usuarios
// en la sección "Usuarios" de Configuración, uno por cada profesional.
//
// Pasos:
//   1. Borra 2 cuentas inactivas sobrantes: mural@mural.app (SUPER_ADMIN) y
//      admin@mural.es (COMPANY_ADMIN) — el usuario las desactivó en Task 22
//      y nunca las ha vuelto a usar.
//   2. Enlaza el User existente de Julio (juliomurillozardoya@gmail.com,
//      COMPANY_ADMIN, isActive=true) con el Professional "JM" (Julio Murillo)
//      seteando professionalId. Julio sigue con su contraseña julio1974@.
//   3. Crea 8 nuevos Users inactivos (uno por cada profesional sin User):
//      JC, ME, BM, MM, AP, JR, AS, PZ. Cada uno:
//        - email = el email real del profesional
//        - name  = "FIRSTNAME LASTNAME"
//        - role  = USER
//        - isActive = false   (no aparecen en el login picker hasta que
//                              Julio les dé contraseña en Permisos)
//        - password = placeholder hash (no sirve para loguearse)
//        - companyId = el de Mural Plastic Surgery
//        - professionalId = el del profesional correspondiente
//
// Resultado: 10 Users, cada uno enlazado a un Professional distinto.
// Permisos → 10 profesionales con acceso asignado (1 activo = Julio, 9 inactivos).
// Usuarios → 10 entradas (1 COMPANY_ADMIN + 9 USER).

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const DATABASE_URL =
  "postgresql://neondb_owner:npg_HCYL46Awqtdy@ep-autumn-queen-aib605ks-pooler.c-4.us-east-1.aws.neon.tech/mural?channel_binding=require&sslmode=require";

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const PLACEHOLDER_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

(async () => {
  try {
    console.log("== Paso 1: borrar 2 cuentas inactivas sobrantes ==");
    const deleted = [];
    for (const email of ["mural@mural.app", "admin@mural.es"]) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (u) {
        await prisma.user.delete({ where: { id: u.id } });
        deleted.push(`${email} (was ${u.role}, active=${u.isActive})`);
      }
    }
    console.log("  Borrados: " + (deleted.length ? deleted.join(", ") : "(nada que borrar)"));

    console.log("\n== Paso 2: enlazar Julio (COMPANY_ADMIN) al profesional JM ==");
    const julioPro = await prisma.professional.findFirst({
      where: { alias: "JM", firstName: { contains: "JULIO" } },
    });
    if (!julioPro) {
      throw new Error("No encuentro al profesional JM (JULIO MURILLO)");
    }
    const julioUser = await prisma.user.findUnique({
      where: { email: "juliomurillozardoya@gmail.com" },
    });
    if (!julioUser) {
      throw new Error("No encuentro al User de Julio (juliomurillozardoya@gmail.com)");
    }
    // Comprobar si el email del profesional JM es distinto del email del User
    // (no debería chocar con nadie más porque el email es único).
    await prisma.user.update({
      where: { id: julioUser.id },
      data: { professionalId: julioPro.id },
    });
    console.log(
      `  ✓ User ${julioUser.email} → linked to pro "${julioPro.alias}" (${julioPro.firstName} ${julioPro.lastName}, id=${julioPro.id})`,
    );

    console.log("\n== Paso 3: crear 8 Users inactivos para los pros sin User ==");
    const pros = await prisma.professional.findMany({
      orderBy: { alias: "asc" },
    });
    const existingLinked = await prisma.user.findMany({
      where: { professionalId: { not: null } },
      select: { professionalId: true },
    });
    const linkedIds = new Set(existingLinked.map((u) => u.professionalId));
    // Julio's User (just linked) is now in linkedIds too.

    let created = 0;
    for (const p of pros) {
      if (linkedIds.has(p.id)) {
        console.log(`  - ${p.alias} (${p.firstName} ${p.lastName}) — ya tiene User, skip`);
        continue;
      }
      // Resolver email: usar el del pro si tiene "@", si no alias@acceso.mural
      let email = (p.email || "").trim();
      if (!email.includes("@")) {
        email = `${p.alias.toLowerCase().replace(/[^a-z0-9]/g, "")}@acceso.mural`;
      }
      // Verificar colisión de email
      const collision = await prisma.user.findUnique({ where: { email } });
      if (collision) {
        // Si colisiona con un User del mismo profesional, saltar (ya está).
        // Si colisiona con otro User, usar el alias@acceso.mural.
        if (collision.professionalId === p.id) {
          console.log(`  - ${p.alias} — ya tiene User (colisión por email), skip`);
          continue;
        }
        email = `${p.alias.toLowerCase().replace(/[^a-z0-9]/g, "")}@acceso.mural`;
      }
      const newUser = await prisma.user.create({
        data: {
          email,
          name: `${p.firstName} ${p.lastName}`.trim(),
          password: PLACEHOLDER_HASH,
          role: "USER",
          companyId: p.companyId,
          professionalId: p.id,
          isActive: false,
        },
      });
      console.log(
        `  ✓ ${p.alias} (${p.firstName} ${p.lastName}) → User ${newUser.email} id=${newUser.id} (inactive)`,
      );
      created++;
    }
    console.log(`  Total creados: ${created}`);

    console.log("\n== Verificación final ==");
    const allUsers = await prisma.user.findMany({
      orderBy: { email: "asc" },
      include: { company: true },
    });
    console.log(`Total Users: ${allUsers.length}`);
    for (const u of allUsers) {
      console.log(
        `  - ${u.email} | ${u.name} | ${u.role} | active=${u.isActive} | proId=${u.professionalId || "—"}`,
      );
    }
    const prosWithUser = await prisma.user.count({
      where: { professionalId: { not: null } },
    });
    const prosWithoutUser = (await prisma.professional.count()) - prosWithUser;
    console.log(
      `Profesionales con User: ${prosWithUser} | sin User: ${prosWithoutUser}`,
    );
  } catch (e) {
    console.error("ERROR:", e.message);
    console.error(e.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
