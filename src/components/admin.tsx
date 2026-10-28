import Link from "next/link";
import { APPLICATION_STATUS_LABEL, ENQUIRY_STATUS_LABEL } from "@/lib/status";

export function StatusBadge({ status }: { status: string }) {
  const label = (ENQUIRY_STATUS_LABEL as Record<string, string>)[status] ?? status;
  return <span className={`badge badge-${status}`}>{label}</span>;
}

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <div role={err ? "alert" : "status"} className={`mb-5 border p-3 text-sm font-medium ${err ? "border-danger bg-danger/10 text-danger" : "border-ok bg-ok/10 text-ok"}`}>
      {err ?? ok}
    </div>
  );
}

export function Pagination({ page, pages, params, basePath }: { page: number; pages: number; params: Record<string, string | undefined>; basePath: string }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-steel">Page {page} of {pages}</span>
      <span className="flex gap-2">
        {page > 1 && <Link className="btn btn-ghost btn-sm no-underline" href={href(page - 1)}>Previous</Link>}
        {page < pages && <Link className="btn btn-ghost btn-sm no-underline" href={href(page + 1)}>Next</Link>}
      </span>
    </nav>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-steel/50 bg-white p-8 text-center">
      <p className="font-semibold text-navy">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-steel">{children}</p>}
    </div>
  );
}

const APP_BADGE: Record<string, string> = {
  PENDING_VERIFICATION: "NEW", DOCS_PENDING: "NEW", CORRECTION_REQUESTED: "NEW",
  UNDER_REVIEW: "IN_PROGRESS", SHORTLISTED: "IN_PROGRESS",
  SELECTED: "RESPONDED", OFFER_ACCEPTED: "CONVERTED", HIRED: "CONVERTED",
  REJECTED: "CLOSED", WITHDRAWN: "CLOSED",
};
export function AppStatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${APP_BADGE[status] ?? "CLOSED"}`}>{APPLICATION_STATUS_LABEL[status as keyof typeof APPLICATION_STATUS_LABEL] ?? status}</span>;
}

export function EmployeeStatusBadge({ status }: { status: string }) {
  const cls = status === "ACTIVE" ? "badge-RESPONDED" : status === "ONBOARDING" ? "badge-NEW" : status === "NOTICE_PERIOD" ? "badge-IN_PROGRESS" : "badge-CLOSED";
  const label = ({ ONBOARDING: "Onboarding", ACTIVE: "Active", NOTICE_PERIOD: "Notice period", EXITED: "Exited" } as Record<string, string>)[status] ?? status;
  return <span className={`badge ${cls}`}>{label}</span>;
}
