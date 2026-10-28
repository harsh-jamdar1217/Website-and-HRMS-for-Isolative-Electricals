import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/admin";
import { fmtDate } from "@/lib/format";
import { getOpenVacancy } from "@/lib/recruitment";
import { EMPLOYMENT_TYPES } from "@/lib/status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const v = getOpenVacancy((await params).slug);
  return { title: v?.title ?? "Vacancy" };
}

export default async function Vacancy({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ err?: string }> }) {
  const { slug } = await params;
  const v = getOpenVacancy(slug);
  if (!v) notFound();
  const { err } = await searchParams;
  return (
    <div className="wrap max-w-4xl py-12">
      <Link href="/careers" className="text-sm font-semibold">All positions</Link>
      <h1 className="mt-2 text-4xl">{v.title}</h1>
      <p className="mt-2 text-steel">{[v.department, v.location, EMPLOYMENT_TYPES[v.employmentType as keyof typeof EMPLOYMENT_TYPES]].filter(Boolean).join("  |  ")}{v.closesAt ? `  |  Apply by ${fmtDate(v.closesAt)}` : ""}</p>
      <div className="mt-5"><Flash err={err} /></div>
      <section className="mt-6"><h2 className="text-xl">About the role</h2><p className="mt-2 max-w-prose whitespace-pre-wrap">{v.description}</p></section>
      <section className="mt-8"><h2 className="text-xl">Eligibility</h2><p className="mt-2 max-w-prose whitespace-pre-wrap">{v.eligibility}</p></section>
      <Link href={`/careers/${v.slug}/apply`} className="btn btn-accent mt-8 no-underline">Apply for this position</Link>
    </div>
  );
}
