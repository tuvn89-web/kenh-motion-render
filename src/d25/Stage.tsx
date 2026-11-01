// 2.5D STAGE — flat painted layers (code paintings now, Nano Banana PNG layers later) placed at real depths
// in a CSS-3D world, filmed by a camera that dollies, pans and tilts. Parallax, perspective and
// depth-of-field come from the geometry, not from fake per-layer speeds.
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';

export const P = 1600; // perspective distance in px (eye -> screen plane)

export type Cam = {x: number; y: number; dolly: number; ry?: number; rx?: number; rz?: number; focus: number; fstop?: number; lens?: number}; // lens = optical zoom (everything scales together)
const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
export const camAt = (keys: [number, Cam][], t: number): Cam => {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [t0, a] = keys[i];
  const [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
  const u = t1 > t0 ? ease((t - t0) / (t1 - t0)) : 0;
  const l = (p: number, q: number) => p + (q - p) * u;
  return {x: l(a.x, b.x), y: l(a.y, b.y), dolly: l(a.dolly, b.dolly), ry: l(a.ry ?? 0, b.ry ?? 0), rx: l(a.rx ?? 0, b.rx ?? 0), rz: l(a.rz ?? 0, b.rz ?? 0), focus: l(a.focus, b.focus), fstop: l(a.fstop ?? 1, b.fstop ?? 1), lens: l(a.lens ?? 1, b.lens ?? 1)};
};
/** Camera x/y that puts a point authored at screen offset (sx, sy) on a plane of depth z in the frame centre. */
export const aim = (sx: number, sy: number, z: number) => ({x: sx * ((P + z) / P), y: sy * ((P + z) / P)});
/** Handheld drift (deterministic). */
export const hand = (t: number, amt = 1) => ({
  x: (Math.sin(t * 0.83) * 3 + Math.sin(t * 2.1 + 1) * 1.2) * amt,
  y: (Math.sin(t * 0.71 + 2) * 2.4 + Math.sin(t * 1.9) * 1) * amt,
  rz: Math.sin(t * 0.5 + 0.4) * 0.0018 * amt,
});

const CamCtx = React.createContext<Cam>({x: 0, y: 0, dolly: 0, focus: 600});

/** The world. Children are <Plane>s. */
export const Stage: React.FC<{cam: Cam; children: React.ReactNode; bg?: string}> = ({cam, children, bg = '#120C0A'}) => {
  const world = `translateZ(${P}px) rotateZ(${cam.rz ?? 0}rad) rotateX(${cam.rx ?? 0}rad) rotateY(${cam.ry ?? 0}rad) translate3d(${-cam.x}px, ${-cam.y}px, ${-P + cam.dolly}px)`;
  return (
    <AbsoluteFill style={{backgroundColor: bg, overflow: 'hidden'}}>
      <AbsoluteFill style={{perspective: P, perspectiveOrigin: '50% 50%', transform: `scale(${cam.lens ?? 1})`, transformOrigin: '50% 50%'}}>
      <div style={{position: 'absolute', left: 960, top: 540, width: 0, height: 0, transformStyle: 'preserve-3d', transform: world}}>
        <CamCtx.Provider value={cam}>{children}</CamCtx.Provider>
      </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Blur radius (px on screen) for a plane at depth z under the current camera focus. */
export const dofBlur = (cam: Cam, z: number, max = 14) => {
  const dz = Math.abs(z - cam.focus);
  const near = P + cam.focus - cam.dolly; // distance eye->focus plane
  return Math.min(max, (dz / Math.max(200, near)) * 22 * (cam.fstop ?? 1));
};

/** A flat layer at depth z. Authored in screen px as seen from the default camera (centre = 0,0). */
export const Plane: React.FC<{
  z: number; x?: number; y?: number; w: number; h: number; src?: string; children?: React.ReactNode;
  blur?: number | 'auto'; opacity?: number; blend?: React.CSSProperties['mixBlendMode']; style?: React.CSSProperties; maxBlur?: number;
}> = ({z, x = 0, y = 0, w, h, src, children, blur = 'auto', opacity = 1, blend, style, maxBlur}) => {
  const cam = React.useContext(CamCtx);
  const s = (P + z) / P;
  const b = blur === 'auto' ? dofBlur(cam, z, maxBlur) : blur;
  return (
    <div
      style={{
        position: 'absolute', left: -w / 2, top: -h / 2, width: w, height: h,
        transform: `translate3d(${x * s}px, ${y * s}px, ${-z}px) scale(${s})`,
        filter: b > 0.3 ? `blur(${b.toFixed(2)}px)` : undefined, opacity, mixBlendMode: blend, ...style,
      }}
    >
      {src && <Img src={src} style={{width: '100%', height: '100%', display: 'block'}} />}
      {children}
    </div>
  );
};

/** Floating dust motes lit by the sun shaft, spread through depth (each mote is a tiny plane). */
export const Dust: React.FC<{t: number; n?: number; zRange: [number, number]; area: [number, number, number, number]; seed?: number; color?: string}> = ({
  t, n = 40, zRange, area, seed = 1, color = '#FFE6B8',
}) => {
  const R = (i: number, k: number) => {
    const v = Math.sin(i * 12.9898 + k * 78.233 + seed * 37.719) * 43758.5453;
    return v - Math.floor(v);
  };
  return (
    <>
      {Array.from({length: n}, (_, i) => {
        const z = zRange[0] + R(i, 1) * (zRange[1] - zRange[0]);
        const [x0, y0, x1, y1] = area;
        const x = x0 + R(i, 2) * (x1 - x0) + Math.sin(t * (0.2 + R(i, 3) * 0.3) + i) * 30;
        const y = y0 + ((R(i, 4) * (y1 - y0) - t * (6 + R(i, 5) * 10)) % (y1 - y0) + (y1 - y0)) % (y1 - y0);
        const r = 2 + R(i, 6) * 4;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + R(i, 7)) + i));
        return (
          <Plane key={i} z={z} x={x} y={y} w={r * 2} h={r * 2} maxBlur={6} opacity={tw}>
            <div style={{width: '100%', height: '100%', borderRadius: '50%', background: `radial-gradient(circle, ${color}, rgba(255,230,184,0) 70%)`}} />
          </Plane>
        );
      })}
    </>
  );
};

