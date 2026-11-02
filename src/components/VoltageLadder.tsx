/**
 * The voltage levels the company states for its switchyard work (docs/content-review.md, item 1):
 * erection, testing and commissioning at 11, 22, 33, 66 and 132 kV. Nothing else is claimed per level.
 */
const LEVELS = [11, 22, 33, 66, 132];

export function VoltageLadder() {
  return (
    <div className="relative overflow-hidden rounded-[4px] border border-white/15 bg-gradient-to-br from-navy to-night shadow-deep">
      <div className="circuit-dark absolute inset-0 opacity-50" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber via-amber/60 to-transparent" aria-hidden />
      <div className="relative grid gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_1.35fr] lg:items-center lg:gap-12">
        <div>
          <h2 className="text-balance text-3xl text-white sm:text-4xl">Switchyards from 11 kV to 132 kV</h2>
          <p className="mt-3 max-w-sm text-white/70">Erection, testing and commissioning of high-voltage and extra-high-voltage switchyards and transmission lines.</p>
        </div>

        <div>
          <ol className="relative grid grid-cols-5" aria-label="Voltage levels">
            <span className="absolute left-[10%] right-[10%] top-[13px] h-[4px] rounded-full bg-amber/90 shadow-[0_0_18px_rgba(240,176,28,.55)]" aria-hidden />
            <span className="energy-bar absolute left-[10%] right-[10%] top-[13px] h-[4px] rounded-full" aria-hidden />
            {LEVELS.map((kv) => (
              <li key={kv} className="relative text-center">
                <span className="relative mx-auto block h-[30px] w-[30px] rounded-full border-[3px] border-amber bg-night shadow-[0_0_0_6px_rgba(240,176,28,.14)]">
                  <span className="absolute inset-[6px] rounded-full bg-amber" />
                </span>
                <p className="mt-4 font-display text-4xl font-bold leading-none text-white sm:text-5xl">{kv}</p>
                <p className="mt-1 text-xs text-white/60">kV</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
