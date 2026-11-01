// Reusable drawing components (SVG). Every visual in the channel is built from these.
import React from 'react';
import {staticFile} from 'remotion';
import {
  BrushOpts, CLOCK, Pt, back, blinking, blobD, brushPaths, circ, clamp, eout, lerp, nz, polyD, seg,
} from '../engine/core';
import {measure} from '../engine/fonts';

export const C = {
  paper: '#F6F1E7', ink: '#232228', accent: '#E35C2B', cat: '#EFA35C', catDark: '#C9773A',
  blue: '#8FB3CC', green: '#86A86F', grey: '#A8A39C', pink: '#F2A69E', terra: '#CC7350',
};
export const setStyle = (s: Partial<typeof C>) => Object.assign(C, s);
export const FONT = 'Patrick Hand';
export const FONT2 = 'Caveat';
export const GROUND = 840;

// ---------- primitives ----------
export const Brush: React.FC<BrushOpts & {pts: Pt[]; col?: string; alpha?: number}> = ({pts, col = C.ink, alpha = 1, ...o}) => {
  const ds = brushPaths(pts, o);
  if (!ds.length) return null;
  return (
    <g fill={col} opacity={alpha}>
      {ds.map((d, i) => <path key={i} d={d} />)}
    </g>
  );
};

export const Dot: React.FC<{x: number; y: number; r: number; col?: string; alpha?: number}> = ({x, y, r, col = C.ink, alpha = 1}) =>
  r > 0 ? <circle cx={x} cy={y} r={r} fill={col} opacity={alpha} /> : null;

export const Wash: React.FC<{cx: number; cy: number; rx: number; ry: number; col: string; alpha?: number; seed?: number; prog?: number}> = ({
  cx, cy, rx, ry, col, alpha = 0.3, seed = 1, prog = 1,
}) => {
  if (prog <= 0) return null;
  const s = eout(prog);
  return (
    <g>
      {[0, 1].map((l) => (
        <path key={l} d={blobD(cx, cy, rx, ry, seed, l, s)} fill={col} fillOpacity={alpha * 0.6} stroke={col} strokeOpacity={alpha * 0.9} strokeWidth={2.2} />
      ))}
    </g>
  );
};

export const Shadow: React.FC<{x: number; y: number; rx: number; alpha?: number}> = ({x, y, rx, alpha = 0.17}) =>
  alpha > 0 ? <ellipse cx={x} cy={y} rx={rx} ry={rx * 0.16} fill="url(#shadowGrad)" opacity={alpha / 0.17} /> : null;

export const SharedDefs: React.FC = () => (
  <defs>
    <radialGradient id="shadowGrad">
      <stop offset="0" stopColor={C.ink} stopOpacity={0.17} />
      <stop offset="1" stopColor={C.ink} stopOpacity={0} />
    </radialGradient>
  </defs>
);

/** Hand-lettered text that writes on left-to-right with `prog`. */
export const HText: React.FC<{
  s: string; x: number; y: number; size: number; col?: string; prog?: number; align?: 'l' | 'c' | 'r';
  alpha?: number; outline?: string; font?: string; bold?: boolean; id: string;
}> = ({s, x, y, size, col = C.ink, prog = 1, align = 'l', alpha = 1, outline, font = FONT, bold = false, id}) => {
  if (prog <= 0) return null;
  const w = measure(s, size, font, bold);
  const x0 = align === 'c' ? x - w / 2 : align === 'r' ? x - w : x;
  const t = (
    <text x={x0} y={y} fontFamily={`"${font}"`} fontWeight={bold ? 700 : 400} fontSize={size} fill={col}
      opacity={alpha} stroke={outline} strokeWidth={outline ? size * 0.22 : 0} strokeLinejoin="round" paintOrder="stroke">
      {s}
    </text>
  );
  if (prog >= 1) return t;
  return (
    <g>
      <clipPath id={`clip-${id}`}>
        <rect x={x0 - 20} y={y - size * 1.5} width={(w + 40) * prog} height={size * 2.5} />
      </clipPath>
      <g clipPath={`url(#clip-${id})`}>{t}</g>
    </g>
  );
};

/** Pops a child in with overshoot around (x, y). */
export const Pop: React.FC<{t: number; x: number; y: number; rot?: number; children: React.ReactNode}> = ({t, x, y, rot = 0, children}) => {
  if (t <= 0) return null;
  const s = back(t);
  return <g transform={`translate(${x} ${y}) rotate(${(rot * (1 - t) * 180) / Math.PI}) scale(${s})`}>{children}</g>;
};

