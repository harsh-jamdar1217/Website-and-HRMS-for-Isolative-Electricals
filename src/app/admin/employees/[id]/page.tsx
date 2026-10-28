import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { completeOnboardingAction, hrTaskAction } from "@/app/actions/employees";
import { reviewDocumentAction } from "@/app/actions/hr";
import { EmployeeStatusBadge, Flash } from "@/components/admin";
import { SubmitButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getEmployeeDetail } from "@/lib/employees";
import { fmtBytes, fmtDate, fmtDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { DOC_REVIEW_LABEL, DOCUMENT_TYPES, EMPLOYMENT_TYPES, ONBOARDING_DOC_TYPES } from "@/lib/status";

export const metadata: Metadata = { title: "Employee record" };
export const dynamic = "force-dynamic";

export default async function EmployeeRecord({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { id } = await params;
  const user = await requirePermission("employee:view", `/admin/employees/${id}`);
  const d = getEmployeeDetail(id);
  if (!d) notFound();
  const { ok, err } = await searchParams;
  const { e, user: person } = d;
  const manage = can(user.role, "employee:manage");
  const download = can(user.role, "candidate:documents");
  const onboarding = e.status === "ONBOARDING";
  const doneCount = d.tasks.filter((t) => t.status === "DONE").length;
  const back = `/admin/employees/${id}`;

  return (
    <div>
      <Link href="/admin/employees" className="text-sm font-semibold">All employees</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl">{person.name}</h1><EmployeeStatusBadge status={e.status} /></div>
      <p className="mt-1 text-sm text-steel"><span className="font-mono">{e.employeeCode}</span>  |  {e.jobTitle}, {e.department}</p>
      <div className="mt-5"><Flash ok={ok} err={err} /></div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <section className="panel p-5"><h2 className="text-lg">Record</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              {[["Email", person.email], ["Employment type", EMPLOYMENT_TYPES[e.employmentType as keyof typeof EMPLOYMENT_TYPES]], ["Joining date", fmtDate(e.joiningDate)], ["Record created", fmtDateTime(e.createdAt)],
                ["Address", e.addressLine], ["Emergency contact", e.emergencyName ? `${e.emergencyName} (${e.emergencyRelation}), ${e.emergencyPhone}` : null]].map(([k, v]) => (
                <div key={String(k)}><dt className="text-xs font-semibold text-steel">{k}</dt><dd>{v || <span className="text-steel">Not provided yet</span>}</dd></div>))}
            </dl>
            <p className="mt-4 text-sm text-steel">Recruitment history: applied for {d.vacancy} (<Link href={`/admin/candidates/${e.applicationId}`} className="font-mono">{d.appRef}</Link>).</p>
          </section>

          <section className="panel p-5" aria-labelledby="docs"><h2 id="docs" className="text-lg">Documents</h2>
            {d.docs.length === 0 ? <p className="mt-3 text-sm text-steel">No documents.</p> : (
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {d.docs.map((doc) => {
                  const onboardingDoc = doc.type in ONBOARDING_DOC_TYPES;
                  return (
                    <li key={doc.id} className={`py-3 text-sm ${doc.supersededAt ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span><strong>{DOCUMENT_TYPES[doc.type as keyof typeof DOCUMENT_TYPES]}</strong>{doc.supersededAt && <span className="ml-2 text-xs text-steel">(replaced)</span>}<span className="block text-steel">{doc.originalName}  |  {fmtBytes(doc.sizeBytes)}  |  {fmtDateTime(doc.uploadedAt)}</span></span>
                        <span className="flex items-center gap-3"><span className={`badge ${doc.reviewStatus === "ACCEPTED" ? "badge-RESPONDED" : doc.reviewStatus === "REJECTED" ? "badge-FAILED" : "badge-PENDING"}`}>{DOC_REVIEW_LABEL[doc.reviewStatus as keyof typeof DOC_REVIEW_LABEL]}</span>{download && <a href={`/api/documents/${doc.id}`} className="font-semibold">Download</a>}</span>
                      </div>
                      {doc.reviewNote && <p className="mt-1 text-danger">Note to employee: {doc.reviewNote}</p>}
                      {manage && onboardingDoc && !doc.supersededAt && doc.reviewStatus === "PENDING" && (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <form action={reviewDocumentAction}><input type="hidden" name="appId" value={e.applicationId} /><input type="hidden" name="docId" value={doc.id} /><input type="hidden" name="decision" value="ACCEPTED" /><input type="hidden" name="returnTo" value={back} /><SubmitButton className="btn btn-ghost btn-sm">Accept</SubmitButton></form>
                          <form action={reviewDocumentAction} className="flex flex-wrap items-end gap-2"><input type="hidden" name="appId" value={e.applicationId} /><input type="hidden" name="docId" value={doc.id} /><input type="hidden" name="decision" value="REJECTED" /><input type="hidden" name="returnTo" value={back} />
                            <input name="note" className="input w-64" placeholder="Why does it need replacing?" aria-label="Reason" /><SubmitButton className="btn btn-ghost btn-sm">Needs replacing</SubmitButton></form>
                        </div>)}
                    </li>);
                })}
              </ul>)}
            {download && <p className="mt-3 text-xs text-steel">Every download is recorded in the audit log.</p>}
          </section>
        </div>

        <section className="panel h-fit p-5" aria-labelledby="ob"><h2 id="ob" className="text-lg">Onboarding checklist</h2>
          <p className="mt-1 text-sm text-steel">{onboarding ? `${doneCount} of ${d.tasks.length} tasks done` : e.onboardingCompletedAt ? `Completed ${fmtDate(e.onboardingCompletedAt)}` : "Closed"}</p>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {d.tasks.map((t) => (
              <li key={t.id} className="py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span><span className={`font-semibold ${t.status === "DONE" ? "text-ok" : "text-navy"}`}>{t.status === "DONE" ? "Done: " : ""}{t.title}</span>
                    <span className="block text-xs text-steel">{t.owner === "HR" ? "HR task" : "Employee task (completes automatically)"}</span></span>
                  {manage && onboarding && t.owner === "HR" && (
                    <form action={hrTaskAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="key" value={t.key} /><input type="hidden" name="done" value={t.status === "DONE" ? "0" : "1"} />
                      <SubmitButton className="btn btn-ghost btn-sm">{t.status === "DONE" ? "Reopen" : "Mark done"}</SubmitButton></form>)}
                </div>
              </li>))}
          </ul>
          {manage && onboarding && (
            <form action={completeOnboardingAction} className="mt-4"><input type="hidden" name="id" value={e.id} />
              <SubmitButton className="btn btn-accent" pending="Completing...">Complete onboarding</SubmitButton>
              <p className="hint">Needs every task done. The employee becomes Active and is emailed.</p></form>)}
        </section>
      </div>
    </div>
  );
}
