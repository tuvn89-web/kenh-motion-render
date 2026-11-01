import React from 'react';
import {Img, staticFile, getInputProps} from 'remotion';
const IP: any = getInputProps();
import {INK, rng, smooth, ridgePoints, noise1} from '../lib/util';

/** camera wrapper: (cx,cy) world point at screen centre, zoom, rotation, plus optional shake */
export const Cam: React.FC<{cx?: number; cy?: number; z?: number; r?: number; children: React.ReactNode}> = ({cx = 960, cy = 540, z = 1, r = 0, children}) => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: `translate(960px,540px) rotate(${r}deg) scale(${z}) translate(${-cx}px,${-cy}px)`}}>{children}</div>
  </div>
);
/** parallax layer: moves by camera offset * (1-depth). depth 0 = with world, 1 = fixed to screen */
export const Par: React.FC<{dx?: number; dy?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({dx = 0, dy = 0, children, style}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `translate(${dx}px,${dy}px)`, ...style}}>{children}</div>
);
export const Svg: React.FC<{children: React.ReactNode; w?: number; h?: number; x?: number; y?: number; style?: React.CSSProperties}> = ({children, w = 1920, h = 1080, x = 0, y = 0, style}) => (
  <svg width={w} height={h} viewBox={`${x} ${y} ${w} ${h}`} style={{position: 'absolute', left: x, top: y, overflow: 'visible', ...style}}>{children}</svg>
);

export const SkyGrad: React.FC<{id: string; stops: [number, string][]; x?: number; y?: number; w?: number; h?: number}> = ({id, stops, x = -600, y = -400, w = 3120, h = 1900}) => (
  <>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">{stops.map(([o, c], i) => <stop key={i} offset={o} stopColor={c} />)}</linearGradient></defs>
    <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
  </>
);

