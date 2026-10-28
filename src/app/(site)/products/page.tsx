import type { Metadata } from "next";
import Link from "next/link";
import { catalogue } from "@/content/company";

export const metadata: Metadata = { title: "Products and services" };

export default function Products() {
  return (
    <div className="wrap py-12">
      <h1 className="text-4xl">Products and services</h1>
      {catalogue.length === 0 ? (
        <div className="mt-8 max-w-2xl border border-line border-t-2 border-t-navy bg-white p-6">
          <h2 className="text-xl">Our catalogue is being updated</h2>
          <p className="mt-2 text-steel">
            Detailed product and service pages will appear here. In the meantime, tell us what you need and we will reply with specifications and a quotation.
          </p>
          <Link href="/enquiry?category=PRODUCT" className="btn btn-accent mt-5 no-underline">Ask about a product</Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-px border border-line bg-line md:grid-cols-2">
          {catalogue.map((p) => (
            <li key={p.name} className="bg-white p-5">
              <h2 className="text-lg">{p.name}</h2>
              <p className="mt-1 text-steel">{p.summary}</p>
              <Link href={`/enquiry?category=QUOTATION`} className="mt-3 inline-block font-semibold">Request a quote</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
