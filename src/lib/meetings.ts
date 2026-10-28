import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, gte, inArray, lt, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "./audit";
import { sendEmail } from "./email";
import * as T from "./email-templates";
import { RuleError } from "./enquiries";
import { buildIcs } from "./ics";
import { MEETING_TYPES } from "./status";

export { RuleError };
const { meetings, meetingParticipants, users, applications } = schema;
export type MeetingRow = typeof meetings.$inferSelect;
export type ParticipantRow = typeof meetingParticipants.$inferSelect;

const MIN_DURATION = 15, MAX_DURATION = 480;

// ------------------------------------------------------------------ time helpers (everything is stored in UTC, entered and shown in IST)
export function parseIst(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return new Date(NaN);
  return new Date(`${date}T${time}:00+05:30`);
}
export function fmtWhen(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(d);
}
export const endOf = (m: { startsAt: Date; durationMin: number }) => new Date(m.startsAt.getTime() + m.durationMin * 60_000);

// ------------------------------------------------------------------ validation
export type MeetingInput = {
  title: string; type: string; date: string; time: string; durationMin: number;
  location?: string; meetingLink?: string; agenda?: string;
};

function validateCore(i: MeetingInput) {
  const title = i.title.trim();
  if (title.length < 3 || title.length > 120) throw new RuleError("Enter a title of 3 to 120 characters.");
  const startsAt = parseIst(i.date, i.time);
  if (Number.isNaN(startsAt.getTime())) throw new RuleError("Choose a valid date and time.");
  if (startsAt.getTime() <= Date.now()) throw new RuleError("The meeting must start in the future.");
  if (!Number.isInteger(i.durationMin) || i.durationMin < MIN_DURATION || i.durationMin > MAX_DURATION) throw new RuleError(`Duration must be between ${MIN_DURATION} and ${MAX_DURATION} minutes.`);
  const location = i.location?.trim() || null;
  const link = i.meetingLink?.trim() || null;
  if (!location && !link) throw new RuleError("Say where the meeting happens: add a location, a video link, or both.");
  if (link && !/^https?:\/\/[^\s]+$/i.test(link)) throw new RuleError("The video link must start with http:// or https://.");
  return { title, startsAt, location, link, agenda: i.agenda?.trim().slice(0, 2000) || null };
}

// ------------------------------------------------------------------ conflicts
/** People already booked during [start, end). Back-to-back meetings (end == start) are allowed. */
export function findConflicts(userIds: string[], start: Date, end: Date, excludeMeetingId?: string): { userId: string; name: string; title: string; startsAt: Date }[] {
  if (userIds.length === 0) return [];
  const overlapping = db.select().from(meetings)
    .where(and(eq(meetings.status, "SCHEDULED"), lt(meetings.startsAt, end), gt(meetings.startsAt, new Date(start.getTime() - MAX_DURATION * 60_000)), excludeMeetingId ? ne(meetings.id, excludeMeetingId) : undefined))
    .all().filter((m) => endOf(m).getTime() > start.getTime());
  const out: { userId: string; name: string; title: string; startsAt: Date }[] = [];
  const names = new Map(db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)).all().map((u) => [u.id, u.name]));
  for (const m of overlapping) {
    const present = new Set([m.organizerId, ...db.select().from(meetingParticipants).where(eq(meetingParticipants.meetingId, m.id)).all().map((p) => p.userId).filter((x): x is string => !!x)]);
    for (const uid of userIds) if (present.has(uid) && !out.some((o) => o.userId === uid && o.title === m.title)) out.push({ userId: uid, name: names.get(uid) ?? "A participant", title: m.title, startsAt: m.startsAt });
  }
  return out;
}
const conflictMessage = (c: ReturnType<typeof findConflicts>) =>
  `Scheduling conflict: ${c.map((x) => `${x.name} is already in "${x.title}" at ${fmtWhen(x.startsAt)}`).join("; ")}.`;