const Eyes: React.FC<{x: number; y: number; gap: number; r: number; seed: number; alpha?: number}> = ({x, y, gap, r, seed, alpha = 1}) => (
  <g>
    {[-1, 1].map((sx) =>
      blinking(seed) ? (
        <Brush key={sx} pts={[[x + sx * gap - r * 1.2, y], [x + sx * gap + r * 1.2, y]]} w={r * 0.9} seed={seed} amp={0.3} alpha={alpha} taper={0} />
      ) : (
        <g key={sx}>
          <Dot x={x + sx * gap} y={y} r={r} alpha={alpha} />
          <Dot x={x + sx * gap + r * 0.35} y={y - r * 0.35} r={r * 0.32} col="#fff" alpha={alpha * 0.9} />
        </g>
      ),
    )}
  </g>
);

// ---------- characters ----------
export type Pose = {lean?: number; aL?: [number, number]; aR?: [number, number]; lL?: [number, number]; lR?: [number, number]; bob?: number; drop?: number};

export const walkPose = (phase: number, amp = 1): Pose => {
  const s = Math.sin(phase);
  return {
    lL: [28 * s * amp, -12 - 16 * Math.max(0, -s) * amp], lR: [-28 * s * amp, -12 - 16 * Math.max(0, s) * amp],
    aL: [-26 * s * amp, -20], aR: [26 * s * amp, -20], bob: Math.abs(Math.cos(phase)) * 6 * amp, lean: 4 * amp,
  };
};

