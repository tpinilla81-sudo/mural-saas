/**
 * COMPLETE Firebase → PostgreSQL migration for Mural by Método
 * 
 * Migrates from reyesa_V13_DEFINITIVA (core data) + panel_v163 (AUS absences)
 * 
 * Usage: node scripts/migrate-firebase-full.mjs <companyId>
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const FB_V13 = "https://mural-80cc6-default-rtdb.europe-west1.firebasedatabase.app/reyesa_V13_DEFINITIVA";
const FB_PANEL = "https://mural-80cc6-default-rtdb.europe-west1.firebasedatabase.app/panel_v163";

async function fetchJSON(base, path) {
  const res = await fetch(`${base}/${path}.json`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}

async function main() {
  const companyId = process.argv[2];
  if (!companyId) {
    console.error("Usage: node scripts/migrate-firebase-full.mjs <companyId>");
    process.exit(1);
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    console.error(`Company ${companyId} not found`);
    process.exit(1);
  }
  console.log(`\n═══ FULL MIGRATION for: ${company.name} (${companyId}) ═══\n`);

  // ═══ STEP 0: Clean all existing data ═══
  console.log("Step 0: Cleaning existing data...");
  await prisma.aviso.deleteMany({ where: { companyId } });
  await prisma.plan.deleteMany({ where: { companyId } });
  await prisma.holiday.deleteMany({ where: { companyId } });
  await prisma.professional.deleteMany({ where: { companyId } });
  await prisma.sede.deleteMany({ where: { companyId } });
  console.log("  ✓ All company data deleted\n");

  // ═══ STEP 1: SEDES ═══
  console.log("Step 1: Migrating Sedes...");
  const fbSedes = await fetchJSON(FB_V13, "sedes");
  const sedeMap = {}; // Firebase key -> Prisma ID
  const orderToSedeId = {}; // order -> Prisma ID

  // Sort by order to maintain proper ordering
  const sortedSedes = Object.entries(fbSedes).sort((a, b) => (a[1].ord ?? 0) - (b[1].ord ?? 0));
  
  for (const [fbKey, fbSede] of sortedSedes) {
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
    orderToSedeId[fbSede.ord ?? 0] = sede.id;
    console.log(`  ✓ ord=${sede.order} | ${sede.name} - ${sede.task}`);
  }
  console.log(`  Total: ${Object.keys(sedeMap).length} sedes\n`);

  // ═══ STEP 2: PROFESSIONALS ═══
  console.log("Step 2: Migrating Professionals...");
  const fbPros = await fetchJSON(FB_V13, "pros");
  const proMap = {}; // Firebase key -> { id, alias }

  for (const [fbKey, fbPro] of Object.entries(fbPros)) {
    try {
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
      console.log(`  ✓ ${pro.alias} - ${pro.firstName} ${pro.lastName} [${pro.type}]`);
    } catch (e) {
      console.log(`  ⚠ Skip duplicate pro: ${fbPro.ali} - ${e.message.substring(0, 80)}`);
    }
  }
  console.log(`  Total: ${Object.keys(proMap).length} professionals\n`);

  // ═══ STEP 3: PLAN (assignments) ═══
  console.log("Step 3: Migrating Plan...");
  const fbPlan = await fetchJSON(FB_V13, "plan");
  let planCount = 0;

  for (const [sedeFbKey, dates] of Object.entries(fbPlan)) {
    const sedeId = sedeMap[sedeFbKey];
    if (!sedeId) {
      console.log(`  ⚠ Skipping plan for unknown sede: ${sedeFbKey}`);
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
              professionalAlias: (alias || "").toUpperCase(),
            },
          });
          planCount++;
        } catch (e) {
          if (e.code !== "P2002") {
            console.log(`  ⚠ Error: ${date} ${turn} ${alias}: ${e.message.substring(0, 80)}`);
          }
        }
      }
    }
  }
  console.log(`  Total: ${planCount} plan entries\n`);

  // ═══ STEP 4: AVISOS from reyesa_V13 (specific professional absences) ═══
  console.log("Step 4: Migrating Avisos (V13)...");
  const fbAvisos = await fetchJSON(FB_V13, "avisos");
  let avisoV13Count = 0;

  for (const [fbKey, fbAviso] of Object.entries(fbAvisos)) {
    const sedeId = sedeMap[fbAviso.sid];
    const proInfo = proMap[fbAviso.pid];

    if (!sedeId) {
      console.log(`  ⚠ Skip aviso for unknown sede: ${fbAviso.sid}`);
      continue;
    }
    if (!proInfo) {
      console.log(`  ⚠ Skip aviso for unknown pro: ${fbAviso.pid}`);
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
          reason: "",
        },
      });
      avisoV13Count++;
    } catch (e) {
      console.log(`  ⚠ Error aviso: ${e.message.substring(0, 80)}`);
    }
  }
  console.log(`  Total: ${avisoV13Count} avisos (V13)\n`);

  // ═══ STEP 5: HOLIDAYS from calendarios + festivos ═══
  console.log("Step 5: Migrating Holidays...");
  const fbCal = await fetchJSON(FB_V13, "calendarios");
  const fbFestivos = await fetchJSON(FB_V13, "festivos");
  let holidayCount = 0;

  const calToProvince = {
    VIT: "ALAVA",
    CR: "CIUDAD REAL",
    BDZ: "BADAJOZ",
    NAV: "NAVARRA",
    SS: "GUIPUZCOA",
  };

  // Calendarios (regional holidays)
  for (const [calKey, dates] of Object.entries(fbCal)) {
    const province = calToProvince[calKey] || calKey;
    for (const [date, type] of Object.entries(dates)) {
      if (type === "FESTIVO") {
        try {
          await prisma.holiday.create({ data: { companyId, province, date } });
          holidayCount++;
        } catch (e) {
          if (e.code !== "P2002") console.log(`  ⚠ ${e.message.substring(0, 60)}`);
        }
      }
    }
  }

  // Festivos (province-specific)
  for (const [province, dates] of Object.entries(fbFestivos)) {
    for (const [date, enabled] of Object.entries(dates)) {
      if (enabled) {
        try {
          await prisma.holiday.create({ data: { companyId, province: province.toUpperCase(), date } });
          holidayCount++;
        } catch (e) {
          if (e.code !== "P2002") console.log(`  ⚠ ${e.message.substring(0, 60)}`);
        }
      }
    }
  }
  console.log(`  Total: ${holidayCount} holidays\n`);

  // ═══ STEP 6: AUS from panel_v163 (sede-level absences with reasons) ═══
  console.log("Step 6: Migrating AUS absences (panel_v163)...");
  const fbPanel = await fetchJSON(FB_PANEL, "");
  let ausCount = 0;
  let ausSkipped = 0;

  // Get AUS entries
  const ausEntries = Object.entries(fbPanel).filter(([k]) => k.startsWith("AUS-"));

  // Group AUS entries by (date, row) to consolidate 6 slots into M/T turns
  const ausGrouped = {};
  for (const [key, val] of ausEntries) {
    const parts = key.split("-");
    const date = `${parts[1]}-${parts[2]}-${parts[3]}`;
    const row = parseInt(parts[4]);
    const slot = parseInt(parts[5]);

    const groupKey = `${date}_row${row}`;
    if (!ausGrouped[groupKey]) {
      ausGrouped[groupKey] = { date, row, slots: [], reason: val.aviso || "" };
    }
    ausGrouped[groupKey].slots.push(slot);
    // Keep the reason (should be same for all slots in a group)
    if (val.aviso) ausGrouped[groupKey].reason = val.aviso;
  }

  // For each grouped AUS, create avisos for M and T turns
  for (const [groupKey, group] of Object.entries(ausGrouped)) {
    const sedeId = orderToSedeId[group.row];
    if (!sedeId) {
      ausSkipped++;
      continue;
    }

    const hasMorning = group.slots.some(s => s <= 3);
    const hasAfternoon = group.slots.some(s => s > 3);

    // Get the sede to check if morning/afternoon is enabled
    const sede = await prisma.sede.findUnique({ where: { id: sedeId } });

    // Create morning aviso
    if (hasMorning && sede?.morningEnabled) {
      try {
        await prisma.aviso.create({
          data: {
            companyId,
            date: group.date,
            professionalId: null, // Sede-level absence
            sedeId,
            turn: "M",
            reason: group.reason,
          },
        });
        ausCount++;
      } catch (e) {
        // Skip duplicates
      }
    }

    // Create afternoon aviso
    if (hasAfternoon && sede?.afternoonEnabled) {
      try {
        await prisma.aviso.create({
          data: {
            companyId,
            date: group.date,
            professionalId: null,
            sedeId,
            turn: "T",
            reason: group.reason,
          },
        });
        ausCount++;
      } catch (e) {
        // Skip duplicates
      }
    }
  }
  console.log(`  Total: ${ausCount} AUS avisos created (${ausSkipped} skipped for unknown rows)\n`);

  // ═══ STEP 7: AV from panel_v163 (professional-specific avisos) ═══
  console.log("Step 7: Migrating AV avisos (panel_v163)...");
  const avEntries = Object.entries(fbPanel).filter(([k]) => k.startsWith("AV-"));
  let avCount = 0;

  for (const [key, val] of avEntries) {
    const sedeId = orderToSedeId[val.row];
    if (!sedeId) {
      console.log(`  ⚠ Skip AV for unknown row: ${val.row}`);
      continue;
    }

    // Try to find the professional by name in the aviso text
    const avisoText = val.aviso || "";
    let professionalId = null;

    // Try to match professional by alias
    for (const [fbKey, proInfo] of Object.entries(proMap)) {
      if (avisoText.toUpperCase().includes(proInfo.alias)) {
        professionalId = proInfo.id;
        break;
      }
    }

    // If no professional matched, use the first admin
    if (!professionalId) {
      const adminPro = Object.values(proMap).find(p => p.alias === "JM");
      if (adminPro) professionalId = adminPro.id;
    }

    try {
      await prisma.aviso.create({
        data: {
          companyId,
          date: val.date,
          professionalId,
          sedeId,
          turn: "M", // Default to morning
          reason: avisoText,
        },
      });
      avCount++;
    } catch (e) {
      console.log(`  ⚠ Error AV: ${e.message.substring(0, 80)}`);
    }
  }
  console.log(`  Total: ${avCount} AV avisos\n`);

  // ═══ SUMMARY ═══
  console.log("═══════════════════════════════════════");
  console.log("         MIGRATION COMPLETE");
  console.log("═══════════════════════════════════════");

  const finalCounts = {
    sedes: await prisma.sede.count({ where: { companyId } }),
    professionals: await prisma.professional.count({ where: { companyId } }),
    plans: await prisma.plan.count({ where: { companyId } }),
    avisos: await prisma.aviso.count({ where: { companyId } }),
    holidays: await prisma.holiday.count({ where: { companyId } }),
  };
  console.log(JSON.stringify(finalCounts, null, 2));

  // Show aviso reason breakdown
  const avisos = await prisma.aviso.findMany({ where: { companyId }, select: { reason: true } });
  const reasonBreakdown = {};
  for (const a of avisos) {
    const r = a.reason || "(sin motivo)";
    reasonBreakdown[r] = (reasonBreakdown[r] || 0) + 1;
  }
  console.log("\nAviso reason breakdown:");
  for (const [reason, count] of Object.entries(reasonBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error("Migration failed:", e);
  process.exit(1);
});
