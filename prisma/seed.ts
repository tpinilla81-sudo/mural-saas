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

  // Create sample payments with full billing data
  const paymentData = [
    { month: "01", status: "PAID", method: "CARD", paidAt: "2026-01-05" },
    { month: "02", status: "PAID", method: "TRANSFER", paidAt: "2026-02-03" },
    { month: "03", status: "PAID", method: "CARD", paidAt: "2026-03-04" },
    { month: "04", status: "PAID", method: "CARD", paidAt: "2026-04-02" },
    { month: "05", status: "PAID", method: "TRANSFER", paidAt: "2026-05-05" },
    { month: "06", status: "PAID", method: "CARD", paidAt: "2026-06-02" },
    { month: "07", status: "PENDING", method: "CARD", paidAt: null },
  ];

  for (let i = 0; i < paymentData.length; i++) {
    const p = paymentData[i];
    const subtotal = 79.99;
    const taxRate = 21.0;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    await db.payment.create({
      data: {
        subscriptionId: sub.id,
        companyId: company.id,
        amount: totalAmount,
        currency: "EUR",
        status: p.status,
        paymentDate: p.paidAt ? new Date(p.paidAt) : null,
        paidAt: p.paidAt ? new Date(p.paidAt) : null,
        dueDate: new Date(`2026-${p.month}-01`),
        method: p.method,
        invoiceNumber: `INV-2026-${String(i + 1).padStart(3, "0")}`,
        concept: `Suscripción Mensual - Plan PRO`,
        taxRate,
        taxAmount,
        subtotal,
        periodStart: new Date(`2026-${p.month}-01`),
        periodEnd: new Date(`2026-${p.month}-28`),
      },
    });
  }
  console.log(`✅ ${paymentData.length} Payments created`);

  // Create a second demo company with BASIC plan
  const company2 = await db.company.create({
    data: {
      name: "Clínica Derma Plus",
      slug: "derma-plus",
      isActive: true,
    },
  });
  console.log("✅ Company 2 created:", company2.name);

  const sub2 = await db.subscription.create({
    data: {
      companyId: company2.id,
      planName: "BASIC",
      billingMethod: "QUARTERLY",
      price: 29.99,
      currency: "EUR",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-04-01"),
      currentPeriodEnd: new Date("2026-06-30"),
      maxProfessionals: 5,
      maxSedes: 3,
    },
  });

  const company2AdminPw = await bcrypt.hash("derma123", 10);
  await db.user.create({
    data: {
      email: "derma@mural.app",
      name: "Ana García",
      password: company2AdminPw,
      role: "COMPANY_ADMIN",
      companyId: company2.id,
    },
  });

  // Payments for company 2
  const sub2Subtotal = 29.99;
  const sub2TaxAmount = Math.round(sub2Subtotal * 0.21 * 100) / 100;
  const sub2Total = Math.round((sub2Subtotal + sub2TaxAmount) * 100) / 100;

  await db.payment.create({
    data: {
      subscriptionId: sub2.id,
      companyId: company2.id,
      amount: sub2Total * 3, // Quarterly
      currency: "EUR",
      status: "PAID",
      paymentDate: new Date("2026-04-01"),
      paidAt: new Date("2026-04-01"),
      dueDate: new Date("2026-04-01"),
      method: "TRANSFER",
      invoiceNumber: "INV-2026-008",
      concept: "Suscripción Trimestral - Plan BASIC",
      taxRate: 21.0,
      taxAmount: sub2TaxAmount * 3,
      subtotal: sub2Subtotal * 3,
      periodStart: new Date("2026-04-01"),
      periodEnd: new Date("2026-06-30"),
    },
  });
  console.log("✅ Company 2 payments created");

  // Create a third demo company with ENTERPRISE plan
  const company3 = await db.company.create({
    data: {
      name: "Hospital Grupo Médico",
      slug: "grupo-medico",
      isActive: true,
    },
  });
  console.log("✅ Company 3 created:", company3.name);

  const sub3 = await db.subscription.create({
    data: {
      companyId: company3.id,
      planName: "ENTERPRISE",
      billingMethod: "ANNUAL",
      price: 199.99,
      currency: "EUR",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-01-01"),
      currentPeriodEnd: new Date("2026-12-31"),
      maxProfessionals: 999,
      maxSedes: 999,
    },
  });

  const company3AdminPw = await bcrypt.hash("grupo123", 10);
  await db.user.create({
    data: {
      email: "grupo@mural.app",
      name: "Carlos Ruiz",
      password: company3AdminPw,
      role: "COMPANY_ADMIN",
      companyId: company3.id,
    },
  });

  const sub3Subtotal = 199.99 * 12; // Annual
  const sub3TaxAmount = Math.round(sub3Subtotal * 0.21 * 100) / 100;
  const sub3Total = Math.round((sub3Subtotal + sub3TaxAmount) * 100) / 100;

  await db.payment.create({
    data: {
      subscriptionId: sub3.id,
      companyId: company3.id,
      amount: sub3Total,
      currency: "EUR",
      status: "PAID",
      paymentDate: new Date("2026-01-15"),
      paidAt: new Date("2026-01-15"),
      dueDate: new Date("2026-01-01"),
      method: "TRANSFER",
      invoiceNumber: "INV-2026-009",
      concept: "Suscripción Anual - Plan ENTERPRISE",
      taxRate: 21.0,
      taxAmount: sub3TaxAmount,
      subtotal: sub3Subtotal,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-12-31"),
    },
  });
  console.log("✅ Company 3 payments created");

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
