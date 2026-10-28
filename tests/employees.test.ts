import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "iep-emp-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.DOCUMENT_DIR = path.join(dir, "docs");
process.env.SMTP_HOST = "";

let M: { rec: typeof import("../src/lib/recruitment"); emp: typeof import("../src/lib/employees"); docs: typeof import("../src/lib/documents"); tok: typeof import("../src/lib/tokens"); s: typeof import("../src/db/schema"); db: typeof import("../src/db").db; st: typeof import("../src/lib/status") };
let vacancyId: string; let hrId: string; let n = 0;
const PDF = () => new File([new Uint8Array(Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(100, 7)]))], "d.pdf", { type: "application/pdf" });
const tomorrow = () => new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
const row = (id: string) => M.db.select().from(M.s.applications).all().find((a) => a.id === id)!;

/** Drives a candidate through the real workflow up to OFFER_ACCEPTED. */
async function offerAccepted() {
  n++;
  const { user, app } = await M.rec.registerAndApply({ name: `Emp ${n}`, email: `emp${n}@example.com`, phone: "+91 98765 43210", password: "Passw0rd!23", vacancyId });
  await M.rec.verifyEmailToken(M.tok.createToken(user.id, "EMAIL_VERIFY").raw);
  const doc = await M.docs.saveDocument({ applicationId: app.id, type: "RESUME", file: PDF(), actorId: user.id });
  const mv = (to: any, by: any, actorId: string) => M.rec.moveApplication({ applicationId: app.id, to, by, actorId });
  await mv("UNDER_REVIEW", "candidate", user.id);
  M.rec.reviewDocument(doc.id, "ACCEPTED", undefined, hrId);
  await mv("SHORTLISTED", "staff", hrId); await mv("SELECTED", "staff", hrId); await mv("OFFER_ACCEPTED", "candidate", user.id);
  return { user, appId: app.id };
}
const convert = (appId: string, over: Record<string, string> = {}) => M.emp.convertToEmployee({ applicationId: appId, department: "Engineering", jobTitle: "Graduate Engineer", employmentType: "FULL_TIME", joiningDate: tomorrow(), actorId: hrId, ...over });

