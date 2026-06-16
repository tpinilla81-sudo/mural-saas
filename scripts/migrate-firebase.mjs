/**
 * Migrate Firebase data into the PostgreSQL database.
 * 
 * Usage: node scripts/migrate-firebase.mjs <companyId>
 * 
 * Reads from: https://mural-80cc6-default-rtdb.europe-west1.firebasedatabase.app/reyesa_V13_DEFINITIVA/
 * Writes to: Prisma PostgreSQL
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const FIREBASE_BASE = "https://mural-80cc6-default-rtdb.europe-west1.firebasedatabase.app/reyesa_V13_DEFINITIVA";

async function fetchJSON(path) {
  const res = await fetch(`${FIREBASE_BASE}/${path}.json`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}

async function main() {
  const companyId = process.argv[2];
  if (!companyId) {
    console.error("Usage: node scripts/migrate-firebase.mjs <companyId>");
    console.error("Get the companyId from the database first.");
    process.exit(1);
  }

  // Verify company exists
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    console.error(`Company ${companyId} not found in database`);
    process.exit(1);
  }
  console.log(`Migrating Firebase data for company: ${company.name} (${companyId})`);

  // ═══ 1. SEDES ═══
  console.log("\n--- Migrating Sedes ---");
  const fbSedes = await fetchJSON("sedes");
  const sedeMap = {}; // Firebase key -> Prisma ID

  for (const [fbKey, fbSede] of Object.entries(fbSedes)) {
    const sede = await prisma.sede.create({
      data: {
        companyId,
        name: (fbSede.nom || "").toUpperCase(),
        city: (fbSede.ciu || "").toUpperCase(),
        province: (fbSede.pro || "").toUpperCase(),
        task: fbSede.tar || "",
        email: fbSede.mail || "",
        phone: fbSede.tel || "",
        morningEnabled: fbSede.hm === "SI",
        afternoonEnabled: fbSede.ht === "SI",
        color: fbSede.col || "#3b82f6",
        order: fbSede.ord ?? 0,
      },
    });
    sedeMap[fbKey] = sede.id;
    console.log(`  ✓ Sede: ${sede.name} - ${sede.task} (${sede.id})`);
  }
  console.log(`  Total: ${Object.keys(sedeMap).length} sedes`);

  // ═══ 2. PROFESSIONALS ═══
  console.log("\n--- Migrating Professionals ---");
  const fbPros = await fetchJSON("pros");
  const proMap = {}; // Firebase key -> Prisma ID

  for (const [fbKey, fbPro] of Object.entries(fbPros)) {
    const pro = await prisma.professional.create({
      data: {
        companyId,
        firstName: (fbPro.nom || "").toUpperCase(),
        lastName: (fbPro.ape || "").toUpperCase(),
        alias: (fbPro.ali || "").toUpperCase(),
        type: fbPro.tipo === "ADMINISTRADOR" ? "ADMINISTRADOR" : "USER",
        category: fbPro.cat || "",
        username: fbPro.user || "",
        email: fbPro.mail || "",
        phone: fbPro.tel || "",
        permissions: fbPro.per || "",
        assignedSedes: fbPro.sede || "",
        startDate: fbPro.fini || "",
        endDate: fbPro.ffin || "INDEFINIDO",
      },
    });
    proMap[fbKey] = { id: pro.id, alias: pro.alias };
    console.log(`  ✓ Pro: ${pro.alias} - ${pro.firstName} ${pro.lastName} (${pro.id})`);
  }
  console.log(`  Total: ${Object.keys(proMap).length} professionals`);

  // ═══ 3. PLAN (assignments) ═══
  console.log("\n--- Migrating Plan ---");
  const fbPlan = await fetchJSON("plan");
  let planCount = 0;

  for (const [sedeFbKey, dates] of Object.entries(fbPlan)) {
    const sedeId = sedeMap[sedeFbKey];
    if (!sedeId) {
      console.log(`  ⚠ Skipping plan for unknown sede key: ${sedeFbKey}`);
      continue;
    }

    for (const [date, turns] of Object.entries(dates)) {
      for (const [turn, alias] of Object.entries(turns)) {
        try {
          await prisma.plan.create({
            data: {
              companyId,
              sedeId,
              date,
              turn: turn === "MAÑANA" ? "MANANA" : turn,
              professionalAlias: alias,
            },
          });
          planCount++;
        } catch (e) {
          if (e.code === "P2002") {
            // Duplicate, skip
          } else {
            console.log(`  ⚠ Error creating plan: ${date} ${turn} ${alias}: ${e.message}`);
          }
        }
      }
    }
  }
  console.log(`  Total: ${planCount} plan entries`);

  // ═══ 4. AVISOS (notices/absences) ═══
  console.log("\n--- Migrating Avisos ---");
  const fbAvisos = await fetchJSON("avisos");
  let avisoCount = 0;

  for (const [fbKey, fbAviso] of Object.entries(fbAvisos)) {
    const sedeId = sedeMap[fbAviso.sid];
    const proInfo = proMap[fbAviso.pid];

    if (!sedeId) {
      console.log(`  ⚠ Skipping aviso for unknown sede key: ${fbAviso.sid}`);
      continue;
    }
    if (!proInfo) {
      console.log(`  ⚠ Skipping aviso for unknown pro key: ${fbAviso.pid}`);
      continue;
    }

    try {
      await prisma.aviso.create({
        data: {
          companyId,
          date: fbAviso.f,
          professionalId: proInfo.id,
          sedeId,
          turn: fbAviso.t || "M",
          reason: "", // Original Firebase didn't have reason field
        },
      });
      avisoCount++;
    } catch (e) {
      console.log(`  ⚠ Error creating aviso: ${e.message}`);
    }
  }
  console.log(`  Total: ${avisoCount} avisos`);

  // ═══ 5. CALENDARIOS (holidays by province) ═══
  console.log("\n--- Migrating Calendarios (holidays) ---");
  const fbCal = await fetchJSON("calendarios");
  let holidayCount = 0;

  // Map calendar keys to province names
  const calToProvince = {
    VIT: "ALAVA",
    CR: "CIUDAD REAL",
    BDZ: "BADAJOZ",
    NAV: "NAVARRA",
    SS: "GUIPUZCOA",
  };

  for (const [calKey, dates] of Object.entries(fbCal)) {
    const province = calToProvince[calKey] || calKey;

    for (const [date, type] of Object.entries(dates)) {
      if (type === "FESTIVO") {
        try {
          await prisma.holiday.create({
            data: {
              companyId,
              province,
              date,
            },
          });
          holidayCount++;
        } catch (e) {
          if (e.code === "P2002") {
            // Duplicate, skip
          }
        }
      }
    }
  }
  console.log(`  Total: ${holidayCount} holidays`);

  // ═══ 6. FESTIVOS (additional province-specific holidays) ═══
  console.log("\n--- Migrating Festivos (province holidays) ---");
  const fbFestivos = await fetchJSON("festivos");
  let festivoCount = 0;

  for (const [province, dates] of Object.entries(fbFestivos)) {
    for (const [date, enabled] of Object.entries(dates)) {
      if (enabled) {
        try {
          await prisma.holiday.create({
            data: {
              companyId,
              province: province.toUpperCase(),
              date,
            },
          });
          festivoCount++;
        } catch (e) {
          if (e.code === "P2002") {
            // Duplicate, skip
          }
        }
      }
    }
  }
  console.log(`  Total: ${festivoCount} additional festivos`);

  console.log("\n═══ Migration Complete ═══");
  await prisma.$disconnect();
}

main().catch(e => {
  console.error("Migration failed:", e);
  process.exit(1);
});
