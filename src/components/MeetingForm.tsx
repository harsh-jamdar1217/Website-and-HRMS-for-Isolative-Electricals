"use client";
import { useActionState } from "react";
import { createMeetingAction, type MeetingFormState } from "@/app/actions/meetings";
import { SubmitButton } from "@/components/ui";
import { MEETING_TYPES } from "@/lib/status";

type Person = { id: string; name: string; role: string };
const ROLE = { ADMIN: "Admin", HR: "HR", EMPLOYEE: "Employee" } as Record<string, string>;

export function MeetingForm({ people, today, interview }: { people: Person[]; today: string; interview?: { applicationId: string; candidateId: string; candidateName: string; vacancy: string } }) {
  const [state, action] = useActionState(createMeetingAction, {} as MeetingFormState);
  const v = state.values ?? {};
  const picked = new Set(state.participants ?? []);
  const types = interview ? ({ INTERVIEW: MEETING_TYPES.INTERVIEW } as Record<string, string>) : Object.fromEntries(Object.entries(MEETING_TYPES).filter(([k]) => k !== "INTERVIEW"));
  return (
    <form action={action} className="panel grid max-w-3xl gap-4 p-5 sm:grid-cols-2">
      {state.error && <div role="alert" className="border border-danger bg-danger/10 p-3 text-sm font-medium text-danger sm:col-span-2">{state.error}</div>}
      {interview && (<>
        <input type="hidden" name="applicationId" value={interview.applicationId} />
        <input type="hidden" name="participants" value={interview.candidateId} />
        <p className="border-l-4 border-amber bg-sheet p-3 text-sm sm:col-span-2">Interview with <strong>{interview.candidateName}</strong> for {interview.vacancy}. They will be invited by email.</p>
      </>)}
      <div className="sm:col-span-2"><label htmlFor="title" className="label">Title</label><input id="title" name="title" className="input" defaultValue={v.title ?? (interview ? `Interview: ${interview.candidateName}` : "")} required maxLength={120} /></div>
      <div><label htmlFor="type" className="label">Type</label><select id="type" name="type" className="input" defaultValue={v.type ?? (interview ? "INTERVIEW" : "INTERNAL")}>{Object.entries(types).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div><label htmlFor="durationMin" className="label">Duration</label>
        <select id="durationMin" name="durationMin" className="input" defaultValue={v.durationMin ?? "60"}>{[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60} hour${m > 60 ? "s" : ""}`.replace("1.5 hours", "1.5 hours") : `${m} minutes`}</option>)}</select></div>
      <div><label htmlFor="date" className="label">Date</label><input id="date" name="date" type="date" min={today} className="input" defaultValue={v.date} required /></div>
      <div><label htmlFor="time" className="label">Start time (India time)</label><input id="time" name="time" type="time" className="input" defaultValue={v.time ?? "10:00"} required /></div>
      <div><label htmlFor="location" className="label">Location <span className="font-normal text-steel">(room or address)</span></label><input id="location" name="location" className="input" defaultValue={v.location} /></div>
      <div><label htmlFor="meetingLink" className="label">Video link <span className="font-normal text-steel">(optional)</span></label><input id="meetingLink" name="meetingLink" type="url" className="input" placeholder="https://" defaultValue={v.meetingLink} /></div>
      <div className="sm:col-span-2"><label htmlFor="agenda" className="label">Agenda <span className="font-normal text-steel">(optional, included in the invitation)</span></label><textarea id="agenda" name="agenda" rows={3} className="input" defaultValue={v.agenda} maxLength={2000} /></div>
      <fieldset className="sm:col-span-2"><legend className="label">Invite people from the company</legend>
        <div className="grid max-h-56 gap-1 overflow-y-auto border border-line bg-white p-3 sm:grid-cols-2">
          {people.map((p) => (<label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="participants" value={p.id} defaultChecked={picked.has(p.id)} className="h-4 w-4 accent-navy" />{p.name}<span className="text-xs text-steel">({ROLE[p.role] ?? p.role})</span></label>))}
          {people.length === 0 && <p className="text-sm text-steel">No other staff or employees yet.</p>}
        </div>
        <p className="hint">You are added automatically. People already in another meeting at that time are flagged when you save.</p>
      </fieldset>
      <div className="sm:col-span-2"><label htmlFor="guests" className="label">External guests <span className="font-normal text-steel">(optional, one per line)</span></label>
        <textarea id="guests" name="guests" rows={3} className="input font-mono text-sm" placeholder={"Priya Sharma <priya@client.com>\nanother@client.com"} defaultValue={v.guests} />
        <p className="hint">Guests receive the invitation by email. Their own calendars cannot be checked for conflicts.</p></div>
      <div className="sm:col-span-2"><SubmitButton pending="Scheduling...">Schedule and send invitations</SubmitButton></div>
    </form>
  );
}
