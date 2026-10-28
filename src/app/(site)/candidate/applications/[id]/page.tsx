import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { acceptOfferAction, saveProfileAction, submitForReviewAction, uploadDocumentAction, withdrawAction } from "@/app/actions/recruitment";
import { AppStatusBadge, Flash } from "@/components/admin";
import { SubmitButton } from "@/components/ui";
import { requireCandidate } from "@/lib/auth";
import { fmtBytes, fmtDateTime } from "@/lib/format";
import { fmtWhen, meetingsForApplication } from "@/lib/meetings";
import { activeDocuments, getOwnApplication, getProfile, timeline } from "@/lib/recruitment";
import { CANDIDATE_DOC_TYPES, CANDIDATE_EDITABLE, DOC_REVIEW_LABEL, DOCUMENT_TYPES, nextStatuses, type ApplicationStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Application" };
export const dynamic = "force-dynamic";

const WHAT_NEXT: Record<string, string> = {
  PENDING_VERIFICATION: "Confirm your email address using the link we sent you.",
  DOCS_PENDING: "Complete your details, upload your documents (a resume is required), then send your application to HR.",
  UNDER_REVIEW: "HR is reviewing your application. We will email you when there is an update.",
  CORRECTION_REQUESTED: "HR needs a correction. Read the note below, update your details or documents, then send it back for review.",
  SHORTLISTED: "You have been shortlisted. HR will be in touch about the next steps.",
  SELECTED: "Congratulations, you have been selected. Please confirm that you accept.",
  OFFER_ACCEPTED: "Thank you for accepting. HR will contact you about joining formalities.",
  HIRED: "Welcome aboard. Your employee portal is now available.",
  REJECTED: "This application is closed. Thank you for your interest.",
  WITHDRAWN: "You withdrew this application.",
};

export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { id } = await params;
  const user = await requireCandidate(`/candidate/applications/${id}`);
  const row = getOwnApplication(id, user.id);
  if (!row) notFound(); // someone else's application looks exactly like a missing one
  const { app, vacancy } = row;
  const { ok, err } = await searchParams;
  const profile = getProfile(user.id);
  const docs = activeDocuments(id);
  const events = timeline(id);
  const status = app.status as ApplicationStatus;
  const editable = CANDIDATE_EDITABLE.includes(status);
  const canEditDetails = editable || status === "PENDING_VERIFICATION";
  const can = nextStatuses(status, "candidate");
  const verified = !!user.emailVerifiedAt;
  const interviews = meetingsForApplication(id).filter((x) => x.status === "SCHEDULED" && x.startsAt.getTime() > Date.now() - 3600_000);

  return (
    <div className="wrap max-w-5xl py-12">
      <Link href="/candidate" className="text-sm font-semibold">All applications</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl">{vacancy.title}</h1><AppStatusBadge status={status} /></div>
      <p className="mt-1 font-mono text-sm text-steel">{app.reference}</p>
      <div className="mt-5"><Flash ok={ok} err={err} /></div>
      <p className="border-l-4 border-amber bg-white p-4"><span className="font-semibold text-navy">What happens next: </span>{WHAT_NEXT[status]}</p>

      {interviews.length > 0 && (
        <section aria-labelledby="iv" className="mt-6 border border-line border-t-2 border-t-amber bg-white p-5"><h2 id="iv" className="text-xl">Your interview</h2>
          <ul className="mt-3 space-y-3">{interviews.map((iv) => (
            <li key={iv.id} className="text-sm"><p className="font-semibold text-navy">{iv.title}</p><p>{fmtWhen(iv.startsAt)} (India time), {iv.durationMin} minutes</p>
              {iv.location && <p>Where: {iv.location}</p>}{iv.meetingLink && <p>Link: <a href={iv.meetingLink} target="_blank" rel="noopener noreferrer">{iv.meetingLink}</a></p>}
              {iv.agenda && <p className="mt-1 whitespace-pre-wrap text-steel">{iv.agenda}</p>}<p className="mt-1 text-xs text-steel">A calendar invitation was emailed to you. If the time changes, we will email you again.</p></li>))}</ul></section>)}

      <div className="mt-8 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-8">
          <section aria-labelledby="details" className="panel p-5">
            <h2 id="details" className="text-xl">Your details</h2>
            {canEditDetails ? (
              <form action={saveProfileAction} className="mt-4 grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={id} />
                <div><label htmlFor="phone" className="label">Mobile number</label><input id="phone" name="phone" className="input" defaultValue={profile?.phone ?? ""} required /></div>
                <div><label htmlFor="city" className="label">City</label><input id="city" name="city" className="input" defaultValue={profile?.city ?? ""} /></div>
                <div><label htmlFor="qualification" className="label">Highest qualification</label><input id="qualification" name="qualification" className="input" defaultValue={profile?.qualification ?? ""} placeholder="e.g. BE Electrical" /></div>
                <div><label htmlFor="experienceYears" className="label">Years of experience</label><input id="experienceYears" name="experienceYears" type="number" min={0} max={60} className="input" defaultValue={profile?.experienceYears ?? ""} /></div>
                <div className="sm:col-span-2"><label htmlFor="summary" className="label">Professional summary</label><textarea id="summary" name="summary" rows={3} maxLength={1500} className="input" defaultValue={profile?.summary ?? ""} /></div>
                <div className="sm:col-span-2"><label htmlFor="coverNote" className="label">Note to HR</label><textarea id="coverNote" name="coverNote" rows={3} maxLength={1500} className="input" defaultValue={app.coverNote ?? ""} /></div>
                <div className="sm:col-span-2"><SubmitButton pending="Saving...">Save details</SubmitButton></div>
              </form>
            ) : (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {[["Mobile", profile?.phone], ["City", profile?.city], ["Qualification", profile?.qualification], ["Experience", profile?.experienceYears != null ? `${profile.experienceYears} years` : null]].map(([k, v]) => (
                  <div key={String(k)}><dt className="text-xs font-semibold text-steel">{k}</dt><dd>{v || "-"}</dd></div>
                ))}
              </dl>
            )}
          </section>

          <section aria-labelledby="docs" className="panel p-5">
            <h2 id="docs" className="text-xl">Documents</h2>
            <p className="mt-1 text-sm text-steel">PDF, JPG or PNG, up to 5 MB each. Files are stored privately and are visible only to you and authorised HR staff.</p>
            {docs.length === 0 ? <p className="mt-4 text-sm text-steel">No documents uploaded yet.</p> : (
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {docs.map((d) => (
                  <li key={d.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span><strong>{DOCUMENT_TYPES[d.type as keyof typeof DOCUMENT_TYPES]}</strong><span className="block text-steel">{d.originalName} ({fmtBytes(d.sizeBytes)})</span></span>
                      <span className="flex items-center gap-3">
                        <span className={`badge ${d.reviewStatus === "ACCEPTED" ? "badge-RESPONDED" : d.reviewStatus === "REJECTED" ? "badge-FAILED" : "badge-PENDING"}`}>{DOC_REVIEW_LABEL[d.reviewStatus as keyof typeof DOC_REVIEW_LABEL]}</span>
                        <a href={`/api/documents/${d.id}`} className="font-semibold">Download</a>
                      </span>
                    </div>
                    {d.reviewNote && <p className="mt-1 text-danger">HR note: {d.reviewNote}</p>}
                  </li>
                ))}
              </ul>
            )}
            {editable && verified && (
              <form action={uploadDocumentAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
                <input type="hidden" name="id" value={id} />
                <div><label htmlFor="type" className="label">Document type</label>
                  <select id="type" name="type" className="input" defaultValue="RESUME">{Object.entries(CANDIDATE_DOC_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                <div><label htmlFor="file" className="label">File</label><input id="file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="input py-2" required /></div>
                <SubmitButton pending="Uploading...">Upload</SubmitButton>
              </form>
            )}
            {(editable || status === "PENDING_VERIFICATION") && !verified && <p className="mt-4 border border-amber-700 bg-amber/15 p-3 text-sm">Confirm your email address before uploading documents. Use the link we emailed you, or request a new one from <Link href="/candidate">your applications page</Link>.</p>}
            {editable && <p className="mt-2 text-xs text-steel">Uploading a document of the same type replaces the previous one. Files are not virus-scanned in this version.</p>}
          </section>

          {(can.includes("UNDER_REVIEW") || can.includes("OFFER_ACCEPTED")) && (
            <section className="panel border-t-2 border-t-amber p-5" aria-labelledby="act">
              <h2 id="act" className="text-xl">{can.includes("OFFER_ACCEPTED") ? "Your offer" : "Ready to submit?"}</h2>
              {can.includes("UNDER_REVIEW") && (<>
                <p className="mt-1 text-sm text-steel">Once sent, you cannot edit until HR responds. A resume is required.</p>
                <form action={submitForReviewAction} className="mt-4"><input type="hidden" name="id" value={id} /><SubmitButton className="btn btn-accent" pending="Sending...">Send application for review</SubmitButton></form></>)}
              {can.includes("OFFER_ACCEPTED") && (
                <form action={acceptOfferAction} className="mt-4"><input type="hidden" name="id" value={id} /><SubmitButton className="btn btn-accent" pending="Confirming...">Accept the offer</SubmitButton></form>)}
            </section>
          )}
          {can.includes("WITHDRAWN") && (
            <details className="text-sm"><summary className="cursor-pointer font-semibold text-danger">Withdraw this application</summary>
              <form action={withdrawAction} className="mt-3 border border-line bg-white p-4"><input type="hidden" name="id" value={id} />
                <p>This ends your application for {vacancy.title}. It cannot be undone.</p>
                <SubmitButton className="btn btn-danger btn-sm mt-3" pending="Withdrawing...">Yes, withdraw</SubmitButton></form></details>
          )}
        </div>

        <aside><section aria-labelledby="tl" className="panel p-5"><h2 id="tl" className="text-lg">Progress</h2>
          <ol className="mt-3 space-y-3 text-sm">
            {events.map((e) => (
              <li key={e.id} className="border-l-2 border-navy/30 pl-3">
                <p className="font-semibold text-navy">{e.toStatus === "PENDING_VERIFICATION" && !e.fromStatus ? "Application created" : (({ DOCS_PENDING: "Email confirmed", UNDER_REVIEW: "Sent for review", CORRECTION_REQUESTED: "Correction requested", SHORTLISTED: "Shortlisted", SELECTED: "Selected", OFFER_ACCEPTED: "Offer accepted", HIRED: "Hired", REJECTED: "Not selected", WITHDRAWN: "Withdrawn" } as Record<string, string>)[e.toStatus] ?? e.toStatus)}</p>
                {e.note && <p className="mt-0.5 whitespace-pre-wrap">{e.note}</p>}
                <p className="text-xs text-steel">{fmtDateTime(e.createdAt)}</p>
              </li>
            ))}
          </ol></section></aside>
      </div>
    </div>
  );
}
