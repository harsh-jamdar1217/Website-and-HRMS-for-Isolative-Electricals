import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Point the app at a throwaway database BEFORE importing anything that opens it.
const dir = mkdtempSync(path.join(tmpdir(), "iep-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.SMTP_HOST = ""; // emails are recorded as LOGGED, nothing is sent
process.env.ADMIN_NOTIFY_EMAIL = "admin@test.example";

let svc: typeof import("../src/lib/enquiries");
let schema: typeof import("../src/db/schema");
let db: typeof import("../src/db").db;
let emailMod: typeof import("../src/lib/email");
let adminId: string;

beforeAll(async () => {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const raw = new Database(process.env.DATABASE_URL!.replace("file:", ""));
  migrate(drizzle(raw), { migrationsFolder: "./drizzle" });
  raw.close();
  svc = await import("../src/lib/enquiries");
  ({ db } = await import("../src/db"));
  schema = await import("../src/db/schema");
  emailMod = await import("../src/lib/email");
  adminId = db.insert(schema.users).values({ email: "a@test.example", name: "Admin", role: "ADMIN", passwordHash: "x" }).returning().get().id;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const sample = { name: "Test User", email: "t@example.com", category: "PRODUCT" as const, message: "Please send product details for panel boards." };

describe("enquiry creation", () => {
  it("stores the enquiry with a random reference and sends two emails", async () => {
    const { enquiry, duplicate } = await svc.createEnquiry(sample);
    expect(duplicate).toBe(false);
    expect(enquiry.reference).toMatch(/^ENQ-\d{4}-[A-Z2-9]{6}$/);
    const logs = db.select().from(schema.emailLogs).all().filter((l) => l.relatedId === enquiry.id);
    expect(logs.map((l) => l.template).sort()).toEqual(["enquiry_ack", "enquiry_admin_notify"]);
    expect(logs.every((l) => l.status === "LOGGED")).toBe(true);
  });

  it("absorbs a repeated submission without a duplicate record or email", async () => {
    const first = await svc.createEnquiry({ ...sample, email: "dup@example.com" });
    const second = await svc.createEnquiry({ ...sample, email: "dup@example.com" });
    expect(second.duplicate).toBe(true);
    expect(second.enquiry.id).toBe(first.enquiry.id);
    const mails = db.select().from(schema.emailLogs).all().filter((l) => l.relatedId === first.enquiry.id);
    expect(mails).toHaveLength(2);
  });
});

describe("status workflow", () => {
  it("allows valid transitions and records them in the audit log", async () => {
    const { enquiry } = await svc.createEnquiry({ ...sample, email: "flow@example.com" });
    svc.changeStatus(enquiry.id, "IN_PROGRESS", adminId);
    svc.changeStatus(enquiry.id, "RESPONDED", adminId);
    const d = svc.getEnquiryDetail(enquiry.id)!;
    expect(d.e.status).toBe("RESPONDED");
    expect(d.history.map((h) => h.a.action)).toContain("enquiry.status_changed");
  });

  it("rejects invalid transitions and manual CONVERTED", async () => {
    const { enquiry } = await svc.createEnquiry({ ...sample, email: "bad@example.com" });
    expect(() => svc.changeStatus(enquiry.id, "RESPONDED", adminId)).toThrow(svc.RuleError);
    expect(() => svc.changeStatus(enquiry.id, "CONVERTED", adminId)).toThrow(svc.RuleError);
  });

  it("converts to a private, non-public client exactly once", async () => {
    const { enquiry } = await svc.createEnquiry({ ...sample, email: "conv@example.com", company: "Conv Co" });
    expect(() => svc.convertToClient(enquiry.id, adminId)).toThrow(svc.RuleError); // still NEW
    svc.changeStatus(enquiry.id, "IN_PROGRESS", adminId);
    const client = svc.convertToClient(enquiry.id, adminId);
    expect(client.name).toBe("Conv Co");
    expect(client.showPublicly).toBe(false);
    expect(() => svc.convertToClient(enquiry.id, adminId)).toThrow(svc.RuleError);
  });

  it("only lets an active administrator be assigned", async () => {
    const { enquiry } = await svc.createEnquiry({ ...sample, email: "as@example.com" });
    const cand = db.insert(schema.users).values({ email: "c@test.example", name: "Cand", role: "CANDIDATE", passwordHash: "x" }).returning().get();
    expect(() => svc.assignEnquiry(enquiry.id, cand.id, adminId)).toThrow(svc.RuleError);
    svc.assignEnquiry(enquiry.id, adminId, adminId);
    expect(svc.getEnquiryDetail(enquiry.id)!.e.assigneeId).toBe(adminId);
  });
});

describe("listing", () => {
  it("filters by status and searches by reference", async () => {
    const { enquiry } = await svc.createEnquiry({ ...sample, email: "find@example.com", message: "Unique search phrase zebra-panel enquiry." });
    expect(svc.listEnquiries({ q: "zebra-panel" }).rows[0].e.id).toBe(enquiry.id);
    expect(svc.listEnquiries({ q: enquiry.reference }).total).toBe(1);
    expect(svc.listEnquiries({ status: "CLOSED" }).rows.every((r) => r.e.status === "CLOSED")).toBe(true);
  });
});

describe("email resilience", () => {
  it("never sends the same idempotency key twice, and keeps failures retryable", async () => {
    const mail = { to: "x@example.com", template: "t", subject: "S", text: "t", html: "<p>t</p>", idempotencyKey: "k-1" };
    expect((await emailMod.sendEmail(mail)).skipped).toBe(false);
    expect((await emailMod.sendEmail(mail)).skipped).toBe(true);
  });

  it("records a failed delivery without throwing, and never stores sensitive bodies", async () => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1"; // nothing listens here
    const res = await emailMod.sendEmail({ to: "y@example.com", template: "tok", subject: "S\r\nBcc: evil@example.com", text: "secret-link", html: "<p>secret</p>", idempotencyKey: "k-2", sensitive: true });
    process.env.SMTP_HOST = "";
    expect(res.status).toBe("FAILED");
    const row = db.select().from(schema.emailLogs).all().find((l) => l.idempotencyKey === "k-2")!;
    expect(row.bodyText).toBeNull();
    expect(row.subject).not.toMatch(/[\r\n]/);
    expect((await emailMod.retryEmail(row.id)).ok).toBe(false); // body not stored -> cannot replay
  });
});
