import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Empty } from "@/components/admin";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function Audit() {
  await requirePermission("audit:view", "/admin/audit");
  const rows = db
    .select({ a: schema.auditLogs, actor: schema.users.name })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorId))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(150)
    .all();
  return (
    <div>
      <h1 className="text-3xl">Audit log</h1>
      <p className="mt-1 max-w-prose text-steel">A read-only record of sensitive actions: who did what, and when. Showing the latest 150 events.</p>
      <div className="mt-6">
        {rows.length === 0 ? <Empty title="No events recorded yet" /> : (
          <div className="overflow-x-auto border border-line bg-white">
            <table className="tbl">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
              <tbody>
                {rows.map(({ a, actor }) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{fmtDateTime(a.createdAt)}</td><td>{actor ?? "Website visitor"}</td>
                    <td className="font-mono text-xs">{a.action}</td><td className="font-mono text-xs">{a.entityType}:{a.entityId.slice(0, 8)}</td>
                    <td className="max-w-xs break-words font-mono text-xs text-steel">{a.details ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
