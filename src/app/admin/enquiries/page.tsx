import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Pagination, StatusBadge } from "@/components/admin";
import { requirePermission } from "@/lib/auth";
import { listEnquiries } from "@/lib/enquiries";
import { fmtDateTime } from "@/lib/format";
import { ENQUIRY_CATEGORIES, ENQUIRY_STATUS_LABEL } from "@/lib/status";

export const metadata: Metadata = { title: "Enquiries" };
export const dynamic = "force-dynamic";

export default async function Enquiries({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requirePermission("enquiry:view", "/admin/enquiries");
  const { q, status, page } = await searchParams;
  const res = listEnquiries({ q, status, page: Number(page) || 1 });
  const filtered = !!(q || status);

  return (
    <div>
      <h1 className="text-3xl">Enquiries</h1>
      <form className="mt-5 flex flex-wrap items-end gap-3" role="search">
        <div>
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" defaultValue={q} className="input w-64" placeholder="Name, email, reference or text" />
        </div>
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="input">
            <option value="">All statuses</option>
            {Object.entries(ENQUIRY_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" type="submit">Apply</button>
        {filtered && <Link href="/admin/enquiries" className="btn btn-ghost no-underline">Clear</Link>}
      </form>

      <p className="mb-3 mt-5 text-sm text-steel">{res.total} enquir{res.total === 1 ? "y" : "ies"}{filtered ? " match your filters" : ""}</p>
      {res.rows.length === 0 ? (
        <Empty title={filtered ? "No enquiries match these filters" : "No enquiries yet"}>{filtered ? "Try a different search or clear the filters." : "New enquiries from the website will appear here."}</Empty>
      ) : (
        <div className="overflow-x-auto border border-line bg-white">
          <table className="tbl">
            <thead><tr><th>Reference</th><th>From</th><th>Type</th><th>Status</th><th>Assigned to</th><th>Received</th></tr></thead>
            <tbody>
              {res.rows.map(({ e, assigneeName }) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap font-mono"><Link href={`/admin/enquiries/${e.id}`}>{e.reference}</Link></td>
                  <td>{e.name}{e.company && <span className="block text-xs text-steel">{e.company}</span>}</td>
                  <td>{ENQUIRY_CATEGORIES[e.category as keyof typeof ENQUIRY_CATEGORIES] ?? e.category}</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td>{assigneeName ?? <span className="text-steel">Unassigned</span>}</td>
                  <td className="whitespace-nowrap">{fmtDateTime(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={res.page} pages={res.pages} params={{ q, status }} basePath="/admin/enquiries" />
    </div>
  );
}