export const Figure: React.FC<{
  x: number; ground?: number; s?: number; face?: number; pose?: Pose; prog?: number; seed?: number; alpha?: number;
  mood?: 'smile' | 'o' | 'flat' | 'sad'; shirt?: string; talk?: number;
}> = ({x, ground = GROUND, s = 1, face = 1, pose, prog = 1, seed = 1, alpha = 1, mood = 'smile', shirt, talk = 0}) => {
  if (alpha <= 0) return null;
  const p = {lean: 0, aL: [16, -8], aR: [-12, -8], lL: [9, -2], lR: [-9, -2], bob: 0, drop: 0, ...pose} as Required<Pose>;
  const r = (d: number) => (d * Math.PI) / 180;
  const breath = Math.sin(CLOCK.T * 2.4 + seed) * 1.6 * s;
  const gy = ground - p.bob;
  const hip: Pt = [x, gy - (152 - p.drop) * s];
  const ln = r(p.lean);
  const neck: Pt = [hip[0] + Math.sin(ln) * 118 * s * face, hip[1] - Math.cos(ln) * 118 * s + breath];
  const hc: Pt = [neck[0] + Math.sin(ln) * 46 * s * face, neck[1] - 46 * s];
  const sh: Pt = [lerp(neck[0], hip[0], 0.1), lerp(neck[1], hip[1], 0.1)];
  const limb = (o: Pt, a: [number, number], l1: number, l2: number): Pt[] => {
    const a1 = r(a[0]);
    const a2 = r(a[0] + a[1]);
    const p1: Pt = [o[0] + Math.sin(a1) * l1 * face, o[1] + Math.cos(a1) * l1];
    return [o, p1, [p1[0] + Math.sin(a2) * l2 * face, p1[1] + Math.cos(a2) * l2]];
  };
  const order = ['head', 'body', 'aL', 'aR', 'lL', 'lR'];
  const pr = Object.fromEntries(order.map((k, i) => [k, clamp(prog * order.length - i)])) as Record<string, number>;
  const w = 9 * s;
  // shirt block (offset fill, printed-illustration feel)
  let shirtEl: React.ReactNode = null;
  if (pr.body > 0) {
    const sa = seg(pr.body, 0.3, 1);
    const nx = hip[0] - neck[0];
    const ny = hip[1] - neck[1];
    const L = Math.hypot(nx, ny) || 1;
    const px = (-ny / L) * 21 * s;
    const py = (nx / L) * 21 * s;
    const top: Pt = [lerp(neck[0], hip[0], 0.08), lerp(neck[1], hip[1], 0.08)];
    const bot: Pt = [lerp(neck[0], hip[0], 0.8), lerp(neck[1], hip[1], 0.8)];
    shirtEl = (
      <path d={polyD([[top[0] + px, top[1] + py], [top[0] - px, top[1] - py], [bot[0] - px * 1.1, bot[1] - py * 1.1], [bot[0] + px * 1.1, bot[1] + py * 1.1]], 5 * s, 4 * s)}
        fill={shirt ?? C.blue} opacity={0.9 * sa} />
    );
  }
  const fa = seg(prog, 0.2, 0.4);
  const ex = hc[0] + face * 15 * s;
  const sm = 12 * s;
  return (
    <g opacity={alpha}>
      <Shadow x={x} y={ground + 4} rx={70 * s} alpha={0.18 * seg(prog, 0.6, 1)} />
      <Brush pts={limb(hip, p.lR, 77 * s, 77 * s)} prog={pr.lR} w={w} seed={seed + 5} />
      <Brush pts={limb(sh, p.aR, 62 * s, 58 * s)} prog={pr.aR} w={w} seed={seed + 3} />
      {shirtEl}
      <Brush pts={[neck, hip]} prog={pr.body} w={w} seed={seed + 1} />
      <Brush pts={limb(hip, p.lL, 77 * s, 77 * s)} prog={pr.lL} w={w} seed={seed + 4} />
      <Brush pts={limb(sh, p.aL, 62 * s, 58 * s)} prog={pr.aL} w={w} seed={seed + 2} />
      {pr.head > 0 && <Dot x={hc[0] + 4 * s} y={hc[1] + 3 * s} r={42 * s} col="#FFFDF8" alpha={seg(pr.head, 0.5, 1)} />}
      <Brush pts={circ(hc[0], hc[1], 42 * s)} prog={pr.head} w={w} seed={seed} />
      {prog > 0.2 && (
        <g>
          <Eyes x={ex} y={hc[1] - 6 * s} gap={10 * s} r={5 * s} seed={seed} alpha={fa} />
          <Dot x={ex + face * 14 * s} y={hc[1] + 10 * s} r={7 * s} col={C.accent} alpha={0.28 * fa} />
          <Dot x={ex - face * 22 * s} y={hc[1] + 10 * s} r={6 * s} col={C.accent} alpha={0.2 * fa} />
          {talk > 0.06 ? (
            <ellipse cx={ex} cy={hc[1] + 15 * s} rx={8 * s} ry={(2 + 9 * talk) * s} fill={C.ink} opacity={fa} />
          ) : null}
          {talk <= 0.06 && mood === 'sad' && (
            <path d={`M${ex - 10 * s} ${hc[1] + 19 * s}Q${ex} ${hc[1] + 10 * s} ${ex + 10 * s} ${hc[1] + 19 * s}`} fill="none" stroke={C.ink} strokeWidth={4.2 * s} strokeLinecap="round" opacity={fa} />
          )}
          {talk <= 0.06 && mood === 'smile' && (
            <path d={`M${ex + sm * Math.cos(0.2 * Math.PI)} ${hc[1] + 7 * s + sm * Math.sin(0.2 * Math.PI)}A${sm} ${sm} 0 0 1 ${ex + sm * Math.cos(0.8 * Math.PI)} ${hc[1] + 7 * s + sm * Math.sin(0.8 * Math.PI)}`}
              fill="none" stroke={C.ink} strokeWidth={4.2 * s} strokeLinecap="round" opacity={fa} />
          )}
          {talk <= 0.06 && mood === 'o' && <Dot x={ex} y={hc[1] + 16 * s} r={5 * s} alpha={fa} />}
          {talk <= 0.06 && mood === 'flat' && <Brush pts={[[ex - 9 * s, hc[1] + 14 * s], [ex + 9 * s, hc[1] + 14 * s]]} w={4 * s} seed={seed + 9} taper={0} alpha={fa} />}
        </g>
      )}
    </g>
  );
};

const earPts = (hx: number, hy: number, r: number) =>
  ([[-155, -108, -130], [-72, -25, -50]] as const).map(([d0, d1, dt]) => {
    const [a0, a1, at] = [d0, d1, dt].map((d) => (d * Math.PI) / 180);
    const outer: Pt[] = [[hx + r * Math.cos(a0), hy + r * Math.sin(a0)], [hx + 1.8 * r * Math.cos(at), hy + 1.8 * r * Math.sin(at)], [hx + r * Math.cos(a1), hy + r * Math.sin(a1)]];
    const inner: Pt[] = [
      [hx + 1.05 * r * Math.cos(a0 + 0.12), hy + 1.05 * r * Math.sin(a0 + 0.12)], [hx + 1.55 * r * Math.cos(at), hy + 1.55 * r * Math.sin(at)],
      [hx + 1.05 * r * Math.cos(a1 - 0.12), hy + 1.05 * r * Math.sin(a1 - 0.12)],
    ];
    return {outer, inner};
  });

