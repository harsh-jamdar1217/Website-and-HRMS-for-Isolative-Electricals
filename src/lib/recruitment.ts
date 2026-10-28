import { and, desc, eq, inArray, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "./audit";
import { sendEmail } from "./email";
import * as T from "./email-templates";
import { makeReference, slugify } from "./ids";
import { hashPassword } from "./password";
import { createToken, consumeToken } from "./tokens";
import { canMoveApplication, CANDIDATE_EDITABLE, type Actor, type ApplicationStatus, APPLICATION_STATUS_LABEL } from "./status";
import { RuleError } from "./enquiries";
import { syncDocumentTasks } from "./employees";

export { RuleError };
const { users, vacancies, applications, applicationEvents, documents, candidateProfiles } = schema;
const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const hrEmail = () => process.env.HR_NOTIFY_EMAIL ?? process.env.ADMIN_NOTIFY_EMAIL ?? "hr@isolative.example";

// ------------------------------------------------------------------ vacancies

export function isOpen(v: { status: string; closesAt: Date | null }) {
  return v.status === "PUBLISHED" && (!v.closesAt || v.closesAt.getTime() > Date.now());
}
export function listOpenVacancies() {
  return db.select().from(vacancies).where(eq(vacancies.status, "PUBLISHED")).orderBy(desc(vacancies.createdAt)).all().filter(isOpen);
}
export function getOpenVacancy(slug: string) {
  const v = db.select().from(vacancies).where(eq(vacancies.slug, slug)).get();
  return v && isOpen(v) ? v : null;
}

export type VacancyInput = { title: string; department?: string; location: string; employmentType: string; description: string; eligibility: string; closesAt?: string };
const closeDate = (s?: string) => (s ? new Date(`${s}T23:59:59+05:30`) : null);

export function createVacancy(input: VacancyInput, actorId: string) {
  const v = db.insert(vacancies).values({
    slug: slugify(input.title), title: input.title, department: input.department || null, location: input.location,
    employmentType: input.employmentType, description: input.description, eligibility: input.eligibility,
    closesAt: closeDate(input.closesAt), createdById: actorId,
  }).returning().get();
  audit({ actorId, action: "vacancy.created", entityType: "vacancy", entityId: v.id, details: { title: v.title } });
  return v;
}
export function updateVacancy(id: string, input: VacancyInput, actorId: string) {
  const v = db.select().from(vacancies).where(eq(vacancies.id, id)).get();
  if (!v) throw new RuleError("Vacancy not found.");
  db.update(vacancies).set({ title: input.title, department: input.department || null, location: input.location, employmentType: input.employmentType, description: input.description, eligibility: input.eligibility, closesAt: closeDate(input.closesAt) }).where(eq(vacancies.id, id)).run();
  audit({ actorId, action: "vacancy.updated", entityType: "vacancy", entityId: id });
}
export function setVacancyStatus(id: string, to: string, actorId: string) {
  const v = db.select().from(vacancies).where(eq(vacancies.id, id)).get();
  if (!v) throw new RuleError("Vacancy not found.");
  const ok: Record<string, string[]> = { DRAFT: ["PUBLISHED"], PUBLISHED: ["CLOSED", "DRAFT"], CLOSED: ["PUBLISHED"] };
  if (!ok[v.status]?.includes(to)) throw new RuleError(`Cannot move a ${v.status.toLowerCase()} vacancy to ${to.toLowerCase()}.`);
  db.update(vacancies).set({ status: to }).where(eq(vacancies.id, id)).run();
  audit({ actorId, action: "vacancy.status_changed", entityType: "vacancy", entityId: id, details: { from: v.status, to } });
}

// ------------------------------------------------------------------ applying & verification

function newApplicationRow(tx: Pick<typeof db, "insert">, candidateId: string, vacancyId: string, coverNote: string | undefined, status: ApplicationStatus) {
  for (let i = 0; i < 5; i++) {
    try {
      const app = tx.insert(applications).values({ reference: makeReference("APP"), candidateId, vacancyId, coverNote: coverNote || null, status }).returning().get();
      tx.insert(applicationEvents).values({ applicationId: app.id, fromStatus: null, toStatus: status, actorId: candidateId }).run();
      return app;
    } catch (e) {
      if (!(e instanceof Error) || !/applications_reference_uq/.test(e.message)) throw e; // retry only on reference collision
    }
  }
  throw new Error("Could not allocate an application reference");
}

export async function sendVerification(userId: string) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || user.emailVerifiedAt) return;
  const app = db.select({ title: vacancies.title }).from(applications).innerJoin(vacancies, eq(vacancies.id, applications.vacancyId)).where(eq(applications.candidateId, userId)).orderBy(desc(applications.createdAt)).get();
  const { raw, id } = createToken(userId, "EMAIL_VERIFY", 24);
  const mail = T.verifyEmail({ name: user.name, url: `${appUrl()}/verify-email?token=${raw}`, vacancy: app?.title ?? "your application" });
  // sensitive: the body holds the secret link, so it is NOT stored in the email log
  await sendEmail({ to: user.email, template: "verify_email", ...mail, idempotencyKey: `verify:${id}`, relatedType: "user", relatedId: userId, sensitive: true });
}

