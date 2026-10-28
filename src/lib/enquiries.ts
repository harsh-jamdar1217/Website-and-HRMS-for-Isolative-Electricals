import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gte, like, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "./audit";
import { sendEmail } from "./email";
import { enquiryAcknowledgement, enquiryAdminNotification } from "./email-templates";
import { canTransition, isEnquiryStatus, type EnquiryCategory } from "./status";

const { enquiries, enquiryNotes, clients, users } = schema;

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid misreading
const DEDUPE_WINDOW_MS = 10 * 60_000;

export function generateReference(now = new Date()): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `ENQ-${now.getFullYear()}-${s}`;
}

export function dedupeKey(email: string, message: string): string {
  return createHash("sha256").update(`${email.toLowerCase()}|${message.trim().replace(/\s+/g, " ").toLowerCase()}`).digest("hex");
}

export type NewEnquiry = {
  name: string; company?: string; email: string; phone?: string; category: EnquiryCategory; message: string;
};

/**
 * Store an enquiry, then send the acknowledgement + admin notification.
 * A double-click or retry within 10 minutes returns the original record and sends nothing new.
 * Email problems never undo the stored enquiry (failures are visible in the Email Log).
 */
export async function createEnquiry(input: NewEnquiry) {
  const key = dedupeKey(input.email, input.message);
  const existing = db
    .select()
    .from(enquiries)
    .where(and(eq(enquiries.dedupeKey, key), gte(enquiries.createdAt, new Date(Date.now() - DEDUPE_WINDOW_MS))))
    .get();
  if (existing) return { enquiry: existing, duplicate: true };

  let enquiry: typeof enquiries.$inferSelect | undefined;
  for (let attempt = 0; attempt < 5 && !enquiry; attempt++) {
    try {
      enquiry = db
        .insert(enquiries)
        .values({
          reference: generateReference(),
          name: input.name,
          company: input.company || null,
          email: input.email,
          phone: input.phone || null,
          category: input.category,
          message: input.message,
          consentAt: new Date(),
          dedupeKey: key,
        })
        .returning()
        .get();
    } catch (e) {
      if (!(e instanceof Error) || !/UNIQUE/i.test(e.message)) throw e; // retry only on reference collision
    }
  }
  if (!enquiry) throw new Error("Could not allocate an enquiry reference");

  audit({ actorId: null, action: "enquiry.created", entityType: "enquiry", entityId: enquiry.id, details: { reference: enquiry.reference, category: enquiry.category } });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  const ack = enquiryAcknowledgement({ name: enquiry.name, reference: enquiry.reference });
  await sendEmail({ to: enquiry.email, template: "enquiry_ack", ...ack, idempotencyKey: `enquiry_ack:${enquiry.id}`, relatedType: "enquiry", relatedId: enquiry.id });
  const adminMail = enquiryAdminNotification({
    reference: enquiry.reference, name: enquiry.name, company: enquiry.company, email: enquiry.email,
    category: enquiry.category as EnquiryCategory, message: enquiry.message, url: `${base}/admin/enquiries/${enquiry.id}`,
  });
  await sendEmail({
    to: process.env.ADMIN_NOTIFY_EMAIL ?? "admin@isolative.example", template: "enquiry_admin_notify", ...adminMail,
    idempotencyKey: `enquiry_admin:${enquiry.id}`, relatedType: "enquiry", relatedId: enquiry.id,
  });
  return { enquiry, duplicate: false };
}

export type EnquiryFilters = { q?: string; status?: string; page?: number; pageSize?: number };

