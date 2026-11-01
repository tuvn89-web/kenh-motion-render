// Core math, noise and the hand-drawn brush. Pure functions, no React.
export type Pt = [number, number];

export const CLOCK = {T: 0, boil: 0}; // set once per frame by <Episode>

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const seg = (t: number, a: number, b: number) =>
  b > a ? clamp((t - a) / (b - a)) : t >= b ? 1 : 0;
export const smooth = (t: number) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
export const eout = (t: number) => 1 - (1 - clamp(t)) ** 3;
export const back = (t: number, c = 1.9) => {
  t = clamp(t);
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const nz = (k: number) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};
const f1 = (n: number) => Math.round(n * 10) / 10;

export const circ = (cx: number, cy: number, r: number, o: {ry?: number; turn?: number; start?: number; n?: number} = {}): Pt[] => {
  const {ry = r, turn = 1.07, start = -1.9, n = 30} = o;
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = start + (turn * 2 * Math.PI * i) / n;
    out.push([cx + r * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
};

export type BrushOpts = {prog?: number; w?: number; seed?: number; amp?: number; taper?: number; boil?: boolean};

/** Pressure-sensitive hand-drawn stroke. Returns path strings: [body, cap1, cap2]. */
export function brushPaths(pts: Pt[], o: BrushOpts = {}): string[] {
  const {prog = 1, w = 7, seed = 0, amp = 1.3, taper = 0.18, boil = true} = o;
  if (prog <= 0 || pts.length < 2) return [];
  const dense: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 9));
    for (let j = 0; j < n; j++) {
      const u = j / n;
      dense.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * u]);
    }
  }
  dense.push(pts[pts.length - 1]);
  const base = seed * 7919 + (boil ? CLOCK.boil : 0) * 104729;
  const jp: Pt[] = dense.map(([x, y], i) => {
    const k0 = Math.floor(i / 3);
    const f = (i % 3) / 3;
    const dx = lerp(nz(base + k0 * 31), nz(base + (k0 + 1) * 31), f) * amp;
    const dy = lerp(nz(base + k0 * 31 + 17), nz(base + (k0 + 1) * 31 + 17), f) * amp;
    return [x + dx, y + dy];
  });
  const cum = [0];
  for (let i = 1; i < jp.length; i++) cum.push(cum[i - 1] + Math.hypot(jp[i][0] - jp[i - 1][0], jp[i][1] - jp[i - 1][1]));
  const L = cum[cum.length - 1];
  if (L < 0.5) return [];
  const tgt = L * clamp(prog);
  const P: Pt[] = [jp[0]];
  const U = [0];
  for (let i = 1; i < jp.length; i++) {
    if (cum[i] <= tgt) {
      P.push(jp[i]);
      U.push(cum[i]);
    } else {
      const fr = (tgt - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      P.push([lerp(jp[i - 1][0], jp[i][0], fr), lerp(jp[i - 1][1], jp[i][1], fr)]);
      U.push(tgt);
      break;
    }
  }
  if (P.length < 2) return [];
  const n = P.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const radii: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const nx = -ty / l;
    const ny = tx / l;
    const u = U[i] / L;
    let pr = taper ? Math.min(1, u / taper, (1 - u) / taper) : 1;
    pr = (0.32 + 0.68 * Math.max(0, pr) ** 0.7) * (1 + 0.09 * nz(seed * 131 + i * 7));
    const hw = (w * pr) / 2;
    radii.push(hw);
    left.push([P[i][0] + nx * hw, P[i][1] + ny * hw]);
    right.push([P[i][0] - nx * hw, P[i][1] - ny * hw]);
  }
  const body =
    'M' + left.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L') + 'L' +
    right.reverse().map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L') + 'Z';
  const cap = (p: Pt, r: number) =>
    `M${f1(p[0] - r)} ${f1(p[1])}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`;
  return [body, cap(P[0], radii[0]), cap(P[n - 1], radii[n - 1])];
}

export const polyD = (pts: Pt[], dx = 0, dy = 0) =>
  'M' + pts.map((p) => `${f1(p[0] + dx)} ${f1(p[1] + dy)}`).join('L') + 'Z';

/** Organic blob outline used for watercolor washes. */
export const blobD = (cx: number, cy: number, rx: number, ry: number, seed: number, layer: number, s: number) => {
  const ph = [0, 1, 2].map((k) => nz(seed * 97 + layer * 13 + k) * 3);
  const pts: Pt[] = [];
  for (let i = 0; i < 56; i++) {
    const a = (2 * Math.PI * i) / 56;
    const r = (1 + 0.06 * Math.sin(3 * a + ph[0]) + 0.045 * Math.sin(5 * a + ph[1]) + 0.025 * Math.sin(11 * a + ph[2])) * (1 - 0.06 * layer);
    pts.push([cx + rx * r * s * Math.cos(a), cy + ry * r * s * Math.sin(a)]);
  }
  return polyD(pts);
};

export const blinking = (seed: number) => (CLOCK.T + seed * 0.71) % 3.3 < 0.11;

/** Time expressions used in episode.json: 3.2 | "leave" | "leave+1.5" | "leave-0.4" */
export type TimeExpr = number | string;
export const resolveTime = (v: TimeExpr, beats: Record<string, number>): number => {
  if (typeof v === 'number') return v;
  const m = v.match(/^\s*([A-Za-z_][\w]*)\s*(([+-])\s*([\d.]+))?\s*$/);
  if (!m) return Number(v) || 0;
  const base = beats[m[1]] ?? 0;
  return m[2] ? base + (m[3] === '+' ? 1 : -1) * Number(m[4]) : base;
};
