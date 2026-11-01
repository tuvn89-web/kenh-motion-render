// ART lane — real public-domain paintings / CC0 photos as plates, moved by a camera, with code overlays
// drawn in the IMAGE's own pixel space (so labels, traced lines, glows stick to the painting while it moves).
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';

export type ArtKey = {fx: number; fy: number; z: number}; // focus point (0..1 of the image) + zoom over "cover"
const ease = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u));
export const artCam = (keys: [number, ArtKey][], t: number): ArtKey => {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [t0, a] = keys[i];
  const [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
  const u = t1 > t0 ? ease((t - t0) / (t1 - t0)) : 0;
  return {fx: a.fx + (b.fx - a.fx) * u, fy: a.fy + (b.fy - a.fy) * u, z: a.z + (b.z - a.z) * u};
};

/** Full-frame painting with Ken Burns camera; children = SVG overlay in image pixel coordinates. */
export const ArtPlate: React.FC<{
  src: string; iw: number; ih: number; cam: ArtKey; W?: number; H?: number; filter?: string; children?: React.ReactNode;
}> = ({src, iw, ih, cam, W = 1920, H = 1080, filter, children}) => {
  const s = Math.max(W / iw, H / ih) * cam.z;
  const dw = iw * s;
  const dh = ih * s;
  const left = Math.min(0, Math.max(W - dw, W / 2 - cam.fx * dw));
  const top = Math.min(0, Math.max(H - dh, H / 2 - cam.fy * dh));
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div style={{position: 'absolute', left, top, width: dw, height: dh, filter}}>
        <Img src={staticFile(src)} style={{width: '100%', height: '100%'}} />
        {children && (
          <svg viewBox={`0 0 ${iw} ${ih}`} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible'}}>
            {children}
          </svg>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** "Artifact on black": the painting floats framed on a dark backdrop with a soft shadow, camera can push into it. */
export const ArtifactOnBlack: React.FC<{
  src: string; iw: number; ih: number; cam: ArtKey; t: number; fit?: number; children?: React.ReactNode; bg?: string;
}> = ({src, iw, ih, cam, t, fit = 0.78, children, bg = '#0E0B0A'}) => {
  const base = Math.min((1920 * fit) / iw, (1080 * fit) / ih);
  const s = base * cam.z;
  const dw = iw * s;
  const dh = ih * s;
  const left = 960 - cam.fx * dw;
  const top = 540 - cam.fy * dh + Math.sin(t * 0.8) * 4;
  return (
    <AbsoluteFill style={{backgroundColor: bg, overflow: 'hidden'}}>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(120,90,60,0.35), rgba(0,0,0,0) 60%)'}} />
      <div style={{position: 'absolute', left, top, width: dw, height: dh, boxShadow: '0 30px 80px rgba(0,0,0,0.75), 0 0 0 10px #2A1D14, 0 0 0 13px #8A6A3E'}}>
        <Img src={staticFile(src)} style={{width: '100%', height: '100%'}} />
        {children && (
          <svg viewBox={`0 0 ${iw} ${ih}`} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible'}}>
            {children}
          </svg>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** Drifting mist + god-ray glow in screen space, to make a still painting breathe. */
export const Atmosphere: React.FC<{t: number; mist?: number; y?: number; tint?: string; rays?: number; rayX?: number}> = ({t, mist = 0.5, y = 0.62, tint = '#F4EEE2', rays = 0, rayX = 0.7}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    <svg width={1920} height={1080}>
      <defs>
        <radialGradient id="atm-m">
          <stop offset="0" stopColor={tint} stopOpacity={0.5} />
          <stop offset="1" stopColor={tint} stopOpacity={0} />
        </radialGradient>
        <linearGradient id="atm-r" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE9C0" stopOpacity={0.35} />
          <stop offset="1" stopColor="#FFE9C0" stopOpacity={0} />
        </linearGradient>
      </defs>
      {mist > 0 &&
        [0, 1, 2, 3].map((k) => (
          <ellipse key={k} cx={((k * 620 + t * (22 + k * 9)) % 2600) - 340} cy={1080 * (y + k * 0.05)} rx={560} ry={46 + k * 10} fill="url(#atm-m)" opacity={mist * (0.6 + 0.4 * Math.sin(t * 0.7 + k))} />
        ))}
      {rays > 0 &&
        [0, 1, 2, 3, 4].map((k) => {
          const x = 1920 * rayX + (k - 2) * 110;
          const w = 50 + k * 14;
          return <path key={k} d={`M${x} -40L${x + w} -40L${x - 300 + w * 2} 1120L${x - 300} 1120Z`} fill="url(#atm-r)" opacity={rays * (0.5 + 0.5 * Math.sin(t * 0.9 + k * 1.7))} />;
        })}
    </svg>
  </AbsoluteFill>
);

/** Hand-inked line that draws itself (in image coordinates). */
export const InkTrace: React.FC<{pts: [number, number][]; u: number; color?: string; width?: number; dash?: boolean}> = ({pts, u, color = '#C0392B', width = 10, dash = false}) => {
  // smooth Catmull-Rom → cubic bezier
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return (
    <g>
      <path d={d} fill="none" stroke="rgba(255,240,210,0.7)" strokeWidth={width + 8} strokeLinecap="round" pathLength={1000} strokeDasharray={`${u * 1000} 1000`} />
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" pathLength={1000} strokeDasharray={dash ? undefined : `${u * 1000} 1000`} style={dash ? {strokeDasharray: `${u * 1000} 1000`} : undefined} />
    </g>
  );
};

/** Pin + label that pops onto the painting (image coordinates; size in image px). */
export const ArtLabel: React.FC<{x: number; y: number; text: string; a: number; size?: number; dx?: number; dy?: number; ring?: number}> = ({x, y, text, a, size = 60, dx = 0, dy = -1.6, ring = 0}) => {
  if (a <= 0) return null;
  const k = 0.7 + 0.3 * a;
  return (
    <g opacity={Math.min(1, a * 1.5)}>
      {ring > 0 && <circle cx={x} cy={y} r={ring * (0.8 + 0.2 * a)} fill="none" stroke="#FFF4DC" strokeWidth={size * 0.12} strokeDasharray={`${size * 0.5} ${size * 0.25}`} />}
      <circle cx={x} cy={y} r={size * 0.22 * k} fill="#C0392B" stroke="#FFF4DC" strokeWidth={size * 0.08} />
      <line x1={x} y1={y} x2={x + dx * size} y2={y + dy * size * 0.8} stroke="#FFF4DC" strokeWidth={size * 0.06} />
      <text x={x + dx * size} y={y + dy * size} textAnchor="middle" fontFamily="Fredoka" fontWeight={600} fontSize={size * k} fill="#FFF6E6" stroke="#2A1A10" strokeWidth={size * 0.16} style={{paintOrder: 'stroke'}}>
        {text}
      </text>
    </g>
  );
};

/** Credits lower-third (required for CC-BY; good manners for PD). */
export const CreditLine: React.FC<{text: string; a: number}> = ({text, a}) => (
  <div style={{position: 'absolute', left: 40, bottom: 34, fontFamily: 'Fredoka', fontSize: 22, color: '#F1E6D2', opacity: a * 0.85, textShadow: '0 1px 4px rgba(0,0,0,0.8)', letterSpacing: 0.5}}>{text}</div>
);
