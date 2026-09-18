/**
 * MIGRACIÓN DEFINITIVA Firebase RTDB → Neon "mural"
 * Fuente: planificador-reybesa-tudela (instancia ACTIVA que usa la app HTML antigua)
 * Datos: reyesa_V13_DEFINITIVA (sedes, pros, plan, notas_asignacion, festivos, calendarios, avisos)
 * NO se importa panel_v163 (datos de la app industrial Reyesa que comparte el proyecto Firebase)
 *
 * Uso: node scripts/migrate-firebase-live.mjs
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();
const COMPANY_ID = "cmu5usell0000n49v0no4qglb";
const data = JSON.parse(readFileSync("download/firebase_live.json", "utf8"));

const normTurn = (t) => (t === "MAÑANA" ? "MANANA" : t === "TARDE" ? "TARDE" : null);

async function main() {
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company) throw new Error(`Company ${COMPANY_ID} no existe`);
  console.log(`═══ MIGRACIÓN Firebase (instancia ACTIVA) → ${company.name} ═══\n`);

  // ── STEP 0: limpiar datos viejos (de la instancia desactualizada mural-80cc6) ──
  console.log("Step 0: borrando datos anteriores...");
  const del = await Promise.all([
    prisma.aviso.deleteMany({ where: { companyId: COMPANY_ID } }),
    prisma.plan.deleteMany({ where: { companyId: COMPANY_ID } }),
    prisma.holiday.deleteMany({ where: { companyId: COMPANY_ID } }),
    prisma.professional.deleteMany({ where: { companyId: COMPANY_ID } }),
    prisma.sede.deleteMany({ where: { companyId: COMPANY_ID } }),
  ]);
  console.log(`  borrados: avisos=${del[0].count} planes=${del[1].count} festivos=${del[2].count} pros=${del[3].count} sedes=${del[4].count}\n`);

  // ── STEP 1: SEDES (22) ──
  console.log("Step 1: importando sedes...");
  const sortedSedes = Object.entries(data.sedes).sort((a, b) => (a[1].ord ?? 0) - (b[1].ord ?? 0));
  const sedeMap = {}; // fbKey -> prisma id
  for (const [fbKey, s] of sortedSedes) {
    const rec = await prisma.sede.create({
      data: {
        companyId: COMPANY_ID,
        name: s.nom || "",
        city: s.ciu || "",
        province: s.pro || "",
        task: s.tar || "",
        email: s.mail || "",
        phone: s.tel || "",
        morningEnabled: s.hm === "SI",
        afternoonEnabled: s.ht === "SI",
        color: s.col || "#3b82f6",
        order: s.ord ?? 0,
      },
    });
    sedeMap[fbKey] = rec.id;
  }
  console.log(`  ✓ ${Object.keys(sedeMap).length} sedes\n`);

  // ── STEP 2: PROFESIONALES (10) ──
  console.log("Step 2: importando profesionales...");
  const proMap = {}; // fbKey -> { id, alias }
  for (const [fbKey, p] of Object.entries(data.pros)) {
    const rec = await prisma.professional.create({
      data: {
        companyId: COMPANY_ID,
        firstName: p.nom || "",
        lastName: p.ape || "",
        alias: p.ali,
        type: p.tipo || "USER",
        category: p.cat || "",
        username: p.user || "",
        email: p.mail || "",
        phone: p.tel || "",
        permissions: p.per || "",
        assignedSedes: p.sede || "",
        startDate: p.fini || "",
        endDate: p.ffin || "INDEFINIDO",
      },
    });
    proMap[fbKey] = { id: rec.id, alias: rec.alias };
  }
  console.log(`  ✓ ${Object.keys(proMap).length} profesionales\n`);

  // ── STEP 3: PLANES + NOTAS_ASIGNACION fusionadas en Plan.notes ──
  console.log("Step 3: importando planes con notas de asignación...");
  const plans = [];
  const notas = data.notas_asignacion || {};
  let orphanNotes = 0;
  for (const [sedeFb, fechas] of Object.entries(data.plan)) {
    const sedeId = sedeMap[sedeFb];
    if (!sedeId) { console.log(`  ⚠ sede desconocida ${sedeFb}, saltada`); continue; }
    for (const [date, turns] of Object.entries(fechas)) {
      for (const [turnRaw, alias] of Object.entries(turns)) {
        const turn = normTurn(turnRaw);
        if (!turn) { console.log(`  ⚠ turno raro "${turnRaw}" en ${sedeFb} ${date}`); continue; }
        const note = notas[sedeFb]?.[date]?.[turnRaw] ?? "";
        plans.push({ companyId: COMPANY_ID, sedeId, date, turn, professionalAlias: String(alias || ""), notes: String(note || "") });
      }
    }
  }
  // notas huérfanas (sede+fecha+turno sin plan): crear plan con alias vacío para no perder la nota
  for (const [sedeFb, fechas] of Object.entries(notas)) {
    const sedeId = sedeMap[sedeFb];
    if (!sedeId) continue;
    for (const [date, turns] of Object.entries(fechas)) {
      for (const [turnRaw, note] of Object.entries(turns)) {
        const turn = normTurn(turnRaw);
        if (!turn) continue;
        if (!plans.some(p => p.sedeId === sedeId && p.date === date && p.turn === turn)) {
          plans.push({ companyId: COMPANY_ID, sedeId, date, turn, professionalAlias: "", notes: String(note || "") });
          orphanNotes++;
        }
      }
    }
  }
  const r3 = await prisma.plan.createMany({ data: plans });
  const withNotes = plans.filter(p => p.notes).length;
  console.log(`  ✓ ${r3.count} planes (${withNotes} con nota, ${orphanNotes} notas huérfanas convertidas en plan)\n`);

  // ── STEP 4: FESTIVOS = festivos[provincia] ∪ calendario compartido (138 fechas 2026-2040) ──
  console.log("Step 4: importando festivos (provincia + calendario compartido)...");
  const sharedCal = new Set(Object.values(data.calendarios)[0] ? Object.keys(Object.values(data.calendarios)[0]) : []);
  const holidayRows = [];
  const seen = new Set();
  for (const [prov, fechas] of Object.entries(data.festivos)) {
    const dates = new Set([...Object.keys(fechas), ...sharedCal]);
    for (const date of dates) {
      const key = `${prov}|${date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      holidayRows.push({ companyId: COMPANY_ID, province: prov, date });
    }
  }
  const r4 = await prisma.holiday.createMany({ data: holidayRows });
  console.log(`  ✓ ${r4.count} festivos en ${Object.keys(data.festivos).length} provincias (calendario compartido: ${sharedCal.size} fechas)\n`);

  // ── STEP 5: AVISOS (11, referencias pro/sede resueltas) ──
  console.log("Step 5: importando avisos...");
  const avisos = [];
  for (const a of Object.values(data.avisos)) {
    const pro = proMap[a.pid];
    const sedeId = sedeMap[a.sid];
    if (!sedeId) { console.log(`  ⚠ aviso con sede desconocida, saltado:`, a); continue; }
    avisos.push({
      companyId: COMPANY_ID,
      date: a.f,
      professionalId: pro ? pro.id : null,
      sedeId,
      turn: a.t === "T" ? "T" : "M",
      reason: "",
    });
  }
  if (avisos.length) await prisma.aviso.createMany({ data: avisos });
  console.log(`  ✓ ${avisos.length} avisos\n`);

  // ── RESUMEN ──
  const [sedes, pros, planes, holidays, avisosN, notasN] = await Promise.all([
    prisma.sede.count({ where: { companyId: COMPANY_ID } }),
    prisma.professional.count({ where: { companyId: COMPANY_ID } }),
    prisma.plan.count({ where: { companyId: COMPANY_ID } }),
    prisma.holiday.count({ where: { companyId: COMPANY_ID } }),
    prisma.aviso.count({ where: { companyId: COMPANY_ID } }),
    prisma.plan.count({ where: { companyId: COMPANY_ID, notes: { not: "" } } }),
  ]);
  console.log("═══════════ RESUMEN FINAL ═══════════");
  console.log(`  Sedes: ${sedes} (esperado 22)`);
  console.log(`  Profesionales: ${pros} (esperado 10)`);
  console.log(`  Planes: ${planes} (esperado ${plans.length})`);
  console.log(`  Planes con nota: ${notasN}`);
  console.log(`  Festivos: ${holidays} (esperado ${holidayRows.length})`);
  console.log(`  Avisos: ${avisosN} (esperado 11 — ya SIN contaminación industrial)`);
}

main()
  .catch((e) => { console.error("ERROR:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