/** New visitor applies: creates the candidate account, profile and application together, then emails a verification link. */
export async function registerAndApply(input: { name: string; email: string; phone: string; password: string; coverNote?: string; vacancyId: string }) {
  const vac = db.select().from(vacancies).where(eq(vacancies.id, input.vacancyId)).get();
  if (!vac || !isOpen(vac)) throw new RuleError("This vacancy is no longer open.");
  if (db.select().from(users).where(eq(users.email, input.email)).get()) throw new RuleError("An account with this email already exists. Please sign in to apply.");
  const passwordHash = await hashPassword(input.password);
  const result = db.transaction((tx) => {
    const user = tx.insert(users).values({ email: input.email, name: input.name, passwordHash, role: "CANDIDATE" }).returning().get();
    tx.insert(candidateProfiles).values({ userId: user.id, phone: input.phone }).run();
    const app = newApplicationRow(tx, user.id, vac.id, input.coverNote, "PENDING_VERIFICATION");
    tx.insert(schema.auditLogs).values({ actorId: user.id, action: "application.created", entityType: "application", entityId: app.id, details: JSON.stringify({ reference: app.reference, vacancy: vac.title }) }).run();
    return { user, app };
  });
  await sendVerification(result.user.id);
  return result;
}

/** Existing, signed-in candidate applies to another vacancy. */
export async function applyExisting(candidateId: string, vacancyId: string, coverNote?: string) {
  const vac = db.select().from(vacancies).where(eq(vacancies.id, vacancyId)).get();
  if (!vac || !isOpen(vac)) throw new RuleError("This vacancy is no longer open.");
  if (db.select().from(applications).where(and(eq(applications.candidateId, candidateId), eq(applications.vacancyId, vacancyId))).get()) throw new RuleError("You have already applied for this vacancy.");
  const user = db.select().from(users).where(eq(users.id, candidateId)).get()!;
  const app = db.transaction((tx) => {
    const a = newApplicationRow(tx, candidateId, vacancyId, coverNote, user.emailVerifiedAt ? "DOCS_PENDING" : "PENDING_VERIFICATION");
    tx.insert(schema.auditLogs).values({ actorId: candidateId, action: "application.created", entityType: "application", entityId: a.id, details: JSON.stringify({ reference: a.reference, vacancy: vac.title }) }).run();
    return a;
  });
  if (user.emailVerifiedAt) await sendReceived(app.id);
  return app;
}

