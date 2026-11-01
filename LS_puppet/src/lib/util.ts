import TL from '../timeline.json';
export const FPS = 30;
export const W = 1920, H = 1080;
export const INK = '#2a211b';

export const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;
export const easeOutBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
/** progress 0..1 between frames a and b with easing */
export const prog = (f: number, a: number, b: number, ease: (t: number) => number = easeInOut) => ease(clamp((f - a) / Math.max(1, b - a)));
export const mix = (f: number, keys: [number, number][], ease = easeInOut) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, v0] = keys[i], [f1, v1] = keys[i + 1];
    if (f <= f1) return lerp(v0, v1, ease(clamp((f - f0) / Math.max(1, f1 - f0))));
  }
  return keys[keys.length - 1][1];
};

type Line = {id: string; start: number; end: number; words: {w: string; t: number}[]};
const lines = (TL as any).lines as Line[];
export const TOTAL_FRAMES = (TL as any).frames as number;
export const line = (id: string) => lines.find((l) => l.id === id)!;
export const LS = (id: string) => Math.round(line(id).start * FPS);
export const LE = (id: string) => Math.round(line(id).end * FPS);
/** absolute frame where word starts (nth occurrence) */
export const WF = (id: string, word: string, nth = 0) => {
  const ws = line(id).words.filter((w) => w.w === word.toLowerCase());
  if (!ws.length) throw new Error('word not found ' + id + ' ' + word);
  return Math.round(ws[Math.min(nth, ws.length - 1)].t * FPS);
};

/** smooth closed/open path through points (Catmull-Rom -> Bezier) */
export const smooth = (pts: [number, number][], closed = false, k = 0.5) => {
  if (pts.length < 2) return '';
  const p = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 1; i <= n; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * k * 2, p1[1] + ((p2[1] - p0[1]) / 6) * k * 2];
    const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * k * 2, p2[1] - ((p3[1] - p1[1]) / 6) * k * 2];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return closed ? d + 'Z' : d;
};
/** value noise 1D, smooth */
export const noise1 = (seed: number) => {
  const r = rng(seed); const v = Array.from({length: 512}, () => r());
  return (x: number) => { const i = Math.floor(x), t = x - i; const a = v[((i % 512) + 512) % 512], b = v[(((i + 1) % 512) + 512) % 512]; const s = t * t * (3 - 2 * t); return a + (b - a) * s; };
};
export const ridgePoints = (seed: number, x0: number, x1: number, y: number, amp: number, freq: number, step = 40) => {
  const n = noise1(seed), n2 = noise1(seed + 99); const pts: [number, number][] = [];
  for (let x = x0; x <= x1 + 0.1; x += step) pts.push([x, y - amp * (0.7 * n(x * freq) + 0.3 * n2(x * freq * 3.1))]);
  return pts;
};