const CatHead: React.FC<{hx: number; hy: number; r: number; look: number; seed: number; prog?: number; fa?: number; w?: number}> = ({
  hx, hy, r, look, seed, prog = 1, fa = 1, w = 6.5,
}) => {
  const ears = earPts(hx, hy, r);
  const a = seg(prog, 0.4, 0.7) * fa;
  const ex = hx + look * r * 0.32;
  return (
    <g>
      {ears.map((e, k) => (
        <g key={k} opacity={fa}>
          <path d={polyD(e.outer, 3, 3)} fill={C.cat} />
          <path d={polyD(e.inner)} fill={C.pink} opacity={0.9} />
        </g>
      ))}
      <ellipse cx={hx + 3} cy={hy + 3} rx={r} ry={r * 0.95} fill={C.cat} opacity={fa} />
      {ears.map((e, k) => <Brush key={k} pts={e.outer} prog={prog} w={w} seed={seed + 40 + k} />)}
      <Brush pts={circ(hx, hy, r, {ry: r * 0.95})} prog={prog} w={w} seed={seed + 50} />
      {prog > 0.4 && (
        <g>
          <Eyes x={ex} y={hy - r * 0.08} gap={r * 0.3} r={r * 0.15} seed={seed} alpha={a} />
          <Dot x={ex + look * r * 0.05} y={hy + r * 0.25} r={r * 0.1} col={C.accent} alpha={a} />
          {[-1, 1].flatMap((sy) =>
            [-1, 1].map((k) => {
              const x0 = ex + k * r * 0.35;
              const y0 = hy + r * 0.3 + sy * 0.06 * r;
              return <Brush key={`${sy}${k}`} pts={[[x0, y0], [x0 + k * r * 0.85, y0 + sy * r * 0.12 - 2]]} w={2.3} seed={seed + 60 + k * 3 + sy} amp={0.4} alpha={a * 0.8} taper={0.3} />;
            }),
          )}
        </g>
      )}
    </g>
  );
};

export const Cat: React.FC<{
  x: number; ground?: number; s?: number; face?: number; look?: number; phase?: number; walking?: number; prog?: number;
  seed?: number; tail?: number; alpha?: number; speed?: number;
}> = ({x, ground = GROUND, s = 1, face = 1, look, phase = 0, walking = 0, prog = 1, seed = 50, tail = 0, alpha = 1, speed = 0}) => {
  if (alpha <= 0) return null;
  const lk = look ?? face;
  const bob = Math.abs(Math.sin(phase)) * 5 * walking;
  const bx = x;
  const by = ground - 62 * s - bob;
  const r = 30 * s;
  const hx = bx + face * 58 * s;
  const hy = by - 32 * s;
  const sw = Math.sin(phase) * 26 * walking;
  const legs: Pt[][] = [-32, -20, 24, 36].map((ox, i) => {
    const a = ((i % 2 === 0 ? sw : -sw) * Math.PI) / 180;
    const top: Pt = [bx + ox * s * face, by + 12 * s];
    return [top, [top[0] + Math.sin(a) * 38 * s * face, ground - 2]];
  });
  const tailPts: Pt[] = Array.from({length: 12}, (_, i) => {
    const u = i / 11;
    return [bx - face * (48 + 38 * u) * s + face * Math.sin(u * 2.4 + tail) * 16 * s * u, by - (4 + 70 * u * u) * s];
  });
  const order = ['body', 'head', 'legs', 'tail'];
  const pr = Object.fromEntries(order.map((k, i) => [k, clamp(prog * order.length - i)])) as Record<string, number>;
  const fa = seg(pr.body, 0.3, 1);
  return (
    <g opacity={alpha}>
      <Shadow x={bx} y={ground + 3} rx={75 * s} alpha={0.17 * seg(prog, 0.5, 1)} />
      {speed > 0.15 && (
        <g>
          {[0, 1, 2].map((k) => {
            const yy = by - 20 * s + k * 22 * s;
            const x0 = bx - face * (70 + 20 * k) * s;
            return <Brush key={k} pts={[[x0, yy], [x0 - face * (55 + 25 * k) * s, yy]]} w={4} seed={seed + 90 + k} alpha={0.45 * Math.min(1, speed)} taper={0.4} />;
          })}
          {[0, 1, 2].map((k) => {
            const ph = (CLOCK.T * 3 + k * 0.33) % 1;
            return <Dot key={`d${k}`} x={bx - face * (50 + ph * 70) * s} y={ground - 8 - ph * 22} r={(8 + ph * 10) * s} col={C.grey} alpha={0.35 * (1 - ph) * Math.min(1, speed)} />;
          })}
        </g>
      )}
      <Brush pts={tailPts} prog={pr.tail} w={9 * s} col={C.cat} seed={seed + 80} taper={0.5} />
      <Brush pts={tailPts} prog={pr.tail} w={4 * s} seed={seed + 81} taper={0.5} alpha={0.9} />
      {[1, 3].map((k) => <Brush key={k} pts={legs[k]} prog={pr.legs} w={7 * s} seed={seed + 20 + k} alpha={0.75} />)}
      <ellipse cx={bx + 4 * s} cy={by + 4 * s} rx={54 * s} ry={27 * s} fill={C.cat} opacity={fa} />
      {[0, 1, 2].map((k) => {
        const sx = bx - face * (18 - k * 16) * s;
        return <Brush key={k} pts={[[sx - 6 * s, by - 26 * s], [sx, by - 12 * s], [sx - 3 * s, by - 2 * s]]} prog={pr.body} w={5 * s} col={C.catDark} seed={seed + 70 + k} taper={0.5} />;
      })}
      <Brush pts={circ(bx, by, 54 * s, {ry: 27 * s, start: -2.6, n: 34})} prog={pr.body} w={7 * s} seed={seed} />
      {[0, 2].map((k) => <Brush key={k} pts={legs[k]} prog={pr.legs} w={7 * s} seed={seed + 20 + k} />)}
      {pr.head > 0 && <CatHead hx={hx} hy={hy} r={r} look={lk} seed={seed} prog={pr.head} fa={seg(pr.head, 0.3, 1)} w={7 * s} />}
    </g>
  );
};