async function sendReceived(applicationId: string) {
  const row = db.select({ app: applications, user: users, title: vacancies.title }).from(applications).innerJoin(users, eq(users.id, applications.candidateId)).innerJoin(vacancies, eq(vacancies.id, applications.vacancyId)).where(eq(applications.id, applicationId)).get();
  if (!row) return;
  const mail = T.applicationReceived({ name: row.user.name, reference: row.app.reference, vacancy: row.title, url: `${appUrl()}/candidate/applications/${row.app.id}` });
  await sendEmail({ to: row.user.email, template: "application_received", ...mail, idempotencyKey: `app_received:${applicationId}`, relatedType: "application", relatedId: applicationId });
}

/** Redeems an emailed token: verifies the address and advances this candidate's waiting applications. */
export async function verifyEmailToken(raw: string): Promise<{ ok: boolean; reason?: string }> {
  const userId = consumeToken(raw, "EMAIL_VERIFY");
  if (!userId) return { ok: false, reason: "This link is invalid, has expired or has already been used. Sign in and request a new one." };
  const waiting = db.transaction((tx) => {
    tx.update(users).set({ emailVerifiedAt: new Date() }).where(and(eq(users.id, userId), isNull(users.emailVerifiedAt))).run();
    const pending = tx.select().from(applications).where(and(eq(applications.candidateId, userId), eq(applications.status, "PENDING_VERIFICATION"))).all();
    for (const a of pending) {
      tx.update(applications).set({ status: "DOCS_PENDING" }).where(eq(applications.id, a.id)).run();
      tx.insert(applicationEvents).values({ applicationId: a.id, fromStatus: "PENDING_VERIFICATION", toStatus: "DOCS_PENDING", actorId: null }).run();
    }
    tx.insert(schema.auditLogs).values({ actorId: userId, action: "user.email_verified", entityType: "user", entityId: userId }).run();
    return pending;
  });
  for (const a of waiting) await sendReceived(a.id);
  return { ok: true };
}

// ------------------------------------------------------------------ candidate side

export function getOwnApplication(id: string, candidateId: string) {
  const row = db.select({ app: applications, vacancy: vacancies }).from(applications).innerJoin(vacancies, eq(vacancies.id, applications.vacancyId)).where(and(eq(applications.id, id), eq(applications.candidateId, candidateId))).get();
  return row ?? null; // null for both "missing" and "someone else's": callers answer 404, never 403
}
export const listOwnApplications = (candidateId: string) =>
  db.select({ app: applications, vacancy: vacancies }).from(applications).innerJoin(vacancies, eq(vacancies.id, applications.vacancyId)).where(eq(applications.candidateId, candidateId)).orderBy(desc(applications.createdAt)).all();

export function getProfile(userId: string) {
  return db.select().from(candidateProfiles).where(eq(candidateProfiles.userId, userId)).get() ?? null;
}
export function activeDocuments(applicationId: string) {
  return db.select().from(documents).where(and(eq(documents.applicationId, applicationId), isNull(documents.supersededAt))).orderBy(documents.type).all();
}
export const timeline = (applicationId: string) =>
  db.select().from(applicationEvents).where(eq(applicationEvents.applicationId, applicationId)).orderBy(desc(applicationEvents.createdAt)).all();

function ownEditable(id: string, candidateId: string) {
  const row = getOwnApplication(id, candidateId);
  if (!row) throw new RuleError("Application not found.");
  return row;
}

export function saveProfile(applicationId: string, candidateId: string, p: { phone: string; city?: string; qualification?: string; experienceYears?: number; summary?: string; coverNote?: string }) {
  const { app } = ownEditable(applicationId, candidateId);
  if (!["PENDING_VERIFICATION", ...CANDIDATE_EDITABLE].includes(app.status as ApplicationStatus)) throw new RuleError("This application can no longer be edited.");
  db.update(candidateProfiles).set({ phone: p.phone, city: p.city || null, qualification: p.qualification || null, experienceYears: p.experienceYears ?? null, summary: p.summary || null }).where(eq(candidateProfiles.userId, candidateId)).run();
  db.update(applications).set({ coverNote: p.coverNote || null }).where(eq(applications.id, applicationId)).run();
  audit({ actorId: candidateId, action: "application.profile_updated", entityType: "application", entityId: applicationId });
}

