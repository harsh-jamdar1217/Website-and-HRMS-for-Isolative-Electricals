import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemVisual } from "@/components/CatalogueGlyph";
import { EnquiryForm } from "@/app/(site)/enquiry/EnquiryForm";
import { factPairs, getPublishedBySlug, imageAvailable, lines, relatedItems } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const it = getPublishedBySlug((await params).slug);
  return it ? { title: it.title, description: it.summary } : { title: "Not found" };
}

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const it = getPublishedBySlug(slug);
  if (!it) notFound();
  const highlights = lines(it.highlights), apps = lines(it.applications), facts = factPairs(it.facts);
  const related = relatedItems(it);
  return (
    <div className="wrap py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-steel"><Link href="/products" className="font-semibold">Products and services</Link><span aria-hidden> / </span><span>{it.category}</span></nav>
      <div className="mt-4 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <div>
          <span className="text-xs font-semibold text-amber-700">{it.kind === "PRODUCT" ? "Product" : "Service"}  |  {it.category}</span>
          <h1 className="mt-1 text-4xl">{it.title}</h1>
          <p className="mt-3 max-w-prose text-lg text-steel">{it.summary}</p>
          <div className="mt-6"><ItemVisual category={it.category} image={imageAvailable(it.imagePath)} title={it.title} size="hero" /></div>
          <div className="mt-8 max-w-prose space-y-4">{it.description.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-wrap">{p}</p>)}</div>
          {highlights.length > 0 && (<section className="mt-8" aria-labelledby="inc"><h2 id="inc" className="text-xl">What is included</h2>
            <ul className="mt-3 max-w-prose space-y-2 border-t-2 border-navy pt-3">{highlights.map((h) => <li key={h} className="flex gap-3"><span aria-hidden className="mt-2 h-2 w-2 shrink-0 bg-amber" />{h}</li>)}</ul></section>)}
          {apps.length > 0 && (<section className="mt-8" aria-labelledby="app"><h2 id="app" className="text-xl">Where it is used</h2>
            <ul className="mt-3 flex max-w-prose flex-wrap gap-2">{apps.map((a) => <li key={a} className="border border-line bg-white px-3 py-1 text-sm">{a}</li>)}</ul></section>)}
        </div>

        <aside className="h-fit space-y-6 lg:sticky lg:top-6">
          {facts.length > 0 && (<section className="panel border-t-2 border-t-navy p-5" aria-labelledby="facts"><h2 id="facts" className="text-lg">Quick facts</h2>
            <dl className="mt-3 divide-y divide-line text-sm">{facts.map(([k, v]) => (<div key={k} className="py-2"><dt className="text-xs font-semibold text-steel">{k}</dt><dd>{v}</dd></div>))}</dl></section>)}
          <section className="panel border-t-2 border-t-amber p-5"><h2 className="text-lg">Need this?</h2>
            <p className="mt-1 text-sm text-steel">Tell us about your site and requirement. You will get a reference number by email, and our team will reply.</p>
            <a href="#enquiry" className="btn btn-accent mt-4 w-full no-underline">Send an enquiry</a></section>
        </aside>
      </div>

      <section id="enquiry" aria-labelledby="enq" className="mt-14 scroll-mt-6 border-t-2 border-navy pt-8">
        <h2 id="enq" className="text-2xl">Send an enquiry about {it.title}</h2>
        <p className="mt-2 max-w-prose text-steel">Your message is sent to our team together with the name of this {it.kind === "PRODUCT" ? "product" : "service"}, so you do not need to repeat it.</p>
        <div className="mt-6 max-w-2xl"><EnquiryForm defaultCategory="QUOTATION" itemSlug={it.slug} itemTitle={it.title} /></div>
      </section>

      {related.length > 0 && (<section className="mt-14" aria-labelledby="rel"><h2 id="rel" className="text-xl">More in {it.category}</h2>
        <ul className="mt-3 grid gap-px border border-line bg-line sm:grid-cols-3">{related.map((r) => (<li key={r.id} className="bg-white p-4"><Link href={`/products/${r.slug}`} className="font-semibold no-underline hover:underline">{r.title}</Link><p className="mt-1 text-sm text-steel">{r.summary}</p></li>))}</ul></section>)}
    </div>
  );
}
