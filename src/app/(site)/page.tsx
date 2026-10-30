import Link from "next/link";
import { SheetHero } from "@/components/SheetHero";
import { company } from "@/content/company";
import { listPublishedByCategory } from "@/lib/catalogue";
import { ENQUIRY_CATEGORIES } from "@/lib/status";

const intents = [
  { key: "QUOTATION", text: "Tell us what you need and the site it is for. We reply with a quotation." },
  { key: "PRODUCT", text: "Ask for product information, specifications or a catalogue." },
  { key: "SUPPORT", text: "Request technical advice or arrange a site inspection." },
] as const;

export const dynamic = "force-dynamic";

const anchorOf = (c: string) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function Home() {
  const groups = listPublishedByCategory();
  return (
    <>
      <section className="wrap grid items-center gap-10 py-10 md:grid-cols-[5fr_6fr] md:py-16">
        <div>
          <h1 className="text-4xl sm:text-5xl">{company.tagline}</h1>
          <p className="mt-5 max-w-prose text-lg text-steel">
            {company.legalName} engineers, installs, tests and maintains electrical systems for industrial plants, power plants, and commercial and residential projects. Based in Khandala, Satara district, Maharashtra.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/enquiry" className="btn btn-accent no-underline">Send an enquiry</Link>
            <Link href="/products" className="btn btn-ghost no-underline">Products and services</Link>
          </div>
        </div>
        <SheetHero />
      </section>

      {groups.length > 0 && (
        <section className="wrap py-10" aria-labelledby="svc">
          <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="svc" className="text-2xl">What we do</h2><Link href="/products" className="font-semibold">All products and services</Link></div>
          <ul className="mt-5 grid border-t-2 border-navy sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g, i) => (
              <li key={g.category} className={`border-b border-line bg-white ${i % 3 !== 0 ? "lg:border-l" : ""} ${i % 2 !== 0 ? "sm:max-lg:border-l" : ""}`}>
                <Link href={`/products#${anchorOf(g.category)}`} className="block h-full p-5 no-underline hover:bg-navy-50">
                  <h3 className="text-lg">{g.category}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-steel">{g.items.slice(0, 3).map((it) => <li key={it.id}>{it.title}</li>)}{g.items.length > 3 && <li className="font-semibold text-navy">+ {g.items.length - 3} more</li>}</ul>
                </Link>
              </li>))}
          </ul>
        </section>)}

      <section className="wrap py-10" aria-labelledby="help">
        <h2 id="help" className="text-2xl">What can we help you with?</h2>
        <div className="mt-5 grid border-t-2 border-navy md:grid-cols-3">
          {intents.map((i, idx) => (
            <Link key={i.key} href={`/enquiry?category=${i.key}`}
              className={`block border-b border-line bg-white p-5 no-underline hover:bg-navy-50 md:border-b-0 ${idx > 0 ? "md:border-l" : ""}`}>
              <h3 className="text-lg">{ENQUIRY_CATEGORIES[i.key]}</h3>
              <p className="mt-2 text-steel">{i.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap py-10" aria-labelledby="process">
        <h2 id="process" className="text-2xl">What happens after you send an enquiry</h2>
        <ol className="mt-5 grid gap-px border border-line bg-line md:grid-cols-4">
          {[
            ["You submit the form", "It takes about two minutes."],
            ["You get a reference number", "Sent to your email straight away."],
            ["Our team reviews it", "Your enquiry is assigned to a team member."],
            ["We reply by email", "Quote the reference in any follow-up."],
          ].map(([t, d], i) => (
            <li key={t} className="bg-white p-5">
              <span className="text-sm font-semibold text-amber-700">Step {i + 1}</span>
              <p className="mt-1 font-semibold text-navy">{t}</p>
              <p className="mt-1 text-sm text-steel">{d}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