/** Central status mover. Enforces who may do what, plus the business rules for shortlisting and selection. */
export async function moveApplication(input: { applicationId: string; to: ApplicationStatus; by: Actor; actorId: string | null; note?: string; internalNote?: string }) {
  const app = db.select().from(applications).where(eq(applications.id, input.applicationId)).get();
  if (!app) throw new RuleError("Application not found.");
  if (!canMoveApplication(app.status, input.to, input.by)) throw new RuleError(`That change is not allowed from "${APPLICATION_STATUS_LABEL[app.status as ApplicationStatus] ?? app.status}".`);
  const docs = activeDocuments(app.id);
  const note = input.note?.trim() || null;

  if (input.to === "UNDER_REVIEW") {
    if (!docs.some((d) => d.type === "RESUME")) throw new RuleError("Upload your resume before sending your application for review.");
    if (app.status === "CORRECTION_REQUESTED" && docs.some((d) => d.reviewStatus === "REJECTED")) throw new RuleError("Replace the documents marked \"Needs replacing\" before resubmitting.");
  }
  if (input.to === "SHORTLISTED" && !docs.some((d) => d.type === "RESUME" && d.reviewStatus === "ACCEPTED")) throw new RuleError("Accept the candidate's resume before shortlisting.");
  if (input.to === "SELECTED" && docs.some((d) => d.reviewStatus !== "ACCEPTED")) throw new RuleError("Every document must be accepted before selecting a candidate.");
  if (input.to === "CORRECTION_REQUESTED" && (!note || note.length < 5)) throw new RuleError("Explain what the candidate needs to correct (at least 5 characters).");

  const ev = db.transaction((tx) => {
    tx.update(applications).set({ status: input.to, ...(input.to === "UNDER_REVIEW" ? { submittedAt: new Date() } : {}) }).where(eq(applications.id, app.id)).run();
    const e = tx.insert(applicationEvents).values({ applicationId: app.id, fromStatus: app.status, toStatus: input.to, actorId: input.actorId, note: input.to === "REJECTED" ? null : note }).returning().get();
    tx.insert(schema.auditLogs).values({ actorId: input.actorId, action: "application.status_changed", entityType: "application", entityId: app.id, details: JSON.stringify({ from: app.status, to: input.to, by: input.by, ...(input.internalNote ? { internalNote: input.internalNote.slice(0, 500) } : {}) }) }).run();
    return e;
  });
  await notifyTransition(app.id, input.to, ev.id, note);
  return ev;
}

async function notifyTransition(applicationId: string, to: ApplicationStatus, eventId: string, note: string | null) {
  const row = db.select({ app: applications, user: users, title: vacancies.title }).from(applications).innerJoin(users, eq(users.id, applications.candidateId)).innerJoin(vacancies, eq(vacancies.id, applications.vacancyId)).where(eq(applications.id, applicationId)).get();
  if (!row) return;
  const base = { name: row.user.name, reference: row.app.reference };
  const url = `${appUrl()}/candidate/applications/${applicationId}`;
  const key = (t: string) => `app_${t}:${eventId}`; // per EVENT: a retry never duplicates, a genuine second correction still sends
  const meta = { relatedType: "application", relatedId: applicationId };
  if (to === "UNDER_REVIEW") {
    await sendEmail({ to: row.user.email, template: "documents_submitted", ...T.documentsSubmitted(base), idempotencyKey: key("submitted"), ...meta });
    await sendEmail({ to: hrEmail(), template: "hr_new_submission", ...T.hrNewSubmission({ reference: row.app.reference, candidate: row.user.name, vacancy: row.title, url: `${appUrl()}/admin/candidates/${applicationId}` }), idempotencyKey: key("hr_notify"), ...meta });
  } else if (to === "CORRECTION_REQUESTED") {
    await sendEmail({ to: row.user.email, template: "correction_requested", ...T.correctionRequested({ ...base, note: note ?? "", url }), idempotencyKey: key("correction"), ...meta });
  } else if (to === "SELECTED") {
    await sendEmail({ to: row.user.email, template: "application_selected", ...T.applicationSelected({ ...base, vacancy: row.title, note, url }), idempotencyKey: key("selected"), ...meta });
  } else if (to === "REJECTED") {
    await sendEmail({ to: row.user.email, template: "application_rejected", ...T.applicationRejected({ ...base, vacancy: row.title }), idempotencyKey: key("rejected"), ...meta });
  }
}

