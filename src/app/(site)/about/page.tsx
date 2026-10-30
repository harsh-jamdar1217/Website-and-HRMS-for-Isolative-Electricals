import type { Metadata } from "next";
import Link from "next/link";
import { company, profile } from "@/content/company";

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
      <div className="mt-4 max-w-prose space-y-4 text-lg text-steel">{profile.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
      <h2 className="mt-10 text-2xl">How a project runs</h2>
      <ol className="mt-4 grid max-w-4xl gap-px border border-line bg-line sm:grid-cols-4">{profile.lifecycle.map((step, i) => (<li key={step} className="bg-white p-4"><span className="text-sm font-semibold text-amber-700">Stage {i + 1}</span><p className="mt-1 font-semibold text-navy">{step}</p></li>))}</ol>
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
        Want to work with us? See our <Link href="/products">products and services</Link>, <Link href="/enquiry">send an enquiry</Link> or <Link href="/contact">find our contact details</Link>.
      </p>
    </div>
  );
}
