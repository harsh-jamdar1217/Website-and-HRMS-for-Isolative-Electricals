import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "iep-meet-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.DOCUMENT_DIR = path.join(dir, "docs");
process.env.SMTP_HOST = "";

let M: { mt: typeof import("../src/lib/meetings"); rec: typeof import("../src/lib/recruitment"); tok: typeof import("../src/lib/tokens"); ics: typeof import("../src/lib/ics"); s: typeof import("../src/db/schema"); db: typeof import("../src/db").db };
let hr: string, e1: string, e2: string, cand: { id: string; appId: string }, cand2: { id: string; appId: string };

/** Date/time strings in IST for "now + offset". */
function ist(offsetMin: number) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(Date.now() + offsetMin * 60_000));
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}
const DAY = 1440;
/** Slots on distinct future days so tests never collide with each other. Each test gets its own "day". */
let day = 5;
const slot = (offsetDays: number, hh = "10:00") => ({ date: ist(offsetDays * DAY).date, time: hh });
const base = (over: Record<string, unknown> = {}) => ({ title: "Team sync", type: "INTERNAL", ...slot(day), durationMin: 60, location: "Conference room", ...over });
const mk = (over: Record<string, unknown> = {}, who: string[] = [e1], extra: Record<string, unknown> = {}) =>
  M.mt.createMeeting({ ...(base(over) as any), organizerId: hr, participantUserIds: who, ...extra });
const logs = (id: string) => M.db.select().from(M.s.emailLogs).all().filter((l) => l.relatedId === id);

async function candidate(n: number) {
  const vac = M.db.select().from(M.s.vacancies).all()[0];
  const { user, app } = await M.rec.registerAndApply({ name: `Cand ${n}`, email: `mc${n}@example.com`, phone: "+91 98765 43210", password: "Passw0rd!23", vacancyId: vac.id });
  return { id: user.id, appId: app.id };
}

