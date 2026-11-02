"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Navigation link for the dark public header. (The shared NavLink in ui.tsx is light-themed and used by the admin portal, so it stays untouched.) */
export function SiteNavLink({ href, children, exact = false, className = "" }: { href: string; children: React.ReactNode; exact?: boolean; className?: string }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`${className} ${active ? "border-amber text-white" : "border-transparent text-white/75 hover:text-white"}`}>
      {children}
    </Link>
  );
}