/** range of hills: filled ridge to bottom, outlined, with ink hatches */
export const Hills: React.FC<{seed: number; y: number; amp: number; freq?: number; fill: string; x0?: number; x1?: number; bottom?: number; hatch?: string; stroke?: string; sw?: number; opacity?: number}> = ({seed, y, amp, freq = 0.0025, fill, x0 = -700, x1 = 2700, bottom = 1500, hatch, stroke = INK, sw = 4, opacity = 1}) => {
  const pts = ridgePoints(seed, x0, x1, y, amp, freq);
  const d = smooth(pts) + ` L${x1},${bottom} L${x0},${bottom} Z`;
  const r = rng(seed + 5);
  const hs = hatch ? Array.from({length: 46}, () => { const x = x0 + r() * (x1 - x0); const i = Math.max(0, Math.min(pts.length - 1, Math.round((x - x0) / 40))); const yy = pts[i][1] + 30 + r() * 160; return `M${x.toFixed(0)},${yy.toFixed(0)} q${8 + r() * 10},${-4 - r() * 4} ${18 + r() * 16},0`; }).join(' ') : '';
  return (
    <g opacity={opacity}>
      <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      {hatch && <path d={hs} stroke={hatch} strokeWidth={3} fill="none" strokeLinecap="round" />}
    </g>
  );
};
/** union-outlined clump (bush / tree canopy / cloud): circles drawn stroke-under */
export const Clump: React.FC<{cx: number; cy: number; r: number; n?: number; seed: number; fill: string; shade?: string; stroke?: string; sw?: number; flat?: number}> = ({cx, cy, r, n = 6, seed, fill, shade, stroke = INK, sw = 4, flat = 0.75}) => {
  const R = rng(seed);
  const cs = Array.from({length: n}, (_, i) => { const a = (i / n) * Math.PI * 2 + R() * 0.6; const d = r * (0.35 + R() * 0.35); return [cx + Math.cos(a) * d * 1.25, cy + Math.sin(a) * d * flat - r * 0.1, r * (0.42 + R() * 0.25)]; });
  cs.push([cx, cy - r * 0.15, r * 0.6]);
  return (
    <g>
      {cs.map(([x, y, rr], i) => <circle key={'s' + i} cx={x} cy={y} r={rr + sw * 0.5} fill={stroke} stroke={stroke} strokeWidth={sw} />)}
      {cs.map(([x, y, rr], i) => <circle key={'f' + i} cx={x} cy={y} r={rr} fill={fill} />)}
      {shade && cs.slice(0, Math.ceil(n / 2)).map(([x, y, rr], i) => <circle key={'h' + i} cx={x + rr * 0.15} cy={y + rr * 0.35} r={rr * 0.6} fill={shade} opacity={0.5} />)}
    </g>
  );
};
/** row of trees along a ridge */
export const TreeLine: React.FC<{seed: number; y: number; amp: number; freq?: number; x0?: number; x1?: number; step?: number; size?: number; fill: string; shade?: string; stroke?: string; sw?: number; cypress?: number}> = ({seed, y, amp, freq = 0.0025, x0 = -600, x1 = 2600, step = 90, size = 60, fill, shade, stroke = INK, sw = 4, cypress = 0}) => {
  const n = noise1(seed); const n2 = noise1(seed + 99); const R = rng(seed + 3);
  const items: JSX.Element[] = [];
  for (let x = x0; x <= x1; x += step * (0.6 + R() * 0.8)) {
    const yy = y - amp * (0.7 * n(x * freq) + 0.3 * n2(x * freq * 3.1));
    const sz = size * (0.7 + R() * 0.6);
    if (R() < cypress) {
      items.push(<g key={x}><path d={`M${x},${yy + 6} L${x},${yy - sz * 0.2}`} stroke={stroke} strokeWidth={6} /><path d={`M${x},${yy - sz * 2.4} C${x + sz * 0.42},${yy - sz * 1.6} ${x + sz * 0.38},${yy - sz * 0.5} ${x},${yy - sz * 0.1} C${x - sz * 0.38},${yy - sz * 0.5} ${x - sz * 0.42},${yy - sz * 1.6} ${x},${yy - sz * 2.4} Z`} fill={fill} stroke={stroke} strokeWidth={sw} /></g>);
    } else {
      items.push(<g key={x}><path d={`M${x},${yy + 8} L${x},${yy - sz * 0.5}`} stroke={stroke} strokeWidth={8} /><Clump cx={x} cy={yy - sz * 0.75} r={sz * 0.8} seed={Math.round(x) + seed} fill={fill} shade={shade} stroke={stroke} sw={sw} /></g>);
    }
  }
  return <g>{items}</g>;
};
/** reeds cluster */
/** 31/10: Cậu Cả bỏ cỏ / lau lay gió — lau vẽ bằng code đứng yên (giữ dáng nghiêng ngẫu nhiên). Bật lại bằng REED_SWAY. */
export const REED_SWAY = false;
export const Reeds: React.FC<{x: number; y: number; seed: number; n?: number; h?: number; f: number; color?: string; dark?: string; stroke?: string; spread?: number}> = ({x, y, seed, n = 14, h = 220, f, color = '#6f7a45', dark = '#4b5530', stroke = INK, spread = 120}) => {
  const R = rng(seed);
  return (
    <g>
      {Array.from({length: n}, (_, i) => {
        const bx = x + (R() - 0.5) * spread; const hh = h * (0.5 + R() * 0.6); const lean = (R() - 0.5) * 50 + (REED_SWAY ? Math.sin(f / 22 + i) * 6 : 0);
        const tip = [bx + lean, y - hh]; const w = 7 + R() * 5; const col = R() < 0.5 ? color : dark;
        const cat = R() < 0.3;
        return (
          <g key={i}>
            <path d={`M${bx - w / 2},${y} Q${bx + lean * 0.3},${y - hh * 0.6} ${tip[0]},${tip[1]} Q${bx + lean * 0.3 + w * 0.3},${y - hh * 0.6} ${bx + w / 2},${y} Z`} fill={col} stroke={stroke} strokeWidth={3} strokeLinejoin="round" />
            {cat && <rect x={tip[0] - 7} y={tip[1] + 20} width={14} height={42} rx={7} fill="#5b3b24" stroke={stroke} strokeWidth={3} transform={`rotate(${lean * 0.3},${tip[0]},${tip[1] + 40})`} />}
          </g>
        );
      })}
    </g>
  );
};
/** water body with drifting ripple strokes */
export const Water: React.FC<{y: number; f: number; fill: string; light?: string; x0?: number; x1?: number; bottom?: number; seed?: number; shore?: string}> = ({y, f, fill, light = '#c7d4d0', x0 = -700, x1 = 2700, bottom = 1500, seed = 4, shore}) => {
  const R = rng(seed);
  const rip = Array.from({length: 60}, () => ({x: x0 + R() * (x1 - x0), y: y + 20 + R() * (bottom - y - 40) * 0.5, w: 30 + R() * 90, p: R() * 6}));
  return (
    <g>
      <rect x={x0} y={y} width={x1 - x0} height={bottom - y} fill={fill} />
      {rip.map((r, i) => { const dx = Math.sin(f / 40 + r.p) * 12; const o = 0.35 + 0.35 * Math.sin(f / 25 + r.p * 2); return <path key={i} d={`M${r.x + dx},${r.y} l${r.w},0`} stroke={light} strokeWidth={3} strokeLinecap="round" opacity={o} />; })}
      {shore && <path d={`M${x0},${y} L${x1},${y}`} stroke={shore} strokeWidth={6} />}
    </g>
  );
};
/** fog sprite layer (HTML) */
/* N3 (31/10) — sương SỐNG: mỗi mảng thở chậm (dày / mỏng), nhấp nhô, và hoà dần sang một tấm sương khác trôi lệch tốc
   → hình sương cuộn đổi liên tục thay vì một tấm ảnh trượt ngang */