// ------------------------------------------------------------------ create
export type ExternalGuest = { name: string; email: string };
export async function createMeeting(input: MeetingInput & { organizerId: string; participantUserIds: string[]; externals?: ExternalGuest[]; applicationId?: string | null }) {
  if (!(input.type in MEETING_TYPES)) throw new RuleError("Choose a meeting type.");
  const core = validateCore(input);
  const organizer = db.select().from(users).where(eq(users.id, input.organizerId)).get();
  if (!organizer || !organizer.isActive) throw new RuleError("The organiser account is not active.");

  const app = input.applicationId ? db.select().from(applications).where(eq(applications.id, input.applicationId)).get() : null;
  if (input.applicationId && !app) throw new RuleError("The linked application was not found.");
  if (input.type === "INTERVIEW" && !app) throw new RuleError("Interviews must be scheduled from a candidate's application.");

  const ids = [...new Set(input.participantUserIds.filter((x) => x && x !== organizer.id))];
  const people = ids.length ? db.select().from(users).where(inArray(users.id, ids)).all() : [];
  if (people.length !== ids.length) throw new RuleError("One of the selected participants no longer exists.");
  for (const p of people) {
    if (!p.isActive) throw new RuleError(`${p.name}'s account is deactivated and cannot be invited.`);
    if (p.role === "CANDIDATE" && p.id !== app?.candidateId) throw new RuleError(`${p.name} is a candidate and can only be invited to an interview for their own application.`);
  }
  const externals = (input.externals ?? []).map((g) => ({ name: g.name.trim(), email: g.email.trim().toLowerCase() }));
  for (const g of externals) {
    if (g.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email)) throw new RuleError(`"${g.name || g.email}" is not a valid guest. Use a name and a valid email.`);
  }
  const everyone = new Map<string, { userId: string | null; name: string; email: string }>();
  everyone.set(organizer.email, { userId: organizer.id, name: organizer.name, email: organizer.email });
  for (const p of people) everyone.set(p.email, { userId: p.id, name: p.name, email: p.email });
  for (const g of externals) if (!everyone.has(g.email)) everyone.set(g.email, { userId: null, name: g.name, email: g.email });
  if (everyone.size < 2) throw new RuleError("Add at least one participant besides yourself.");

  const end = new Date(core.startsAt.getTime() + input.durationMin * 60_000);
  const meeting = db.transaction((tx) => {
    // Checked and inserted in ONE transaction so two people cannot book the same slot at the same moment.
    const conflicts = findConflicts([organizer.id, ...ids], core.startsAt, end);
    if (conflicts.length) throw new RuleError(conflictMessage(conflicts));
    const m = tx.insert(meetings).values({
      uid: `${randomUUID()}@isolative-portal`, title: core.title, type: input.type, startsAt: core.startsAt, durationMin: input.durationMin,
      location: core.location, meetingLink: core.link, agenda: core.agenda, organizerId: organizer.id, applicationId: app?.id ?? null,
    }).returning().get();
    for (const p of everyone.values()) tx.insert(meetingParticipants).values({ meetingId: m.id, ...p }).run();
    tx.insert(schema.auditLogs).values({ actorId: organizer.id, action: "meeting.created", entityType: "meeting", entityId: m.id, details: JSON.stringify({ title: m.title, startsAt: m.startsAt.toISOString(), participants: everyone.size }) }).run();
    return m;
  });
  await notify(meeting.id, "invite");
  return meeting;
}

