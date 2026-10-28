"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertEmployee, assertPermission } from "@/lib/auth";
import { DocumentError, saveDocument } from "@/lib/documents";
import { completeOnboarding, convertToEmployee, getEmployeeByUser, RuleError, saveEmployeeDetails, setHrTask } from "@/lib/employees";
import { rateLimit } from "@/lib/rate-limit";
import { ONBOARDING_DOC_TYPES } from "@/lib/status";
import { convertSchema, employeeDetailsSchema, firstError } from "@/lib/validation";

function bounce(path: string, ok?: string, err?: string): never {
  revalidatePath("/admin", "layout");
  revalidatePath("/employee");
  redirect(`${path}?${err ? `err=${encodeURIComponent(err)}` : `ok=${encodeURIComponent(ok ?? "Saved.")}`}`);
}

// ---- HR ---------------------------------------------------------------------------
export async function convertCandidateAction(fd: FormData) {
  const user = await assertPermission("employee:manage");
  const applicationId = String(fd.get("applicationId") ?? "");
  const back = `/admin/candidates/${applicationId}`;
  const parsed = convertSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) bounce(back, undefined, firstError(parsed.error));
  let id: string;
  try { id = (await convertToEmployee({ applicationId, ...parsed.data, actorId: user.id })).id; }
  catch (e) { if (e instanceof RuleError) bounce(back, undefined, e.message); throw e; }
  bounce(`/admin/employees/${id}`, "Employee record created. A welcome email has been sent and the onboarding checklist is ready.");
}

export async function hrTaskAction(fd: FormData) {
  const user = await assertPermission("employee:manage");
  const id = String(fd.get("id") ?? "");
  try { setHrTask(id, String(fd.get("key") ?? ""), fd.get("done") === "1", user.id); }
  catch (e) { if (e instanceof RuleError) bounce(`/admin/employees/${id}`, undefined, e.message); throw e; }
  bounce(`/admin/employees/${id}`, "Task updated.");
}

export async function completeOnboardingAction(fd: FormData) {
  const user = await assertPermission("employee:manage");
  const id = String(fd.get("id") ?? "");
  try { await completeOnboarding(id, user.id); }
  catch (e) { if (e instanceof RuleError) bounce(`/admin/employees/${id}`, undefined, e.message); throw e; }
  bounce(`/admin/employees/${id}`, "Onboarding complete. The employee is now active.");
}

// ---- employee (own record only: the id is never taken from the form) ----------------
export async function saveDetailsAction(fd: FormData) {
  const user = await assertEmployee();
  const parsed = employeeDetailsSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) bounce("/employee", undefined, firstError(parsed.error));
  try { saveEmployeeDetails(user.id, parsed.data); }
  catch (e) { if (e instanceof RuleError) bounce("/employee", undefined, e.message); throw e; }
  bounce("/employee", "Your details were saved.");
}

export async function uploadOnboardingDocAction(fd: FormData) {
  const user = await assertEmployee();
  try {
    const emp = getEmployeeByUser(user.id);
    if (!emp || (emp.status !== "ONBOARDING" && emp.status !== "ACTIVE")) throw new RuleError("Document upload is not available for your record.");
    if (!rateLimit(`upload:${user.id}`, 20, 60 * 60_000).ok) throw new RuleError("Too many uploads. Try again later.");
    const file = fd.get("file");
    if (!(file instanceof File)) throw new RuleError("Choose a file to upload.");
    await saveDocument({ applicationId: emp.applicationId, type: String(fd.get("type") ?? ""), file, actorId: user.id, allowedTypes: ONBOARDING_DOC_TYPES });
  } catch (e) {
    if (e instanceof RuleError || e instanceof DocumentError) bounce("/employee", undefined, e.message);
    throw e;
  }
  bounce("/employee", "Document uploaded. HR will review it.");
}
