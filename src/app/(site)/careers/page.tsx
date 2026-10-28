import type { Metadata } from "next";
import Link from "next/link";
import { Empty } from "@/components/admin";
import { fmtDate } from "@/lib/format";
import { listOpenVacancies } from "@/lib/recruitment";
import { EMPLOYMENT_TYPES } from "@/lib/status";

export const metadata: Metadata = { title: "Careers" };
export const dynamic = "force-dynamic";

export default function Careers() {
  const vacancies = listOpenVacancies();
  return (
    <div className="wrap py-12">
      <h1 className="text-4xl">Careers</h1>
      <p className="mt-3 max-w-prose text-lg text-steel">Open positions at Isolative Electricals. Apply online, upload your documents securely and follow your application status from your own page.</p>
      <div className="mt-8">
        {vacancies.length === 0 ? (
          <Empty title="No open positions right now">Please check again soon. You can also send us an enquiry about working with us.</Empty>
        ) : (
          <ul className="border-t-2 border-navy bg-white">
            {vacancies.map((v) => (
              <li key={v.id} className="border-b border-line">
                <Link href={`/careers/${v.slug}`} className="grid gap-1 p-5 no-underline hover:bg-navy-50 sm:grid-cols-[1fr_auto] sm:items-center">
                  <span>
                    <span className="block text-xl font-semibold text-navy">{v.title}</span>
                    <span className="mt-1 block text-sm text-steel">{[v.department, v.location, EMPLOYMENT_TYPES[v.employmentType as keyof typeof EMPLOYMENT_TYPES]].filter(Boolean).join("  |  ")}</span>
                  </span>
                  <span className="text-sm text-steel">{v.closesAt ? `Apply by ${fmtDate(v.closesAt)}` : "Open until filled"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
