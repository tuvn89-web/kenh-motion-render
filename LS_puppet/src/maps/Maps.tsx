import React from 'react';
import {Img, staticFile} from 'remotion';
import {INK, smooth, rng, clamp, lerp, easeInOut, easeOut} from '../lib/util';
import {useCue} from '../lib/cue';

export const Parchment: React.FC<{x?: number; y?: number; w?: number; h?: number}> = ({x = -700, y = -500, w = 3400, h = 2200}) => (
  <Img src={staticFile('parchment.jpg')} style={{position: 'absolute', left: x, top: y, width: w, height: h}} />
);

/* ---------- region map (lat/lon projected) ---------- */
export const P = (lat: number, lon: number): [number, number] => [(lon - 9.9) * 900, (44.2 - lat) * 900 * 1.37];
const COAST: [number, number][] = [[44.3, 9.7], [44.1, 9.85], [43.9, 10.2], [43.68, 10.28], [43.55, 10.31], [43.4, 10.43], [43.25, 10.53], [43.05, 10.53], [42.93, 10.5], [42.95, 10.7], [42.8, 10.78], [42.65, 10.98], [42.45, 11.1], [42.4, 11.2], [42.33, 11.55], [42.09, 11.8]].map(([a, b]) => P(a, b));
const ARNO = [[43.85, 11.68], [43.5, 11.83], [43.55, 11.65], [43.7, 11.45], [43.77, 11.25], [43.72, 10.9], [43.7, 10.4], [43.68, 10.28]].map(([a, b]) => P(a, b));
const TIBER = [[43.8, 12.05], [43.45, 12.24], [43.1, 12.4], [42.8, 12.47], [42.45, 12.42]].map(([a, b]) => P(a, b));
const CHIANA = [[43.5, 11.83], [43.3, 11.9], [43.15, 11.95], [42.95, 12.0]].map(([a, b]) => P(a, b));
export const CITY = {
  arretium: P(43.46, 11.88), cortona: P(43.27, 11.99), lake: P(43.13, 12.1), perusia: P(43.11, 12.39), faesulae: P(43.81, 11.29), pisae: P(43.72, 10.4),
};
export const HANNIBAL_PATH: [number, number][] = [CITY.faesulae, [1420, 720], [1600, 960], [1760, 1110], [1860, 1210], [1935, 1268]];
export const ROMAN_PATH: [number, number][] = [[1800, 940], [1915, 1010], [1990, 1110], [2010, 1215]];

export const pathLen = (pts: [number, number][]) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
export const along = (pts: [number, number][], t: number): [number, number, number] => {
  const L = pathLen(pts) * clamp(t); let acc = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc + d >= L) { const u = (L - acc) / d; return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u), Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])]; } acc += d; }
  const n = pts.length - 1; return [pts[n][0], pts[n][1], Math.atan2(pts[n][1] - pts[n - 1][1], pts[n][0] - pts[n - 1][0])];
};
/** animated arrow along points; t = draw progress; pen = khoá nét (H4: đang vẽ thì in cue 'pen' mỗi khung → tiếng bút lông cào giấy) */
export const Arrow: React.FC<{pts: [number, number][]; t: number; color: string; w?: number; dash?: boolean; pen?: string}> = ({pts, t, color, w = 14, dash = false, pen}) => {
  const cue = useCue();
  if (t <= 0) return null;
  const L = pathLen(pts); const d = smooth(pts);
  const [hx, hy, a] = along(pts, t);
  if (pen && t < 1) cue('pen', hx, hy, {k: pen, p: Math.round(t * 1000)});
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + 8} strokeLinecap="round" strokeDasharray={`${L * t} ${L}`} />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash ? undefined : `${L * t} ${L}`} />
      <g transform={`translate(${hx},${hy}) rotate(${(a * 180) / Math.PI})`}><path d={`M${w * 2.2},0 L${-w * 1.2},${-w * 1.9} L${-w * 0.6},0 L${-w * 1.2},${w * 1.9} Z`} fill={color} stroke={INK} strokeWidth={4} strokeLinejoin="round" /></g>
    </g>
  );
};
export const Flame: React.FC<{x: number; y: number; s?: number; f: number; seed?: number}> = ({x, y, s = 1, f, seed = 0}) => {
  const w = Math.sin(f / 3 + seed) * 3;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d={`M0,0 C-22,-4 -24,-26 -10,-40 C-8,-30 -2,-30 0,-36 C${2 + w},-52 ${10 + w},-62 ${6 + w},-74 C24,-56 28,-30 20,-14 C16,-4 10,0 0,0 Z`} fill="#d9682a" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <path d={`M2,-6 C-8,-8 -8,-22 0,-28 C2,-22 6,-24 ${6 + w * 0.5},-34 C14,-24 14,-12 8,-7 Z`} fill="#f2c14a" />
    </g>
  );
};
export const RegionMap: React.FC<{f: number}> = ({f}) => {
  const R = rng(77);
  const sea = smooth(COAST) + ' L-800,2800 L-800,-400 L' + COAST[0][0] + ',' + COAST[0][1];
  const mts = Array.from({length: 70}, () => { const t = R(); const x = lerp(1250, 2600, t) + (R() - 0.5) * 260; const y = lerp(150, 980, t) + (R() - 0.5) * 220; return [x, y]; });
  return (
    <svg width={3400} height={3000} viewBox="-700 -500 3400 3000" style={{position: 'absolute', left: -700, top: -500, overflow: 'visible'}}>
      <path d={sea} fill="#9fb2ad" opacity={0.85} />
      <path d={smooth(COAST)} fill="none" stroke={INK} strokeWidth={5} />
      {[1, 2, 3].map((k) => <path key={k} d={smooth(COAST.map(([x, y]) => [x - k * 26, y + k * 10]) as any)} fill="none" stroke="#6f8782" strokeWidth={3} opacity={0.6 - k * 0.15} />)}
      <ellipse cx={333} cy={1751} rx={70} ry={30} fill="#dccfae" stroke={INK} strokeWidth={4} />
      {mts.map(([x, y], i) => <path key={i} d={`M${x - 22},${y + 12} L${x},${y - 16} L${x + 22},${y + 12}`} fill="none" stroke="#7d6a4c" strokeWidth={4} strokeLinejoin="round" />)}
      {[ARNO, TIBER].map((r, i) => <g key={i}><path d={smooth(r as any)} fill="none" stroke={INK} strokeWidth={11} strokeLinecap="round" /><path d={smooth(r as any)} fill="none" stroke="#7d9aa0" strokeWidth={6} strokeLinecap="round" /></g>)}
      <ellipse cx={CITY.lake[0]} cy={CITY.lake[1] + 10} rx={56} ry={44} fill="#7d9aa0" stroke={INK} strokeWidth={5} />
      {(['arretium', 'cortona', 'perusia', 'faesulae', 'pisae'] as const).map((k) => <g key={k}><rect x={CITY[k][0] - 11} y={CITY[k][1] - 11} width={22} height={22} fill="#efe5cc" stroke={INK} strokeWidth={4} transform={`rotate(45,${CITY[k][0]},${CITY[k][1]})`} /></g>)}
    </svg>
  );
};

