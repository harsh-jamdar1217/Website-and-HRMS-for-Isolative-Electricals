import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { decideApplicationAction, reviewDocumentAction } from "@/app/actions/hr";
import { AppStatusBadge, Flash } from "@/components/admin";
import { SubmitButton } from "@/components/ui";
import { convertCandidateAction } from "@/app/actions/employees";
import { requirePermission } from "@/lib/auth";
import { getEmployeeByApplication } from "@/lib/employees";
import { fmtWhen, meetingsForApplication } from "@/lib/meetings";
import { EMPLOYMENT_TYPES } from "@/lib/status";
import { fmtBytes, fmtDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getApplicationDetail } from "@/lib/recruitment";
import { APPLICATION_STATUS_LABEL, DOC_REVIEW_LABEL, DOCUMENT_TYPES, nextStatuses, type ApplicationStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Application review" };
export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { CORRECTION_REQUESTED: "Request a correction", SHORTLISTED: "Shortlist", SELECTED: "Select candidate", REJECTED: "Reject" };

export default async function Review({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { id } = await params;
  const user = await requirePermission("candidate:view", `/admin/candidates/${id}`);
  const d = getApplicationDetail(id);
  if (!d) notFound();
  const { ok, err } = await searchParams;
  const { app, user: cand, vacancy, profile } = d;
  const manage = can(user.role, "candidate:manage");
  const download = can(user.role, "candidate:documents");
  const status = app.status as ApplicationStatus;
  const moves = manage ? nextStatuses(status, "staff") : [];
  const empRecord = status === "HIRED" ? getEmployeeByApplication(id) : null;
  const interviews = meetingsForApplication(id);
  const canSchedule = can(user.role, "meeting:manage") && ["UNDER_REVIEW", "SHORTLISTED"].includes(status);
  const canConvert = can(user.role, "employee:manage") && status === "OFFER_ACCEPTED";
  const reviewable = manage && (status === "UNDER_REVIEW" || status === "SHORTLISTED");

  return (
    <div>
      <Link href="/admin/candidates" className="text-sm font-semibold">All candidates</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl">{cand.name}</h1><AppStatusBadge status={status} /></div>
      <p className="mt-1 text-sm text-steel"><span className="font-mono">{app.reference}</span>  |  {vacancy.title}  |  Applied {fmtDateTime(app.createdAt)}</p>
      <div className="mt-5"><Flash ok={ok} err={err} /></div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <section className="panel p-5"><h2 className="text-lg">Candidate</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              {[["Email", `${cand.email}${cand.emailVerifiedAt ? " (verified)" : " (NOT verified)"}`], ["Mobile", profile?.phone], ["City", profile?.city], ["Qualification", profile?.qualification], ["Experience", profile?.experienceYears != null ? `${profile.experienceYears} years` : null]].map(([k, v]) => (
                <div key={String(k)}><dt className="text-xs font-semibold text-steel">{k}</dt><dd>{v || "-"}</dd></div>))}
            </dl>
            {profile?.summary && <p className="mt-4 whitespace-pre-wrap border-l-4 border-line pl-4 text-sm">{profile.summary}</p>}
            {app.coverNote && <><p className="mt-4 text-xs font-semibold text-steel">Note to HR</p><p className="whitespace-pre-wrap border-l-4 border-amber pl-4 text-sm">{app.coverNote}</p></>}
          </section>

          <section className="panel p-5" aria-labelledby="docs"><h2 id="docs" className="text-lg">Documents</h2>
            {d.docs.length === 0 ? <p className="mt-3 text-sm text-steel">No documents uploaded.</p> : (
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {d.docs.map((doc) => (
                  <li key={doc.id} className={`py-3 text-sm ${doc.supersededAt ? "opacity-60" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span><strong>{DOCUMENT_TYPES[doc.type as keyof typeof DOCUMENT_TYPES]}</strong>{doc.supersededAt && <span className="ml-2 text-xs text-steel">(replaced)</span>}
                        <span className="block text-steel">{doc.originalName}  |  {fmtBytes(doc.sizeBytes)}  |  {fmtDateTime(doc.uploadedAt)}</span>
                        <span className="block font-mono text-xs text-steel">{doc.scanStatus === "NOT_SCANNED" ? "Not virus-scanned" : doc.scanStatus}  |  sha256 {doc.sha256.slice(0, 12)}</span></span>
                      <span className="flex items-center gap-3"><span className={`badge ${doc.reviewStatus === "ACCEPTED" ? "badge-RESPONDED" : doc.reviewStatus === "REJECTED" ? "badge-FAILED" : "badge-PENDING"}`}>{DOC_REVIEW_LABEL[doc.reviewStatus as keyof typeof DOC_REVIEW_LABEL]}</span>
                        {download && <a href={`/api/documents/${doc.id}`} className="font-semibold">Download</a>}</span>
                    </div>
                    {doc.reviewNote && <p className="mt-1 text-danger">Note to candidate: {doc.reviewNote}</p>}
                    {reviewable && !doc.supersededAt && (
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <form action={reviewDocumentAction}><input type="hidden" name="appId" value={id} /><input type="hidden" name="docId" value={doc.id} /><input type="hidden" name="decision" value="ACCEPTED" /><SubmitButton className="btn btn-ghost btn-sm">Accept</SubmitButton></form>
                        <form action={reviewDocumentAction} className="flex flex-wrap items-end gap-2"><input type="hidden" name="appId" value={id} /><input type="hidden" name="docId" value={doc.id} /><input type="hidden" name="decision" value="REJECTED" />
                          <input name="note" className="input w-64" placeholder="Why does it need replacing?" aria-label="Reason the document needs replacing" /><SubmitButton className="btn btn-ghost btn-sm">Needs replacing</SubmitButton></form>
                      </div>)}
                  </li>))}
              </ul>)}
            {download && d.docs.length > 0 && <p className="mt-3 text-xs text-steel">Every download is recorded in the audit log.</p>}
          </section>
        </div>

        <div className="space-y-6">
          {manage && (
            <section className="panel p-5" aria-labelledby="dec"><h2 id="dec" className="text-lg">Decision</h2>
              {moves.length === 0 ? <p className="mt-2 text-sm text-steel">No staff actions are available at this stage ({APPLICATION_STATUS_LABEL[status]}).</p> : (
                <div className="mt-3 space-y-4">
                  {moves.map((to) => (
                    <form key={to} action={decideApplicationAction} className="border-t border-line pt-4 first:border-0 first:pt-0">
                      <input type="hidden" name="id" value={id} /><input type="hidden" name="to" value={to} />
                      {to === "CORRECTION_REQUESTED" && <><label htmlFor={`n-${to}`} className="label">Message to the candidate (emailed)</label><textarea id={`n-${to}`} name="note" rows={3} className="input" required minLength={5} placeholder="What needs to be corrected?" /></>}
                      {to === "SELECTED" && <><label htmlFor={`n-${to}`} className="label">Message to the candidate <span className="font-normal text-steel">(optional, emailed)</span></label><textarea id={`n-${to}`} name="note" rows={2} className="input" /></>}
                      {to === "REJECTED" && <><label htmlFor={`n-${to}`} className="label">Internal reason <span className="font-normal text-steel">(staff only, not shown to the candidate)</span></label><textarea id={`n-${to}`} name="internalNote" rows={2} className="input" /><p className="hint">A polite rejection email is sent automatically.</p></>}
                      <SubmitButton className={`btn btn-sm mt-3 ${to === "REJECTED" ? "btn-danger" : to === "SELECTED" ? "btn-accent" : "btn-primary"}`} pending="Saving...">{LABEL[to] ?? APPLICATION_STATUS_LABEL[to]}</SubmitButton>
                    </form>))}
                </div>)}
            </section>)}

          {(interviews.length > 0 || canSchedule) && (
            <section className="panel p-5" aria-labelledby="iv"><h2 id="iv" className="text-lg">Interviews</h2>
              {interviews.length === 0 ? <p className="mt-2 text-sm text-steel">No interview scheduled yet.</p> : (
                <ul className="mt-3 divide-y divide-line border-y border-line text-sm">{interviews.map((iv) => (
                  <li key={iv.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><Link href={`/admin/meetings/${iv.id}`} className="font-semibold">{iv.title}</Link><span className="block text-xs text-steel">{fmtWhen(iv.startsAt)}</span></span>
                    <span className={`badge ${iv.status === "CANCELLED" ? "badge-FAILED" : "badge-RESPONDED"}`}>{iv.status === "CANCELLED" ? "Cancelled" : "Scheduled"}</span></li>))}</ul>)}
              {canSchedule && <Link href={`/admin/meetings/new?applicationId=${id}`} className="btn btn-primary btn-sm mt-3 no-underline">Schedule an interview</Link>}
            </section>)}
          {canConvert && (
            <section className="panel border-t-2 border-t-amber p-5" aria-labelledby="conv"><h2 id="conv" className="text-lg">Convert to employee</h2>
              <p className="mt-1 text-sm text-steel">{cand.name} accepted the offer. This creates an employee record with an ID and an onboarding checklist, and turns their account into an employee account. Recruitment history is kept.</p>
              <form action={convertCandidateAction} className="mt-4 grid gap-3">
                <input type="hidden" name="applicationId" value={id} />
                <div><label htmlFor="jobTitle" className="label">Job title</label><input id="jobTitle" name="jobTitle" className="input" defaultValue={vacancy.title.replace(/\s*\(Demo\)/, "")} required /></div>
                <div><label htmlFor="department" className="label">Department</label><input id="department" name="department" className="input" defaultValue={vacancy.department ?? ""} required /></div>
                <div><label htmlFor="employmentType" className="label">Employment type</label><select id="employmentType" name="employmentType" className="input" defaultValue={vacancy.employmentType}>{Object.entries(EMPLOYMENT_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                <div><label htmlFor="joiningDate" className="label">Joining date</label><input id="joiningDate" name="joiningDate" type="date" className="input" required /></div>
                <SubmitButton className="btn btn-accent" pending="Converting...">Convert to employee</SubmitButton>
              </form></section>)}
          {empRecord && (<section className="panel border-t-2 border-t-ok p-5"><h2 className="text-lg">Employee record</h2><p className="mt-1 text-sm">Converted to employee <span className="font-mono">{empRecord.employeeCode}</span>.</p><Link href={`/admin/employees/${empRecord.id}`} className="btn btn-primary btn-sm mt-3 no-underline">Open employee record</Link></section>)}

          <section className="panel p-5" aria-labelledby="hist"><h2 id="hist" className="text-lg">History</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {d.events.map(({ e, actor }) => (
                <li key={e.id} className="border-l-2 border-navy/30 pl-3"><p className="font-semibold text-navy">{e.fromStatus ? `${APPLICATION_STATUS_LABEL[e.fromStatus as ApplicationStatus]} to ` : ""}{APPLICATION_STATUS_LABEL[e.toStatus as ApplicationStatus]}</p>
                  {e.note && <p className="whitespace-pre-wrap">{e.note}</p>}<p className="text-xs text-steel">{actor ?? "System"}  |  {fmtDateTime(e.createdAt)}</p></li>))}
            </ol></section>
        </div>
      </div>
    </div>
  );
}