// ------------------------------------------------------------------ staff side

export type ApplicationFilters = { q?: string; status?: string; vacancyId?: string; page?: number; pageSize?: number };

export function listApplications({ q, status, vacancyId, page = 1, pageSize = 15 }: ApplicationFilters) {
  const conds: SQL[] = [];
  if (status && status in APPLICATION_STATUS_LABEL) conds.push(eq(applications.status, status));
  if (vacancyId) conds.push(eq(applications.vacancyId, vacancyId));
  if (q?.trim()) { const p = `%${q.trim()}%`; conds.push(or(like(users.name, p), like(users.email, p), like(applications.reference, p))!); }
  const where = conds.length ? and(...conds) : undefined;
  const base = db.select({ n: sql<number>`count(*)` }).from(applications).innerJoin(users, eq(users.id, applications.candidateId));
  const total = (where ? base.where(where) : base).get()?.n ?? 0;
  const safePage = Math.max(1, page);
  const rows = db.select({ app: applications, name: users.name, email: users.email, vacancy: vacancies.title }).from(applications)
    .innerJoin(users, eq(users.id, applications.candidateId)).innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
    .where(where).orderBy(desc(applications.createdAt)).limit(pageSize).offset((safePage - 1) * pageSize).all();
  return { rows, total, page: safePage, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function getApplicationDetail(id: string) {
  const row = db.select({ app: applications, user: users, vacancy: vacancies }).from(applications).innerJoin(users, eq(users.id, applications.candidateId)).innerJoin(vacancies, eq(vacancies.id, applications.vacancyId)).where(eq(applications.id, id)).get();
  if (!row) return null;
  const docs = db.select().from(documents).where(eq(documents.applicationId, id)).orderBy(desc(documents.uploadedAt)).all();
  const events = db.select({ e: applicationEvents, actor: users.name }).from(applicationEvents).leftJoin(users, eq(users.id, applicationEvents.actorId)).where(eq(applicationEvents.applicationId, id)).orderBy(desc(applicationEvents.createdAt)).all();
  return { ...row, profile: getProfile(row.user.id), docs, events };
}

export function reviewDocument(documentId: string, decision: "ACCEPTED" | "REJECTED", note: string | undefined, actorId: string) {
  const doc = db.select().from(documents).where(eq(documents.id, documentId)).get();
  if (!doc || doc.supersededAt) throw new RuleError("Document not found or already replaced.");
  const app = db.select().from(applications).where(eq(applications.id, doc.applicationId)).get()!;
  if (!["UNDER_REVIEW", "SHORTLISTED", "HIRED"].includes(app.status)) throw new RuleError("Documents can be reviewed only while the application is under review, shortlisted or being onboarded.");
  if (decision === "REJECTED" && (!note || note.trim().length < 5)) throw new RuleError("Say why the document needs replacing (at least 5 characters).");
  db.update(documents).set({ reviewStatus: decision, reviewNote: decision === "REJECTED" ? note!.trim() : null }).where(eq(documents.id, documentId)).run();
  audit({ actorId, action: `document.${decision.toLowerCase()}`, entityType: "application", entityId: doc.applicationId, details: { documentId, type: doc.type } });
  syncDocumentTasks(doc, decision, actorId); // onboarding tasks follow the review decision
}

export function countByStatus(statuses: ApplicationStatus[]): number {
  return db.select({ n: sql<number>`count(*)` }).from(applications).where(inArray(applications.status, statuses)).get()?.n ?? 0;
}
