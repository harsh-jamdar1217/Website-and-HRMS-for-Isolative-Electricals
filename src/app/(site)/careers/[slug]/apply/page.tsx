import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { applyExistingAction } from "@/app/actions/recruitment";
import { Flash } from "@/components/admin";
import { SubmitButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getOpenVacancy } from "@/lib/recruitment";
import { ApplyForm } from "./ApplyForm";

export const metadata: Metadata = { title: "Apply" };
export const dynamic = "force-dynamic";

export default async function Apply({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ err?: string }> }) {
  const { slug } = await params;
  const v = getOpenVacancy(slug);
  if (!v) notFound();
  const user = await getCurrentUser();
  const { err } = await searchParams;
  return (
    <div className="wrap max-w-2xl py-12">
      <Link href={`/careers/${v.slug}`} className="text-sm font-semibold">Back to the vacancy</Link>
      <h1 className="mt-2 text-3xl">Apply: {v.title}</h1>
      <div className="mt-6"><Flash err={err} />
        {!user && (
          <>
            <p className="mb-6 text-steel">Create your candidate account and apply in one step. Already registered? <Link href={`/login?next=${encodeURIComponent(`/careers/${v.slug}/apply`)}`}>Sign in</Link>.</p>
            <ApplyForm slug={v.slug} />
          </>
        )}
        {user?.role === "CANDIDATE" && (
          <form action={applyExistingAction} className="space-y-4">
            <input type="hidden" name="slug" value={v.slug} />
            <p className="text-steel">Signed in as {user.name}. Your saved details will be used.</p>
            <div><label htmlFor="coverNote" className="label">Why are you interested? <span className="font-normal text-steel">(optional)</span></label><textarea id="coverNote" name="coverNote" className="input min-h-28" rows={4} maxLength={1500} /></div>
            <SubmitButton pending="Submitting...">Submit application</SubmitButton>
          </form>
        )}
        {user && user.role !== "CANDIDATE" && <p className="border border-line bg-white p-4">Staff accounts cannot apply for vacancies. Use a separate candidate account.</p>}
      </div>
    </div>
  );
}
