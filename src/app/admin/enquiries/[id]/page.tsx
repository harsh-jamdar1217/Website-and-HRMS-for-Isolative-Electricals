import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { assignAction, convertAction, followUpAction, noteAction, statusAction } from "@/app/actions/admin";
import { Flash, StatusBadge } from "@/components/admin";
import { SubmitButton } from "@/components/ui";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { getEnquiryDetail } from "@/lib/enquiries";
import { fmtDate, fmtDateTime, toDateInput } from "@/lib/format";
import { can } from "@/lib/permissions";
import { ENQUIRY_CATEGORIES, ENQUIRY_STATUS_LABEL, ENQUIRY_TRANSITIONS, type EnquiryStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Enquiry" };
export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = { IN_PROGRESS: "Start work", RESPONDED: "Mark as responded", CLOSED: "Close enquiry" };

export default async function EnquiryDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { id } = await params;
  const user = await requirePermission("enquiry:view", `/admin/enquiries/${id}`);
  const d = getEnquiryDetail(id);
  if (!d) notFound();
  const { ok, err } = await searchParams;
  const { e } = d;
  const canManage = can(user.role, "enquiry:manage");
  const admins = db.select().from(schema.users).where(and(eq(schema.users.role, "ADMIN"), eq(schema.users.isActive, true))).all();
  const next = ENQUIRY_TRANSITIONS[e.status as EnquiryStatus] ?? [];
  const canConvert = canManage && (e.status === "IN_PROGRESS" || e.status === "RESPONDED");

  return (
    <div>
      <Link href="/admin/enquiries" className="text-sm font-semibold">All enquiries</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-3xl">{e.reference}</h1>
        <StatusBadge status={e.status} />
      </div>
      <p className="mt-1 text-sm text-steel">Received {fmtDateTime(e.createdAt)}</p>
      <div className="mt-5"><Flash ok={ok} err={err} /></div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <section className="panel p-5" aria-labelledby="enq">
            <h2 id="enq" className="text-lg">Enquiry</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["Name", e.name],
                ["Company", e.company ?? "-"],
                ["Email", <a key="m" href={`mailto:${e.email}`}>{e.email}</a>],
                ["Phone", e.phone ?? "-"],
                ["Type", ENQUIRY_CATEGORIES[e.category as keyof typeof ENQUIRY_CATEGORIES] ?? e.category],
                ["Privacy notice accepted", fmtDateTime(e.consentAt)],
              ].map(([k, v]) => (<div key={String(k)}><dt className="text-xs font-semibold text-steel">{k}</dt><dd>{v}</dd></div>))}
            </dl>
            <p className="mt-4 whitespace-pre-wrap border-l-4 border-amber pl-4">{e.message}</p>
          </section>

          <section className="panel p-5" aria-labelledby="notes">
            <h2 id="notes" className="text-lg">Internal notes</h2>
            {canManage && (
              <form action={noteAction} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={e.id} />
                <label htmlFor="body" className="label">Add a note (visible to staff only)</label>
                <textarea id="body" name="body" className="input" rows={3} maxLength={2000} required />
                <SubmitButton className="btn btn-primary btn-sm" pending="Saving...">Save note</SubmitButton>
              </form>
            )}
            {d.notes.length === 0 ? <p className="mt-4 text-sm text-steel">No notes yet.</p> : (
              <ul className="mt-4 space-y-3">
                {d.notes.map(({ n, authorName }) => (
                  <li key={n.id} className="border-t border-line pt-3 text-sm"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-1 text-xs text-steel">{authorName}, {fmtDateTime(n.createdAt)}</p></li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel p-5" aria-labelledby="work">
            <h2 id="work" className="text-lg">Handling</h2>
            {!canManage ? <p className="mt-2 text-sm text-steel">You have read-only access.</p> : (
              <div className="mt-3 space-y-5">
                <div>
                  <p className="label">Status: {ENQUIRY_STATUS_LABEL[e.status as EnquiryStatus]}</p>
                  {next.length === 0 && !canConvert ? <p className="hint">No further status changes.</p> : (
                    <div className="flex flex-wrap gap-2">
                      {next.map((s) => (
                        <form key={s} action={statusAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="to" value={s} />
                          <SubmitButton className={`btn btn-sm ${s === "CLOSED" ? "btn-ghost" : "btn-primary"}`}>{e.status === "CLOSED" && s === "IN_PROGRESS" ? "Reopen" : ACTION_LABEL[s]}</SubmitButton></form>
                      ))}
                      {canConvert && (
                        <form action={convertAction}><input type="hidden" name="id" value={e.id} /><SubmitButton className="btn btn-accent btn-sm" pending="Converting...">Convert to client</SubmitButton></form>
                      )}
                    </div>
                  )}
                </div>
                <form action={assignAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <label htmlFor="assigneeId" className="label">Assigned to</label>
                  <div className="flex gap-2">
                    <select id="assigneeId" name="assigneeId" defaultValue={e.assigneeId ?? ""} className="input">
                      <option value="">Unassigned</option>
                      {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <SubmitButton className="btn btn-ghost btn-sm" pending="Saving...">Save</SubmitButton>
                  </div>
                </form>
                <form action={followUpAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <label htmlFor="date" className="label">Follow-up date</label>
                  <div className="flex gap-2">
                    <input id="date" name="date" type="date" defaultValue={toDateInput(e.followUpDate)} className="input" />
                    <SubmitButton className="btn btn-ghost btn-sm" pending="Saving...">Save</SubmitButton>
                  </div>
                  <p className="hint">Leave empty and save to clear.</p>
                </form>
              </div>
            )}
            {d.client && <p className="mt-4 border-t border-line pt-3 text-sm">Client record: <strong>{d.client.name}</strong> (created {fmtDate(d.client.createdAt)}).</p>}
          </section>

          <section className="panel p-5" aria-labelledby="hist">
            <h2 id="hist" className="text-lg">History</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {d.history.map(({ a, actorName }) => (
                <li key={a.id} className="border-t border-line pt-2"><span className="font-mono text-xs">{a.action}</span><span className="block text-xs text-steel">{actorName ?? "Website visitor"}, {fmtDateTime(a.createdAt)}</span></li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