export const FogBank: React.FC<{x: number; y: number; w?: number; h?: number; k?: number; op?: number; drift?: number; f: number; tint?: string}> = ({x, y, w = 1800, h = 700, k = 0, op = 0.8, drift = 0.4, f, tint}) => {
  if (IP.nofog) return null;
  const s = x * 0.0137 + y * 0.0213 + k * 1.7;
  const br = 0.8 + 0.2 * Math.sin(f / 97 + s * 3.1), cf = 0.5 + 0.5 * Math.sin(f / 131 + s * 5.3);
  const bob = Math.sin(f / 113 + s) * h * 0.03, sy = 1 + 0.05 * Math.sin(f / 150 + s * 2);
  const st = (kk: number, o: number, dr: number, dy: number): React.CSSProperties => ({position: 'absolute', left: x, top: y, width: w, height: h, opacity: o, filter: tint,
    transform: `translate3d(${(f * dr).toFixed(3)}px,${dy.toFixed(2)}px,0) scaleY(${sy.toFixed(4)})`, willChange: 'transform'});
  return <>
    <Img src={staticFile(`fog${k % 4}.png`)} style={st(k, op * br * (1 - 0.45 * cf), drift, bob)} />
    <Img src={staticFile(`fog${(k + 1) % 4}.png`)} style={st(k + 1, op * br * 0.45 * cf, drift * 1.18, -bob * 0.7)} />
  </>;
};
/** dải sương mỏng TRÔI NGANG qua trước mặt nhân vật (cảnh sương dày): vài mảng lớn, mềm, mờ, đi nhanh hơn sương nền,
    hiện ra rồi tan — thay cho lớp sương phủ đứng yên làm cả khung đục như video kém chất lượng (Cậu Cả góp ý 29/10) */
export const FogWisps: React.FC<{f: number; y: number; op?: number; seed?: number; n?: number; speed?: number; h?: number}> = ({f, y, op = 0.25, seed = 3, n = 3, speed = 2.2, h = 420}) => {
  if (IP.nofog || op <= 0) return null;
  const R = rng(seed); const W = 2600;
  return <>{Array.from({length: n}, (_, i) => {
    const per = 520 + R() * 260, ph = R() * per, sp = speed * (0.7 + R() * 0.6), dy = (R() - 0.5) * h * 0.5, k = Math.floor(R() * 4);
    const t = ((f + ph) % per) / per;                        // mỗi mảng đi hết khung trong `per` khung rồi quay vòng
    const x = -W + t * (1920 + W) * (sp / speed);
    const env = Math.sin(Math.PI * t);                       // hiện dần ở giữa đường, mờ ở hai đầu
    return <Img key={i} src={staticFile(`fog${k}.png`)} style={{position: 'absolute', left: x, top: y + dy - h / 2, width: W, height: h, opacity: op * env, filter: 'blur(6px)'}} />;
  })}</>;
};
/** many fog banks to make a fog field */
export const FogField: React.FC<{f: number; y: number; rows?: number; op?: number; seed?: number; drift?: number; spread?: number; h?: number; x0?: number; x1?: number}> = ({f, y, rows = 3, op = 0.7, seed = 1, drift = 0.5, spread = 160, h = 520, x0 = -1400, x1 = 2600}) => {
  const R = rng(seed);
  const items: JSX.Element[] = [];
  for (let r = 0; r < rows; r++) for (let x = x0; x < x1; x += 900) {
    const xx = x + R() * 400; const yy = y + r * spread * 0.5 + (R() - 0.5) * spread * 0.5; const sp = drift * (0.6 + R() * 0.8);
    items.push(<FogBank key={r + '_' + x} x={xx} y={yy - h / 2} w={1700 + R() * 600} h={h} k={Math.floor(R() * 4)} op={op} drift={sp} f={f} />);
  }
  return <>{items}</>;
};
/** dark ground patches with scribble edges */
export const Ground: React.FC<{y: number; fill: string; patch?: string; seed?: number; x0?: number; x1?: number; bottom?: number; edge?: boolean}> = ({y, fill, patch, seed = 9, x0 = -700, x1 = 2700, bottom = 1500, edge = true}) => {
  const R = rng(seed);
  const ps = patch ? Array.from({length: 22}, () => ({x: x0 + R() * (x1 - x0), y: y + 30 + R() * (bottom - y), rx: 50 + R() * 140, ry: 10 + R() * 22})) : [];
  return (
    <g>
      <rect x={x0} y={y} width={x1 - x0} height={bottom - y} fill={fill} />
      {edge && <path d={`M${x0},${y} L${x1},${y}`} stroke={INK} strokeWidth={4} />}
      {ps.map((p, i) => <ellipse key={i} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill={patch} />)}
    </g>
  );
};