export function listEnquiries({ q, status, page = 1, pageSize = 15 }: EnquiryFilters) {
  const conds: SQL[] = [];
  if (status && isEnquiryStatus(status)) conds.push(eq(enquiries.status, status));
  if (q?.trim()) {
    const p = `%${q.trim()}%`;
    conds.push(or(like(enquiries.name, p), like(enquiries.email, p), like(enquiries.company, p), like(enquiries.reference, p), like(enquiries.message, p))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const total = db.select({ n: sql<number>`count(*)` }).from(enquiries).where(where).get()?.n ?? 0;
  const safePage = Math.max(1, page);
  const rows = db
    .select({ e: enquiries, assigneeName: users.name })
    .from(enquiries)
    .leftJoin(users, eq(users.id, enquiries.assigneeId))
    .where(where)
    .orderBy(desc(enquiries.createdAt))
    .limit(pageSize)
    .offset((safePage - 1) * pageSize)
    .all();
  return { rows, total, page: safePage, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function getEnquiryDetail(id: string) {
  const row = db.select({ e: enquiries, assigneeName: users.name }).from(enquiries).leftJoin(users, eq(users.id, enquiries.assigneeId)).where(eq(enquiries.id, id)).get();
  if (!row) return null;
  const notes = db
    .select({ n: enquiryNotes, authorName: users.name })
    .from(enquiryNotes)
    .innerJoin(users, eq(users.id, enquiryNotes.authorId))
    .where(eq(enquiryNotes.enquiryId, id))
    .orderBy(desc(enquiryNotes.createdAt))
    .all();
  const client = db.select().from(clients).where(eq(clients.sourceEnquiryId, id)).get() ?? null;
  const history = db
    .select({ a: schema.auditLogs, actorName: users.name })
    .from(schema.auditLogs)
    .leftJoin(users, eq(users.id, schema.auditLogs.actorId))
    .where(and(eq(schema.auditLogs.entityType, "enquiry"), eq(schema.auditLogs.entityId, id)))
    .orderBy(desc(schema.auditLogs.createdAt))
    .all();
  return { ...row, notes, client, history };
}

export class RuleError extends Error {}

function mustGet(id: string) {
  const e = db.select().from(enquiries).where(eq(enquiries.id, id)).get();
  if (!e) throw new RuleError("Enquiry not found.");
  return e;
}

export function changeStatus(id: string, to: string, actorId: string) {
  const e = mustGet(id);
  if (!isEnquiryStatus(to) || to === "CONVERTED") throw new RuleError("That status cannot be set manually.");
  if (!canTransition(e.status, to)) throw new RuleError(`Cannot move an enquiry from ${e.status} to ${to}.`);
  db.update(enquiries).set({ status: to }).where(eq(enquiries.id, id)).run();
  audit({ actorId, action: "enquiry.status_changed", entityType: "enquiry", entityId: id, details: { from: e.status, to } });
}

export function assignEnquiry(id: string, assigneeId: string | null, actorId: string) {
  const e = mustGet(id);
  if (assigneeId) {
    const u = db.select().from(users).where(eq(users.id, assigneeId)).get();
    if (!u || !u.isActive || u.role !== "ADMIN") throw new RuleError("Choose an active administrator.");
  }
  db.update(enquiries).set({ assigneeId }).where(eq(enquiries.id, id)).run();
  audit({ actorId, action: "enquiry.assigned", entityType: "enquiry", entityId: id, details: { from: e.assigneeId, to: assigneeId } });
}

export function addNote(id: string, body: string, actorId: string) {
  mustGet(id);
  const text = body.trim();
  if (text.length < 2 || text.length > 2000) throw new RuleError("A note must be between 2 and 2000 characters.");
  db.insert(enquiryNotes).values({ enquiryId: id, authorId: actorId, body: text }).run();
  audit({ actorId, action: "enquiry.note_added", entityType: "enquiry", entityId: id });
}

export function setFollowUp(id: string, date: Date | null, actorId: string) {
  mustGet(id);
  db.update(enquiries).set({ followUpDate: date }).where(eq(enquiries.id, id)).run();
  audit({ actorId, action: "enquiry.followup_set", entityType: "enquiry", entityId: id, details: { date: date?.toISOString() ?? null } });
}

/** Creates the private client record and marks the enquiry CONVERTED. One client per enquiry (unique constraint). */
export function convertToClient(id: string, actorId: string) {
  const e = mustGet(id);
  if (e.status === "CONVERTED") throw new RuleError("This enquiry is already converted.");
  if (e.status !== "IN_PROGRESS" && e.status !== "RESPONDED") throw new RuleError("Only enquiries that are in progress or responded can be converted.");
  return db.transaction((tx) => {
    const client = tx
      .insert(clients)
      .values({ name: e.company || e.name, contactName: e.name, email: e.email, phone: e.phone, sourceEnquiryId: e.id })
      .returning()
      .get();
    tx.update(enquiries).set({ status: "CONVERTED" }).where(eq(enquiries.id, id)).run();
    tx.insert(schema.auditLogs).values({ actorId, action: "enquiry.converted", entityType: "enquiry", entityId: id, details: JSON.stringify({ clientId: client.id }) }).run();
    return client;
  });
}