export const MiniCatHead: React.FC<{r?: number; accent?: boolean; seed?: number}> = ({r = 16, accent = false, seed = 0}) => {
  const fill = accent ? C.accent : C.cat;
  return (
    <g>
      <ellipse cx={2} cy={2} rx={r} ry={r * 0.95} fill={fill} />
      {earPts(0, 0, r).map((e, k) => (
        <g key={k}>
          <path d={polyD(e.outer, 2, 2)} fill={fill} />
          <Brush pts={e.outer} w={3.4} seed={seed + 3 + k} amp={0.5} />
        </g>
      ))}
      <Brush pts={circ(0, 0, r, {ry: r * 0.95, n: 18})} w={3.6} seed={seed} amp={0.5} />
      <Dot x={-r * 0.33} y={-r * 0.05} r={r * 0.13} />
      <Dot x={r * 0.33} y={-r * 0.05} r={r * 0.13} />
      <Dot x={0} y={r * 0.25} r={r * 0.1} col={accent ? C.ink : C.accent} />
    </g>
  );
};

export const BabyHead: React.FC<{r?: number; seed?: number}> = ({r = 22, seed = 0}) => (
  <g>
    <Dot x={3} y={3} r={r} col="#FFEDD9" />
    <Brush pts={circ(0, 0, r, {n: 20})} w={4} seed={seed} amp={0.5} />
    <Brush pts={[[-2, -r], [4, -r - 12], [12, -r - 8], [8, -r - 2]]} w={3.4} seed={seed + 2} amp={0.4} />
    <Dot x={-r * 0.35} y={-r * 0.05} r={r * 0.11} />
    <Dot x={r * 0.35} y={-r * 0.05} r={r * 0.11} />
    <Dot x={0} y={r * 0.45} r={r * 0.16} col={C.accent} alpha={0.9} />
  </g>
);

export const Heart: React.FC<{sz?: number; col?: string}> = ({sz = 36, col = C.accent}) => (
  <g transform={`scale(${sz / 40})`}>
    <path d="M0 16C-38 -6 -20 -36 0 -18C20 -36 38 -6 0 16Z" fill={col} stroke={C.ink} strokeOpacity={0.9} strokeWidth={3} />
    <circle cx={-11} cy={-14} r={4.5} fill="#fff" opacity={0.8} />
  </g>
);

