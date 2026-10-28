"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth";
import { addNote, assignEnquiry, changeStatus, convertToClient, RuleError, setFollowUp } from "@/lib/enquiries";
import { retryEmail } from "@/lib/email";
import { audit } from "@/lib/audit";

/** Run a mutation, then bounce back to the page with either a success or a readable rule error. */
async function run(id: string, fn: (actorId: string) => void | Promise<void>, ok: string) {
  const user = await assertPermission("enquiry:manage"); // server-side check on EVERY action
  let msg = `ok=${encodeURIComponent(ok)}`;
  try {
    await fn(user.id);
  } catch (e) {
    if (!(e instanceof RuleError)) throw e;
    msg = `err=${encodeURIComponent(e.message)}`;
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/enquiries/${id}?${msg}`);
}

const idOf = (fd: FormData) => String(fd.get("id") ?? "");

export async function statusAction(fd: FormData) {
  const id = idOf(fd), to = String(fd.get("to") ?? "");
  await run(id, (actor) => changeStatus(id, to, actor), "Status updated.");
}
export async function assignAction(fd: FormData) {
  const id = idOf(fd), a = String(fd.get("assigneeId") ?? "");
  await run(id, (actor) => assignEnquiry(id, a || null, actor), "Assignment updated.");
}
export async function noteAction(fd: FormData) {
  const id = idOf(fd), body = String(fd.get("body") ?? "");
  await run(id, (actor) => addNote(id, body, actor), "Note added.");
}
export async function followUpAction(fd: FormData) {
  const id = idOf(fd), v = String(fd.get("date") ?? "");
  const date = v ? new Date(`${v}T09:00:00+05:30`) : null; // stored as 9:00 IST on that day
  await run(id, (actor) => {
    if (date && Number.isNaN(date.getTime())) throw new RuleError("Enter a valid date.");
    setFollowUp(id, date, actor);
  }, date ? "Follow-up date saved." : "Follow-up date cleared.");
}
export async function convertAction(fd: FormData) {
  const id = idOf(fd);
  await run(id, (actor) => void convertToClient(id, actor), "Converted to a client record.");
}

export async function retryEmailAction(fd: FormData) {
  const user = await assertPermission("email:retry");
  const id = String(fd.get("id") ?? "");
  const res = await retryEmail(id);
  audit({ actorId: user.id, action: "email.retry", entityType: "email", entityId: id, details: { ok: res.ok } });
  revalidatePath("/admin/emails");
  redirect(`/admin/emails?${res.ok ? "ok=Retry attempted." : `err=${encodeURIComponent(res.reason ?? "Retry failed.")}`}`);
}
