"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertCandidate, clientIp, getCurrentUser } from "@/lib/auth";
import { DocumentError, saveDocument } from "@/lib/documents";
import { rateLimit } from "@/lib/rate-limit";
import { applyExisting, getOpenVacancy, moveApplication, registerAndApply, RuleError, saveProfile, sendVerification, verifyEmailToken } from "@/lib/recruitment";
import { CANDIDATE_EDITABLE, type ApplicationStatus } from "@/lib/status";
import { applySchema, fieldErrors, firstError, profileSchema, type FieldErrors } from "@/lib/validation";
import { getOwnApplication } from "@/lib/recruitment";

export type ApplyState = { errors?: FieldErrors; formError?: string; values?: Record<string, string> };

/** New visitor: register + apply in one step. */
export async function applyAction(_prev: ApplyState, fd: FormData): Promise<ApplyState> {
  const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
  const slug = String(raw.slug ?? "");
  const values = { name: raw.name ?? "", email: raw.email ?? "", phone: raw.phone ?? "", coverNote: raw.coverNote ?? "" }; // never echo the password
  if (raw.website) redirect("/careers/applied");
  const vac = getOpenVacancy(slug);
  if (!vac) return { formError: "This vacancy is no longer open.", values };
  const parsed = applySchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const rl = rateLimit(`apply:${await clientIp()}`, 5, 60 * 60_000);
  if (!rl.ok) return { formError: "Too many applications from this connection. Please try again later.", values };
  try {
    const d = parsed.data;
    await registerAndApply({ name: d.name, email: d.email, phone: d.phone, password: d.password, coverNote: d.coverNote || undefined, vacancyId: vac.id });
  } catch (e) {
    if (e instanceof RuleError) return { formError: e.message, values };
    console.error("[apply] failed", e);
    return { formError: "We could not save your application. Please try again.", values };
  }
  redirect("/careers/applied");
}

/** Signed-in candidate applies to another vacancy. */
export async function applyExistingAction(fd: FormData) {
  const user = await assertCandidate();
  const slug = String(fd.get("slug") ?? "");
  const vac = getOpenVacancy(slug);
  if (!vac) redirect(`/careers/${slug}?err=${encodeURIComponent("This vacancy is no longer open.")}`);
  try {
    const app = await applyExisting(user.id, vac.id, String(fd.get("coverNote") ?? "").slice(0, 1500));
    redirect(`/candidate/applications/${app.id}?ok=${encodeURIComponent("Application registered.")}`);
  } catch (e) {
    if (e instanceof RuleError) redirect(`/careers/${slug}/apply?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
}

export async function verifyEmailAction(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const rl = rateLimit(`verify:${await clientIp()}`, 20, 15 * 60_000);
  if (!rl.ok) redirect("/verify-email?status=failed");
  const res = await verifyEmailToken(token);
  redirect(`/verify-email?status=${res.ok ? "done" : "failed"}`);
}

export async function resendVerificationAction() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CANDIDATE") throw new Error("Not authorised");
  const rl = rateLimit(`resend:${user.id}`, 3, 60 * 60_000);
  if (!rl.ok) redirect("/candidate?err=" + encodeURIComponent("Too many requests. Try again in an hour."));
  await sendVerification(user.id);
  redirect("/candidate?ok=" + encodeURIComponent("Verification email sent. It may take a minute to arrive."));
}

/** Run a candidate mutation on one of THEIR applications and bounce back with a flash message. */
async function run(appId: string, fn: (userId: string) => void | Promise<void>, ok: string) {
  const user = await assertCandidate();
  let q = `ok=${encodeURIComponent(ok)}`;
  try {
    await fn(user.id);
  } catch (e) {
    if (!(e instanceof RuleError) && !(e instanceof DocumentError)) throw e;
    q = `err=${encodeURIComponent(e.message)}`;
  }
  revalidatePath(`/candidate/applications/${appId}`);
  redirect(`/candidate/applications/${appId}?${q}`);
}

export async function saveProfileAction(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  await run(id, (uid) => {
    const parsed = profileSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) throw new RuleError(firstError(parsed.error));
    const p = parsed.data;
    saveProfile(id, uid, { phone: p.phone, city: p.city || undefined, qualification: p.qualification || undefined, experienceYears: typeof p.experienceYears === "number" ? p.experienceYears : undefined, summary: p.summary || undefined, coverNote: p.coverNote || undefined });
  }, "Your details were saved.");
}

export async function uploadDocumentAction(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  await run(id, async (uid) => {
    const user = await getCurrentUser();
    if (!user?.emailVerifiedAt) throw new RuleError("Confirm your email address before uploading documents.");
    const row = getOwnApplication(id, uid);
    if (!row) throw new RuleError("Application not found.");
    if (!CANDIDATE_EDITABLE.includes(row.app.status as ApplicationStatus)) throw new RuleError("Documents can only be added while your application is waiting for them.");
    const rl = rateLimit(`upload:${uid}`, 20, 60 * 60_000);
    if (!rl.ok) throw new RuleError("Too many uploads. Try again later.");
    const file = fd.get("file");
    if (!(file instanceof File)) throw new RuleError("Choose a file to upload.");
    await saveDocument({ applicationId: id, type: String(fd.get("type") ?? ""), file, actorId: uid });
  }, "Document uploaded.");
}

export async function submitForReviewAction(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  await run(id, async (uid) => {
    if (!getOwnApplication(id, uid)) throw new RuleError("Application not found.");
    await moveApplication({ applicationId: id, to: "UNDER_REVIEW", by: "candidate", actorId: uid });
  }, "Sent to HR for review. We have emailed you a confirmation.");
}

export async function withdrawAction(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  await run(id, async (uid) => {
    if (!getOwnApplication(id, uid)) throw new RuleError("Application not found.");
    await moveApplication({ applicationId: id, to: "WITHDRAWN", by: "candidate", actorId: uid });
  }, "Application withdrawn.");
}

export async function acceptOfferAction(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  await run(id, async (uid) => {
    if (!getOwnApplication(id, uid)) throw new RuleError("Application not found.");
    await moveApplication({ applicationId: id, to: "OFFER_ACCEPTED", by: "candidate", actorId: uid });
  }, "Thank you. HR will contact you about joining.");
}
