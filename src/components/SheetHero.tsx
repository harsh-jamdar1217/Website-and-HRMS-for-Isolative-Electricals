import { company } from "@/content/company";

/**
 * The memorable element: the hero is an engineering drawing sheet, with a single-line diagram
 * (supply -> isolator -> breaker -> busbar -> feeders) and a title block. Purely decorative SVG;
 * the facts in the title block come only from verified company data.
 */
export function SheetHero() {
  return (
    <div className="relative border-2 border-navy bg-white p-2 sm:p-3">
      <div className="relative border border-navy/60">
        {/* corner zone ticks, as on a drawing frame */}
        <svg viewBox="0 0 900 360" role="img" aria-label="Single-line electrical diagram: incoming supply, isolator, circuit breaker, busbar and three outgoing feeders" className="block h-auto w-full">
          <g fill="none" stroke="#12324A" strokeWidth="2" strokeLinecap="square">
            {/* incoming supply */}
            <path d="M60 40 V120" />
            <path d="M44 40 h32 M50 32 h20 M56 24 h8" strokeWidth="2" />
            {/* isolator (open blade symbol) */}
            <path d="M60 120 V140" /><circle cx="60" cy="146" r="4" fill="#fff" />
            <path d="M60 150 L78 176" /><circle cx="60" cy="182" r="4" fill="#fff" />
            <path d="M60 186 V214" />
            {/* breaker (box) */}
            <rect x="48" y="214" width="24" height="24" fill="#fff" /><path d="M48 214 L72 238 M72 214 L48 238" strokeWidth="1.5" />
            <path d="M60 238 V270" />
            {/* transformer */}
            <circle cx="60" cy="282" r="14" fill="#fff" /><circle cx="60" cy="298" r="14" fill="#fff" />
            <path d="M60 312 V326" />
          </g>
          {/* the one highlighted conductor path: energised busbar */}
          <path d="M60 326 H840" stroke="#E3A008" strokeWidth="6" fill="none" strokeLinecap="square" />
          <g fill="none" stroke="#12324A" strokeWidth="2" strokeLinecap="square">
            {[240, 460, 680].map((x) => (
              <g key={x}>
                <path d={`M${x} 326 V290`} />
                <rect x={x - 12} y="258" width="24" height="32" fill="#fff" />
                <path d={`M${x} 258 V210`} />
                <circle cx={x} cy="196" r="14" fill="#fff" />
                <path d={`M${x - 8} 196 q4 -8 8 0 t8 0`} strokeWidth="1.5" />
              </g>
            ))}
          </g>
          <g fill="#52606D" fontSize="11" fontFamily="ui-monospace, Menlo, Consolas, monospace">
            <text x="86" y="62">INCOMING SUPPLY</text>
            <text x="86" y="170">ISOLATOR</text>
            <text x="86" y="232">BREAKER</text>
            <text x="86" y="294">TRANSFORMER</text>
            <text x="190" y="170">FEEDER 1</text>
            <text x="410" y="170">FEEDER 2</text>
            <text x="630" y="170">FEEDER 3</text>
            <text x="700" y="346">BUSBAR</text>
          </g>
        </svg>

        {/* title block */}
        <div className="grid grid-cols-2 border-t border-navy/60 text-sm sm:grid-cols-[2fr_1fr_1fr]">
          <div className="col-span-2 border-b border-navy/30 p-3 sm:col-span-1 sm:border-b-0 sm:border-r">
            <p className="text-xs text-steel">Company</p>
            <p className="font-semibold text-navy">{company.legalName}</p>
          </div>
          <div className="border-r border-navy/30 p-3">
            <p className="text-xs text-steel">Location</p>
            <p className="font-semibold text-navy">Khandala, Satara</p>
          </div>
          <div className="p-3">
            <p className="text-xs text-steel">Incorporated</p>
            <p className="font-semibold text-navy">{company.incorporationYear}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
