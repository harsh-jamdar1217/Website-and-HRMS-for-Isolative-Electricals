"use client";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import Link from "next/link";

export function SubmitButton({ children, pending: pendingLabel = "Working...", className = "btn btn-primary" }: { children: React.ReactNode; pending?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function NavLink({ href, children, exact = false, className = "" }: { href: string; children: React.ReactNode; exact?: boolean; className?: string }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`${className} ${active ? "border-amber text-navy font-semibold" : "border-transparent text-steel hover:text-navy"}`}>
      {children}
    </Link>
  );
}

export function Field({ id, label, error, hint, optional, children }: { id: string; label: string; error?: string; hint?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {optional && <span className="ml-1.5 font-normal text-steel">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="err">{error}</p>}
    </div>
  );
}
