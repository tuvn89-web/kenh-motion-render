// A procedural "painter": thousands of soft, oriented brush dabs on a canvas, deterministic per seed.
// Paints once per layer (cached as an image) — the animation then moves the painted layers.
export type Ctx = CanvasRenderingContext2D;
export type RGB = [number, number, number];

export const rng = (seed: number) => {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
};
export const hex = (h: string): RGB => {
  const v = h.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
export const mixC = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const jitterC = (c: RGB, r: () => number, amt = 14): RGB => [c[0] + (r() - 0.5) * amt, c[1] + (r() - 0.5) * amt, c[2] + (r() - 0.5) * amt];
/** multi-stop colour ramp, t in 0..1 */
export const ramp = (stops: [number, string][], t: number): RGB => {
  if (t <= stops[0][0]) return hex(stops[0][1]);
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (t <= b) return mixC(hex(ca), hex(cb), (t - a) / (b - a));
  }
  return hex(stops[stops.length - 1][1]);
};
export const noise2 = (x: number, y: number, seed = 0) => {
  const n = (ix: number, iy: number) => {
    const v = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  return (n(ix, iy) * (1 - u) + n(ix + 1, iy) * u) * (1 - v) + (n(ix, iy + 1) * (1 - u) + n(ix + 1, iy + 1) * u) * v;
};
export const fbm = (x: number, y: number, seed = 0, oct = 4) => {
  let a = 0.5;
  let f = 1;
  let s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f, y * f, seed + i * 13);
    a *= 0.5;
    f *= 2.03;
  }
  return s;
};

