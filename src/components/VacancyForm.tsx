import { saveVacancyAction } from "@/app/actions/hr";
import { SubmitButton } from "@/components/ui";
import type { Vacancy } from "@/db/schema";
import { toDateInput } from "@/lib/format";
import { EMPLOYMENT_TYPES } from "@/lib/status";

export function VacancyForm({ v }: { v?: Vacancy }) {
  return (
    <form action={saveVacancyAction} className="panel grid max-w-3xl gap-4 p-5 sm:grid-cols-2">
      {v && <input type="hidden" name="id" value={v.id} />}
      <div className="sm:col-span-2"><label htmlFor="title" className="label">Job title</label><input id="title" name="title" className="input" defaultValue={v?.title} required maxLength={120} /></div>
      <div><label htmlFor="department" className="label">Department <span className="font-normal text-steel">(optional)</span></label><input id="department" name="department" className="input" defaultValue={v?.department ?? ""} /></div>
      <div><label htmlFor="location" className="label">Location</label><input id="location" name="location" className="input" defaultValue={v?.location ?? "Khandala, Satara"} required /></div>
      <div><label htmlFor="employmentType" className="label">Employment type</label>
        <select id="employmentType" name="employmentType" className="input" defaultValue={v?.employmentType ?? "FULL_TIME"}>{Object.entries(EMPLOYMENT_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div><label htmlFor="closesAt" className="label">Apply by <span className="font-normal text-steel">(optional)</span></label><input id="closesAt" name="closesAt" type="date" className="input" defaultValue={toDateInput(v?.closesAt)} /></div>
      <div className="sm:col-span-2"><label htmlFor="description" className="label">About the role</label><textarea id="description" name="description" rows={6} className="input" defaultValue={v?.description} required /></div>
      <div className="sm:col-span-2"><label htmlFor="eligibility" className="label">Eligibility</label><textarea id="eligibility" name="eligibility" rows={4} className="input" defaultValue={v?.eligibility} required /></div>
      <div className="sm:col-span-2"><SubmitButton pending="Saving...">{v ? "Save changes" : "Create vacancy"}</SubmitButton></div>
    </form>
  );
}
