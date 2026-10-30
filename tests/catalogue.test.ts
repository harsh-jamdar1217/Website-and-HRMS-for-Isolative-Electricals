import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "iep-cat-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.SMTP_HOST = "";
let C: typeof import("../src/lib/catalogue"); let E: typeof import("../src/lib/enquiries"); let S: typeof import("../src/content/catalogue-seed");
let s: typeof import("../src/db/schema"); let db: typeof import("../src/db").db; let admin: string;

const base = { title: "Cable Jointing Service", category: "Testing Services", kind: "SERVICE", summary: "Jointing and termination of HT cables on site.", description: "A longer description of the service that is comfortably above the minimum length.", sortOrder: 50 };

beforeAll(async () => {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const raw = new Database(process.env.DATABASE_URL!.replace("file:", ""));
  migrate(drizzle(raw), { migrationsFolder: "./drizzle" }); raw.close();
  C = await import("../src/lib/catalogue"); E = await import("../src/lib/enquiries"); S = await import("../src/content/catalogue-seed");
  s = await import("../src/db/schema"); db = (await import("../src/db")).db;
  admin = db.insert(s.users).values({ email: "a@c.example", name: "Admin", role: "ADMIN", passwordHash: "x" }).returning().get().id;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("seed content", () => {
  it("loads the company's catalogue once and never overwrites later edits", () => {
    expect(C.seedCatalogue(true)).toBe(S.SEED_ITEMS.length);
    expect(C.seedCatalogue(true)).toBe(0);
    expect(db.select().from(s.catalogueItems).all()).toHaveLength(14);
  });
  it("seed data is well-formed: unique slugs, known categories, no empty text, sensible lengths", () => {
    const slugs = S.SEED_ITEMS.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const i of S.SEED_ITEMS) {
      expect(S.CATEGORY_ORDER).toContain(i.category);
      expect(i.title.length).toBeGreaterThan(5); expect(i.summary.length).toBeGreaterThan(20); expect(i.summary.length).toBeLessThanOrEqual(300);
      expect(i.description.length).toBeGreaterThan(40); expect(slugs.filter((x) => x === i.slug)).toHaveLength(1);
      expect((i.highlights ?? []).length).toBeLessThanOrEqual(12);
    }
  });
});

describe("public listing", () => {
  it("groups published items by category in the company's order and hides drafts", () => {
    const draft = C.createItem({ ...base, title: "Hidden Draft Service" }, admin);
    const groups = C.listPublishedByCategory();
    expect(groups.map((g) => g.category)).toEqual([...S.CATEGORY_ORDER]);
    expect(groups.flatMap((g) => g.items).some((i) => i.id === draft.id)).toBe(false);
    expect(C.getPublishedBySlug(draft.slug)).toBeNull();
    expect(C.getPublishedBySlug("no-such-item")).toBeNull();
    expect(C.getPublishedBySlug("ct-and-pt-testing-work")?.title).toBe("CT and PT Testing Work");
  });
  it("parses highlight lines and quick facts", () => {
    const it = C.getPublishedBySlug("relay-testing-and-commissioning")!;
    expect(C.factPairs(it.facts)[0][0]).toBe("Makes handled");
    expect(C.factPairs("no colon here\nGood: yes\nBad:")).toEqual([["Good", "yes"]]);
    expect(C.lines("a\n\n  b \r\nc")).toEqual(["a", "b", "c"]);
  });
});

describe("admin editing rules", () => {
  it("creates drafts with unique, clean slugs; updating never changes the URL", () => {
    const a = C.createItem(base, admin), b = C.createItem(base, admin);
    expect(a.slug).toBe("cable-jointing-service"); expect(b.slug).toBe("cable-jointing-service-2"); expect(a.status).toBe("DRAFT");
    C.updateItem(a.id, { ...base, title: "Renamed Service" }, admin);
    expect(C.getItemById(a.id)!.slug).toBe("cable-jointing-service");
    expect(C.getItemById(a.id)!.title).toBe("Renamed Service");
  });
  it("publishes and unpublishes with valid transitions, auditing each change", () => {
    const it = C.createItem({ ...base, title: "Switch Me" }, admin);
    C.setItemStatus(it.id, "PUBLISHED", admin);
    expect(C.getPublishedBySlug(it.slug)).not.toBeNull();
    expect(() => C.setItemStatus(it.id, "PUBLISHED", admin)).toThrow(/already published/);
    C.setItemStatus(it.id, "DRAFT", admin);
    expect(C.getPublishedBySlug(it.slug)).toBeNull();
    expect(db.select().from(s.auditLogs).all().filter((a) => a.entityId === it.id).map((a) => a.action)).toEqual(expect.arrayContaining(["catalogue.created", "catalogue.published", "catalogue.unpublished"]));
  });
  it("rejects bad kinds, external or unsafe image paths, over-long lists and malformed facts", () => {
    expect(() => C.createItem({ ...base, kind: "OTHER" }, admin)).toThrow(/service or a product/);
    for (const bad of ["https://evil.example/x.jpg", "//evil.example/x.jpg", "/catalogue/../secret.jpg", "/catalogue/x.svg", "catalogue/x.jpg", "/etc/passwd", "/catalogue/a b.jpg", "javascript:alert(1)"])
      expect(() => C.createItem({ ...base, imagePath: bad }, admin), bad).toThrow(/Image path/);
    expect(() => C.createItem({ ...base, highlights: Array.from({ length: 13 }, (_, i) => `Point ${i}`).join("\n") }, admin)).toThrow(/at most 12/);
    expect(() => C.createItem({ ...base, facts: "not a fact line" }, admin)).toThrow(/Label: value/);
    expect(() => C.createItem({ ...base, facts: Array.from({ length: 9 }, (_, i) => `K${i}: v`).join("\n") }, admin)).toThrow(/at most 8/);
    expect(() => C.updateItem("missing", base, admin)).toThrow(/not found/);
    expect(C.createItem({ ...base, title: "Good Image", imagePath: "/catalogue/photo-1.jpg" }, admin).imagePath).toBe("/catalogue/photo-1.jpg");
  });
  it("only shows an image when the file really exists in public/catalogue", () => {
    const folder = path.join(process.cwd(), "public", "catalogue"); mkdirSync(folder, { recursive: true });
    const file = path.join(folder, "zz-test-image.png"); writeFileSync(file, "x");
    try { expect(C.imageAvailable("/catalogue/zz-test-image.png")).toBe("/catalogue/zz-test-image.png"); } finally { rmSync(file); }
    expect(C.imageAvailable("/catalogue/zz-test-image.png")).toBeNull(); // file gone: falls back to the drawn icon
    expect(C.imageAvailable("https://x.example/a.png")).toBeNull();
    expect(C.imageAvailable(null)).toBeNull();
    expect(existsSync(file)).toBe(false);
  });
});

describe("enquiries from a product or service page", () => {
  const e = (over: Record<string, unknown> = {}) => ({ name: "Visitor One", email: "v1@example.com", category: "QUOTATION" as const, message: "Please send a quotation for testing three breakers at our plant in Satara.", ...over });
  it("links the enquiry to the item, snapshots its title, and names it in both emails", async () => {
    const { enquiry } = await E.createEnquiry(e({ itemSlug: "circuit-breaker-servicing-and-testing" }));
    expect(enquiry.itemTitle).toBe("Circuit Breaker Servicing and Testing Work");
    expect(enquiry.catalogueItemId).toBe(C.getPublishedBySlug("circuit-breaker-servicing-and-testing")!.id);
    const mails = db.select().from(s.emailLogs).all().filter((l) => l.relatedId === enquiry.id);
    expect(mails).toHaveLength(2);
    expect(mails.every((m) => m.bodyText!.includes("Circuit Breaker Servicing and Testing Work"))).toBe(true);
  });
  it("ignores unknown or unpublished items instead of trusting the form", async () => {
    const draft = C.createItem({ ...base, title: "Not Public Yet" }, admin);
    for (const [i, slug] of ["nope-nope", draft.slug, "../../etc/passwd"].entries()) {
      const { enquiry } = await E.createEnquiry(e({ email: `v-ign${i}@example.com`, itemSlug: slug }));
      expect(enquiry.catalogueItemId).toBeNull(); expect(enquiry.itemTitle).toBeNull();
    }
  });
  it("treats the same message about two different items as two enquiries, but a repeat for one item as a duplicate", async () => {
    const x = await E.createEnquiry(e({ email: "v2@example.com", itemSlug: "ct-and-pt-testing-work" }));
    const y = await E.createEnquiry(e({ email: "v2@example.com", itemSlug: "relay-testing-and-commissioning" }));
    const z = await E.createEnquiry(e({ email: "v2@example.com", itemSlug: "ct-and-pt-testing-work" }));
    expect(y.duplicate).toBe(false); expect(y.enquiry.id).not.toBe(x.enquiry.id);
    expect(z.duplicate).toBe(true); expect(z.enquiry.id).toBe(x.enquiry.id);
  });
  it("keeps the readable title even if the item is later unpublished", async () => {
    const it = C.createItem({ ...base, title: "Temporary Offer" }, admin); C.setItemStatus(it.id, "PUBLISHED", admin);
    const { enquiry } = await E.createEnquiry(e({ email: "v3@example.com", itemSlug: it.slug }));
    C.setItemStatus(it.id, "DRAFT", admin);
    expect(E.getEnquiryDetail(enquiry.id)!.e.itemTitle).toBe("Temporary Offer");
  });
});