// ---------- props ----------
export const Yarn: React.FC<{x: number; ground?: number; prog?: number; seed?: number; roll?: number}> = ({x, ground = GROUND, prog = 1, seed = 300, roll = 0}) => {
  const r = 32;
  const cy = ground - r;
  const s = eout(prog);
  return (
    <g>
      <Shadow x={x} y={ground + 3} rx={40} alpha={0.15 * prog} />
      {s > 0 && <circle cx={x + 3} cy={cy + 3} r={r * s} fill={C.accent} opacity={0.85} />}
      <Brush pts={circ(x, cy, r)} prog={prog} w={6} seed={seed} />
      {[0, 1, 2].map((k) => {
        const a = roll + k * 1.05;
        const pts: Pt[] = Array.from({length: 6}, (_, i) => [x + r * 0.85 * Math.cos(a + i * 0.32), cy + r * 0.85 * Math.sin(a + i * 0.32)]);
        return <Brush key={k} pts={pts} prog={clamp(prog * 1.3 - 0.3)} w={3.5} col="#99331A" seed={seed + k + 1} taper={0.4} />;
      })}
      <Brush pts={[[x + r * 0.8, ground - 6], [x + 60, ground - 2], [x + 100, ground - 7], [x + 130, ground - 3]]} prog={clamp(prog * 2 - 1)} w={4} col={C.accent} seed={seed + 9} taper={0.4} />
    </g>
  );
};

export const Door: React.FC<{x0: number; ground?: number; opn?: number; prog?: number; seed?: number}> = ({x0, ground = GROUND, opn = 0, prog = 1, seed = 400}) => {
  const w = 175;
  const h = 350;
  const top = ground - h;
  const frame = <Brush pts={[[x0 - 12, ground], [x0 - 12, top - 12], [x0 + w + 12, top - 12], [x0 + w + 12, ground]]} prog={prog} w={9} seed={seed} taper={0.05} />;
  if (prog < 1) return frame;
  const xr = x0 + w * (1 - 0.78 * opn);
  const sk = 28 * opn;
  const panel: Pt[] = [[x0, top], [xr, top - sk], [xr, ground + sk * 0.3], [x0, ground]];
  return (
    <g>
      {frame}
      {opn > 0 && (
        <g>
          <rect x={x0} y={top} width={w} height={h} fill={C.ink} opacity={0.82 * Math.min(1, opn * 3)} />
          <linearGradient id={`doorlight${seed}`} x1="0" x2="1">
            <stop offset="0" stopColor="#FFE6B3" stopOpacity={0} />
            <stop offset="1" stopColor="#FFD999" stopOpacity={0.25 * opn} />
          </linearGradient>
          <rect x={x0} y={top} width={w} height={h} fill={`url(#doorlight${seed})`} />
        </g>
      )}
      <path d={polyD(panel)} fill="#EDDBBF" />
      <path d={polyD(panel)} fill={C.catDark} opacity={0.12} />
      {[0.12, 0.55].map((fy, k) => {
        const fx0 = lerp(x0, xr, 0.18);
        const fx1 = lerp(x0, xr, 0.82);
        const y0 = lerp(top, ground, fy);
        const y1 = lerp(top, ground, fy + 0.32);
        return <Brush key={k} pts={[[fx0, y0], [fx1, y0 - sk * 0.5], [fx1, y1 - sk * 0.2], [fx0, y1], [fx0, y0]]} w={3.5} seed={seed + 7 + k} alpha={0.6} taper={0.05} />;
      })}
      <Brush pts={[...panel, panel[0]]} w={8} seed={seed + 1} taper={0.04} />
      <Dot x={lerp(x0, xr, 0.85)} y={ground - h * 0.48} r={9} col={C.accent} />
    </g>
  );
};

export const Window: React.FC<{x: number; y: number; w: number; h: number; prog?: number; seed?: number}> = ({x, y, w, h, prog = 1, seed = 700}) => {
  if (prog <= 0) return null;
  const a = seg(prog, 0.5, 1);
  return (
    <g>
      <rect x={x + 5} y={y + 5} width={w} height={h} fill={C.blue} opacity={0.45 * a} />
      <Wash cx={x + w * 0.7} cy={y + h * 0.3} rx={w * 0.25} ry={h * 0.12} col="#FFFFFF" alpha={0.7 * a} seed={seed} />
      <Dot x={x + w * 0.25} y={y + h * 0.28} r={22} col="#FFD973" alpha={0.9 * a} />
      <Brush pts={[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]} prog={prog} w={8} seed={seed} taper={0.05} />
      <Brush pts={[[x + w / 2, y], [x + w / 2, y + h]]} prog={seg(prog, 0.4, 1)} w={6} seed={seed + 1} />
      <Brush pts={[[x, y + h / 2], [x + w, y + h / 2]]} prog={seg(prog, 0.5, 1)} w={6} seed={seed + 2} />
      {[-1, 1].map((side) => {
        const cx = side < 0 ? x - 18 : x + w + 18;
        const pts: Pt[] = [[cx, y - 20], [cx - side * 30, y + h * 0.5], [cx - side * 8, y + h + 30], [cx + side * 22, y + h + 30], [cx + side * 26, y - 20]];
        return (
          <g key={side}>
            <path d={polyD(pts, 4, 4)} fill={C.green} opacity={0.75 * a} />
            <Brush pts={[...pts, pts[0]]} prog={seg(prog, 0.6, 1)} w={4.5} seed={seed + 5 + side} taper={0.05} />
          </g>
        );
      })}
      <Brush pts={[[x - 60, y - 22], [x + w + 60, y - 22]]} prog={prog} w={7} seed={seed + 9} />
    </g>
  );
};

