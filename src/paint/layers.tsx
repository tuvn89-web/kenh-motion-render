// Camera + painted layers with depth parallax, soft dissolves, era stamps, chapter titles.
import React, {useMemo} from 'react';
import {AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ctx, paintToURL} from './brush';

export type Cam = {x: number; y: number; z: number}; // pan in px (at depth 1), zoom (at depth 1)
export const camLerp = (keys: [number, Cam][], t: number): Cam => {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [t0, a] = keys[i];
  const [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
  const u0 = t1 > t0 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 0;
  const u = u0 * u0 * (3 - 2 * u0);
  return {x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u};
};
export const layerStyle = (cam: Cam, depth: number, over = 1.18): React.CSSProperties => {
  const z = 1 + (cam.z - 1) * depth;
  return {
    position: 'absolute', left: (1920 - 1920 * over) / 2, top: (1080 - 1080 * over) / 2, width: 1920 * over, height: 1080 * over,
    transform: `translate(${-cam.x * depth}px, ${-cam.y * depth}px) scale(${z})`, transformOrigin: '50% 50%',
  };
};

/** A painted layer: painted once (cached), moved by the camera at its depth. */
export const PaintLayer: React.FC<{id: string; cam: Cam; depth: number; paint: (ctx: Ctx, W: number, H: number) => void; blur?: number; over?: number; opacity?: number}> = ({
  id, cam, depth, paint, blur = 0, over = 1.18, opacity = 1,
}) => {
  const W = Math.round(1920 * over);
  const H = Math.round(1080 * over);
  const url = useMemo(() => paintToURL(id, W, H, paint), [id]);
  return <Img src={url} style={{...layerStyle(cam, depth, over), filter: blur ? `blur(${blur}px)` : undefined, opacity}} />;
};

/** SVG overlay living at a given depth (characters, boats, birds…) — coordinates are in a 1920*over canvas. */
export const DepthSvg: React.FC<{cam: Cam; depth: number; over?: number; children: React.ReactNode; blur?: number}> = ({cam, depth, over = 1.18, children, blur = 0}) => (
  <svg viewBox={`0 0 ${1920 * over} ${1080 * over}`} style={{...layerStyle(cam, depth, over), filter: blur ? `blur(${blur}px)` : undefined, overflow: 'visible'}}>
    {children}
  </svg>
);

/** Shot wrapper: local time + dissolve in/out. */
export const Shot: React.FC<{from: number; to: number; fade?: number; children: (t: number, dur: number) => React.ReactNode}> = ({from, to, fade = 0.4, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = frame / fps;
  if (T < from - fade || T > to + fade) return null;
  const a = interpolate(T, [from - fade, from, to, to + fade], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{opacity: a}}>{children(T - from, to - from)}</AbsoluteFill>;
};

/** Small era / place stamp like a documentary lower-third. */
export const EraStamp: React.FC<{t: number; text: string; sub?: string; at?: number; top?: boolean}> = ({t, text, sub, at = 0.6, top = false}) => {
  const a = interpolate(t, [at, at + 0.5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: 0, right: 0, ...(top ? {top: 40, paddingTop: 30, paddingBottom: 40, background: 'radial-gradient(ellipse 34% 60% at 50% 50%, rgba(20,12,8,0.6), rgba(20,12,8,0) 100%)'} : {bottom: 150}), textAlign: 'center', opacity: a, transform: `translateY(${(1 - a) * 10}px)`}}>
      <div style={{fontFamily: 'Fredoka', fontWeight: 600, fontSize: 40, color: '#FFF6E6', letterSpacing: 3, textShadow: '0 2px 8px rgba(0,0,0,0.55)'}}>{text}</div>
      {sub && <div style={{fontFamily: 'Fredoka', fontWeight: 400, fontSize: 26, color: '#FFE2B8', letterSpacing: 2, marginTop: 4, textShadow: '0 2px 8px rgba(0,0,0,0.55)'}}>{sub}</div>}
    </div>
  );
};

/** Chapter title that writes on with widening letter-spacing. */
export const ChapterTitle: React.FC<{t: number; text: string; sub?: string; at?: number}> = ({t, text, sub, at = 1}) => {
  const a = interpolate(t, [at, at + 0.8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const sp = interpolate(t, [at, at + 3], [4, 16], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 360, textAlign: 'center', opacity: a}}>
      <div style={{fontFamily: 'Fredoka', fontWeight: 700, fontSize: 96, color: '#FFF4E0', letterSpacing: sp, textShadow: '0 4px 24px rgba(60,20,10,0.6)'}}>{text}</div>
      {sub && (
        <div style={{fontFamily: 'Fredoka', fontSize: 34, color: '#FFD9A8', letterSpacing: 4, marginTop: 10, opacity: interpolate(t, [at + 0.8, at + 1.4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
          {sub}
        </div>
      )}
    </div>
  );
};