/* ---------- tactical map of the north shore ---------- */
export const SHORE: [number, number][] = [[-500, 770], [-200, 760], [100, 748], [400, 772], [800, 762], [1200, 732], [1500, 664], [1700, 566], [1820, 478], [2000, 432], [2400, 440]];
export const ROAD: [number, number][] = [[-500, 722], [-200, 718], [100, 712], [400, 726], [800, 716], [1200, 688], [1490, 616], [1680, 520], [1800, 436], [1960, 380], [2400, 360]];
export const HILLS: [number, number][] = [[-500, 560], [-200, 540], [0, 570], [80, 610], [150, 676], [215, 694], [280, 630], [360, 540], [700, 488], [1000, 460], [1300, 486], [1520, 520], [1640, 470], [1760, 400], [2000, 330], [2400, 300]];
export const CAMP: [number, number] = [1600, 418];
export const UNITS = [
  {id: 'inf1', kind: 'inf', end: [1300, 400]}, {id: 'inf2', kind: 'inf', end: [1420, 420]}, {id: 'inf3', kind: 'inf', end: [1180, 410]},
  {id: 'gaul1', kind: 'gaul', end: [900, 390]}, {id: 'gaul2', kind: 'gaul', end: [760, 410]}, {id: 'gaul3', kind: 'gaul', end: [1040, 380]},
  {id: 'lt1', kind: 'light', end: [560, 450]}, {id: 'lt2', kind: 'light', end: [430, 470]},
  {id: 'cav1', kind: 'cav', end: [30, 520]}, {id: 'cav2', kind: 'cav', end: [150, 560]},
] as const;
export const unitStart = (i: number): [number, number] => [CAMP[0] - 40 + (i % 4) * 34, CAMP[1] - 30 + Math.floor(i / 4) * 30];
export const unitPos = (i: number, t: number): [number, number] => {
  const s = unitStart(i), e = UNITS[i].end as unknown as [number, number];
  const mid: [number, number] = [lerp(s[0], e[0], 0.5), 250];
  const u = easeInOut(clamp(t));
  const a = lerp(s[0], mid[0], u), b = lerp(s[1], mid[1], u), c = lerp(mid[0], e[0], u), d = lerp(mid[1], e[1], u);
  return [lerp(a, c, u), lerp(b, d, u)];
};
const UCOL: Record<string, string> = {inf: '#2f5566', gaul: '#3e6a55', light: '#58707a', cav: '#2b3f5c'};
export const UnitBlock: React.FC<{x: number; y: number; kind: string; a?: number; rot?: number}> = ({x, y, kind, a = 1, rot = 0}) => (
  <g transform={`translate(${x},${y}) rotate(${rot})`} opacity={a}>
    <rect x={-34} y={-20} width={68} height={40} rx={4} fill={UCOL[kind]} stroke={INK} strokeWidth={4} />
    {kind === 'cav' ? <path d="M-14,8 L-6,-8 L6,-8 L14,8" stroke="#e8e0c8" strokeWidth={4} fill="none" /> : kind === 'light' ? <circle r={7} fill="#e8e0c8" /> : <path d="M-18,-10 L18,10 M18,-10 L-18,10" stroke="#e8e0c8" strokeWidth={4} />}
  </g>
);
export const RomanBlock: React.FC<{x: number; y: number; rot?: number; a?: number}> = ({x, y, rot = 0, a = 1}) => (
  <g transform={`translate(${x},${y}) rotate(${rot})`} opacity={a}>
    <rect x={-26} y={-15} width={52} height={30} rx={3} fill="#b33a2c" stroke={INK} strokeWidth={4} />
    <path d="M-16,0 L16,0" stroke="#f1e2c4" strokeWidth={4} />
  </g>
);
export const Camp: React.FC<{x: number; y: number; a?: number}> = ({x, y, a = 1}) => (
  <g transform={`translate(${x},${y})`} opacity={a}>
    <rect x={-70} y={-50} width={140} height={100} fill="#d8c79e" stroke={INK} strokeWidth={5} strokeDasharray="10 5" />
    {[[-35, -18], [0, -18], [35, -18], [-35, 18], [0, 18], [35, 18]].map(([tx, ty], i) => <path key={i} d={`M${tx - 13},${ty + 10} L${tx},${ty - 10} L${tx + 13},${ty + 10} Z`} fill="#efe5cc" stroke={INK} strokeWidth={3} />)}
  </g>
);
export const Tactical: React.FC<{f: number}> = ({f}) => {
  const R = rng(91);
  // kéo dài sang trái tới x = -1100 để máy lia sát mép (S13 cuối) không lộ mép bản đồ; ROAD giữ nguyên mảng vì S18 đặt quân theo nó
  const ext = (pts: [number, number][]) => `M-1100,${pts[0][1]} L` + smooth(pts).replace(/^M/, '');
  const hillsD = ext(HILLS) + ' L2400,-600 L-1100,-600 Z';
  const lakeD = ext(SHORE) + ' L2400,1700 L-1100,1700 Z';
  const hach = Array.from({length: 170}, () => { const x = -1080 + R() * 3460; const y = -300 + R() * 760; return [x, y]; }).filter(([x, y]) => {
    // keep only points above hill line
    let i = 0; while (i < HILLS.length - 1 && HILLS[i + 1][0] < x) i++; const p = HILLS[i], q = HILLS[Math.min(i + 1, HILLS.length - 1)]; const yy = lerp(p[1], q[1], clamp((x - p[0]) / Math.max(1, q[0] - p[0]))); return y < yy - 30; });
  return (
    <svg width={3000} height={2400} viewBox="-500 -600 3000 2400" style={{position: 'absolute', left: -500, top: -600, overflow: 'visible'}}>
      <path d={lakeD} fill="#9fb2ad" stroke={INK} strokeWidth={5} />
      {Array.from({length: 48}, (_, i) => { const x = -1030 + (i % 12) * 290 + (Math.floor(i / 12) % 2) * 140; const y = 840 + Math.floor(i / 12) * 70; return <path key={i} d={`M${x + Math.sin(f / 30 + i) * 8},${y} l90,0`} stroke="#c4d1cc" strokeWidth={4} strokeLinecap="round" />; })}
      <path d={hillsD} fill="#b9a77c" stroke={INK} strokeWidth={5} />
      {hach.map(([x, y], i) => <path key={i} d={`M${x - 16},${y + 8} L${x},${y - 10} L${x + 16},${y + 8}`} fill="none" stroke="#8a7650" strokeWidth={4} strokeLinejoin="round" />)}
      <path d={ext(ROAD)} fill="none" stroke={INK} strokeWidth={22} strokeLinecap="round" />
      <path d={ext(ROAD)} fill="none" stroke="#e7d9b4" strokeWidth={14} strokeLinecap="round" />
      <path d={ext(ROAD)} fill="none" stroke="#a08b62" strokeWidth={3} strokeDasharray="14 16" />
    </svg>
  );
};

/** H4 — in vị trí máy trên bản đồ mỗi khung (cue 'mapcam'): bộ trộn tính tốc độ lia → tiếng giấy sột soạt theo cú lia */
export const MapCue: React.FC<{cx: number; cy: number; z: number}> = ({cx, cy, z}) => {
  const cue = useCue(); cue('mapcam', 960, 540, {cx: Math.round(cx * 10) / 10, cy: Math.round(cy * 10) / 10, zz: Math.round(z * 1000) / 1000});
  return null;
};
