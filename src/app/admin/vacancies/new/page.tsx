import type { Metadata } from "next";
import Link from "next/link";
import { Flash } from "@/components/admin";
import { VacancyForm } from "@/components/VacancyForm";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "New vacancy" };

export default async function NewVacancy({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  await requirePermission("vacancy:manage", "/admin/vacancies/new");
  const { err } = await searchParams;
  return (<div><Link href="/admin/vacancies" className="text-sm font-semibold">All vacancies</Link><h1 className="mb-5 mt-2 text-3xl">New vacancy</h1><Flash err={err} /><VacancyForm /></div>);
}
