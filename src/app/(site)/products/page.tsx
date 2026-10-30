import type { Metadata } from "next";
import Link from "next/link";
import { Empty } from "@/components/admin";
import { ItemVisual } from "@/components/CatalogueGlyph";
import { imageAvailable, listPublishedByCategory } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Products and services", description: "Electrical EPC, testing, commissioning, refurbishment and maintenance services from Isolative Electricals." };
export const dynamic = "force-dynamic";

const anchor = (c: string) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function Products() {
  const groups = listPublishedByCategory();
  return (
    <div className="wrap py-12">
      <h1 className="text-4xl">Products and services</h1>
      <p className="mt-3 max-w-prose text-lg text-steel">What Isolative Electricals can do for your plant, substation or project. Open any item for details, and send an enquiry straight from its page.</p>

      {groups.length === 0 ? (
        <div className="mt-8"><Empty title="Our catalogue is being updated">Tell us what you need and we will reply with details and a quotation.</Empty><Link href="/enquiry" className="btn btn-accent mt-5 no-underline">Send an enquiry</Link></div>
      ) : (
        <>
          <nav aria-label="Categories" className="mt-8 flex flex-wrap gap-2">
            {groups.map((g) => (<a key={g.category} href={`#${anchor(g.category)}`} className="border border-navy/40 bg-white px-3 py-1.5 text-sm font-semibold text-navy no-underline hover:bg-navy-50">{g.category} <span className="font-normal text-steel">({g.items.length})</span></a>))}
          </nav>
          <div className="mt-10 space-y-14">
            {groups.map((g) => (
              <section key={g.category} id={anchor(g.category)} aria-labelledby={`h-${anchor(g.category)}`} className="scroll-mt-6">
                <h2 id={`h-${anchor(g.category)}`} className="border-b-2 border-navy pb-2 text-2xl">{g.category}</h2>
                <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((it) => (
                    <li key={it.id} className="flex flex-col border border-line bg-white">
                      <Link href={`/products/${it.slug}`} className="block no-underline"><ItemVisual category={it.category} image={imageAvailable(it.imagePath)} title={it.title} /></Link>
                      <div className="flex flex-1 flex-col p-4">
                        <span className="text-xs font-semibold text-amber-700">{it.kind === "PRODUCT" ? "Product" : "Service"}</span>
                        <h3 className="mt-1 text-lg"><Link href={`/products/${it.slug}`} className="text-navy no-underline hover:underline">{it.title}</Link></h3>
                        <p className="mt-2 flex-1 text-sm text-steel">{it.summary}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
                          <Link href={`/products/${it.slug}`}>View details</Link>
                          <Link href={`/products/${it.slug}#enquiry`} className="text-ok">Send an enquiry</Link>
                        </div>
                      </div>
                    </li>))}
                </ul>
              </section>))}
          </div>
          <div className="mt-14 border border-line border-t-2 border-t-amber bg-white p-6"><h2 className="text-xl">Do not see what you need?</h2><p className="mt-1 text-steel">Describe your requirement and our team will tell you whether and how we can help.</p><Link href="/enquiry" className="btn btn-primary mt-4 no-underline">Send an enquiry</Link></div>
        </>
      )}
    </div>
  );
}
