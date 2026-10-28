import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { Empty } from "@/components/admin";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function Clients() {
  await requirePermission("client:view", "/admin/clients");
  const rows = db.select().from(schema.clients).orderBy(desc(schema.clients.createdAt)).all();
  return (
    <div>
      <h1 className="text-3xl">Clients</h1>
      <p className="mt-1 max-w-prose text-steel">Private client records. Nothing here appears on the public website.</p>
      <div className="mt-6">
        {rows.length === 0 ? <Empty title="No clients yet">Convert a handled enquiry to create the first client record.</Empty> : (
          <div className="overflow-x-auto border border-line bg-white">
            <table className="tbl">
              <thead><tr><th>Client</th><th>Contact</th><th>Email</th><th>Public display</th><th>Added</th><th>Source</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold">{c.name}</td><td>{c.contactName ?? "-"}</td><td>{c.email ?? "-"}</td>
                    <td>{c.showPublicly ? "Authorised" : "Not shown"}</td><td>{fmtDate(c.createdAt)}</td>
                    <td>{c.sourceEnquiryId ? <Link href={`/admin/enquiries/${c.sourceEnquiryId}`}>Enquiry</Link> : "-"}</td>
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
