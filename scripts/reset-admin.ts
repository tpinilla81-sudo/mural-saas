import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const email = "admin@mural.es";
  const newPassword = "Mural2024!";
  
  const hashed = await bcrypt.hash(newPassword, 10);
  
  // Find admin user
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.log("User not found, creating...");
    const company = await db.company.findFirst({ where: { slug: "metodo" } });
    if (!company) {
      console.error("No company found with slug 'metodo'");
      return;
    }
    await db.user.create({
      data: {
        email,
        name: "Admin Método",
        password: hashed,
        role: "COMPANY_ADMIN",
        companyId: company.id,
        isActive: true,
      },
    });
    console.log("Admin user created");
  } else {
    await db.user.update({
      where: { email },
      data: { password: hashed, isActive: true },
    });
    console.log("Admin password reset");
    console.log("User:", user.email, "role:", user.role, "companyId:", user.companyId);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