/** Screen-space light: god rays from a point, plus a warm bloom; blend 'screen'. */
export const LightRays: React.FC<{t: number; x: number; y: number; strength: number; color?: string; spread?: number; angle?: number; bloom?: number}> = ({t, x, y, strength, color = '255,214,160', spread = 0.9, angle = 2.4, bloom = 1}) => {
  if (strength <= 0) return null;
  const rays = Array.from({length: 9}, (_, k) => {
    const a = angle + (k / 8 - 0.5) * spread;
    const len = 2200;
    const w = 0.035 + 0.03 * Math.sin(k * 3.3);
    const x1 = x + Math.cos(a - w) * len;
    const y1 = y + Math.sin(a - w) * len;
    const x2 = x + Math.cos(a + w) * len;
    const y2 = y + Math.sin(a + w) * len;
    const flick = 0.55 + 0.45 * Math.sin(t * (0.5 + k * 0.13) + k * 2.1);
    return <path key={k} d={`M${x} ${y}L${x1} ${y1}L${x2} ${y2}Z`} fill="url(#lr-g)" opacity={strength * flick * 0.55} />;
  });
  return (
    <AbsoluteFill style={{mixBlendMode: 'screen', pointerEvents: 'none'}}>
      <svg width={1920} height={1080}>
        <defs>
          <radialGradient id="lr-g" cx={x} cy={y} r={1500} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={`rgb(${color})`} stopOpacity={0.55} />
            <stop offset="1" stopColor={`rgb(${color})`} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="lr-b" cx={x} cy={y} r={520} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={`rgb(${color})`} stopOpacity={0.6} />
            <stop offset="1" stopColor={`rgb(${color})`} stopOpacity={0} />
          </radialGradient>
        </defs>
        {rays}
        {bloom > 0 && <circle cx={x} cy={y} r={520} fill="url(#lr-b)" opacity={strength * bloom} />}
      </svg>
    </AbsoluteFill>
  );
};
