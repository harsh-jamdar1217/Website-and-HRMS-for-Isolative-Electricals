import Link from "next/link";
import { company } from "@/content/company";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { logoutAction } from "@/app/actions/auth";
import { NavLink } from "./ui";

const links = [
  { href: "/", label: "Home", exact: true },
  { href: "/about", label: "About" },
  { href: "/products", label: "Products and services" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-line bg-white">
      <div className="wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
        <Link href="/" className="flex items-center gap-3 no-underline" aria-label={`${company.shortName} home`}>
          <span aria-hidden className="grid h-10 w-10 place-items-center border-2 border-navy bg-navy text-lg font-bold text-amber">IE</span>
          <span className="leading-tight">
            <span className="block text-[17px] font-bold text-navy">{company.shortName}</span>
            <span className="block text-xs text-steel">Private Limited, Khandala</span>
          </span>
        </Link>
        <nav aria-label="Main" className="order-3 -mb-3 flex w-full gap-5 overflow-x-auto md:order-none md:mb-0 md:w-auto">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} exact={l.exact} className="whitespace-nowrap border-b-[3px] py-3 text-[15px] no-underline md:py-2">
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {user.role === "CANDIDATE" && <Link href="/candidate" className="text-sm font-semibold">My applications</Link>}
              {user.role === "EMPLOYEE" && <Link href="/employee" className="text-sm font-semibold">Employee portal</Link>}
              {can(user.role, "admin:access") && <Link href="/admin" className="text-sm font-semibold">Admin portal</Link>}
              <form action={logoutAction}><button className="btn btn-ghost btn-sm" type="submit">Sign out</button></form>
            </>
          ) : (
            <Link href="/login" className="text-sm font-semibold">Sign in</Link>
          )}
          <Link href="/enquiry" className="btn btn-accent btn-sm no-underline">Send an enquiry</Link>
        </div>
      </div>
    </header>
  );
}