beforeAll(async () => {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const raw = new Database(process.env.DATABASE_URL!.replace("file:", ""));
  migrate(drizzle(raw), { migrationsFolder: "./drizzle" }); raw.close();
  M = { rec: await import("../src/lib/recruitment"), emp: await import("../src/lib/employees"), docs: await import("../src/lib/documents"), tok: await import("../src/lib/tokens"), s: await import("../src/db/schema"), db: (await import("../src/db")).db, st: await import("../src/lib/status") };
  hrId = M.db.insert(M.s.users).values({ email: "hr@t.example", name: "HR", role: "HR", passwordHash: "x" }).returning().get().id;
  vacancyId = M.rec.createVacancy({ title: "Eng", location: "Khandala", employmentType: "FULL_TIME", description: "d".repeat(40), eligibility: "BE Electrical" }, hrId).id;
  M.rec.setVacancyStatus(vacancyId, "PUBLISHED", hrId);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("conversion rules", () => {
  it("refuses anyone who has not accepted an offer", async () => {
    n++;
    const { user, app } = await M.rec.registerAndApply({ name: "Not Yet", email: `ny${n}@example.com`, phone: "+91 98765 43210", password: "Passw0rd!23", vacancyId });
    await expect(convert(app.id)).rejects.toThrow(/accepted their offer/); // PENDING_VERIFICATION
    await M.rec.verifyEmailToken(M.tok.createToken(user.id, "EMAIL_VERIFY").raw);
    await expect(convert(app.id)).rejects.toThrow(/accepted their offer/); // DOCS_PENDING
    expect(M.emp.getEmployeeByUser(user.id)).toBeNull();
  });

  it("promotes the same account, issues an ID, builds the checklist, keeps history, emails and audits", async () => {
    const { user, appId } = await offerAccepted();
    const e = await convert(appId);
    expect(e.employeeCode).toMatch(/^EMP-\d{4}$/); expect(e.status).toBe("ONBOARDING");
    const u = M.db.select().from(M.s.users).all().find((x) => x.id === user.id)!;
    expect(u.role).toBe("EMPLOYEE"); expect(M.db.select().from(M.s.users).all().filter((x) => x.email === user.email)).toHaveLength(1);
    expect(row(appId).status).toBe("HIRED");
    expect(M.emp.tasksFor(e.id)).toHaveLength(M.emp.ONBOARDING_TEMPLATE.length);
    expect(M.rec.timeline(appId).map((x) => x.toStatus)).toEqual(expect.arrayContaining(["PENDING_VERIFICATION", "UNDER_REVIEW", "SHORTLISTED", "SELECTED", "OFFER_ACCEPTED", "HIRED"]));
    expect(M.db.select().from(M.s.emailLogs).all().some((l) => l.template === "employee_welcome" && l.relatedId === e.id)).toBe(true);
    expect(M.db.select().from(M.s.auditLogs).all().some((a) => a.action === "employee.created" && a.entityId === e.id)).toBe(true);
  });

  it("cannot convert twice, and employee IDs are unique and sequential", async () => {
    const a = await offerAccepted(); const b = await offerAccepted();
    const ea = await convert(a.appId); const eb = await convert(b.appId);
    await expect(convert(a.appId)).rejects.toThrow(/already been converted/);
    const num = (c: string) => Number(c.split("-")[1]);
    expect(num(eb.employeeCode)).toBe(num(ea.employeeCode) + 1);
    expect(M.db.select().from(M.s.employees).all().filter((x) => x.userId === a.user.id)).toHaveLength(1);
  });

  it("rejects bad joining dates, deactivated accounts and rejected candidates", async () => {
    const a = await offerAccepted();
    await expect(convert(a.appId, { joiningDate: "not-a-date" })).rejects.toThrow(/valid joining date/);
    await expect(convert(a.appId, { joiningDate: "2001-01-01" })).rejects.toThrow(/30 days/);
    M.db.update(M.s.users).set({ isActive: false }).where((await import("drizzle-orm")).eq(M.s.users.id, a.user.id)).run();
    await expect(convert(a.appId)).rejects.toThrow(/deactivated/);
    expect(row(a.appId).status).toBe("OFFER_ACCEPTED"); // failed conversion changes nothing (transaction)
    n++;
    const { user, app } = await M.rec.registerAndApply({ name: "Rej", email: `rej${n}@example.com`, phone: "+91 98765 43210", password: "Passw0rd!23", vacancyId });
    await M.rec.verifyEmailToken(M.tok.createToken(user.id, "EMAIL_VERIFY").raw);
    await M.rec.moveApplication({ applicationId: app.id, to: "REJECTED", by: "staff", actorId: hrId });
    await expect(convert(app.id)).rejects.toThrow(/accepted their offer/);
  });
});

describe("onboarding checklist", () => {
  it("completes only when every task is done, then activates the employee", async () => {
    const { user, appId } = await offerAccepted();
    const e = await convert(appId);
    await expect(M.emp.completeOnboarding(e.id, hrId)).rejects.toThrow(/still open/);

    // employee-owned tasks cannot be ticked by HR
    expect(() => M.emp.setHrTask(e.id, "BANK_PROOF", true, hrId)).toThrow(/completed by the employee/);
    expect(() => M.emp.setHrTask(e.id, "NOPE", true, hrId)).toThrow(/Task not found/);

    // DETAILS completes from the employee's own form
    M.emp.saveEmployeeDetails(user.id, { addressLine: "12 Main Road, Khandala, Satara", emergencyName: "Parent", emergencyRelation: "Father", emergencyPhone: "+91 98765 00000" });
    // documents: HR acceptance completes the task, rejection re-opens it
    for (const type of ["BANK_PROOF", "JOINING_FORM"]) {
      const d = await M.docs.saveDocument({ applicationId: appId, type, file: PDF(), actorId: user.id, allowedTypes: M.st.ONBOARDING_DOC_TYPES });
      M.rec.reviewDocument(d.id, "ACCEPTED", undefined, hrId);
    }
    const bank = M.db.select().from(M.s.documents).all().find((d) => d.applicationId === appId && d.type === "BANK_PROOF")!;
    M.rec.reviewDocument(bank.id, "REJECTED", "Image is cut off at the edge", hrId);
    expect(M.emp.tasksFor(e.id).find((t) => t.key === "BANK_PROOF")!.status).toBe("PENDING");
    const bank2 = await M.docs.saveDocument({ applicationId: appId, type: "BANK_PROOF", file: PDF(), actorId: user.id, allowedTypes: M.st.ONBOARDING_DOC_TYPES });
    M.rec.reviewDocument(bank2.id, "ACCEPTED", undefined, hrId);

    for (const k of ["VERIFY_DOCS", "ID_CARD", "ORIENTATION"]) M.emp.setHrTask(e.id, k, true, hrId);
    await M.emp.completeOnboarding(e.id, hrId);
    const done = M.emp.getEmployeeByUser(user.id)!;
    expect(done.status).toBe("ACTIVE"); expect(done.onboardingCompletedAt).not.toBeNull();
    expect(M.db.select().from(M.s.emailLogs).all().some((l) => l.template === "onboarding_complete" && l.relatedId === e.id)).toBe(true);
    expect(() => M.emp.setHrTask(e.id, "ID_CARD", false, hrId)).toThrow(/already closed/);
    await expect(M.emp.completeOnboarding(e.id, hrId)).rejects.toThrow(/already complete/);
  });

  it("candidates cannot upload onboarding-only document types through the candidate path", async () => {
    const { user, appId } = await offerAccepted();
    await expect(M.docs.saveDocument({ applicationId: appId, type: "BANK_PROOF", file: PDF(), actorId: user.id })).rejects.toThrow(/Choose a document type/);
  });
});