export const Picture: React.FC<{x: number; y: number; w: number; h: number; prog?: number; seed?: number}> = ({x, y, w, h, prog = 1, seed = 720}) => {
  if (prog <= 0) return null;
  const a = seg(prog, 0.5, 1);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#FFF8E6" opacity={a} />
      <path d={polyD([[x + 10, y + h - 10], [x + w * 0.4, y + h * 0.35], [x + w * 0.6, y + h * 0.6], [x + w * 0.75, y + h * 0.45], [x + w - 10, y + h - 10]])} fill={C.green} opacity={0.8 * a} />
      <Dot x={x + w * 0.75} y={y + h * 0.25} r={12} col={C.accent} alpha={0.8 * a} />
      <Brush pts={[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]} prog={prog} w={7} seed={seed} taper={0.05} />
      <Brush pts={[[x + w * 0.2, y], [x + w / 2, y - 45], [x + w * 0.8, y]]} prog={seg(prog, 0.6, 1)} w={3} seed={seed + 1} alpha={0.7} />
    </g>
  );
};

export const Plant: React.FC<{x: number; ground?: number; prog?: number; seed?: number; sway?: number}> = ({x, ground = GROUND, prog = 1, seed = 740, sway = 0}) => {
  if (prog <= 0) return null;
  const a = seg(prog, 0.4, 1);
  const leaves = [[-50, 120, -0.9], [-20, 160, -0.35], [15, 170, 0.15], [45, 135, 0.7], [-5, 110, 0]];
  const pot: Pt[] = [[x - 42, ground - 78], [x + 42, ground - 78], [x + 32, ground], [x - 32, ground]];
  return (
    <g>
      <Shadow x={x} y={ground + 3} rx={55} alpha={0.15 * a} />
      {leaves.map(([, lh, ang], i) => {
        const sc = eout(seg(prog, 0.3 + i * 0.1, 0.7 + i * 0.06));
        if (sc <= 0) return null;
        const rot = ((ang * 0.6 + Math.sin(sway + i) * 0.04) * 180) / Math.PI;
        const pts: Pt[] = [[0, 0], [-18, -lh * 0.45], [0, -lh], [18, -lh * 0.45], [0, 0]];
        return (
          <g key={i} transform={`translate(${x} ${ground - 70}) rotate(${rot}) scale(${sc})`}>
            <path d={polyD(pts, 3, 3)} fill={C.green} opacity={0.9} />
            <Brush pts={pts} w={4} seed={seed + i} taper={0.2} />
            <Brush pts={[[0, -6], [0, -lh * 0.85]]} w={2.5} seed={seed + 10 + i} alpha={0.6} />
          </g>
        );
      })}
      <path d={polyD(pot, 4, 3)} fill={C.terra} opacity={a} />
      <Brush pts={[...pot, pot[0]]} prog={prog} w={7} seed={seed + 20} taper={0.05} />
      <Brush pts={[[x - 48, ground - 78], [x + 48, ground - 78]]} prog={prog} w={8} seed={seed + 21} />
    </g>
  );
};

export const Rug: React.FC<{cx: number; ground?: number; rx: number; prog?: number}> = ({cx, ground = GROUND, rx, prog = 1}) => {
  if (prog <= 0) return null;
  const s = eout(prog);
  return (
    <g>
      <ellipse cx={cx} cy={ground + 16} rx={rx * s} ry={26 * s} fill={C.accent} opacity={0.16} />
      <ellipse cx={cx} cy={ground + 16} rx={rx * s * 0.9} ry={20 * s} fill="none" stroke={C.accent} strokeOpacity={0.45 * s} strokeWidth={3} strokeDasharray="14 12" />
    </g>
  );
};

