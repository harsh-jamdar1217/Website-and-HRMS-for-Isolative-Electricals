import { CATEGORY_ORDER } from "@/content/catalogue-seed";

/** Simple drawn icons (one per category) used when an item has no photo. Decorative only. */
export function CatalogueGlyph({ category, className = "h-16 w-16" }: { category: string; className?: string }) {
  const i = Math.max(0, (CATEGORY_ORDER as readonly string[]).indexOf(category));
  const s = { fill: "none", stroke: "#12324A", strokeWidth: 2.5, strokeLinecap: "square" as const };
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      {i === 0 && <g {...s}><path d="M32 6 L20 58 M32 6 L44 58 M24 22 H40 M22 36 H42 M8 18 H56" /><path d="M8 18 V26 M56 18 V26" stroke="#E3A008" /></g>}
      {i === 1 && <g {...s}><circle cx="24" cy="24" r="11" /><circle cx="24" cy="40" r="11" /><path d="M46 12 V52 M40 18 H52 M40 46 H52" stroke="#E3A008" /></g>}
      {i === 2 && <g {...s}><path d="M8 44 A24 24 0 0 1 56 44" /><path d="M32 44 L44 24" stroke="#E3A008" /><circle cx="32" cy="44" r="3" /><path d="M14 52 H50" /></g>}
      {i === 3 && <g {...s}><rect x="10" y="14" width="44" height="36" /><path d="M10 26 H54 M22 14 V50 M34 34 H46 M34 42 H42" /><path d="M46 8 L54 16" stroke="#E3A008" /></g>}
      {i === 4 && <g {...s}><path d="M12 32 A20 20 0 0 1 48 20 M52 32 A20 20 0 0 1 16 44" /><path d="M44 12 L50 20 L40 22 M20 52 L14 44 L24 42" stroke="#E3A008" /></g>}
      {i >= 5 && <g {...s}><path d="M8 32 C16 16 24 48 32 32 C40 16 48 48 56 32" /><circle cx="32" cy="32" r="22" stroke="#E3A008" /></g>}
    </svg>
  );
}

export function ItemVisual({ category, image, title, size = "card" }: { category: string; image: string | null; title: string; size?: "card" | "hero" }) {
  const box = size === "hero" ? "aspect-[16/9] w-full" : "aspect-[16/10] w-full";
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={title} loading="lazy" className={`${box} border border-line object-cover`} />
  ) : (
    <div className={`${box} grid place-items-center border border-line bg-sheet`}><CatalogueGlyph category={category} className={size === "hero" ? "h-24 w-24" : "h-14 w-14"} /></div>
  );
}
