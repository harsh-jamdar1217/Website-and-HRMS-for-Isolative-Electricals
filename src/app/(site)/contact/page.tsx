import type { Metadata } from "next";
import Link from "next/link";
import { company } from "@/content/company";

export const metadata: Metadata = { title: "Contact" };

export default function Contact() {
  return (
    <div className="wrap py-12">
      <h1 className="text-4xl">Contact us</h1>
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <dl className="border-t-2 border-navy bg-white">
          {[
            ["Email", <a key="e" href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a>],
            ["Phone", company.contactPhone],
            ["Registered office", company.registeredAddress],
          ].map(([k, v]) => (
            <div key={String(k)} className="border-b border-line px-4 py-3">
              <dt className="text-sm font-semibold text-steel">{k}</dt>
              <dd className="mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="border border-line border-t-2 border-t-amber bg-white p-6">
          <h2 className="text-xl">For a quotation or product details</h2>
          <p className="mt-2 text-steel">The enquiry form gives you a reference number and makes sure your request reaches the right person.</p>
          <Link href="/enquiry" className="btn btn-primary mt-5 no-underline">Send an enquiry</Link>
        </div>
      </div>
    </div>
  );
}