// ------------------------------------------------------------------ reschedule / cancel
export async function rescheduleMeeting(id: string, input: MeetingInput, actorId: string) {
  const m = db.select().from(meetings).where(eq(meetings.id, id)).get();
  if (!m) throw new RuleError("Meeting not found.");
  if (m.status !== "SCHEDULED") throw new RuleError("A cancelled meeting cannot be changed. Create a new one instead.");
  if (endOf(m).getTime() < Date.now()) throw new RuleError("This meeting has already taken place.");
  const core = validateCore({ ...input, type: m.type });
  const end = new Date(core.startsAt.getTime() + input.durationMin * 60_000);
  db.transaction((tx) => {
    const ids = [m.organizerId, ...tx.select().from(meetingParticipants).where(eq(meetingParticipants.meetingId, id)).all().map((p) => p.userId).filter((x): x is string => !!x)];
    const conflicts = findConflicts([...new Set(ids)], core.startsAt, end, id); // the meeting never conflicts with itself
    if (conflicts.length) throw new RuleError(conflictMessage(conflicts));
    tx.update(meetings).set({ title: core.title, startsAt: core.startsAt, durationMin: input.durationMin, location: core.location, meetingLink: core.link, agenda: core.agenda, sequence: m.sequence + 1 }).where(eq(meetings.id, id)).run();
    tx.insert(schema.auditLogs).values({ actorId, action: "meeting.rescheduled", entityType: "meeting", entityId: id, details: JSON.stringify({ from: m.startsAt.toISOString(), to: core.startsAt.toISOString() }) }).run();
  });
  await notify(id, "update");
}

export async function cancelMeeting(id: string, reason: string | undefined, actorId: string) {
  const m = db.select().from(meetings).where(eq(meetings.id, id)).get();
  if (!m) throw new RuleError("Meeting not found.");
  if (m.status !== "SCHEDULED") throw new RuleError("This meeting is already cancelled.");
  db.update(meetings).set({ status: "CANCELLED", cancelReason: reason?.trim().slice(0, 500) || null, sequence: m.sequence + 1 }).where(eq(meetings.id, id)).run();
  audit({ actorId, action: "meeting.cancelled", entityType: "meeting", entityId: id });
  await notify(id, "cancel");
}

// ------------------------------------------------------------------ emails
type Kind = "invite" | "update" | "cancel" | "reminder";

/** Sends one email per participant. Keys include the meeting's sequence number: a retry never duplicates, a genuine reschedule still notifies. */
async function notify(meetingId: string, kind: Kind): Promise<{ sent: number; failed: number }> {
  const m = db.select().from(meetings).where(eq(meetings.id, meetingId)).get();
  if (!m) return { sent: 0, failed: 0 };
  const org = db.select().from(users).where(eq(users.id, m.organizerId)).get()!;
  const parts = db.select().from(meetingParticipants).where(eq(meetingParticipants.meetingId, meetingId)).all();
  const base = (name: string) => ({ title: m.title, when: fmtWhen(m.startsAt), durationMin: m.durationMin, location: m.location, link: m.meetingLink, agenda: m.agenda, organizer: org.name, name });
  let sent = 0, failed = 0;
  for (const p of parts) {
    const b = base(p.name);
    const mail = kind === "invite" ? T.meetingInvitation(b) : kind === "update" ? T.meetingUpdated(b) : kind === "cancel" ? T.meetingCancelled({ ...b, reason: m.cancelReason }) : T.meetingReminder(b);
    const ics = kind === "reminder" ? undefined : buildIcs({
      uid: m.uid, sequence: m.sequence, method: kind === "cancel" ? "CANCEL" : "REQUEST", title: m.title, startsAt: m.startsAt, durationMin: m.durationMin,
      location: [m.location, m.meetingLink].filter(Boolean).join(" | ") || null, description: m.agenda, organizer: { name: org.name, email: org.email }, attendee: { name: p.name, email: p.email },
    });
    const key = kind === "cancel" ? `meeting_cancel:${m.id}:${p.id}` : `meeting_${kind}:${m.id}:${p.id}:${m.sequence}`;
    const res = await sendEmail({ to: p.email, template: `meeting_${kind}`, ...mail, ics, idempotencyKey: key, relatedType: "meeting", relatedId: m.id });
    if (res.status === "FAILED") failed++; // delivery problems are reported, never counted as sent
    else if (!res.skipped) sent++;
  }
  return { sent, failed };
}

