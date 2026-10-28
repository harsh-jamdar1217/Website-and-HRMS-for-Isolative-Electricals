import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "./audit";
import { sendEmail } from "./email";
import * as T from "./email-templates";
import { RuleError } from "./enquiries";
import { fmtDate } from "./format";
import { EMPLOYEE_STATUS_LABEL, ONBOARDING_DOC_TYPES } from "./status";

export { RuleError };
const { employees, onboardingTasks, applications, applicationEvents, users, documents, vacancies } = schema;
const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

/** The default onboarding checklist. Edit here to change what every new joiner gets. */
export const ONBOARDING_TEMPLATE = [
  { key: "DETAILS", owner: "EMPLOYEE", title: "Complete your address and emergency contact", description: "Used only for HR records and emergencies." },
  { key: "BANK_PROOF", owner: "EMPLOYEE", title: "Upload bank account proof", description: "A cancelled cheque or first page of the passbook, for salary payment." },
  { key: "JOINING_FORM", owner: "EMPLOYEE", title: "Upload your signed joining form", description: "HR will give you the form on or before your joining date." },
  { key: "VERIFY_DOCS", owner: "HR", title: "Verify identity and education documents", description: "Confirm originals against the uploaded copies." },
  { key: "ID_CARD", owner: "HR", title: "Issue ID card and workplace access", description: "" },
  { key: "ORIENTATION", owner: "HR", title: "Hold joining orientation", description: "" },
] as const;
/** Tasks that complete automatically when HR accepts the matching document. */
const DOC_TASK: Record<string, string> = { BANK_PROOF: "BANK_PROOF", JOINING_FORM: "JOINING_FORM" };

function nextEmployeeCode(tx: Pick<typeof db, "insert" | "select">): string {
  tx.insert(schema.counters).values({ name: "employee", value: 0 }).onConflictDoNothing().run();
  const row = (tx as typeof db).update(schema.counters).set({ value: sql`${schema.counters.value} + 1` }).where(eq(schema.counters.name, "employee")).returning({ v: schema.counters.value }).get();
  return `EMP-${String(row.v).padStart(4, "0")}`;
}

export type ConversionInput = { applicationId: string; department: string; jobTitle: string; employmentType: string; joiningDate: string; actorId: string };

/**
 * The ONLY path from candidate to employee. Requires an accepted offer, an active account, and no existing employee record.
 * The same user is promoted (no duplicate identity); the application becomes HIRED and keeps the full history.
 */
export async function convertToEmployee(input: ConversionInput) {
  const joining = new Date(`${input.joiningDate}T09:00:00+05:30`);
  if (Number.isNaN(joining.getTime())) throw new RuleError("Choose a valid joining date.");
  if (joining.getTime() < Date.now() - 30 * 86400_000) throw new RuleError("The joining date cannot be more than 30 days in the past.");

  const emp = db.transaction((tx) => {
    const app = tx.select().from(applications).where(eq(applications.id, input.applicationId)).get();
    if (!app) throw new RuleError("Application not found.");
    if (app.status === "HIRED") throw new RuleError("This candidate has already been converted to an employee.");
    if (app.status !== "OFFER_ACCEPTED") throw new RuleError("Only candidates who have accepted their offer can be converted.");
    const user = tx.select().from(users).where(eq(users.id, app.candidateId)).get()!;
    if (!user.isActive) throw new RuleError("This account is deactivated.");
    if (user.role !== "CANDIDATE") throw new RuleError("This account already has an employee or staff role.");
    if (tx.select().from(employees).where(eq(employees.userId, user.id)).get()) throw new RuleError("An employee record already exists for this person.");

    const e = tx.insert(employees).values({
      userId: user.id, applicationId: app.id, employeeCode: nextEmployeeCode(tx), department: input.department, jobTitle: input.jobTitle,
      employmentType: input.employmentType, joiningDate: joining, createdById: input.actorId,
    }).returning().get();
    ONBOARDING_TEMPLATE.forEach((t, i) => tx.insert(onboardingTasks).values({ employeeId: e.id, key: t.key, title: t.title, description: t.description || null, owner: t.owner, sortOrder: i }).run());
    tx.update(users).set({ role: "EMPLOYEE" }).where(eq(users.id, user.id)).run();
    tx.update(applications).set({ status: "HIRED" }).where(eq(applications.id, app.id)).run();
    tx.insert(applicationEvents).values({ applicationId: app.id, fromStatus: "OFFER_ACCEPTED", toStatus: "HIRED", actorId: input.actorId }).run();
    tx.insert(schema.auditLogs).values({ actorId: input.actorId, action: "employee.created", entityType: "employee", entityId: e.id, details: JSON.stringify({ code: e.employeeCode, applicationId: app.id }) }).run();
    return { e, user };
  });

  const mail = T.employeeWelcome({ name: emp.user.name, code: emp.e.employeeCode, jobTitle: emp.e.jobTitle, joiningDate: fmtDate(emp.e.joiningDate), url: `${appUrl()}/employee` });
  await sendEmail({ to: emp.user.email, template: "employee_welcome", ...mail, idempotencyKey: `employee_welcome:${emp.e.id}`, relatedType: "employee", relatedId: emp.e.id });
  return emp.e;
}

