import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "iep-rec-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.DOCUMENT_DIR = path.join(dir, "docs");
process.env.SMTP_HOST = "";

type Mods = { rec: typeof import("../src/lib/recruitment"); docs: typeof import("../src/lib/documents"); tok: typeof import("../src/lib/tokens"); s: typeof import("../src/db/schema"); db: typeof import("../src/db").db };
let m: Mods; let vacancyId: string; let staffId: string;

const PDF = () => new File([new Uint8Array(Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(200, 1)]))], "My Resume.pdf", { type: "application/pdf" });
let n = 0;
async function newCandidate(verified = true) {
  n++;
  const { user, app } = await m.rec.registerAndApply({ name: `Cand ${n}`, email: `cand${n}@example.com`, phone: "+91 98765 43210", password: "Passw0rd!23", vacancyId });
  if (verified) await m.rec.verifyEmailToken(m.tok.createToken(user.id, "EMAIL_VERIFY").raw);
  return { user, appId: app.id };
}
const status = (id: string) => m.db.select().from(m.s.applications).all().find((a) => a.id === id)!.status;

beforeAll(async () => {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const raw = new Database(process.env.DATABASE_URL!.replace("file:", ""));
  migrate(drizzle(raw), { migrationsFolder: "./drizzle" }); raw.close();
  m = { rec: await import("../src/lib/recruitment"), docs: await import("../src/lib/documents"), tok: await import("../src/lib/tokens"), s: await import("../src/db/schema"), db: (await import("../src/db")).db };
  staffId = m.db.insert(m.s.users).values({ email: "hr@t.example", name: "HR", role: "HR", passwordHash: "x" }).returning().get().id;
  vacancyId = m.rec.createVacancy({ title: "Test Engineer", location: "Khandala", employmentType: "FULL_TIME", description: "d".repeat(40), eligibility: "BE Electrical" }, staffId).id;
  m.rec.setVacancyStatus(vacancyId, "PUBLISHED", staffId);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("registration and email verification", () => {
  it("creates an unverified candidate and a waiting application; the verification email body is not stored", async () => {
    const { user, appId } = await newCandidate(false);
    expect(user.role).toBe("CANDIDATE"); expect(user.emailVerifiedAt).toBeNull();
    expect(status(appId)).toBe("PENDING_VERIFICATION");
    const mail = m.db.select().from(m.s.emailLogs).all().find((l) => l.template === "verify_email" && l.toAddress === user.email)!;
    expect(mail.bodyText).toBeNull();
  });
  it("rejects a duplicate email and a closed vacancy", async () => {
    const { user } = await newCandidate(false);
    await expect(m.rec.registerAndApply({ name: "X Y", email: user.email, phone: "+91 98765 43210", password: "Passw0rd!23", vacancyId })).rejects.toThrow(m.rec.RuleError);
    const draft = m.rec.createVacancy({ title: "Draft Role", location: "K", employmentType: "FULL_TIME", description: "d".repeat(40), eligibility: "none given" }, staffId);
    await expect(m.rec.registerAndApply({ name: "X Y", email: "late@example.com", phone: "+91 98765 43210", password: "Passw0rd!23", vacancyId: draft.id })).rejects.toThrow(/no longer open/);
  });
  it("verifies once: advances to DOCS_PENDING, sends the received email, and the link cannot be reused", async () => {
    const { user, appId } = await newCandidate(false);
    const { raw } = m.tok.createToken(user.id, "EMAIL_VERIFY");
    expect((await m.rec.verifyEmailToken(raw)).ok).toBe(true);
    expect(status(appId)).toBe("DOCS_PENDING");
    expect(m.db.select().from(m.s.emailLogs).all().some((l) => l.template === "application_received" && l.relatedId === appId)).toBe(true);
    expect((await m.rec.verifyEmailToken(raw)).ok).toBe(false);
  });
  it("rejects expired, unknown and superseded tokens", async () => {
    const { user } = await newCandidate(false);
    const old = m.tok.createToken(user.id, "EMAIL_VERIFY");
    m.tok.createToken(user.id, "EMAIL_VERIFY"); // resend invalidates the older link
    expect((await m.rec.verifyEmailToken(old.raw)).ok).toBe(false);
    expect((await m.rec.verifyEmailToken("not-a-token")).ok).toBe(false);
    const exp = m.tok.createToken(user.id, "EMAIL_VERIFY");
    m.db.update(m.s.verificationTokens).set({ expiresAt: new Date(Date.now() - 1000) }).run();
    expect((await m.rec.verifyEmailToken(exp.raw)).ok).toBe(false);
  });
});

describe("document security", () => {
  it("stores a valid PDF under a random key and ignores the user's file name for the path", async () => {
    const { user, appId } = await newCandidate();
    const d = await m.docs.saveDocument({ applicationId: appId, type: "RESUME", file: PDF(), actorId: user.id });
    expect(d.mimeType).toBe("application/pdf"); expect(d.storageKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(d.originalName).toBe("My Resume.pdf");
    expect(existsSync(path.join(process.env.DOCUMENT_DIR!, d.storageKey))).toBe(true);
  });
  it("rejects a disguised file (text named .pdf), an executable, an empty file and oversize files", async () => {
    const { user, appId } = await newCandidate();
    const bad = (bytes: Buffer, name: string, type = "application/pdf") => m.docs.saveDocument({ applicationId: appId, type: "RESUME", file: new File([new Uint8Array(bytes)], name, { type }), actorId: user.id });
    await expect(bad(Buffer.from("just text, not a pdf"), "cv.pdf")).rejects.toThrow(/PDF, JPG and PNG/);
    await expect(bad(Buffer.from("MZ\x90\x00 exe"), "cv.pdf")).rejects.toThrow(/PDF, JPG and PNG/);
    await expect(bad(Buffer.alloc(0), "cv.pdf")).rejects.toThrow(/Choose a file/);
    await expect(bad(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(6 * 1024 * 1024)]), "big.pdf")).rejects.toThrow(/5 MB/);
    expect(m.db.select().from(m.s.documents).all().filter((d) => d.applicationId === appId)).toHaveLength(0);
  });
  it("sanitises path-traversal names and keeps history when a document is replaced", async () => {
    const { user, appId } = await newCandidate();
    const a = await m.docs.saveDocument({ applicationId: appId, type: "RESUME", file: new File([PDF()], "../../etc/passwd<script>.pdf"), actorId: user.id });
    expect(a.originalName).not.toMatch(/[\\/<>]/);
    await m.docs.saveDocument({ applicationId: appId, type: "RESUME", file: PDF(), actorId: user.id });
    expect(m.rec.activeDocuments(appId)).toHaveLength(1);
    expect(m.db.select().from(m.s.documents).all().filter((d) => d.applicationId === appId)).toHaveLength(2);
    await expect(m.docs.readStored("../../etc/passwd")).rejects.toThrow();
  });
});

describe("ownership", () => {
  it("a candidate cannot see another candidate's application", async () => {
    const a = await newCandidate(); const b = await newCandidate();
    expect(m.rec.getOwnApplication(a.appId, a.user.id)).not.toBeNull();
    expect(m.rec.getOwnApplication(a.appId, b.user.id)).toBeNull();
  });
});

describe("status workflow and business rules", () => {
  it("cannot be sent for review without a resume; then goes to review and notifies candidate and HR", async () => {
    const { user, appId } = await newCandidate();
    await expect(m.rec.moveApplication({ applicationId: appId, to: "UNDER_REVIEW", by: "candidate", actorId: user.id })).rejects.toThrow(/resume/i);
    await m.docs.saveDocument({ applicationId: appId, type: "RESUME", file: PDF(), actorId: user.id });
    await m.rec.moveApplication({ applicationId: appId, to: "UNDER_REVIEW", by: "candidate", actorId: user.id });
    expect(status(appId)).toBe("UNDER_REVIEW");
    const t = m.db.select().from(m.s.emailLogs).all().filter((l) => l.relatedId === appId).map((l) => l.template);
    expect(t).toContain("documents_submitted"); expect(t).toContain("hr_new_submission");
  });
  it("a candidate can never select, shortlist or reject themselves; staff cannot skip steps", async () => {
    const { user, appId } = await newCandidate();
    for (const to of ["SELECTED", "SHORTLISTED", "REJECTED", "OFFER_ACCEPTED"] as const)
      await expect(m.rec.moveApplication({ applicationId: appId, to, by: "candidate", actorId: user.id })).rejects.toThrow(m.rec.RuleError);
    await expect(m.rec.moveApplication({ applicationId: appId, to: "SELECTED", by: "staff", actorId: staffId })).rejects.toThrow(m.rec.RuleError);
    expect(status(appId)).toBe("DOCS_PENDING");
  });
  it("runs the full happy path with document review, correction loop and selection email", async () => {
    const { user, appId } = await newCandidate();
    const doc = await m.docs.saveDocument({ applicationId: appId, type: "RESUME", file: PDF(), actorId: user.id });
    await m.rec.moveApplication({ applicationId: appId, to: "UNDER_REVIEW", by: "candidate", actorId: user.id });
    await expect(m.rec.moveApplication({ applicationId: appId, to: "SHORTLISTED", by: "staff", actorId: staffId })).rejects.toThrow(/resume/i); // not accepted yet
    await expect(m.rec.moveApplication({ applicationId: appId, to: "CORRECTION_REQUESTED", by: "staff", actorId: staffId })).rejects.toThrow(/Explain/);
    m.rec.reviewDocument(doc.id, "REJECTED", "Scan is unreadable, please upload again", staffId);
    await m.rec.moveApplication({ applicationId: appId, to: "CORRECTION_REQUESTED", by: "staff", actorId: staffId, note: "Your resume scan is unreadable." });
    await expect(m.rec.moveApplication({ applicationId: appId, to: "UNDER_REVIEW", by: "candidate", actorId: user.id })).rejects.toThrow(/Replace/);
    const doc2 = await m.docs.saveDocument({ applicationId: appId, type: "RESUME", file: PDF(), actorId: user.id });
    await m.rec.moveApplication({ applicationId: appId, to: "UNDER_REVIEW", by: "candidate", actorId: user.id });
    m.rec.reviewDocument(doc2.id, "ACCEPTED", undefined, staffId);
    await m.rec.moveApplication({ applicationId: appId, to: "SHORTLISTED", by: "staff", actorId: staffId });
    await m.rec.moveApplication({ applicationId: appId, to: "SELECTED", by: "staff", actorId: staffId, note: "Joining details will follow." });
    await m.rec.moveApplication({ applicationId: appId, to: "OFFER_ACCEPTED", by: "candidate", actorId: user.id });
    expect(status(appId)).toBe("OFFER_ACCEPTED");
    const t = m.db.select().from(m.s.emailLogs).all().filter((l) => l.relatedId === appId).map((l) => l.template);
    expect(t).toEqual(expect.arrayContaining(["correction_requested", "application_selected"]));
    expect(m.rec.timeline(appId).length).toBeGreaterThanOrEqual(8);
  });
  it("rejection sends the rejection email, hides the internal reason from the candidate, and is final", async () => {
    const { user, appId } = await newCandidate();
    await m.docs.saveDocument({ applicationId: appId, type: "RESUME", file: PDF(), actorId: user.id });
    await m.rec.moveApplication({ applicationId: appId, to: "UNDER_REVIEW", by: "candidate", actorId: user.id });
    await m.rec.moveApplication({ applicationId: appId, to: "REJECTED", by: "staff", actorId: staffId, note: "visible?", internalNote: "Weak fit for the role" });
    expect(m.db.select().from(m.s.emailLogs).all().some((l) => l.template === "application_rejected" && l.relatedId === appId)).toBe(true);
    expect(m.rec.timeline(appId).every((e) => e.note !== "visible?")).toBe(true);
    expect(m.db.select().from(m.s.auditLogs).all().some((a) => a.details?.includes("Weak fit"))).toBe(true);
    for (const to of ["UNDER_REVIEW", "SHORTLISTED", "SELECTED", "DOCS_PENDING"] as const)
      await expect(m.rec.moveApplication({ applicationId: appId, to, by: "staff", actorId: staffId })).rejects.toThrow(m.rec.RuleError);
    await expect(m.rec.moveApplication({ applicationId: appId, to: "WITHDRAWN", by: "candidate", actorId: user.id })).rejects.toThrow(m.rec.RuleError);
  });
  it("one application per vacancy", async () => {
    const { user } = await newCandidate();
    await expect(m.rec.applyExisting(user.id, vacancyId)).rejects.toThrow(/already applied/);
  });
});
