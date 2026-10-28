import type { Metadata } from "next";
import Link from "next/link";
import { AppStatusBadge, Empty, Pagination } from "@/components/admin";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { listApplications } from "@/lib/recruitment";
import { APPLICATION_STATUS_LABEL } from "@/lib/status";

export const metadata: Metadata = { title: "Candidates" };
export const dynamic = "force-dynamic";

export default async function Candidates({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; vacancyId?: string; page?: string }> }) {
  await requirePermission("candidate:view", "/admin/candidates");
  const { q, status, vacancyId, page } = await searchParams;
  const res = listApplications({ q, status, vacancyId, page: Number(page) || 1 });
  const vacancies = db.select().from(schema.vacancies).all();
  const filtered = !!(q || status || vacancyId);
  return (
    <div>
      <h1 className="text-3xl">Candidates</h1>
      <form className="mt-5 flex flex-wrap items-end gap-3" role="search">
        <div><label htmlFor="q" className="label">Search</label><input id="q" name="q" defaultValue={q} className="input w-60" placeholder="Name, email or reference" /></div>
        <div><label htmlFor="status" className="label">Status</label><select id="status" name="status" defaultValue={status ?? ""} className="input"><option value="">All statuses</option>{Object.entries(APPLICATION_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label htmlFor="vacancyId" className="label">Vacancy</label><select id="vacancyId" name="vacancyId" defaultValue={vacancyId ?? ""} className="input"><option value="">All vacancies</option>{vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}</select></div>
        <button className="btn btn-primary" type="submit">Apply</button>
        {filtered && <Link href="/admin/candidates" className="btn btn-ghost no-underline">Clear</Link>}
      </form>
      <p className="mb-3 mt-5 text-sm text-steel">{res.total} application{res.total === 1 ? "" : "s"}</p>
      {res.rows.length === 0 ? <Empty title={filtered ? "No applications match these filters" : "No applications yet"}>{filtered ? "Try different filters." : "Applications from the Careers page appear here."}</Empty> : (
        <div className="overflow-x-auto border border-line bg-white"><table className="tbl">
          <thead><tr><th>Reference</th><th>Candidate</th><th>Vacancy</th><th>Status</th><th>Applied</th></tr></thead>
          <tbody>{res.rows.map((r) => (
            <tr key={r.app.id}><td className="whitespace-nowrap font-mono"><Link href={`/admin/candidates/${r.app.id}`}>{r.app.reference}</Link></td>
              <td>{r.name}<span className="block text-xs text-steel">{r.email}</span></td><td>{r.vacancy}</td><td><AppStatusBadge status={r.app.status} /></td><td className="whitespace-nowrap">{fmtDateTime(r.app.createdAt)}</td></tr>))}</tbody>
        </table></div>)}
      <Pagination page={res.page} pages={res.pages} params={{ q, status, vacancyId }} basePath="/admin/candidates" />
    </div>
  );
}
