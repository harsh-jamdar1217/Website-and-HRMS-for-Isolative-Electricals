import type { Metadata } from "next";
import Link from "next/link";
import { resendVerificationAction } from "@/app/actions/recruitment";
import { AppStatusBadge, Empty, Flash } from "@/components/admin";
import { SubmitButton } from "@/components/ui";
import { requireCandidate } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { listOwnApplications } from "@/lib/recruitment";

export const metadata: Metadata = { title: "My applications" };
export const dynamic = "force-dynamic";

export default async function CandidateHome({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireCandidate("/candidate");
  const { ok, err } = await searchParams;
  const apps = listOwnApplications(user.id);
  return (
    <div className="wrap py-12">
      <h1 className="text-4xl">My applications</h1>
      <p className="mt-2 text-steel">Signed in as {user.name} ({user.email}).</p>
      <div className="mt-5"><Flash ok={ok} err={err} /></div>
      {!user.emailVerifiedAt && (
        <div role="status" className="mb-6 border border-amber-700 bg-amber/15 p-4">
          <p className="font-semibold text-navy">Confirm your email address to continue</p>
          <p className="mt-1 text-sm">We sent a confirmation link to {user.email}. You cannot upload documents until it is confirmed.</p>
          <form action={resendVerificationAction} className="mt-3"><SubmitButton className="btn btn-primary btn-sm" pending="Sending...">Send a new link</SubmitButton></form>
        </div>
      )}
      {apps.length === 0 ? (
        <Empty title="You have not applied yet">Browse open positions and apply in a few minutes.</Empty>
      ) : (
        <ul className="border-t-2 border-navy bg-white">
          {apps.map(({ app, vacancy }) => (
            <li key={app.id} className="border-b border-line">
              <Link href={`/candidate/applications/${app.id}`} className="grid gap-2 p-5 no-underline hover:bg-navy-50 sm:grid-cols-[1fr_auto] sm:items-center">
                <span><span className="block text-lg font-semibold text-navy">{vacancy.title}</span><span className="mt-0.5 block font-mono text-sm text-steel">{app.reference}  |  Applied {fmtDate(app.createdAt)}</span></span>
                <AppStatusBadge status={app.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/careers" className="btn btn-ghost mt-6 no-underline">Browse open positions</Link>
    </div>
  );
}
