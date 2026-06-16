import { PrismaClient } from "@prisma/client";
import data from "./firebase-data.json";

const db = new PrismaClient();

async function main() {
  const v13 = (data as any).reyesa_V13_DEFINITIVA;
  const companyId = "cmqes3n9q0001noudrx4b97a8"; // MURAL Plastic Surgery

  console.log("🗑️  Limpiando datos de ejemplo...");

  // Delete in order (respecting foreign keys)
  await db.plan.deleteMany({ where: { companyId } });
  await db.holiday.deleteMany({ where: { companyId } });
  await db.professional.deleteMany({ where: { companyId } });
  await db.sede.deleteMany({ where: { companyId } });

  console.log("📍 Importando sedes...");
  const sedeMap: Record<string, string> = {};
  const sedes = v13.sedes;
  for (const [firebaseId, s] of Object.entries(sedes)) {
    const sede = s as any;
    const record = await db.sede.create({
      data: {
        companyId,
        name: sede.nom,
        city: sede.ciu || "",
        province: sede.pro || "",
        task: sede.tar || "",
        email: sede.mail || "",
        phone: sede.tel || "",
        morningEnabled: sede.hm === "SI",
        afternoonEnabled: sede.ht === "SI",
        color: sede.col || "#3b82f6",
      },
    });
    sedeMap[firebaseId] = record.id;
    console.log(`  ✓ ${sede.nom} | ${sede.tar} (${record.id})`);
  }
  console.log(`✅ ${Object.keys(sedes).length} sedes importadas`);

  console.log("👤 Importando profesionales...");
  const pros = v13.pros;
  for (const [firebaseId, p] of Object.entries(pros)) {
    const pro = p as any;
    await db.professional.create({
      data: {
        companyId,
        firstName: pro.nom || "",
        lastName: pro.ape || "",
        alias: pro.ali,
        type: pro.cat === "JEFE DE SERVICIO" ? "ADMINISTRADOR" : "USER",
        category: pro.cat || "",
        username: "",
        email: pro.mail || "",
        phone: pro.tel || "",
        permissions: pro.per || "",
        assignedSedes: pro.sede || "",
        startDate: pro.fini ? new Date(pro.fini) : null,
        endDate: pro.ffin || "INDEFINIDO",
      },
    });
    console.log(`  ✓ ${pro.ali} - ${pro.nom} ${pro.ape}`);
  }
  console.log(`✅ ${Object.keys(pros).length} profesionales importados`);

  console.log("📋 Importando planes (turnos)...");
  const plan = v13.plan;
  let planCount = 0;
  for (const [sedeFirebaseId, dates] of Object.entries(plan)) {
    const prismaSedeId = sedeMap[sedeFirebaseId];
    if (!prismaSedeId) {
      console.log(`  ⚠️ Sede no encontrada: ${sedeFirebaseId}, saltando...`);
      continue;
    }
    for (const [date, turns] of Object.entries(dates as Record<string, any>)) {
      for (const [turn, proAlias] of Object.entries(turns)) {
        const turnStr = turn === "MAÑANA" ? "MANANA" : "TARDE";
        try {
          await db.plan.create({
            data: {
              companyId,
              sedeId: prismaSedeId,
              date,
              turn: turnStr,
              professionalAlias: proAlias as string,
            },
          });
          planCount++;
        } catch (e: any) {
          if (e.code === "P2002") {
            // Duplicate, skip
          } else {
            console.log(`  ⚠️ Error: ${e.message}`);
          }
        }
      }
    }
  }
  console.log(`✅ ${planCount} planes importados`);

  console.log("🎉 Importando festivos...");
  const festivos = v13.festivos;
  let festCount = 0;
  for (const [province, dates] of Object.entries(festivos)) {
    for (const date of Object.keys(dates as Record<string, any>)) {
      try {
        await db.holiday.create({
          data: {
            companyId,
            province,
            date,
          },
        });
        festCount++;
      } catch (e: any) {
        if (e.code === "P2002") {
          // Duplicate, skip
        } else {
          console.log(`  ⚠️ Error festivo: ${e.message}`);
        }
      }
    }
  }
  console.log(`✅ ${festCount} festivos importados`);

  console.log("\n🏁 MIGRACIÓN COMPLETA!");
  console.log(`   Sedes: ${Object.keys(sedes).length}`);
  console.log(`   Profesionales: ${Object.keys(pros).length}`);
  console.log(`   Planes: ${planCount}`);
  console.log(`   Festivos: ${festCount}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
