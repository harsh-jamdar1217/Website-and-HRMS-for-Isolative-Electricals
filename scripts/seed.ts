/** Demo data for development. Fictional people only; no real employee or client data. */
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { hashPassword } from "../src/lib/password";
import { createEnquiry } from "../src/lib/enquiries";
import { createVacancy, setVacancyStatus } from "../src/lib/recruitment";

async function upsertUser(email: string, name: string, role: string, password: string) {
  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (existing) return existing;
  return db.insert(schema.users).values({ email, name, role, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() }).returning().get();
}

async function main() {
  const admin = await upsertUser("admin@isolative.example", "Demo Administrator", "ADMIN", process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345");
  await upsertUser("hr@isolative.example", "Demo HR Executive", "HR", process.env.SEED_HR_PASSWORD ?? "Hr@12345678");

  const count = db.select().from(schema.enquiries).all().length;
  if (count === 0) {
    const samples = [
      { name: "Rohan Deshmukh", company: "Sahyadri Fabrication Works", email: "rohan@sahyadri-fab.example", phone: "+91 98220 11111", category: "QUOTATION" as const, message: "We need a quotation for electrical panel supply for a new fabrication shed. Please share your process and lead times." },
      { name: "Neha Kulkarni", company: "Kulkarni Infra", email: "neha@kulkarni-infra.example", category: "PRODUCT" as const, message: "Could you share product details and a catalogue for your range? We are evaluating suppliers for a site in Satara." },
      { name: "Imran Shaikh", email: "imran@example.com", phone: "+91 98900 22222", category: "SUPPORT" as const, message: "One of our installations needs a technical inspection. Who should we contact to arrange a site visit?" },
    ];
    for (const s of samples) await createEnquiry(s);
    const rows = db.select().from(schema.enquiries).all();
    db.update(schema.enquiries).set({ status: "IN_PROGRESS", assigneeId: admin.id }).where(eq(schema.enquiries.id, rows[0].id)).run();
  }
  if (db.select().from(schema.vacancies).all().length === 0) {
    // DEMO vacancies only: invented for the demonstration, clearly labelled, replace with real ones via Admin > Vacancies.
    const hr = db.select().from(schema.users).where(eq(schema.users.email, "hr@isolative.example")).get()!;
    const v1 = createVacancy({ title: "Graduate Engineer Trainee, Electrical (Demo)", department: "Engineering", location: "Khandala, Satara", employmentType: "FULL_TIME",
      description: "DEMO VACANCY for demonstration. Replace with the real role description.\n\nWork alongside senior engineers on electrical projects and learn site and workshop practices.",
      eligibility: "BE / BTech in Electrical Engineering.\nFreshers welcome.\nWilling to work at Khandala, Satara." }, hr.id);
    setVacancyStatus(v1.id, "PUBLISHED", hr.id);
    const v2 = createVacancy({ title: "Site Supervisor (Demo)", department: "Operations", location: "Satara region", employmentType: "CONTRACT",
      description: "DEMO VACANCY for demonstration. Supervise installation and commissioning work at customer sites.", eligibility: "Diploma or ITI in Electrical.\n2+ years of site experience." }, hr.id);
    setVacancyStatus(v2.id, "PUBLISHED", hr.id);
    createVacancy({ title: "Accounts Assistant (Demo draft)", location: "Khandala, Satara", employmentType: "FULL_TIME", description: "DEMO DRAFT. Not visible on the website until published.", eligibility: "Commerce graduate." }, hr.id);
  }
  console.log("Seed complete.\n  admin@isolative.example / (SEED_ADMIN_PASSWORD)\n  hr@isolative.example / (SEED_HR_PASSWORD)");
}
main();
