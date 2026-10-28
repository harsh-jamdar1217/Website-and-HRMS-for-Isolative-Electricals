import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { vacancyStatusAction } from "@/app/actions/hr";
import { Flash } from "@/components/admin";
import { VacancyForm } from "@/components/VacancyForm";
import { SubmitButton } from "@/components/ui";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { VACANCY_STATUS_LABEL } from "@/lib/status";

export const metadata: Metadata = { title: "Edit vacancy" };
export const dynamic = "force-dynamic";
const NEXT: Record<string, [string, string][]> = { DRAFT: [["PUBLISHED", "Publish"]], PUBLISHED: [["CLOSED", "Close applications"], ["DRAFT", "Unpublish"]], CLOSED: [["PUBLISHED", "Reopen"]] };

export default async function EditVacancy({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { id } = await params;
  await requirePermission("vacancy:manage", `/admin/vacancies/${id}`);
  const v = db.select().from(schema.vacancies).where(eq(schema.vacancies.id, id)).get();
  if (!v) notFound();
  const { ok, err } = await searchParams;
  return (
    <div>
      <Link href="/admin/vacancies" className="text-sm font-semibold">All vacancies</Link>
      <div className="mb-5 mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl">{v.title}</h1><span className="badge badge-IN_PROGRESS">{VACANCY_STATUS_LABEL[v.status as keyof typeof VACANCY_STATUS_LABEL]}</span></div>
      <Flash ok={ok} err={err} />
      <div className="mb-6 flex flex-wrap gap-2">
        {NEXT[v.status]?.map(([to, label]) => (
          <form key={to} action={vacancyStatusAction}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="to" value={to} /><SubmitButton className={`btn btn-sm ${to === "PUBLISHED" ? "btn-accent" : "btn-ghost"}`}>{label}</SubmitButton></form>))}
        {v.status === "PUBLISHED" && <Link href={`/careers/${v.slug}`} className="btn btn-ghost btn-sm no-underline">View on website</Link>}
        <Link href={`/admin/candidates?vacancyId=${v.id}`} className="btn btn-ghost btn-sm no-underline">View applications</Link>
      </div>
      <VacancyForm v={v} />
    </div>
  );
}
