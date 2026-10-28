import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelAction, rescheduleAction } from "@/app/actions/meetings";
import { Flash } from "@/components/admin";
import { SubmitButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { endOf, fmtWhen, getMeeting } from "@/lib/meetings";
import { can } from "@/lib/permissions";
import { MEETING_TYPES } from "@/lib/status";

export const metadata: Metadata = { title: "Meeting" };
export const dynamic = "force-dynamic";

const ymdIst = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const hmIst = (d: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(d);

export default async function MeetingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { id } = await params;
  const user = await requirePermission("meeting:view", `/admin/meetings/${id}`);
  const d = getMeeting(id);
  if (!d) notFound();
  const { ok, err } = await searchParams;
  const { m, organizer, participants } = d;
  const manage = can(user.role, "meeting:manage");
  const live = m.status === "SCHEDULED" && endOf(m).getTime() > Date.now();
  const past = m.status === "SCHEDULED" && !live;

  return (
    <div>
      <Link href="/admin/meetings" className="text-sm font-semibold">All meetings</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl">{m.title}</h1>
        <span className={`badge ${m.status === "CANCELLED" ? "badge-FAILED" : past ? "badge-CLOSED" : "badge-RESPONDED"}`}>{m.status === "CANCELLED" ? "Cancelled" : past ? "Completed" : "Scheduled"}</span></div>
      <p className="mt-1 text-steel">{MEETING_TYPES[m.type as keyof typeof MEETING_TYPES]}  |  {fmtWhen(m.startsAt)}  |  {m.durationMin} minutes (India time)</p>
      <div className="mt-5"><Flash ok={ok} err={err} /></div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <section className="panel p-5"><h2 className="text-lg">Details</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-semibold text-steel">Location</dt><dd>{m.location ?? "-"}</dd></div>
              <div><dt className="text-xs font-semibold text-steel">Video link</dt><dd>{m.meetingLink ? <a href={m.meetingLink} target="_blank" rel="noopener noreferrer">{m.meetingLink}</a> : "-"}</dd></div>
              <div><dt className="text-xs font-semibold text-steel">Organiser</dt><dd>{organizer.name}</dd></div>
              <div><dt className="text-xs font-semibold text-steel">Version</dt><dd>{m.sequence === 0 ? "Original" : `Rescheduled ${m.sequence} time${m.sequence === 1 ? "" : "s"}`}</dd></div>
            </dl>
            {m.agenda && <p className="mt-4 whitespace-pre-wrap border-l-4 border-amber pl-4 text-sm">{m.agenda}</p>}
            {m.cancelReason && <p className="mt-4 text-sm text-danger">Cancelled: {m.cancelReason}</p>}
            {m.applicationId && <p className="mt-4 text-sm"><Link href={`/admin/candidates/${m.applicationId}`}>Open the candidate&apos;s application</Link></p>}
          </section>
          <section className="panel p-5" aria-labelledby="who"><h2 id="who" className="text-lg">Participants ({participants.length})</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
              {participants.map(({ p, role }) => (<li key={p.id} className="flex justify-between gap-3 py-2"><span>{p.name}<span className="block text-xs text-steel">{p.email}</span></span><span className="text-xs text-steel">{p.userId === m.organizerId ? "Organiser" : role === "CANDIDATE" ? "Candidate" : role ? "Company" : "External guest"}</span></li>))}
            </ul></section>
        </div>

        {manage && live && (
          <div className="space-y-6">
            <section className="panel p-5" aria-labelledby="re"><h2 id="re" className="text-lg">Reschedule or edit</h2>
              <form action={rescheduleAction} className="mt-3 grid gap-3">
                <input type="hidden" name="id" value={m.id} />
                <div><label htmlFor="title" className="label">Title</label><input id="title" name="title" className="input" defaultValue={m.title} required /></div>
                <div className="grid grid-cols-2 gap-3"><div><label htmlFor="date" className="label">Date</label><input id="date" name="date" type="date" className="input" defaultValue={ymdIst(m.startsAt)} min={ymdIst(new Date())} required /></div>
                  <div><label htmlFor="time" className="label">Start time</label><input id="time" name="time" type="time" className="input" defaultValue={hmIst(m.startsAt)} required /></div></div>
                <div><label htmlFor="durationMin" className="label">Duration (minutes)</label><input id="durationMin" name="durationMin" type="number" min={15} max={480} step={15} className="input" defaultValue={m.durationMin} required /></div>
                <div><label htmlFor="location" className="label">Location</label><input id="location" name="location" className="input" defaultValue={m.location ?? ""} /></div>
                <div><label htmlFor="meetingLink" className="label">Video link</label><input id="meetingLink" name="meetingLink" type="url" className="input" defaultValue={m.meetingLink ?? ""} /></div>
                <div><label htmlFor="agenda" className="label">Agenda</label><textarea id="agenda" name="agenda" rows={3} className="input" defaultValue={m.agenda ?? ""} /></div>
                <SubmitButton pending="Saving...">Save and notify everyone</SubmitButton>
              </form></section>
            <details className="text-sm"><summary className="cursor-pointer font-semibold text-danger">Cancel this meeting</summary>
              <form action={cancelAction} className="mt-3 grid gap-3 border border-line bg-white p-4"><input type="hidden" name="id" value={m.id} />
                <div><label htmlFor="reason" className="label">Reason <span className="font-normal text-steel">(shared with participants, optional)</span></label><textarea id="reason" name="reason" rows={2} className="input" maxLength={500} /></div>
                <SubmitButton className="btn btn-danger btn-sm" pending="Cancelling...">Cancel meeting and notify everyone</SubmitButton></form></details>
          </div>)}
        {manage && !live && <p className="h-fit border border-line bg-white p-4 text-sm text-steel">{m.status === "CANCELLED" ? "This meeting was cancelled and can no longer be changed." : "This meeting has already taken place."}</p>}
      </div>
    </div>
  );
}
