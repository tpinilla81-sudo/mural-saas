import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

async function main() {
  console.log("🌱 Seeding database...");

  // Create SUPER_ADMIN
  const superAdminPw = await bcrypt.hash("admin123", 10);
  const superAdmin = await db.user.create({
    data: {
      email: "admin@mural.app",
      name: "Super Admin",
      password: superAdminPw,
      role: "SUPER_ADMIN",
    },
  });
  console.log("✅ Super Admin created:", superAdmin.email);

  // Create demo company
  const company = await db.company.create({
    data: {
      name: "MURAL Plastic Surgery",
      slug: "mural-ps",
      isActive: true,
    },
  });
  console.log("✅ Company created:", company.name);

  // Create COMPANY_ADMIN
  const companyAdminPw = await bcrypt.hash("mural123", 10);
  const companyAdmin = await db.user.create({
    data: {
      email: "mural@mural.app",
      name: "Julio Murillo",
      password: companyAdminPw,
      role: "COMPANY_ADMIN",
      companyId: company.id,
    },
  });
  console.log("✅ Company Admin created:", companyAdmin.email);

  // Create a regular user
  const userPw = await bcrypt.hash("user123", 10);
  const regularUser = await db.user.create({
    data: {
      email: "alma@mural.app",
      name: "Alma Tejedor",
      password: userPw,
      role: "USER",
      companyId: company.id,
    },
  });
  console.log("✅ Regular User created:", regularUser.email);

  // Create subscription
  const sub = await db.subscription.create({
    data: {
      companyId: company.id,
      planName: "PRO",
      billingMethod: "MONTHLY",
      price: 79.99,
      currency: "EUR",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-06-01"),
      currentPeriodEnd: new Date("2026-06-30"),
      maxProfessionals: 15,
      maxSedes: 10,
    },
  });
  console.log("✅ Subscription created:", sub.planName);

  // Create sample payment
  await db.payment.create({
    data: {
      subscriptionId: sub.id,
      companyId: company.id,
      amount: 79.99,
      currency: "EUR",
      status: "PAID",
      paymentDate: new Date("2026-06-01"),
      dueDate: new Date("2026-06-01"),
      method: "CARD",
      invoiceNumber: "INV-2026-001",
    },
  });
  console.log("✅ Payment created");

  // Create sample sedes
  const sedeData = [
    { name: "VITORIA", city: "VITORIA-GASTEIZ", province: "ALAVA", task: "Consulta VIT", color: "#0292f2", morningEnabled: true, afternoonEnabled: true },
    { name: "CR", city: "CIUDAD REAL", province: "CIUDAD REAL", task: "Consulta CR", color: "#f97b06", morningEnabled: true, afternoonEnabled: true },
    { name: "PAMPLONA", city: "PAMPLONA", province: "NAVARRA", task: "Consulta Pamplona", color: "#48935f", morningEnabled: true, afternoonEnabled: true },
    { name: "BDZ", city: "BADAJOZ", province: "BADAJOZ", task: "Consulta BDZ", color: "#e53e3e", morningEnabled: true, afternoonEnabled: true },
    { name: "CONGRESO", city: "", province: "CONGRESO", task: "Cursos o congresos", color: "#b794f4", morningEnabled: true, afternoonEnabled: true },
    { name: "VIT QUIRÓFANO", city: "VITORIA-GASTEIZ", province: "ALAVA", task: "Quirofano VIT", color: "#0292f2", morningEnabled: true, afternoonEnabled: false },
    { name: "CR QUIRÓFANO", city: "CIUDAD REAL", province: "CIUDAD REAL", task: "Quirofano CR", color: "#f97b06", morningEnabled: true, afternoonEnabled: false },
    { name: "NAV QUIRÓFANO", city: "PAMPLONA", province: "NAVARRA", task: "Quirofano Pamplona", color: "#48935f", morningEnabled: true, afternoonEnabled: false },
    { name: "BDZ QUIRÓFANO", city: "BADAJOZ", province: "BADAJOZ", task: "Quirófano BDZ", color: "#e53e3e", morningEnabled: true, afternoonEnabled: false },
    { name: "VIT MED. ESTÉTICA", city: "VITORIA-GASTEIZ", province: "ALAVA", task: "Medicina estética VIT", color: "#e0fbff", morningEnabled: true, afternoonEnabled: true },
    { name: "VIT DERMAENEA", city: "VITORIA-GASTEIZ", province: "ALAVA", task: "Dermaenea", color: "#c7b43d", morningEnabled: true, afternoonEnabled: true },
    { name: "NAV GESTIÓN", city: "PAMPLONA", province: "NAVARRA", task: "Gestion", color: "#48935f", morningEnabled: true, afternoonEnabled: true },
    { name: "NAV CLÍNICA", city: "PAMPLONA", province: "NAVARRA", task: "Clinica Murillo", color: "#48935f", morningEnabled: true, afternoonEnabled: true },
  ];

  const sedes: Record<string, string> = {};
  for (const s of sedeData) {
    const sede = await db.sede.create({
      data: { companyId: company.id, ...s },
    });
    sedes[s.name] = sede.id;
  }
  console.log(`✅ ${sedeData.length} Sedes created`);

  // Create sample professionals
  const proData = [
    { firstName: "JAVIER", lastName: "CASTRO GARCIA", alias: "JC", assignedSedes: "VITORIA" },
    { firstName: "MIRIAM", lastName: "", alias: "ME", assignedSedes: "VITORIA" },
    { firstName: "BORJA", lastName: "MASOT LEON", alias: "BM", assignedSedes: "BDZ" },
    { firstName: "MILLAN", lastName: "", alias: "MM", assignedSedes: "" },
    { firstName: "JULIO", lastName: "MURILLO", alias: "JM", assignedSedes: "VITORIA, PAMPLONA, BDZ, CR, CONGRESO", type: "ADMINISTRADOR", permissions: "Consulta, Quirofano, Gestion, Cursos o congresos, Medicina estética, Dermaenea, Clinica Murillo" },
    { firstName: "ANA", lastName: "", alias: "AP", assignedSedes: "VITORIA" },
    { firstName: "JOSE", lastName: "REY VASALO", alias: "JR", assignedSedes: "VITORIA, BDZ" },
    { firstName: "ALBERTO", lastName: "SAMPER SUGRAÑES", alias: "AS", assignedSedes: "CR" },
    { firstName: "ALMA", lastName: "TEJEDOR BARCOS", alias: "AT", assignedSedes: "VITORIA", permissions: "Medicina estética, Dermaenea" },
    { firstName: "PAMELA", lastName: "", alias: "PZ", assignedSedes: "VITORIA" },
  ];

  for (const p of proData) {
    await db.professional.create({
      data: {
        companyId: company.id,
        firstName: p.firstName,
        lastName: p.lastName,
        alias: p.alias,
        assignedSedes: p.assignedSedes,
        type: p.type || "USER",
        permissions: p.permissions || "Consulta",
      },
    });
  }
  console.log(`✅ ${proData.length} Professionals created`);

  // Create some holidays
  const holidays = [
    { province: "CIUDAD REAL", date: "2026-06-04" },
    { province: "CIUDAD REAL", date: "2026-06-09" },
    { province: "BADAJOZ", date: "2026-06-24" },
    { province: "GUIPUZCOA", date: "2026-06-24" },
  ];
  for (const h of holidays) {
    await db.holiday.create({
      data: { companyId: company.id, province: h.province, date: h.date },
    });
  }
  console.log(`✅ ${holidays.length} Holidays created`);

  // Create some plan assignments for June 2026
  const planAssignments = [
    { sedeName: "VITORIA", date: "2026-06-01", turn: "MANANA" as const, pro: "JC" },
    { sedeName: "CR", date: "2026-06-01", turn: "MANANA" as const, pro: "AS" },
    { sedeName: "CR", date: "2026-06-01", turn: "TARDE" as const, pro: "AS" },
    { sedeName: "PAMPLONA", date: "2026-06-01", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "NAV GESTIÓN", date: "2026-06-01", turn: "TARDE" as const, pro: "JM" },
    { sedeName: "VITORIA", date: "2026-06-02", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "VITORIA", date: "2026-06-02", turn: "TARDE" as const, pro: "JM" },
    { sedeName: "CONGRESO", date: "2026-06-03", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "CONGRESO", date: "2026-06-03", turn: "TARDE" as const, pro: "JM" },
    { sedeName: "CONGRESO", date: "2026-06-05", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "VIT QUIRÓFANO", date: "2026-06-08", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "VIT QUIRÓFANO", date: "2026-06-08", turn: "TARDE" as const, pro: "JM" },
    { sedeName: "VITORIA", date: "2026-06-09", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "CR QUIRÓFANO", date: "2026-06-10", turn: "MANANA" as const, pro: "AS" },
    { sedeName: "CR QUIRÓFANO", date: "2026-06-10", turn: "TARDE" as const, pro: "AS" },
    { sedeName: "NAV QUIRÓFANO", date: "2026-06-10", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "VIT MED. ESTÉTICA", date: "2026-06-11", turn: "MANANA" as const, pro: "AT" },
    { sedeName: "VIT MED. ESTÉTICA", date: "2026-06-11", turn: "TARDE" as const, pro: "AT" },
    { sedeName: "CR", date: "2026-06-11", turn: "MANANA" as const, pro: "AS" },
    { sedeName: "PAMPLONA", date: "2026-06-12", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "VIT QUIRÓFANO", date: "2026-06-16", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "VIT MED. ESTÉTICA", date: "2026-06-18", turn: "MANANA" as const, pro: "AT" },
    { sedeName: "VIT MED. ESTÉTICA", date: "2026-06-18", turn: "TARDE" as const, pro: "AT" },
    { sedeName: "VITORIA", date: "2026-06-19", turn: "MANANA" as const, pro: "JR" },
    { sedeName: "NAV CLÍNICA", date: "2026-06-19", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "VITORIA", date: "2026-06-22", turn: "MANANA" as const, pro: "JR" },
    { sedeName: "CR QUIRÓFANO", date: "2026-06-22", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "CR QUIRÓFANO", date: "2026-06-23", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "BDZ", date: "2026-06-25", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "BDZ", date: "2026-06-26", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "BDZ QUIRÓFANO", date: "2026-06-26", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "BDZ", date: "2026-06-26", turn: "TARDE" as const, pro: "BM" },
    { sedeName: "VIT QUIRÓFANO", date: "2026-06-29", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "VITORIA", date: "2026-06-30", turn: "MANANA" as const, pro: "JM" },
    { sedeName: "VITORIA", date: "2026-06-30", turn: "TARDE" as const, pro: "JM" },
  ];

  for (const p of planAssignments) {
    const sedeId = sedes[p.sedeName];
    if (sedeId) {
      await db.plan.create({
        data: {
          companyId: company.id,
          sedeId,
          date: p.date,
          turn: p.turn,
          professionalAlias: p.pro,
        },
      }).catch(() => {}); // skip if duplicate
    }
  }
  console.log(`✅ ${planAssignments.length} Plan assignments created`);

  console.log("\n🎉 Seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SUPER_ADMIN: admin@mural.app / admin123");
  console.log("COMPANY_ADMIN: mural@mural.app / mural123");
  console.log("USER: alma@mural.app / user123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
