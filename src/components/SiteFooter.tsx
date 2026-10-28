import Link from "next/link";
import { company } from "@/content/company";

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-navy text-white">
      <div className="wrap grid gap-8 py-10 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="text-lg font-bold">{company.legalName}</p>
          <p className="mt-2 max-w-md text-sm text-white/80">Registered office: {company.registeredAddress}</p>
          <p className="mt-1 text-sm text-white/60">CIN {company.cin}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-amber">Pages</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {[["/about", "About"], ["/products", "Products and services"], ["/careers", "Careers"], ["/contact", "Contact"], ["/enquiry", "Send an enquiry"]].map(([h, l]) => (
              <li key={h}><Link href={h} className="text-white no-underline hover:underline">{l}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-amber">Reach us</p>
          <p className="mt-2 text-sm"><a className="text-white" href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a></p>
          <p className="mt-1 text-sm">{company.contactPhone}</p>
        </div>
      </div>
      <div className="border-t border-white/15 py-4 text-center text-xs text-white/60">© {new Date().getFullYear()} {company.legalName}</div>
    </footer>
  );
}
