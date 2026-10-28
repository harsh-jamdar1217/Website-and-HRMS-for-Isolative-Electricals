// TEST HELPER (development only): creates two employees and one SHORTLISTED candidate using the real services.
// Prints JSON for the end-to-end meetings test.
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { saveDocument } from "../src/lib/documents";
import { hashPassword } from "../src/lib/password";
import { moveApplication, registerAndApply, reviewDocument, verifyEmailToken } from "../src/lib/recruitment";
import { createToken } from "../src/lib/tokens";
import { convertToEmployee } from "../src/lib/employees";

async function main() {
  const hr = db.select().from(schema.users).where(eq(schema.users.email, "hr@isolative.example")).get()!;
  const passwordHash = await hashPassword("Staff#Pass12345");
  void passwordHash;
  const vac = db.select().from(schema.vacancies).where(eq(schema.vacancies.status, "PUBLISHED")).get()!;
  /** A real employee: goes through the whole recruitment flow and the HR conversion, exactly as in production. */
  async function realEmployee(email: string, name: string) {
    const { user, app } = await registerAndApply({ name, email, phone: "+91 98765 43210", password: "Staff#Pass12345", vacancyId: vac.id });
    await verifyEmailToken(createToken(user.id, "EMAIL_VERIFY").raw);
    const pdf0 = new File([new Uint8Array(Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(100, 2)]))], "r.pdf", { type: "application/pdf" });
    const d0 = await saveDocument({ applicationId: app.id, type: "RESUME", file: pdf0, actorId: user.id });
    for (const [to, by, actorId] of [["UNDER_REVIEW", "candidate", user.id], ["SHORTLISTED", "staff", hr.id], ["SELECTED", "staff", hr.id], ["OFFER_ACCEPTED", "candidate", user.id]] as const) {
      if (to === "SHORTLISTED") reviewDocument(d0.id, "ACCEPTED", undefined, hr.id);
      await moveApplication({ applicationId: app.id, to, by, actorId });
    }
    await convertToEmployee({ applicationId: app.id, department: "Engineering", jobTitle: "Engineer", employmentType: "FULL_TIME", joiningDate: new Date(Date.now() + 86400_000).toISOString().slice(0, 10), actorId: hr.id });
    return { id: user.id, email };
  }
  const a = await realEmployee("emp-a@example.com", "Anita Employee"), b = await realEmployee("emp-b@example.com", "Bharat Employee");
  const { user, app } = await registerAndApply({ name: "Ira Interviewee", email: "ira@example.com", phone: "+91 98765 43210", password: "Ira#Pass123456", vacancyId: vac.id });
  await verifyEmailToken(createToken(user.id, "EMAIL_VERIFY").raw);
  const pdf = new File([new Uint8Array(Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(100, 5)]))], "r.pdf", { type: "application/pdf" });
  const doc = await saveDocument({ applicationId: app.id, type: "RESUME", file: pdf, actorId: user.id });
  await moveApplication({ applicationId: app.id, to: "UNDER_REVIEW", by: "candidate", actorId: user.id });
  reviewDocument(doc.id, "ACCEPTED", undefined, hr.id);
  await moveApplication({ applicationId: app.id, to: "SHORTLISTED", by: "staff", actorId: hr.id });
  console.log("JSON:" + JSON.stringify({ a: { id: a.id, email: a.email }, b: { id: b.id, email: b.email }, cand: { id: user.id, email: user.email, appId: app.id } }));
}
main();
