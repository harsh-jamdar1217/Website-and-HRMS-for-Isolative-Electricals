import Link from "next/link";
import { company } from "@/content/company";
import { logoutAction } from "@/app/actions/auth";
import { NavLink } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";

export const metadata = { title: { default: "Admin portal", template: "%s | Admin portal" }, robots: { index: false, follow: false } };

const nav: { href: string; label: string; perm: Permission; exact?: boolean }[] = [
  { href: "/admin", label: "Dashboard", perm: "admin:access", exact: true },
  { href: "/admin/candidates", label: "Candidates", perm: "candidate:view" },
  { href: "/admin/employees", label: "Employees", perm: "employee:view" },
  { href: "/admin/vacancies", label: "Vacancies", perm: "vacancy:manage" },
  { href: "/admin/meetings", label: "Meetings", perm: "meeting:view" },
  { href: "/admin/enquiries", label: "Enquiries", perm: "enquiry:view" },
  { href: "/admin/clients", label: "Clients", perm: "client:view" },
  { href: "/admin/emails", label: "Email log", perm: "email:view" },
  { href: "/admin/audit", label: "Audit log", perm: "audit:view" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission("admin:access");
  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
      <aside className="bg-navy text-white md:min-h-screen">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <Link href="/admin" className="block font-bold text-white no-underline">{company.shortName}<span className="block text-xs font-normal text-white/70">Admin portal</span></Link>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-3 md:block md:space-y-1 md:pb-0">
          {nav.filter((n) => can(user.role, n.perm)).map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.exact} className="block whitespace-nowrap border-l-[3px] px-3 py-2 text-sm text-white no-underline [&[aria-current=page]]:bg-white/10 [&[aria-current=page]]:text-white hover:text-white">
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-white/15 p-4 text-sm md:absolute md:bottom-0 md:block md:w-56">
          <p className="font-semibold">{user.name}</p>
          <p className="text-xs text-white/70">{user.role === "ADMIN" ? "Administrator" : "HR"}</p>
          <form action={logoutAction} className="mt-3"><button className="btn btn-ghost btn-sm border-white/40 text-white hover:bg-white/10" type="submit">Sign out</button></form>
          <Link href="/" className="mt-3 block text-xs text-white/80">View website</Link>
        </div>
      </aside>
      <main id="main" className="min-w-0 px-5 py-7 sm:px-8">{children}</main>
    </div>
  );
}
