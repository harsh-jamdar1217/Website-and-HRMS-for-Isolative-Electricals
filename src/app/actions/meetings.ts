"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth";
import { cancelMeeting, createMeeting, parseGuests, RuleError, rescheduleMeeting, sendDueReminders } from "@/lib/meetings";

export type MeetingFormState = { error?: string; values?: Record<string, string>; participants?: string[] };

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function createMeetingAction(_prev: MeetingFormState, fd: FormData): Promise<MeetingFormState> {
  const user = await assertPermission("meeting:manage");
  const values = Object.fromEntries(["title", "type", "date", "time", "durationMin", "location", "meetingLink", "agenda", "guests", "applicationId"].map((k) => [k, field(fd, k)]));
  const participants = fd.getAll("participants").map(String);
  let id: string;
  try {
    const m = await createMeeting({
      title: values.title, type: values.type, date: values.date, time: values.time, durationMin: Number(values.durationMin),
      location: values.location, meetingLink: values.meetingLink, agenda: values.agenda, organizerId: user.id,
      participantUserIds: participants, externals: parseGuests(values.guests), applicationId: values.applicationId || null,
    });
    id = m.id;
  } catch (e) {
    if (e instanceof RuleError) return { error: e.message, values, participants };
    console.error("[meeting] create failed", e);
    return { error: "The meeting could not be saved. Please try again.", values, participants };
  }
  revalidatePath("/admin/meetings");
  redirect(`/admin/meetings/${id}?ok=${encodeURIComponent("Meeting scheduled. Invitations with a calendar file have been emailed.")}`);
}

function bounce(id: string, ok?: string, err?: string): never {
  revalidatePath("/admin/meetings"); revalidatePath(`/admin/meetings/${id}`);
  redirect(`/admin/meetings/${id}?${err ? `err=${encodeURIComponent(err)}` : `ok=${encodeURIComponent(ok ?? "Saved.")}`}`);
}

export async function rescheduleAction(fd: FormData) {
  const user = await assertPermission("meeting:manage");
  const id = field(fd, "id");
  try {
    await rescheduleMeeting(id, { title: field(fd, "title"), type: "", date: field(fd, "date"), time: field(fd, "time"), durationMin: Number(field(fd, "durationMin")), location: field(fd, "location"), meetingLink: field(fd, "meetingLink"), agenda: field(fd, "agenda") }, user.id);
  } catch (e) { if (e instanceof RuleError) bounce(id, undefined, e.message); throw e; }
  bounce(id, "Meeting updated. Everyone has been emailed the new details.");
}

export async function cancelAction(fd: FormData) {
  const user = await assertPermission("meeting:manage");
  const id = field(fd, "id");
  try { await cancelMeeting(id, field(fd, "reason"), user.id); }
  catch (e) { if (e instanceof RuleError) bounce(id, undefined, e.message); throw e; }
  bounce(id, "Meeting cancelled. Everyone has been notified.");
}

export async function remindersAction() {
  const user = await assertPermission("meeting:manage");
  const r = await sendDueReminders(24, user.id);
  revalidatePath("/admin/meetings");
  if (r.failed > 0) redirect(`/admin/meetings?err=${encodeURIComponent(`${r.failed} reminder email${r.failed === 1 ? "" : "s"} could not be delivered${r.emails ? ` (${r.emails} were sent)` : ""}. Check the Email log and retry once the mail server is reachable.`)}`);
  redirect(`/admin/meetings?ok=${encodeURIComponent(r.emails === 0 ? "No reminders were due. Everyone has already been reminded, or nothing starts in the next 24 hours." : `Sent ${r.emails} reminder${r.emails === 1 ? "" : "s"} for ${r.meetings} meeting${r.meetings === 1 ? "" : "s"}.`)}`);
}
