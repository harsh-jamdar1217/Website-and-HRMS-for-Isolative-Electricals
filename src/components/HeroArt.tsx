/**
 * Decorative backdrop: a line of lattice transmission towers with conductors, and a bright pulse
 * travelling along each conductor. Pure SVG, drawn from code, no image file and no third-party art.
 */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Arm = { y: number; l: number; r: number };
function tower(x: number, base: number, h: number, w: number): { d: string; arms: Arm[] } {
  const top = base - h;
  const waist = base - h * 0.78;
  const hwBase = w / 2, hwWaist = w * 0.09;
  const half = (y: number) => (y >= waist ? lerp(hwWaist, hwBase, (y - waist) / (base - waist)) : lerp(w * 0.02, hwWaist, (y - top) / (waist - top)));

  let d = `M${x - hwBase} ${base} L${x - hwWaist} ${waist} L${x} ${top} L${x + hwWaist} ${waist} L${x + hwBase} ${base}`;
  const brace = (from: number, to: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const y1 = lerp(from, to, k / n), y2 = lerp(from, to, (k + 1) / n);
      const a = half(y1), b = half(y2);
      d += ` M${x - a} ${y1} L${x + b} ${y2} M${x + a} ${y1} L${x - b} ${y2} M${x - b} ${y2} H${x + b}`;
    }
  };
  brace(base, waist, 5);
  brace(waist, top + h * 0.06, 4);

  const arms: Arm[] = [];
  const drop = h * 0.04;
  [[0.68, 0.95], [0.8, 0.78], [0.92, 0.55]].forEach(([f, k]) => {
    const y = base - h * f, aw = w * k;
    d += ` M${x - aw} ${y} H${x + aw} M${x - aw} ${y} v${drop} M${x + aw} ${y} v${drop}`;
    arms.push({ y: y + drop, l: x - aw, r: x + aw });
  });
  return { d, arms };
}

function wires(a: { arms: Arm[] }, b: { arms: Arm[] }) {
  return a.arms.map((arm, i) => {
    const x1 = arm.r, y1 = arm.y, x2 = b.arms[i].l, y2 = b.arms[i].y;
    const sag = (x2 - x1) * 0.1;
    return `M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.max(y1, y2) + sag} ${x2} ${y2}`;
  });
}

const FRONT = [180, 640, 1100, 1560].map((x) => tower(x, 770, 580, 210));
const BACK = [410, 870, 1330].map((x) => tower(x, 650, 300, 112));

export function HeroArt({ faint = false }: { faint?: boolean }) {
  const frontWires = FRONT.slice(0, -1).flatMap((t, i) => wires(t, FRONT[i + 1]));
  const backWires = BACK.slice(0, -1).flatMap((t, i) => wires(t, BACK[i + 1]));
  return (
    <svg viewBox="0 0 1440 720" preserveAspectRatio="xMidYMax slice" aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${faint ? "opacity-45" : ""}`}>
      <g fill="none" strokeLinejoin="round" strokeLinecap="round">
        <g stroke="#fff" strokeOpacity=".07" strokeWidth="1.3">
          {BACK.map((t, i) => <path key={i} d={t.d} />)}
          {backWires.map((d, i) => <path key={i} d={d} />)}
        </g>
        <g stroke="#fff" strokeOpacity=".16" strokeWidth="1.7">
          {FRONT.map((t, i) => <path key={i} d={t.d} />)}
          {frontWires.map((d, i) => <path key={i} d={d} />)}
        </g>
        <g stroke="#6FD3FF" strokeWidth="2.4">
          {frontWires.map((d, i) => <path key={i} d={d} className="flow" style={{ animationDelay: `${(i % 3) * 0.9 + Math.floor(i / 3) * 0.4}s` }} />)}
        </g>
      </g>
    </svg>
  );
}
