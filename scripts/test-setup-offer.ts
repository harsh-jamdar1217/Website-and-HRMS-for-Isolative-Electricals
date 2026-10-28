// TEST HELPER (development only): creates N candidates already at "offer accepted" using the real services,
// so end-to-end tests can start at the conversion step. Prints JSON: [{email, password, appId}].
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { saveDocument } from "../src/lib/documents";
import { createToken } from "../src/lib/tokens";
import { moveApplication, registerAndApply, reviewDocument, verifyEmailToken } from "../src/lib/recruitment";

async function main() {
  const count = Number(process.argv[2] ?? 2);
  const hr = db.select().from(schema.users).where(eq(schema.users.email, "hr@isolative.example")).get()!;
  const vac = db.select().from(schema.vacancies).where(eq(schema.vacancies.status, "PUBLISHED")).get()!;
  const out: { email: string; password: string; appId: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const email = `joiner${i}@example.com`, password = "Joiner#Pass123";
    const { user, app } = await registerAndApply({ name: `Joiner ${i}`, email, phone: "+91 98765 43210", password, vacancyId: vac.id });
    await verifyEmailToken(createToken(user.id, "EMAIL_VERIFY").raw);
    const pdf = new File([new Uint8Array(Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(120, 3)]))], "resume.pdf", { type: "application/pdf" });
    const doc = await saveDocument({ applicationId: app.id, type: "RESUME", file: pdf, actorId: user.id });
    await moveApplication({ applicationId: app.id, to: "UNDER_REVIEW", by: "candidate", actorId: user.id });
    reviewDocument(doc.id, "ACCEPTED", undefined, hr.id);
    await moveApplication({ applicationId: app.id, to: "SHORTLISTED", by: "staff", actorId: hr.id });
    await moveApplication({ applicationId: app.id, to: "SELECTED", by: "staff", actorId: hr.id });
    await moveApplication({ applicationId: app.id, to: "OFFER_ACCEPTED", by: "candidate", actorId: user.id });
    out.push({ email, password, appId: app.id });
  }
  console.log("JSON:" + JSON.stringify(out));
}
main();
