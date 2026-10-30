import { and, asc, eq, ne } from "drizzle-orm";
import { existsSync } from "node:fs";
import path from "node:path";
import { db, schema } from "@/db";
import { audit } from "./audit";
import { CATEGORY_ORDER, SEED_ITEMS } from "@/content/catalogue-seed";
import { RuleError } from "./enquiries";

export { RuleError };
const { catalogueItems } = schema;
export type Item = typeof catalogueItems.$inferSelect;

/** Split a multi-line text column into trimmed non-empty lines. */
export const lines = (t: string | null | undefined): string[] => (t ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
/** "Label: value" lines to pairs (lines without a colon are ignored). */
export function factPairs(t: string | null | undefined): [string, string][] {
  return lines(t).flatMap((l) => { const i = l.indexOf(":"); return i > 0 && i < l.length - 1 ? [[l.slice(0, i).trim(), l.slice(i + 1).trim()] as [string, string]] : []; });
}

function cleanSlug(title: string): string {
  return title.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "item";
}
function uniqueSlug(title: string): string {
  const base = cleanSlug(title);
  let slug = base, n = 2;
  while (db.select().from(catalogueItems).where(eq(catalogueItems.slug, slug)).get()) slug = `${base}-${n++}`;
  return slug;
}

/** Only files placed in /public/catalogue may be referenced: no external URLs (no hotlinking, no tracking), no path tricks. */
export const IMAGE_RE = /^\/catalogue\/[a-z0-9][a-z0-9._-]*\.(jpg|jpeg|png|webp)$/i;
export function imageAvailable(imagePath: string | null | undefined): string | null {
  if (!imagePath || !IMAGE_RE.test(imagePath)) return null;
  return existsSync(path.join(process.cwd(), "public", imagePath)) ? imagePath : null;
}

export type ItemInput = {
  title: string; category: string; kind: string; summary: string; description: string;
  highlights?: string; applications?: string; facts?: string; imagePath?: string; sortOrder: number;
};

function checkInput(i: ItemInput) {
  if (!["SERVICE", "PRODUCT"].includes(i.kind)) throw new RuleError("Choose whether this is a service or a product.");
  if (i.imagePath && !IMAGE_RE.test(i.imagePath)) throw new RuleError("Image path must look like /catalogue/my-photo.jpg (a file you placed in the public/catalogue folder).");
  const hl = lines(i.highlights), ap = lines(i.applications);
  if (hl.length > 12 || ap.length > 12) throw new RuleError("Use at most 12 lines in each list.");
  if (hl.concat(ap).some((l) => l.length > 220)) throw new RuleError("Each list line must be under 220 characters.");
  const badFact = lines(i.facts).find((l) => !/^[^:]{1,40}:\s*\S.{0,200}$/.test(l));
  if (badFact) throw new RuleError(`Quick facts must be written as "Label: value". Check: "${badFact.slice(0, 40)}".`);
  if (lines(i.facts).length > 8) throw new RuleError("Use at most 8 quick facts.");
}

const toRow = (i: ItemInput) => ({
  title: i.title.trim(), category: i.category.trim(), kind: i.kind, summary: i.summary.trim(), description: i.description.trim(),
  highlights: lines(i.highlights).join("\n") || null, applications: lines(i.applications).join("\n") || null,
  facts: lines(i.facts).join("\n") || null, imagePath: i.imagePath?.trim() || null, sortOrder: i.sortOrder,
});

export function createItem(input: ItemInput, actorId: string): Item {
  checkInput(input);
  const item = db.insert(catalogueItems).values({ ...toRow(input), slug: uniqueSlug(input.title), status: "DRAFT" }).returning().get();
  audit({ actorId, action: "catalogue.created", entityType: "catalogue", entityId: item.id, details: { title: item.title } });
  return item;
}
export function updateItem(id: string, input: ItemInput, actorId: string) {
  checkInput(input);
  if (!db.select().from(catalogueItems).where(eq(catalogueItems.id, id)).get()) throw new RuleError("Item not found.");
  db.update(catalogueItems).set(toRow(input)).where(eq(catalogueItems.id, id)).run(); // slug never changes: public links stay valid
  audit({ actorId, action: "catalogue.updated", entityType: "catalogue", entityId: id });
}
export function setItemStatus(id: string, to: "PUBLISHED" | "DRAFT", actorId: string) {
  const it = db.select().from(catalogueItems).where(eq(catalogueItems.id, id)).get();
  if (!it) throw new RuleError("Item not found.");
  if (it.status === to) throw new RuleError(`This item is already ${to === "PUBLISHED" ? "published" : "a draft"}.`);
  db.update(catalogueItems).set({ status: to }).where(eq(catalogueItems.id, id)).run();
  audit({ actorId, action: to === "PUBLISHED" ? "catalogue.published" : "catalogue.unpublished", entityType: "catalogue", entityId: id });
}

// ------------------------------------------------------------------ public reads (published only)
const rank = (c: string) => { const i = (CATEGORY_ORDER as readonly string[]).indexOf(c); return i === -1 ? 999 : i; };

export function listPublishedByCategory(): { category: string; items: Item[] }[] {
  const rows = db.select().from(catalogueItems).where(eq(catalogueItems.status, "PUBLISHED")).orderBy(asc(catalogueItems.sortOrder), asc(catalogueItems.title)).all();
  const map = new Map<string, Item[]>();
  for (const r of rows) map.set(r.category, [...(map.get(r.category) ?? []), r]);
  return [...map.entries()].map(([category, items]) => ({ category, items })).sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category));
}
export const getPublishedBySlug = (slug: string) => db.select().from(catalogueItems).where(and(eq(catalogueItems.slug, slug), eq(catalogueItems.status, "PUBLISHED"))).get() ?? null;
export const relatedItems = (item: Item, limit = 3) =>
  db.select().from(catalogueItems).where(and(eq(catalogueItems.status, "PUBLISHED"), eq(catalogueItems.category, item.category), ne(catalogueItems.id, item.id))).orderBy(asc(catalogueItems.sortOrder)).limit(limit).all();

// ------------------------------------------------------------------ admin reads
export const listAllItems = () => db.select().from(catalogueItems).all().sort((a, b) => rank(a.category) - rank(b.category) || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
export const getItemById = (id: string) => db.select().from(catalogueItems).where(eq(catalogueItems.id, id)).get() ?? null;
export const categoriesInUse = () => [...new Set([...(CATEGORY_ORDER as readonly string[]), ...db.select({ c: catalogueItems.category }).from(catalogueItems).all().map((r) => r.c)])];

// ------------------------------------------------------------------ seeding
/** Inserts the initial catalogue once (does nothing if any item exists, so admin edits are never overwritten). */
export function seedCatalogue(publish = true): number {
  if (db.select().from(catalogueItems).limit(1).get()) return 0;
  for (const s of SEED_ITEMS) {
    db.insert(catalogueItems).values({
      slug: s.slug, title: s.title, category: s.category, kind: s.kind, summary: s.summary, description: s.description,
      highlights: s.highlights?.join("\n") ?? null, applications: s.applications?.join("\n") ?? null,
      facts: s.facts?.map(([k, v]) => `${k}: ${v}`).join("\n") ?? null, sortOrder: s.sortOrder, status: publish ? "PUBLISHED" : "DRAFT",
    }).run();
  }
  return SEED_ITEMS.length;
}