// ------------------------------------------------------------------ reads

export function getEmployeeByUser(userId: string) {
  return db.select().from(employees).where(eq(employees.userId, userId)).get() ?? null;
}
export function getEmployeeByApplication(applicationId: string) {
  return db.select().from(employees).where(eq(employees.applicationId, applicationId)).get() ?? null;
}
export function tasksFor(employeeId: string) {
  return db.select().from(onboardingTasks).where(eq(onboardingTasks.employeeId, employeeId)).orderBy(onboardingTasks.sortOrder).all();
}
export function documentsFor(applicationId: string) {
  return db.select().from(documents).where(and(eq(documents.applicationId, applicationId), sql`${documents.supersededAt} is null`)).orderBy(documents.type).all();
}

export function listEmployees({ q, status, page = 1, pageSize = 15 }: { q?: string; status?: string; page?: number; pageSize?: number }) {
  const conds: SQL[] = [];
  if (status && status in EMPLOYEE_STATUS_LABEL) conds.push(eq(employees.status, status));
  if (q?.trim()) { const p = `%${q.trim()}%`; conds.push(or(like(users.name, p), like(users.email, p), like(employees.employeeCode, p), like(employees.department, p))!); }
  const where = conds.length ? and(...conds) : undefined;
  const base = db.select({ n: sql<number>`count(*)` }).from(employees).innerJoin(users, eq(users.id, employees.userId));
  const total = (where ? base.where(where) : base).get()?.n ?? 0;
  const safe = Math.max(1, page);
  const rows = db.select({ e: employees, name: users.name, email: users.email, done: sql<number>`(select count(*) from onboarding_tasks t where t.employee_id = ${employees.id} and t.status='DONE')`, all: sql<number>`(select count(*) from onboarding_tasks t where t.employee_id = ${employees.id})` })
    .from(employees).innerJoin(users, eq(users.id, employees.userId)).where(where).orderBy(desc(employees.createdAt)).limit(pageSize).offset((safe - 1) * pageSize).all();
  return { rows, total, page: safe, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function getEmployeeDetail(id: string) {
  const row = db.select({ e: employees, user: users, vacancy: vacancies.title, appRef: applications.reference }).from(employees)
    .innerJoin(users, eq(users.id, employees.userId)).innerJoin(applications, eq(applications.id, employees.applicationId)).innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
    .where(eq(employees.id, id)).get();
  if (!row) return null;
  return { ...row, tasks: tasksFor(id), docs: db.select().from(documents).where(eq(documents.applicationId, row.e.applicationId)).orderBy(desc(documents.uploadedAt)).all() };
}

// ------------------------------------------------------------------ onboarding actions

function markTask(employeeId: string, key: string, done: boolean, actorId: string | null) {
  db.update(onboardingTasks).set({ status: done ? "DONE" : "PENDING", completedAt: done ? new Date() : null, completedById: done ? actorId : null })
    .where(and(eq(onboardingTasks.employeeId, employeeId), eq(onboardingTasks.key, key))).run();
}

/** Employee saves their own contact details. Completes the DETAILS task only when everything is filled in. */
export function saveEmployeeDetails(userId: string, d: { addressLine: string; emergencyName: string; emergencyRelation: string; emergencyPhone: string }) {
  const e = getEmployeeByUser(userId);
  if (!e) throw new RuleError("Employee record not found.");
  if (e.status === "EXITED") throw new RuleError("This record is closed.");
  db.update(employees).set({ addressLine: d.addressLine, emergencyName: d.emergencyName, emergencyRelation: d.emergencyRelation, emergencyPhone: d.emergencyPhone }).where(eq(employees.id, e.id)).run();
  markTask(e.id, "DETAILS", true, userId);
  audit({ actorId: userId, action: "employee.details_updated", entityType: "employee", entityId: e.id });
}

/** Keeps document-driven tasks in step with HR's review decisions. Called from reviewDocument(). */
export function syncDocumentTasks(doc: { applicationId: string; type: string }, decision: "ACCEPTED" | "REJECTED", actorId: string) {
  const key = DOC_TASK[doc.type];
  const e = key ? getEmployeeByApplication(doc.applicationId) : null;
  if (e && key) markTask(e.id, key, decision === "ACCEPTED", actorId);
}

/** HR ticks (or un-ticks) an HR-owned task. Employee-owned tasks complete themselves and cannot be forced here. */
export function setHrTask(employeeId: string, taskKey: string, done: boolean, actorId: string) {
  const e = db.select().from(employees).where(eq(employees.id, employeeId)).get();
  if (!e) throw new RuleError("Employee not found.");
  if (e.status !== "ONBOARDING") throw new RuleError("Onboarding is already closed for this employee.");
  const t = db.select().from(onboardingTasks).where(and(eq(onboardingTasks.employeeId, employeeId), eq(onboardingTasks.key, taskKey))).get();
  if (!t) throw new RuleError("Task not found.");
  if (t.owner !== "HR") throw new RuleError("This task is completed by the employee and cannot be ticked by HR.");
  markTask(employeeId, taskKey, done, actorId);
  audit({ actorId, action: done ? "onboarding.task_done" : "onboarding.task_reopened", entityType: "employee", entityId: employeeId, details: { task: taskKey } });
}

export async function completeOnboarding(employeeId: string, actorId: string) {
  const e = db.select().from(employees).where(eq(employees.id, employeeId)).get();
  if (!e) throw new RuleError("Employee not found.");
  if (e.status !== "ONBOARDING") throw new RuleError("Onboarding is already complete.");
  const open = tasksFor(employeeId).filter((t) => t.status !== "DONE");
  if (open.length) throw new RuleError(`${open.length} onboarding task${open.length === 1 ? " is" : "s are"} still open: ${open.map((t) => t.title).join("; ")}.`);
  db.update(employees).set({ status: "ACTIVE", onboardingCompletedAt: new Date() }).where(eq(employees.id, employeeId)).run();
  audit({ actorId, action: "onboarding.completed", entityType: "employee", entityId: employeeId });
  const u = db.select().from(users).where(eq(users.id, e.userId)).get()!;
  const mail = T.onboardingComplete({ name: u.name, code: e.employeeCode });
  await sendEmail({ to: u.email, template: "onboarding_complete", ...mail, idempotencyKey: `onboarding_complete:${e.id}`, relatedType: "employee", relatedId: e.id });
}

export const EMPLOYEE_UPLOAD_TYPES = ONBOARDING_DOC_TYPES;
export function countEmployees(status: string): number {
  return db.select({ n: sql<number>`count(*)` }).from(employees).where(eq(employees.status, status)).get()?.n ?? 0;
}
