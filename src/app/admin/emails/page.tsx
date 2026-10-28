import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { retryEmailAction } from "@/app/actions/admin";
import { Empty, Flash } from "@/components/admin";
import { SubmitButton } from "@/components/ui";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Email log" };
export const dynamic = "force-dynamic";

export default async function Emails({ searchParams }: { searchParams: Promise<{ status?: string; ok?: string; err?: string }> }) {
  const user = await requirePermission("email:view", "/admin/emails");
  const { status, ok, err } = await searchParams;
  const q = db.select().from(schema.emailLogs);
  const rows = (status ? q.where(eq(schema.emailLogs.status, status)) : q).orderBy(desc(schema.emailLogs.createdAt)).limit(100).all();
  return (
    <div>
      <h1 className="text-3xl">Email log</h1>
      <p className="mt-1 max-w-prose text-steel">Every automated email, with its delivery result. Failed emails can be retried when their content was stored.</p>
      <div className="mt-5"><Flash ok={ok} err={err} /></div>
      <form className="mb-4 flex items-end gap-3">
        <div><label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="input"><option value="">All</option>{["SENT", "LOGGED", "FAILED", "PENDING"].map((s) => <option key={s}>{s}</option>)}</select></div>
        <button className="btn btn-primary" type="submit">Apply</button>
      </form>
      {rows.length === 0 ? <Empty title="No emails to show" /> : (
        <div className="overflow-x-auto border border-line bg-white">
          <table className="tbl">
            <thead><tr><th>When</th><th>To</th><th>Template</th><th>Subject</th><th>Status</th><th>Tries</th><th /></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(m.createdAt)}</td><td>{m.toAddress}</td><td className="font-mono text-xs">{m.template}</td>
                  <td>{m.subject}{m.lastError && <span className="block text-xs text-danger">{m.lastError}</span>}</td>
                  <td><span className={`badge badge-${m.status}`}>{m.status}</span></td><td>{m.attempts}</td>
                  <td>{m.status === "FAILED" && can(user.role, "email:retry") && (
                    <form action={retryEmailAction}><input type="hidden" name="id" value={m.id} /><SubmitButton className="btn btn-ghost btn-sm" pending="Retrying...">Retry</SubmitButton></form>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-steel">LOGGED means no mail server is configured, so the message was recorded but not delivered (development mode).</p>
    </div>
  );
}