beforeAll(async () => {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const raw = new Database(process.env.DATABASE_URL!.replace("file:", ""));
  migrate(drizzle(raw), { migrationsFolder: "./drizzle" }); raw.close();
  M = { mt: await import("../src/lib/meetings"), rec: await import("../src/lib/recruitment"), tok: await import("../src/lib/tokens"), ics: await import("../src/lib/ics"), s: await import("../src/db/schema"), db: (await import("../src/db")).db };
  const mkUser = (email: string, name: string, role: string) => M.db.insert(M.s.users).values({ email, name, role, passwordHash: "x" }).returning().get().id;
  hr = mkUser("hr@m.example", "Hema HR", "HR"); e1 = mkUser("e1@m.example", "Ravi", "EMPLOYEE"); e2 = mkUser("e2@m.example", "Sana", "EMPLOYEE");
  const vac = M.rec.createVacancy({ title: "Eng", location: "K", employmentType: "FULL_TIME", description: "d".repeat(40), eligibility: "BE Electrical" }, hr);
  M.rec.setVacancyStatus(vac.id, "PUBLISHED", hr);
  cand = await candidate(1); cand2 = await candidate(2);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("creating meetings", () => {
  it("stores the meeting, adds the organiser, and emails every participant a calendar invitation", async () => {
    day++;
    const m = await mk({}, [e1, e2], { externals: [{ name: "Client Contact", email: "Client@Example.com" }] });
    const parts = M.mt.getMeeting(m.id)!.participants;
    expect(parts.map((p) => p.p.email).sort()).toEqual(["client@example.com", "e1@m.example", "e2@m.example", "hr@m.example"]);
    const mails = logs(m.id);
    expect(mails).toHaveLength(4);
    expect(mails.every((l) => l.template === "meeting_invite" && l.icsContent?.includes("METHOD:REQUEST") && l.icsContent.includes(`UID:${m.uid}`) && l.icsContent.includes("SEQUENCE:0"))).toBe(true);
    expect(M.db.select().from(M.s.auditLogs).all().some((a) => a.action === "meeting.created" && a.entityId === m.id)).toBe(true);
  });

  it("validates time, duration, location, link, participants and guests", async () => {
    day++;
    const past = ist(-120);
    await expect(mk({ ...past })).rejects.toThrow(/future/);
    await expect(mk({ date: "nope" })).rejects.toThrow(/valid date/);
    await expect(mk({ durationMin: 5 })).rejects.toThrow(/Duration/);
    await expect(mk({ durationMin: 600 })).rejects.toThrow(/Duration/);
    await expect(mk({ location: "", meetingLink: "" })).rejects.toThrow(/where/i);
    await expect(mk({ meetingLink: "javascript:alert(1)" })).rejects.toThrow(/http/);
    await expect(mk({ title: "x" })).rejects.toThrow(/title/i);
    await expect(mk({}, [])).rejects.toThrow(/at least one participant/i);
    await expect(mk({}, [e1], { externals: [{ name: "A", email: "bad" }] })).rejects.toThrow(/not a valid guest/);
    await expect(mk({}, ["missing-id"])).rejects.toThrow(/no longer exists/);
  });

  it("interviews need an application; candidates can only join their own interview; deactivated users cannot be invited", async () => {
    day++;
    await expect(mk({ type: "INTERVIEW" }, [cand.id])).rejects.toThrow(/application/);
    await expect(mk({ type: "INTERNAL" }, [cand.id])).rejects.toThrow(/only be invited to an interview/);
    await expect(mk({ type: "INTERVIEW" }, [cand2.id], { applicationId: cand.appId })).rejects.toThrow(/only be invited/); // someone else's application
    const ok = await mk({ type: "INTERVIEW", title: "Interview: Cand 1" }, [cand.id], { applicationId: cand.appId });
    expect(M.mt.meetingsForApplication(cand.appId).map((x) => x.id)).toContain(ok.id);
    M.db.update(M.s.users).set({ isActive: false }).where((await import("drizzle-orm")).eq(M.s.users.id, e2)).run();
    day++;
    await expect(mk({}, [e2])).rejects.toThrow(/deactivated/);
    M.db.update(M.s.users).set({ isActive: true }).where((await import("drizzle-orm")).eq(M.s.users.id, e2)).run();
  });
});

describe("conflict checks", () => {
  it("blocks overlaps (full and partial) for participants and the organiser, names who is busy", async () => {
    day++;
    await mk({ time: "10:00", durationMin: 60 }, [e1]);
    await expect(mk({ time: "10:00" }, [e1])).rejects.toThrow(/Ravi is already in "Team sync"/);
    await expect(mk({ time: "10:30", title: "Other" }, [e1])).rejects.toThrow(/Scheduling conflict/); // partial overlap
    await expect(mk({ time: "09:30", durationMin: 60, title: "Other" }, [e1])).rejects.toThrow(/Scheduling conflict/); // ends inside
    await expect(mk({ time: "10:15", title: "Other" }, [e2])).rejects.toThrow(/Hema HR/); // organiser is busy too
  });
  it("allows back-to-back meetings and different people at the same time", async () => {
    day++;
    await mk({ time: "10:00", durationMin: 60 }, [e1]);
    await expect(mk({ time: "11:00", title: "Back to back" }, [e1])).resolves.toBeTruthy(); // starts exactly when the other ends
    day++;
    const org2 = M.db.insert(M.s.users).values({ email: `o${day}@m.example`, name: "Other Org", role: "ADMIN", passwordHash: "x" }).returning().get().id;
    await mk({ time: "14:00" }, [e1]);
    await expect(M.mt.createMeeting({ ...(base({ time: "14:00", title: "Parallel" }) as any), organizerId: org2, participantUserIds: [e2] })).resolves.toBeTruthy();
  });
  it("cancelled meetings no longer block the slot", async () => {
    day++;
    const m = await mk({ time: "10:00" }, [e1]);
    await expect(mk({ time: "10:00", title: "Blocked" }, [e1])).rejects.toThrow(/conflict/);
    await M.mt.cancelMeeting(m.id, "Not needed", hr);
    await expect(mk({ time: "10:00", title: "Now free" }, [e1])).resolves.toBeTruthy();
  });
});

describe("reschedule and cancel", () => {
  it("reschedules: bumps the sequence, notifies everyone with an updated calendar entry, and never conflicts with itself", async () => {
    day++;
    const m = await mk({ time: "10:00" }, [e1, e2]);
    const d2 = slot(day, "10:30"); // overlaps its own old slot: allowed
    await M.mt.rescheduleMeeting(m.id, { title: "Team sync", type: "INTERNAL", ...d2, durationMin: 60, location: "Room 2" }, hr);
    const got = M.mt.getMeeting(m.id)!.m;
    expect(got.sequence).toBe(1); expect(got.location).toBe("Room 2");
    const upd = logs(m.id).filter((l) => l.template === "meeting_update");
    expect(upd).toHaveLength(3); expect(upd.every((l) => l.icsContent?.includes("SEQUENCE:1") && l.icsContent.includes(`UID:${m.uid}`))).toBe(true);
    expect(M.db.select().from(M.s.auditLogs).all().some((a) => a.action === "meeting.rescheduled" && a.entityId === m.id)).toBe(true);
  });
  it("refuses a reschedule onto someone else's meeting, into the past, or after cancellation", async () => {
    day++;
    await mk({ time: "13:00", title: "Existing" }, [e1]);
    const m = await mk({ time: "10:00" }, [e1]);
    await expect(M.mt.rescheduleMeeting(m.id, { title: "Team sync", type: "INTERNAL", ...slot(day, "13:30"), durationMin: 30, location: "Room" }, hr)).rejects.toThrow(/conflict/i);
    await expect(M.mt.rescheduleMeeting(m.id, { title: "Team sync", type: "INTERNAL", ...ist(-60), durationMin: 30, location: "Room" }, hr)).rejects.toThrow(/future/);
    expect(M.mt.getMeeting(m.id)!.m.sequence).toBe(0); // failed attempts change nothing
    await M.mt.cancelMeeting(m.id, undefined, hr);
    await expect(M.mt.rescheduleMeeting(m.id, { title: "Team sync", type: "INTERNAL", ...slot(day, "16:00"), durationMin: 30, location: "Room" }, hr)).rejects.toThrow(/cancelled/);
  });
  it("cancels: status, reason, CANCEL calendar entry to everyone; cannot cancel twice", async () => {
    day++;
    const m = await mk({}, [e1, e2]);
    await M.mt.cancelMeeting(m.id, "Speaker unavailable", hr);
    const g = M.mt.getMeeting(m.id)!.m; expect(g.status).toBe("CANCELLED"); expect(g.cancelReason).toBe("Speaker unavailable");
    const c = logs(m.id).filter((l) => l.template === "meeting_cancel");
    expect(c).toHaveLength(3); expect(c.every((l) => l.icsContent?.includes("METHOD:CANCEL") && l.icsContent.includes("STATUS:CANCELLED"))).toBe(true);
    expect(c[0].bodyText).toContain("Speaker unavailable");
    await expect(M.mt.cancelMeeting(m.id, "again", hr)).rejects.toThrow(/already cancelled/);
  });
});

describe("reminders", () => {
  it("reminds each person once for meetings in the next 24h, skips far-off and cancelled ones, and again after a reschedule", async () => {
    const soon = ist(180); // 3 hours from now
    const near = await M.mt.createMeeting({ ...(base({ ...soon, title: "Starts soon" }) as any), organizerId: hr, participantUserIds: [e1, e2] });
    const far = await mk({ title: "Far away" }, [e1]);
    day++;
    const cancelled = await M.mt.createMeeting({ ...(base({ ...ist(240), title: "Cancelled soon" }) as any), organizerId: hr, participantUserIds: [e1] }).catch(async () => null); // may conflict: fine
    if (cancelled) await M.mt.cancelMeeting(cancelled.id, undefined, hr);
    const first = await M.mt.sendDueReminders(24, hr);
    expect(first.meetings).toBeGreaterThanOrEqual(1);
    expect(logs(near.id).filter((l) => l.template === "meeting_reminder")).toHaveLength(3);
    expect(logs(far.id).filter((l) => l.template === "meeting_reminder")).toHaveLength(0);
    if (cancelled) expect(logs(cancelled.id).filter((l) => l.template === "meeting_reminder")).toHaveLength(0);
    const second = await M.mt.sendDueReminders(24, hr);
    expect(second.emails).toBe(0); // running it again sends nothing new
    await M.mt.rescheduleMeeting(near.id, { title: "Starts soon", type: "INTERNAL", ...ist(200), durationMin: 60, location: "Conference room" }, hr);
    const third = await M.mt.sendDueReminders(24, hr);
    expect(third.emails).toBe(3); // the new schedule is reminded once more
  });
});

describe("reminder honesty", () => {
  it("reports undeliverable reminders as failed, not as sent, and retries them next time", async () => {
    const near = await M.mt.createMeeting({ ...(base({ ...ist(300), title: "Mail outage meeting" }) as any), organizerId: hr, participantUserIds: [e2] });
    process.env.SMTP_HOST = "127.0.0.1"; process.env.SMTP_PORT = "1"; // nothing listens: every send fails
    const down = await M.mt.sendDueReminders(24, hr);
    process.env.SMTP_HOST = "";
    expect(down.failed).toBeGreaterThanOrEqual(2);
    expect(logs(near.id).filter((l) => l.template === "meeting_reminder").every((l) => l.status === "FAILED")).toBe(true);
    const back = await M.mt.sendDueReminders(24, hr); // mail is back: the failed ones are retried and now succeed
    expect(back.failed).toBe(0); expect(back.emails).toBeGreaterThanOrEqual(2);
    expect(logs(near.id).filter((l) => l.template === "meeting_reminder").every((l) => l.status === "LOGGED")).toBe(true);
  });
});

describe("what participants can see", () => {
  it("a person's upcoming list contains only meetings they are part of", async () => {
    day++;
    const mine = await mk({ title: "Only Ravi and Hema" }, [e1]);
    const sanas = await mk({ time: "15:00", title: "Only Sana and Hema" }, [e2]);
    const forE1 = M.mt.upcomingForUser(e1, 50).map((m) => m.id);
    expect(forE1).toContain(mine.id); expect(forE1).not.toContain(sanas.id);
    expect(M.mt.upcomingForUser(cand2.id)).toHaveLength(0);
  });
});

describe("calendar file", () => {
  it("is valid iCalendar: CRLF lines, escaped text, folded long lines, stable UID", () => {
    const text = M.ics.buildIcs({ uid: "u-1@x", sequence: 2, method: "REQUEST", title: "Review; budget, plan\nsecond line", startsAt: new Date("2026-11-03T05:00:00Z"), durationMin: 45,
      location: "Room 1, Block A", description: "A".repeat(200), organizer: { name: "Hema", email: "hr@x.example" }, attendee: { name: "Ravi", email: "e1@x.example" } });
    expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true); expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(text).toContain("SUMMARY:Review\\; budget\\, plan\\nsecond line");
    expect(text).toContain("DTSTART:20261103T050000Z"); expect(text).toContain("DTEND:20261103T054500Z"); expect(text).toContain("UID:u-1@x"); expect(text).toContain("SEQUENCE:2");
    expect(text.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
});
