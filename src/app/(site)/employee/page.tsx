import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { saveDetailsAction, uploadOnboardingDocAction } from "@/app/actions/employees";
import { EmployeeStatusBadge, Empty, Flash } from "@/components/admin";
import { SubmitButton } from "@/components/ui";
import { requireEmployee } from "@/lib/auth";
import { documentsFor, getEmployeeByUser, tasksFor } from "@/lib/employees";
import { fmtBytes, fmtDate } from "@/lib/format";
import { fmtWhen, upcomingForUser } from "@/lib/meetings";
import { DOC_REVIEW_LABEL, DOCUMENT_TYPES, EMPLOYMENT_TYPES, ONBOARDING_DOC_TYPES } from "@/lib/status";

export const metadata: Metadata = { title: "Employee portal" };
export const dynamic = "force-dynamic";

export default async function EmployeePortal({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireEmployee("/employee");
  const e = getEmployeeByUser(user.id);
  const { ok, err } = await searchParams;
  if (!e) return (<div className="wrap py-12"><h1 className="text-3xl">Employee portal</h1><div className="mt-6"><Empty title="No employee record found">Please contact HR.</Empty></div></div>);
  const tasks = tasksFor(e.id);
  const docs = documentsFor(e.applicationId);
  const onboarding = e.status === "ONBOARDING";
  const done = tasks.filter((t) => t.status === "DONE").length;
  const meets = upcomingForUser(user.id, 8);
  const canUpload = e.status === "ONBOARDING" || e.status === "ACTIVE";

  return (
    <div className="wrap max-w-5xl py-12">
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-4xl">Welcome, {user.name.split(" ")[0]}</h1><EmployeeStatusBadge status={e.status} /></div>
      <p className="mt-2 text-steel"><span className="font-mono">{e.employeeCode}</span>  |  {e.jobTitle}, {e.department}  |  {EMPLOYMENT_TYPES[e.employmentType as keyof typeof EMPLOYMENT_TYPES]}  |  Joining {fmtDate(e.joiningDate)}</p>
      <div className="mt-5"><Flash ok={ok} err={err} /></div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-8">
          <section aria-labelledby="det" className="panel p-5"><h2 id="det" className="text-xl">Your contact details</h2>
            <p className="mt-1 text-sm text-steel">Used by HR for records and emergencies only.</p>
            <form action={saveDetailsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label htmlFor="addressLine" className="label">Current address</label><textarea id="addressLine" name="addressLine" rows={2} className="input" defaultValue={e.addressLine ?? ""} required minLength={8} maxLength={300} /></div>
              <div><label htmlFor="emergencyName" className="label">Emergency contact name</label><input id="emergencyName" name="emergencyName" className="input" defaultValue={e.emergencyName ?? ""} required /></div>
              <div><label htmlFor="emergencyRelation" className="label">Relationship</label><input id="emergencyRelation" name="emergencyRelation" className="input" defaultValue={e.emergencyRelation ?? ""} required /></div>
              <div><label htmlFor="emergencyPhone" className="label">Emergency contact phone</label><input id="emergencyPhone" name="emergencyPhone" type="tel" className="input" defaultValue={e.emergencyPhone ?? ""} required /></div>
              <div className="sm:col-span-2"><SubmitButton pending="Saving...">Save details</SubmitButton></div>
            </form>
          </section>

          <section aria-labelledby="docs" className="panel p-5"><h2 id="docs" className="text-xl">Your documents</h2>
            <p className="mt-1 text-sm text-steel">Files are stored privately and visible only to you and authorised HR staff. PDF, JPG or PNG, up to 5 MB.</p>
            {docs.length === 0 ? <p className="mt-4 text-sm text-steel">No documents yet.</p> : (
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {docs.map((d) => (
                  <li key={d.id} className="py-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2">
                    <span><strong>{DOCUMENT_TYPES[d.type as keyof typeof DOCUMENT_TYPES]}</strong><span className="block text-steel">{d.originalName} ({fmtBytes(d.sizeBytes)})</span></span>
                    <span className="flex items-center gap-3"><span className={`badge ${d.reviewStatus === "ACCEPTED" ? "badge-RESPONDED" : d.reviewStatus === "REJECTED" ? "badge-FAILED" : "badge-PENDING"}`}>{DOC_REVIEW_LABEL[d.reviewStatus as keyof typeof DOC_REVIEW_LABEL]}</span><a href={`/api/documents/${d.id}`} className="font-semibold">Download</a></span></div>
                    {d.reviewNote && <p className="mt-1 text-danger">HR note: {d.reviewNote}</p>}</li>))}
              </ul>)}
            {canUpload && (
              <form action={uploadOnboardingDocAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
                <div><label htmlFor="type" className="label">Document type</label><select id="type" name="type" className="input">{Object.entries(ONBOARDING_DOC_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                <div><label htmlFor="file" className="label">File</label><input id="file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="input py-2" required /></div>
                <SubmitButton pending="Uploading...">Upload</SubmitButton>
              </form>)}
            <p className="mt-2 text-xs text-steel">Uploading the same type again replaces the earlier file. Files are not virus-scanned in this version.</p>
          </section>
        </div>

        <aside className="h-fit space-y-6">
          <section aria-labelledby="mt" className="panel p-5"><h2 id="mt" className="text-lg">Upcoming meetings</h2>
            {meets.length === 0 ? <p className="mt-2 text-sm text-steel">Nothing scheduled.</p> : (
              <ul className="mt-3 space-y-3 text-sm">{meets.map((m) => (
                <li key={m.id} className="border-l-2 border-amber pl-3"><p className="font-semibold text-navy">{m.title}</p><p>{fmtWhen(m.startsAt)}</p>
                  {(m.location || m.meetingLink) && <p className="text-xs text-steel">{m.location}{m.location && m.meetingLink ? " | " : ""}{m.meetingLink && <a href={m.meetingLink} target="_blank" rel="noopener noreferrer">Join link</a>}</p>}</li>))}</ul>)}
          </section>
          <section aria-labelledby="ob" className="panel p-5"><h2 id="ob" className="text-lg">{onboarding ? "Onboarding checklist" : "Onboarding"}</h2>
            <p className="mt-1 text-sm text-steel">{onboarding ? `${done} of ${tasks.length} tasks done` : `Completed ${fmtDate(e.onboardingCompletedAt)}`}</p>
            <ul className="mt-3 space-y-3 text-sm">
              {tasks.map((t) => (
                <li key={t.id} className="border-l-2 pl-3" style={{ borderColor: t.status === "DONE" ? "#1E7B4F" : "#C9D1D5" }}>
                  <p className={`font-semibold ${t.status === "DONE" ? "text-ok" : "text-navy"}`}>{t.status === "DONE" ? "Done: " : ""}{t.title}</p>
                  <p className="text-xs text-steel">{t.owner === "HR" ? "Handled by HR" : t.description}</p></li>))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