export const Room: React.FC<{prog?: number; t?: number}> = ({prog = 1, t = 0}) => {
  const a = seg(prog, 0, 0.4);
  return (
    <g>
      <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.catDark} stopOpacity={0.16 * a} />
        <stop offset="1" stopColor={C.catDark} stopOpacity={0.04 * a} />
      </linearGradient>
      <rect x={-400} y={GROUND} width={2720} height={500} fill="url(#floorGrad)" />
      <Brush pts={[[-300, GROUND], [2200, GROUND]]} prog={eout(seg(prog, 0, 0.35))} w={8} seed={900} taper={0.02} />
      <Window x={175} y={300} w={250} h={210} prog={seg(prog, 0.15, 0.55)} />
      <Picture x={1175} y={380} w={170} h={125} prog={seg(prog, 0.3, 0.7)} />
      <Plant x={1440} prog={seg(prog, 0.45, 0.9)} sway={t * 1.3} />
      <Rug cx={720} rx={360} prog={seg(prog, 0.2, 0.6)} />
    </g>
  );
};

export const Clock: React.FC<{x: number; y: number; prog?: number; hand?: number; seed?: number}> = ({x, y, prog = 1, hand = 0, seed = 500}) => {
  const a = -Math.PI / 2 + hand * 2 * Math.PI;
  const R = 46;
  const wedge =
    hand > 0
      ? `M${x} ${y}L${x} ${y - R}A${R} ${R} 0 ${hand > 0.5 ? 1 : 0} 1 ${x + R * Math.cos(a)} ${y + R * Math.sin(a)}Z`
      : '';
  return (
    <g>
      <Dot x={x + 5} y={y + 5} r={62 * eout(prog)} col="#FFFBF0" />
      <Brush pts={circ(x, y, 62)} prog={prog} w={8} seed={seed} />
      {prog >= 0.6 && (
        <g>
          {Array.from({length: 12}, (_, i) => {
            const b = (i * Math.PI) / 6;
            return <Brush key={i} pts={[[x + 48 * Math.cos(b), y + 48 * Math.sin(b)], [x + 55 * Math.cos(b), y + 55 * Math.sin(b)]]} w={4} seed={seed + i} taper={0} />;
          })}
          {hand > 0 && hand < 1 && <path d={wedge} fill={C.accent} opacity={0.32} />}
          {hand >= 1 && <circle cx={x} cy={y} r={R} fill={C.accent} opacity={0.32} />}
          <Brush pts={[[x, y], [x + 42 * Math.cos(a), y + 42 * Math.sin(a)]]} w={7} col={C.accent} seed={seed + 20} taper={0.3} />
          <Dot x={x} y={y} r={7} />
        </g>
      )}
    </g>
  );
};

export const HatchBar: React.FC<{x: number; w: number; h: number; col: string; seed: number; id: string}> = ({x, w, h, col, seed, id}) => {
  if (h <= 1) return null;
  const top = GROUND - h;
  const lines: React.ReactNode[] = [];
  for (let k = -Math.floor(h); k < w + 40; k += 22) lines.push(<line key={k} x1={x + k} y1={GROUND} x2={x + k + h} y2={top} />);
  return (
    <g>
      <rect x={x + 6} y={top + 6} width={w} height={Math.max(0, h - 6)} fill={col} opacity={0.35} />
      <clipPath id={`hb-${id}`}>
        <rect x={x} y={top} width={w} height={h} />
      </clipPath>
      <g clipPath={`url(#hb-${id})`} stroke={col} strokeOpacity={0.9} strokeWidth={5} strokeLinecap="round">{lines}</g>
      <Brush pts={[[x, GROUND], [x, top], [x + w, top], [x + w, GROUND]]} w={8} seed={seed} taper={0.03} />
    </g>
  );
};

/** Nano Banana plate: still image with slow Ken Burns, blended into the paper look. */
export const Plate: React.FC<{src: string; t: number; dur: number; from?: [number, number, number]; to?: [number, number, number]; alpha?: number}> = ({
  src, t, dur, from = [960, 540, 1.0], to = [960, 540, 1.08], alpha = 1,
}) => {
  const u = clamp(t / Math.max(0.01, dur));
  const e = u * u * (3 - 2 * u);
  const cx = lerp(from[0], to[0], e);
  const cy = lerp(from[1], to[1], e);
  const z = lerp(from[2], to[2], e);
  return (
    <g opacity={alpha}>
      <g transform={`translate(960 540) scale(${z}) translate(${-cx} ${-cy})`}>
        <image href={staticFile(src)} x={0} y={0} width={1920} height={1080} preserveAspectRatio="xMidYMid slice" />
      </g>
      <image href={staticFile('paper-grain.png')} x={0} y={0} width={1920} height={1080} style={{mixBlendMode: 'overlay'}} opacity={0.55} />
    </g>
  );
};

export const randomish = nz;
