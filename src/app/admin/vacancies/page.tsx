import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Empty } from "@/components/admin";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { VACANCY_STATUS_LABEL } from "@/lib/status";

export const metadata: Metadata = { title: "Vacancies" };
export const dynamic = "force-dynamic";

export default async function Vacancies() {
  await requirePermission("vacancy:manage", "/admin/vacancies");
  const rows = db.select({ v: schema.vacancies, apps: sql<number>`(select count(*) from applications a where a.vacancy_id = ${schema.vacancies.id})` }).from(schema.vacancies).orderBy(desc(schema.vacancies.createdAt)).all();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl">Vacancies</h1><Link href="/admin/vacancies/new" className="btn btn-primary no-underline">New vacancy</Link></div>
      <div className="mt-6">
        {rows.length === 0 ? <Empty title="No vacancies yet">Create one and publish it to show it on the Careers page.</Empty> : (
          <div className="overflow-x-auto border border-line bg-white"><table className="tbl">
            <thead><tr><th>Title</th><th>Status</th><th>Applications</th><th>Apply by</th><th>Created</th></tr></thead>
            <tbody>{rows.map(({ v, apps }) => (
              <tr key={v.id}><td><Link href={`/admin/vacancies/${v.id}`} className="font-semibold">{v.title}</Link><span className="block text-xs text-steel">{v.location}</span></td>
                <td><span className={`badge ${v.status === "PUBLISHED" ? "badge-RESPONDED" : v.status === "DRAFT" ? "badge-NEW" : "badge-CLOSED"}`}>{VACANCY_STATUS_LABEL[v.status as keyof typeof VACANCY_STATUS_LABEL]}</span></td>
                <td>{apps > 0 ? <Link href={`/admin/candidates?vacancyId=${v.id}`}>{apps}</Link> : 0}</td><td>{fmtDate(v.closesAt)}</td><td>{fmtDate(v.createdAt)}</td></tr>))}</tbody>
          </table></div>)}
      </div>
    </div>
  );
}