/** Reminders for scheduled meetings starting within the window. Safe to run repeatedly: each person is reminded once per schedule. */
export async function sendDueReminders(windowHours = 24, actorId: string | null = null): Promise<{ meetings: number; emails: number; failed: number }> {
  const now = new Date();
  const due = db.select().from(meetings).where(and(eq(meetings.status, "SCHEDULED"), gt(meetings.startsAt, now), lt(meetings.startsAt, new Date(now.getTime() + windowHours * 3600_000)))).all();
  let emails = 0, failed = 0, count = 0;
  for (const m of due) { const r = await notify(m.id, "reminder"); emails += r.sent; failed += r.failed; if (r.sent > 0) count++; }
  audit({ actorId, action: "meeting.reminders_sent", entityType: "meeting", entityId: "batch", details: { meetings: count, emails, failed } });
  return { meetings: count, emails, failed };
}

// ------------------------------------------------------------------ reads
export function getMeeting(id: string) {
  const m = db.select().from(meetings).where(eq(meetings.id, id)).get();
  if (!m) return null;
  const organizer = db.select().from(users).where(eq(users.id, m.organizerId)).get()!;
  const participants = db.select({ p: meetingParticipants, role: users.role }).from(meetingParticipants).leftJoin(users, eq(users.id, meetingParticipants.userId)).where(eq(meetingParticipants.meetingId, id)).all();
  return { m, organizer, participants };
}

export function listBetween(from: Date, to: Date) {
  return db.select({ m: meetings, organizer: users.name }).from(meetings).innerJoin(users, eq(users.id, meetings.organizerId))
    .where(and(gte(meetings.startsAt, from), lt(meetings.startsAt, to))).orderBy(asc(meetings.startsAt)).all();
}

export function listUpcoming(limit = 50) {
  return db.select({ m: meetings, organizer: users.name }).from(meetings).innerJoin(users, eq(users.id, meetings.organizerId))
    .where(and(eq(meetings.status, "SCHEDULED"), gt(meetings.startsAt, new Date(Date.now() - 3600_000)))).orderBy(asc(meetings.startsAt)).limit(limit).all();
}

/** A person's own upcoming meetings (what a candidate or employee may see: no internal fields beyond what the invitation shows). */
export function upcomingForUser(userId: string, limit = 10) {
  return db.select({ m: meetings }).from(meetingParticipants).innerJoin(meetings, eq(meetings.id, meetingParticipants.meetingId))
    .where(and(eq(meetingParticipants.userId, userId), eq(meetings.status, "SCHEDULED"), gt(meetings.startsAt, new Date(Date.now() - 3600_000)))).orderBy(asc(meetings.startsAt)).limit(limit).all().map((r) => r.m);
}

export function meetingsForApplication(applicationId: string) {
  return db.select().from(meetings).where(eq(meetings.applicationId, applicationId)).orderBy(asc(meetings.startsAt)).all();
}

export function countUpcoming(days: number): number {
  return db.select().from(meetings).where(and(eq(meetings.status, "SCHEDULED"), gt(meetings.startsAt, new Date()), lt(meetings.startsAt, new Date(Date.now() + days * 86400_000)))).all().length;
}

/** Active people who can be invited internally (staff and employees). Candidates are only reachable through an application. */
export function invitableUsers() {
  return db.select({ id: users.id, name: users.name, role: users.role, email: users.email }).from(users).where(and(eq(users.isActive, true), inArray(users.role, ["ADMIN", "HR", "EMPLOYEE"]))).orderBy(users.name).all();
}

/** Accepts lines such as "Priya Sharma <priya@client.com>" or just "priya@client.com". */
export function parseGuests(text: string): { name: string; email: string }[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 20).map((line) => {
    const m = line.match(/^(.*?)\s*<([^>]+)>$/);
    if (m) return { name: m[1].trim() || m[2].split("@")[0], email: m[2].trim() };
    return { name: line.split("@")[0], email: line };
  });
}

