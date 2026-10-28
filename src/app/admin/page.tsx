import Link from "next/link";
import { and, count, desc, eq, lte, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { Empty, StatusBadge } from "@/components/admin";
import { requirePermission } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { countByStatus } from "@/lib/recruitment";
import { countEmployees } from "@/lib/employees";
import { countUpcoming } from "@/lib/meetings";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requirePermission("admin:access");
  const canEnq = can(user.role, "enquiry:view");
  const n = (q: { n: number } | undefined) => q?.n ?? 0;

  const stats = canEnq
    ? {
        fresh: n(db.select({ n: count() }).from(schema.enquiries).where(eq(schema.enquiries.status, "NEW")).get()),
        active: n(db.select({ n: count() }).from(schema.enquiries).where(eq(schema.enquiries.status, "IN_PROGRESS")).get()),
        due: n(db.select({ n: count() }).from(schema.enquiries).where(and(lte(schema.enquiries.followUpDate, new Date()), notInArray(schema.enquiries.status, ["CLOSED", "CONVERTED"]))).get()),
        failedMail: can(user.role, "email:view") ? n(db.select({ n: count() }).from(schema.emailLogs).where(eq(schema.emailLogs.status, "FAILED")).get()) : null,
      }
    : null;
  const canCand = can(user.role, "candidate:view");
  const recruit = canCand ? { review: countByStatus(["UNDER_REVIEW"]), docs: countByStatus(["DOCS_PENDING", "CORRECTION_REQUESTED"]), shortlisted: countByStatus(["SHORTLISTED"]), offers: countByStatus(["SELECTED"]), toConvert: countByStatus(["OFFER_ACCEPTED"]), onboarding: can(user.role, "employee:view") ? countEmployees("ONBOARDING") : 0, meetings: can(user.role, "meeting:view") ? countUpcoming(7) : 0 } : null;
  const recent = canEnq ? db.select().from(schema.enquiries).orderBy(desc(schema.enquiries.createdAt)).limit(6).all() : [];

  return (
    <div>
      <h1 className="text-3xl">Dashboard</h1>
      <p className="mt-1 text-steel">Signed in as {user.name}.</p>

      {recruit && (
        <>
          <h2 className="mb-3 mt-6 text-xl">Recruitment</h2>
          <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {[["Awaiting your review", recruit.review, "/admin/candidates?status=UNDER_REVIEW", "Documents submitted"], ["Waiting for candidates", recruit.docs, "/admin/candidates?status=DOCS_PENDING", "Documents or corrections due"], ["Shortlisted", recruit.shortlisted, "/admin/candidates?status=SHORTLISTED", "Ready for a decision"], ["Offers out", recruit.offers, "/admin/candidates?status=SELECTED", "Waiting for acceptance"], ["Ready to convert", recruit.toConvert, "/admin/candidates?status=OFFER_ACCEPTED", "Accepted, not yet employees"], ["In onboarding", recruit.onboarding, "/admin/employees?status=ONBOARDING", "New joiners with open tasks"], ["Meetings, next 7 days", recruit.meetings, "/admin/meetings?view=list", "Scheduled and upcoming"]].map(([label, value, href, hint]) => (
              <Link key={String(label)} href={String(href)} className="block bg-white p-4 no-underline hover:bg-navy-50"><p className="text-sm font-semibold text-steel">{label}</p><p className="mt-1 text-3xl font-bold text-navy">{value}</p><p className="mt-1 text-xs text-steel">{hint}</p></Link>))}
          </div>
        </>
      )}
      {!stats ? (
        recruit ? null : <div className="mt-6"><Empty title="Nothing to review">Your role has no review queues.</Empty></div>
      ) : (
        <>
          <h2 className="mb-3 mt-9 text-xl">Enquiries</h2>
          <div className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["New enquiries", stats.fresh, "/admin/enquiries?status=NEW", "Waiting for first review"],
              ["In progress", stats.active, "/admin/enquiries?status=IN_PROGRESS", "Being handled"],
              ["Follow-ups due", stats.due, "/admin/enquiries", "Follow-up date has arrived"],
              ...(stats.failedMail !== null ? [["Failed emails", stats.failedMail, "/admin/emails?status=FAILED", "Need a retry or a check"]] : []),
            ].map(([label, value, href, hint]) => (
              <Link key={String(label)} href={String(href)} className="block bg-white p-4 no-underline hover:bg-navy-50">
                <p className="text-sm font-semibold text-steel">{label}</p>
                <p className="mt-1 text-3xl font-bold text-navy">{value}</p>
                <p className="mt-1 text-xs text-steel">{hint}</p>
              </Link>
            ))}
          </div>

          <h2 className="mb-3 mt-9 text-xl">Latest enquiries</h2>
          {recent.length === 0 ? (
            <Empty title="No enquiries yet">New enquiries from the website will appear here.</Empty>
          ) : (
            <div className="overflow-x-auto border border-line bg-white">
              <table className="tbl">
                <thead><tr><th>Reference</th><th>From</th><th>Status</th><th>Received</th></tr></thead>
                <tbody>
                  {recent.map((e) => (
                    <tr key={e.id}>
                      <td className="font-mono"><Link href={`/admin/enquiries/${e.id}`}>{e.reference}</Link></td>
                      <td>{e.name}{e.company && <span className="block text-xs text-steel">{e.company}</span>}</td>
                      <td><StatusBadge status={e.status} /></td>
                      <td className="whitespace-nowrap">{fmtDateTime(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
