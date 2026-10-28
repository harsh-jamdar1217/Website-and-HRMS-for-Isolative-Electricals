import type { Metadata } from "next";
import Link from "next/link";
import { company } from "@/content/company";

export const metadata: Metadata = { title: "About" };

export default function About() {
  const rows: [string, string][] = [
    ["Legal name", company.legalName],
    ["Company type", "Private limited company"],
    ["Registered office", company.registeredAddress],
    ["Incorporated", String(company.incorporationYear)],
    ["Corporate identity number", company.cin],
  ];
  return (
    <div className="wrap py-12">
      <h1 className="text-4xl">About {company.shortName}</h1>
      <p className="mt-4 max-w-prose text-lg text-steel">
        {company.legalName} is a registered company in the Khandala region of Satara district, Maharashtra. It works in the electrical sector and serves customers from the surrounding industrial and commercial area.
      </p>
      <h2 className="mt-10 text-2xl">Company details</h2>
      <dl className="mt-4 max-w-3xl border-t-2 border-navy bg-white">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 border-b border-line px-4 py-3 sm:grid-cols-[14rem_1fr]">
            <dt className="text-sm font-semibold text-steel">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 max-w-prose text-steel">
        Want to work with us? <Link href="/enquiry">Send an enquiry</Link> or <Link href="/contact">find our contact details</Link>.
      </p>
    </div>
  );
}
