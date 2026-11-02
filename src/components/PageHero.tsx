import Link from "next/link";
import { HeroArt } from "./HeroArt";

/**
 * Title band for inner pages: night sheet with faint power lines, breadcrumb, headline, short lead.
 * `image` (optional) becomes a heavily blurred, tinted backdrop, which turns even a small photo into atmosphere.
 * `children` fills an optional right-hand slot (e.g. a photo).
 */
export function PageHero({ title, lead, crumbs = [], image, children }: { title: string; lead?: string; crumbs?: { href?: string; label: string }[]; image?: string | null; children?: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden bg-night text-white">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-35 blur-2xl saturate-150" />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-night via-night/85 to-night/40" aria-hidden />
      <div className="circuit-dark absolute inset-0 -z-10 opacity-70" aria-hidden />
      <div className="absolute inset-0 -z-10"><HeroArt faint /></div>
      <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-amber/20 blur-3xl" aria-hidden />

      <div className={`wrap relative grid items-center gap-8 py-14 sm:py-20 ${children ? "lg:grid-cols-[1fr_auto]" : ""}`}>
        <div>
          {crumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-5 text-sm text-white/70">
              <ol className="flex flex-wrap items-center gap-x-2">
                <li><Link href="/" className="text-white/80 no-underline hover:text-amber">Home</Link></li>
                {crumbs.map((c) => (
                  <li key={c.label} className="flex items-center gap-x-2">
                    <span aria-hidden className="text-amber">/</span>
                    {c.href ? <Link href={c.href} className="text-white/80 no-underline hover:text-amber">{c.label}</Link> : <span className="text-white" aria-current="page">{c.label}</span>}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <h1 className="rise max-w-3xl text-5xl text-white sm:text-6xl">{title}</h1>
          {lead && <p className="rise mt-5 max-w-2xl text-lg text-white/80" style={{ "--d": "0.12s" } as React.CSSProperties}>{lead}</p>}
        </div>
        {children}
      </div>
      <div className="h-1 bg-gradient-to-r from-amber via-amber to-transparent" aria-hidden />
    </section>
  );
}
