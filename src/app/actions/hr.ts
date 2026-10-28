"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth";
import { createVacancy, moveApplication, reviewDocument, RuleError, setVacancyStatus, updateVacancy } from "@/lib/recruitment";
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/lib/status";
import { firstError, vacancySchema } from "@/lib/validation";

function bounce(path: string, ok?: string, err?: string): never {
  revalidatePath("/admin", "layout");
  redirect(`${path}?${err ? `err=${encodeURIComponent(err)}` : `ok=${encodeURIComponent(ok ?? "Saved.")}`}`);
}

// ---- vacancies -------------------------------------------------------------------
export async function saveVacancyAction(fd: FormData) {
  const user = await assertPermission("vacancy:manage");
  const id = String(fd.get("id") ?? "");
  const parsed = vacancySchema.safeParse(Object.fromEntries(fd.entries()));
  const back = id ? `/admin/vacancies/${id}` : "/admin/vacancies/new";
  if (!parsed.success) bounce(back, undefined, firstError(parsed.error));
  try {
    if (id) { updateVacancy(id, parsed.data, user.id); bounce(back, "Vacancy saved."); }
    const v = createVacancy(parsed.data, user.id);
    bounce(`/admin/vacancies/${v.id}`, "Vacancy created as a draft. Publish it when ready.");
  } catch (e) {
    if (e instanceof RuleError) bounce(back, undefined, e.message);
    throw e;
  }
}

export async function vacancyStatusAction(fd: FormData) {
  const user = await assertPermission("vacancy:manage");
  const id = String(fd.get("id") ?? "");
  try { setVacancyStatus(id, String(fd.get("to") ?? ""), user.id); }
  catch (e) { if (e instanceof RuleError) bounce(`/admin/vacancies/${id}`, undefined, e.message); throw e; }
  bounce(`/admin/vacancies/${id}`, "Vacancy status updated.");
}

// ---- candidate review -------------------------------------------------------------
export async function decideApplicationAction(fd: FormData) {
  const user = await assertPermission("candidate:manage");
  const id = String(fd.get("id") ?? ""), to = String(fd.get("to") ?? "");
  const path = `/admin/candidates/${id}`;
  if (!(to in APPLICATION_STATUS_LABEL)) bounce(path, undefined, "Unknown status.");
  try {
    await moveApplication({
      applicationId: id, to: to as ApplicationStatus, by: "staff", actorId: user.id,
      note: String(fd.get("note") ?? "").slice(0, 1000), // shown to the candidate (correction / selection)
      internalNote: String(fd.get("internalNote") ?? "").slice(0, 1000), // staff only (kept in the audit log)
    });
  } catch (e) { if (e instanceof RuleError) bounce(path, undefined, e.message); throw e; }
  bounce(path, `Application moved to "${APPLICATION_STATUS_LABEL[to as ApplicationStatus]}".`);
}

export async function reviewDocumentAction(fd: FormData) {
  const user = await assertPermission("candidate:manage");
  const appId = String(fd.get("appId") ?? ""), docId = String(fd.get("docId") ?? "");
  const decision = fd.get("decision") === "ACCEPTED" ? "ACCEPTED" : "REJECTED";
  const ret = String(fd.get("returnTo") ?? "");
  const back = /^\/admin\/[a-z0-9/_-]+$/i.test(ret) ? ret : `/admin/candidates/${appId}`; // same-site admin paths only
  try { reviewDocument(docId, decision, String(fd.get("note") ?? ""), user.id); }
  catch (e) { if (e instanceof RuleError) bounce(back, undefined, e.message); throw e; }
  bounce(back, decision === "ACCEPTED" ? "Document accepted." : "Document marked as needing replacement.");
}
