import type { Metadata } from "next";
import Link from "next/link";
import { Empty, EmployeeStatusBadge, Pagination } from "@/components/admin";
import { requirePermission } from "@/lib/auth";
import { listEmployees } from "@/lib/employees";
import { fmtDate } from "@/lib/format";
import { EMPLOYEE_STATUS_LABEL } from "@/lib/status";

export const metadata: Metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

export default async function Employees({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requirePermission("employee:view", "/admin/employees");
  const { q, status, page } = await searchParams;
  const res = listEmployees({ q, status, page: Number(page) || 1 });
  const filtered = !!(q || status);
  return (
    <div>
      <h1 className="text-3xl">Employees</h1>
      <p className="mt-1 max-w-prose text-steel">Employee records are created from candidates who accepted an offer. Open a candidate with status &quot;Offer accepted&quot; to convert them.</p>
      <form className="mt-5 flex flex-wrap items-end gap-3" role="search">
        <div><label htmlFor="q" className="label">Search</label><input id="q" name="q" defaultValue={q} className="input w-60" placeholder="Name, email, ID or department" /></div>
        <div><label htmlFor="status" className="label">Status</label><select id="status" name="status" defaultValue={status ?? ""} className="input"><option value="">All</option>{Object.entries(EMPLOYEE_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <button className="btn btn-primary" type="submit">Apply</button>
        {filtered && <Link href="/admin/employees" className="btn btn-ghost no-underline">Clear</Link>}
      </form>
      <p className="mb-3 mt-5 text-sm text-steel">{res.total} employee{res.total === 1 ? "" : "s"}</p>
      {res.rows.length === 0 ? <Empty title={filtered ? "No employees match these filters" : "No employees yet"}>{filtered ? "Try different filters." : "Convert a candidate with an accepted offer to create the first record."}</Empty> : (
        <div className="overflow-x-auto border border-line bg-white"><table className="tbl">
          <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Status</th><th>Onboarding</th><th>Joining</th></tr></thead>
          <tbody>{res.rows.map((r) => (
            <tr key={r.e.id}><td className="whitespace-nowrap font-mono"><Link href={`/admin/employees/${r.e.id}`}>{r.e.employeeCode}</Link></td>
              <td>{r.name}<span className="block text-xs text-steel">{r.email}</span></td><td>{r.e.jobTitle}<span className="block text-xs text-steel">{r.e.department}</span></td>
              <td><EmployeeStatusBadge status={r.e.status} /></td><td>{r.e.status === "ONBOARDING" ? `${r.done} of ${r.all} tasks` : "Complete"}</td><td>{fmtDate(r.e.joiningDate)}</td></tr>))}</tbody>
        </table></div>)}
      <Pagination page={res.page} pages={res.pages} params={{ q, status }} basePath="/admin/employees" />
    </div>
  );
}
