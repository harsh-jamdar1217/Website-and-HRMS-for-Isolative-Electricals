import Link from "next/link";
import { company } from "@/content/company";

/** Logo mark: a navy tile with an amber bolt. Replace with the company's real logo file when supplied. */
export function Brand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const light = tone === "light";
  return (
    <Link href="/" className="flex items-center gap-3 no-underline" aria-label={`${company.shortName} home`}>
      <span aria-hidden className={`grid h-11 w-11 shrink-0 place-items-center rounded-[3px] ${light ? "bg-amber" : "bg-navy"}`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill={light ? "#08141F" : "#F0B01C"}><path d="M13.5 2 5 13.2h5.2L9 22l9.5-12H13z" /></svg>
      </span>
      <span className="leading-none">
        <span className={`block font-display text-[26px] font-bold ${light ? "text-white" : "text-navy"}`}>{company.shortName}</span>
        <span className={`mt-1 block text-xs ${light ? "text-white/65" : "text-steel"}`}>Private Limited, Khandala</span>
      </span>
    </Link>
  );
}