/** one soft, slightly ragged oval dab */
export const dab = (ctx: Ctx, x: number, y: number, w: number, h: number, ang: number, c: RGB, a: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
  g.addColorStop(0, rgba(c, a));
  g.addColorStop(0.55, rgba(c, a * 0.85));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.scale(1, h / w);
  ctx.beginPath();
  ctx.arc(0, 0, w, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};
/** a short tapered stroke (for grass, reeds, planks, hatching) */
export const stroke = (ctx: Ctx, x: number, y: number, len: number, ang: number, wid: number, c: RGB, a: number, bend = 0) => {
  const ex = x + Math.cos(ang) * len;
  const ey = y + Math.sin(ang) * len;
  const mx = (x + ex) / 2 - Math.sin(ang) * bend;
  const my = (y + ey) / 2 + Math.cos(ang) * bend;
  ctx.strokeStyle = rgba(c, a);
  ctx.lineWidth = wid;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();
};

/** Painted sky: vertical ramp laid in with horizontal dabs + soft cloud bands. */
export const paintSky = (ctx: Ctx, W: number, H: number, stops: [number, string][], seed: number, clouds = 0.6) => {
  const r = rng(seed);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  stops.forEach(([t, c]) => g.addColorStop(t, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    const y = r() * H;
    const x = r() * W;
    const c = jitterC(ramp(stops, y / H), r, 10);
    dab(ctx, x, y, 30 + r() * 90, 6 + r() * 14, (r() - 0.5) * 0.08, c, 0.18);
  }
  // cloud bands lit from below by the sun
  for (let i = 0; i < 1400 * clouds; i++) {
    const band = Math.floor(r() * 4);
    const by = H * (0.12 + band * 0.11) + (r() - 0.5) * 40;
    const x = r() * W;
    const d = fbm(x / 260, band * 3.1, seed);
    if (d < 0.5) continue;
    const base = ramp(stops, by / H);
    const lit = mixC(base, hex('#FFE3B0'), 0.35 + r() * 0.3);
    dab(ctx, x, by + (r() - 0.5) * 30, 40 + r() * 70, 6 + r() * 10, (r() - 0.5) * 0.1, r() < 0.3 ? lit : mixC(base, hex('#B07A8E'), 0.25), 0.22);
  }
};

/** Sun disc + layered glow (paint it on the sky layer). */
export const paintSun = (ctx: Ctx, x: number, y: number, r: number, core = '#FFF4D6', glow = '#FFB15C') => {
  for (let i = 6; i >= 1; i--) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * i * 2.2);
    g.addColorStop(0, rgba(hex(glow), 0.16));
    g.addColorStop(1, rgba(hex(glow), 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * i * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

/** A ridge (hills, far shore, mud bank) filled with strokes, top edge lit by a warm rim. */
export const paintRidge = (ctx: Ctx, W: number, H: number, y0: number, amp: number, freq: number, seed: number, body: string, rim: string, haze = 0) => {
  const r = rng(seed);
  const top = (x: number) => y0 + (fbm(x * freq, 0.5, seed) - 0.5) * amp * 2;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, top(x));
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  const b = hex(body);
  for (let i = 0; i < 2200; i++) {
    const x = r() * W;
    const t = top(x);
    const y = t + r() * (H - t);
    dab(ctx, x, y, 10 + r() * 30, 4 + r() * 8, (r() - 0.5) * 0.4, jitterC(mixC(b, hex('#000000'), r() * 0.12), r, 16), 0.35);
  }
  // rim light along the top edge
  for (let x = 0; x < W; x += 3) {
    const t = top(x);
    dab(ctx, x, t + 3, 6 + r() * 6, 2 + r() * 2, 0, hex(rim), 0.5 * (0.5 + r() * 0.5));
  }
  if (haze > 0) {
    const g = ctx.createLinearGradient(0, y0 - amp, 0, H);
    g.addColorStop(0, `rgba(255,214,170,${haze})`);
    g.addColorStop(1, 'rgba(255,214,170,0)');
    ctx.fillStyle = g;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
};

/** Calm water below `horizon`: mirrored sky colours as horizontal strokes, darker toward the viewer. */
export const paintWater = (ctx: Ctx, W: number, H: number, horizon: number, skyStops: [number, string][], seed: number, sunX?: number) => {
  const r = rng(seed);
  for (let y = horizon; y < H; y += 2) {
    const t = (y - horizon) / (H - horizon);
    const mirror = ramp(skyStops, Math.max(0, 1 - t * 1.1) * 0.95);
    const c = mixC(mirror, hex('#2B3A55'), Math.min(1, t * 0.9));
    ctx.fillStyle = rgba(c, 1);
    ctx.fillRect(0, y, W, 2);
  }
  for (let i = 0; i < 3600; i++) {
    const y = horizon + Math.pow(r(), 1.4) * (H - horizon);
    const t = (y - horizon) / (H - horizon);
    const x = r() * W;
    const base = mixC(ramp(skyStops, Math.max(0, 1 - t) * 0.95), hex('#2B3A55'), Math.min(1, t * 0.9));
    dab(ctx, x, y, 20 + r() * 60 * (0.3 + t), 1.5 + t * 3, 0, jitterC(base, r, 18), 0.35);
  }
  if (sunX !== undefined) {
    // glitter path under the sun
    for (let i = 0; i < 900; i++) {
      const y = horizon + Math.pow(r(), 1.6) * (H - horizon);
      const t = (y - horizon) / (H - horizon);
      const x = sunX + (r() - 0.5) * (40 + t * 420);
      dab(ctx, x, y, 6 + r() * 26 * (0.4 + t), 1 + t * 2, 0, hex(r() < 0.5 ? '#FFE7B5' : '#FFC27A'), 0.55);
    }
  }
};

/** Reeds / grass tufts as dark tapered strokes with warm rim highlights. */
export const paintReeds = (ctx: Ctx, x0: number, x1: number, base: number, height: number, n: number, seed: number, dark = '#2E2A2B', rim = '#F2A65A') => {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0);
    const h = height * (0.4 + r() * 0.8);
    const ang = -Math.PI / 2 + (r() - 0.5) * 0.35;
    stroke(ctx, x, base + r() * 10, h, ang, 2 + r() * 3.5, jitterC(hex(dark), r, 10), 0.92, (r() - 0.5) * h * 0.25);
    if (r() < 0.35) stroke(ctx, x + 1.5, base - 2, h * 0.9, ang, 1, hex(rim), 0.45, (r() - 0.5) * h * 0.2);
    if (r() < 0.12) {
      // cattail head
      const hx = x + Math.cos(ang) * h * 0.95;
      const hy = base + Math.sin(ang) * h * 0.95;
      dab(ctx, hx, hy, 5, 14, ang + Math.PI / 2, hex('#5A3A28'), 0.95);
    }
  }
};

/** Paper / canvas tooth applied over a finished layer (multiply). */
export const paintTooth = (ctx: Ctx, W: number, H: number, seed: number, amt = 0.08) => {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 9000; i++) {
    const x = r() * W;
    const y = r() * H;
    const v = 200 + r() * 55;
    ctx.fillStyle = `rgba(${v},${v - 6},${v - 16},${amt})`;
    ctx.fillRect(x, y, 2 + r() * 5, 1 + r() * 2);
  }
  ctx.restore();
};

/** Render a painting function to a cached data URL (deterministic, so each render tab paints the same picture). */
const cache = new Map<string, string>();
export const paintToURL = (key: string, W: number, H: number, fn: (ctx: Ctx, W: number, H: number) => void) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  fn(ctx, W, H);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
};
