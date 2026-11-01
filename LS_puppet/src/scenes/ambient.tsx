/* H2 — CẢNH VẬT SỐNG (29/10/2026)
   - WIND: trời trôi — lớp ảnh bầu trời (độ sâu ≤ 0,1) trượt chậm theo gió (px / khung, dương = sang phải), mây vẽ sẵn trôi theo
   - SwayLayer: cỏ / lau sậy VẼ SẴN trong lớp nền lay theo gió (bản đồ src/scenes/sway.json do tools/gio_co.py dựng):
     dx = amp·w·sin(kx − ωt) → làn gió chạy ngang qua bãi cỏ, có cơn mạnh cơn nhẹ
   - DistantBirds: đàn chim xa bay ngang trời (vỗ cánh rồi lượn), nét mực mảnh */
import React, {useId} from 'react';
import {Img, staticFile} from 'remotion';
import {cutSrc} from '../puppet/assets';
import SJ from './sway.json';
import {rng} from '../lib/util';

type SwayMap = {amp: number; a: string; b: string; per?: number};
const SWAY = SJ as unknown as Record<string, SwayMap>;
export const hasSway = (name: string) => name in SWAY;
/** tốc độ trời trôi theo bối cảnh (px / khung ở 1080p); cùng chiều với làn gió trên cỏ */
export const WIND: Record<string, number> = {LAKEDAWN: 0.1, FOGROAD: 0.12, HILLTOP: 0.1, TUSCANY: 0.2, HILLTOWN: 0.15, POVHILL: 0.1, ROMANCAMP: 0.12, WIDEROAD: 0.12, SHORE: 0.1};

const LW = 2400, LH = 1350;   // khung lớp ảnh (xem LayerImg)
export const SwayLayer: React.FC<{name: string; f: number; style?: React.CSSProperties}> = ({name, f, style}) => {
  const M = SWAY[name]; const id = 'sw' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const ph = (2 * Math.PI * f) / (M.per ?? 84);                                               // một làn gió ~2,8 s (mặt nước nhanh hơn)
  const gust = 0.7 + 0.3 * Math.sin((2 * Math.PI * f) / 170 + 1.3) + 0.12 * Math.sin((2 * Math.PI * f) / 61);
  const S = 2 * M.amp * LW * gust;
  return (
    <div style={{position: 'absolute', left: -240, top: -135, width: LW, height: LH, filter: `url(#${id})`, ...style}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={id} filterUnits="userSpaceOnUse" x={0} y={0} width={LW} height={LH} colorInterpolationFilters="sRGB">
          <feImage href={M.a} x={0} y={0} width={LW} height={LH} preserveAspectRatio="none" result="a" />
          <feImage href={M.b} x={0} y={0} width={LW} height={LH} preserveAspectRatio="none" result="b" />
          <feDisplacementMap in="SourceGraphic" in2="a" scale={S * Math.cos(ph)} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feDisplacementMap in="d" in2="b" scale={-S * Math.sin(ph)} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <Img src={staticFile(cutSrc(name))} style={{position: 'absolute', left: 0, top: 0, width: LW, height: LH, objectFit: 'cover'}} />
    </div>
  );
};

/** đàn chim xa: (x, y) = vị trí đầu đàn lúc `at`, vx/vy px mỗi khung, s = sải cánh (px) */
export const DistantBirds: React.FC<{f: number; x: number; y: number; at?: number; vx?: number; vy?: number; n?: number; s?: number; seed?: number; color?: string; op?: number}> = ({f, x, y, at = 0, vx = 2, vy = -0.15, n = 5, s = 22, seed = 3, color = '#2a211b', op = 0.8}) => {
  const t = f - at; if (t < 0) return null;
  const R = rng(seed);
  const bs = Array.from({length: n}, (_, i) => ({dx: -i * s * (1.1 + R() * 0.8) * Math.sign(vx || 1), dy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * s * 0.55 + (R() - 0.5) * s * 0.6, ph: R() * 6, k: 0.75 + R() * 0.4, g: R() * 6}));
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}} opacity={op}>
      {bs.map((b, i) => {
        const bx = x + b.dx + vx * t + Math.sin(t / 37 + b.g) * s * 0.3, by = y + b.dy + vy * t + Math.sin(t / 23 + b.ph) * s * 0.25;
        const glide = Math.sin(t / 26 + b.g) > 0.35 ? 0.25 : 1;                      // vỗ cánh một lúc rồi lượn
        const w = Math.sin(t * 0.5 * b.k + b.ph) * s * 0.55 * glide; const h = s * b.k;
        return <path key={i} d={`M${bx - h},${by + w} Q${bx - h * 0.45},${by - h * 0.35} ${bx},${by} Q${bx + h * 0.45},${by - h * 0.35} ${bx + h},${by + w}`} stroke={color} strokeWidth={Math.max(1.8, s * 0.12)} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </svg>
  );
};

/* ---------- N3/N4/N7 — HẬU CẢNH SỐNG (31/10/2026) ---------- */
/** cột khói mảnh bốc lên (bếp trại, ống khói): chuỗi vòng tròn mờ uốn theo gió, viền nhoè bằng nhiễu; g = độ lớn (0..1.5) */
export const SmokeColumn: React.FC<{f: number; x: number; y: number; s?: number; n?: number; seed?: number; color?: string; op?: number; wind?: number; g?: number}> = ({f, x, y, s = 1, n = 8, seed = 1, color = '#8a8580', op = 0.42, wind = 1, g = 1}) => {
  const id = 'sm' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const pts = Array.from({length: n}, (_, k) => { const t = ((f * 0.9 + k * 22 + seed * 37) % (n * 22)) / (n * 22);   // mỗi vòng khói đi từ chân lên đỉnh rồi lặp
    return {t, x: x + (Math.sin(f / 23 + t * 5 + seed) * 6 + t * t * 90 * wind) * s * g, y: y - t * 260 * s * g, r: (7 + t * 30) * s * (0.6 + 0.4 * g)}; });
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <defs><filter id={id} x="-60%" y="-60%" width="220%" height="220%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves={2} seed={seed} result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale={18 * s} xChannelSelector="R" yChannelSelector="G" /><feGaussianBlur stdDeviation={3 * s} /></filter></defs>
      <g filter={`url(#${id})`}>{pts.map((p, k) => <circle key={k} cx={p.x} cy={p.y} r={p.r} fill={color} opacity={op * Math.sin(Math.PI * Math.min(1, p.t * 1.15)) * (1 - p.t * 0.5)} />)}</g>
    </svg>
  );
};
/** cờ (vexillum / cờ trên tháp) phấp phới: cán + tấm vải uốn sóng; (x, y) = đỉnh cán, h = cao cán */
export const Flag: React.FC<{f: number; x: number; y: number; h?: number; w?: number; color?: string; seed?: number; ink?: string; dir?: 1 | -1}> = ({f, x, y, h = 60, w = 30, color = '#b23a2a', seed = 1, ink = '#2a211b', dir = 1}) => {
  const N = 6, ht = w * 0.75, P: string[] = [], Q: string[] = [];
  for (let i = 0; i <= N; i++) { const u = i / N, a = Math.sin(f * 0.22 + seed - u * 3.2) * w * 0.12 * u; P.push(`${x + dir * u * w},${y + 3 + a}`); Q.unshift(`${x + dir * u * w},${y + 3 + ht + a + Math.sin(f * 0.19 + seed - u * 2.6) * w * 0.05 * u}`); }
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <line x1={x} y1={y} x2={x} y2={y + h} stroke={ink} strokeWidth={Math.max(1.5, h * 0.045)} strokeLinecap="round" />
      <path d={`M${P.join(' L')} L${Q.join(' L')} Z`} fill={color} stroke={ink} strokeWidth={Math.max(1.2, h * 0.03)} strokeLinejoin="round" />
    </svg>
  );
};
/** bóng mây lướt qua đồng (cảnh nắng / nhìn từ cao): mảng tối mềm trôi chậm, chỉ phủ phần đất (dưới đường chân trời yTop) */
export const CloudShadows: React.FC<{f: number; yTop: number; op?: number; seed?: number; speed?: number}> = ({f, yTop, op = 0.16, seed = 3, speed = 0.7}) => {
  const R = rng(seed);
  return (
    <div style={{position: 'absolute', left: -600, top: yTop, width: 3200, height: 1400 - yTop, overflow: 'hidden', mixBlendMode: 'multiply', opacity: op,
      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 140px)', maskImage: 'linear-gradient(to bottom, transparent 0, #000 140px)'}}>
      {Array.from({length: 5}, (_, i) => { const w = 700 + R() * 600, x0 = R() * 3200, yy = R() * (1000 - yTop) - 100, sp = speed * (0.7 + R() * 0.6);
        const x = ((x0 + f * sp) % (3200 + w)) - w;
        return <Img key={i} src={staticFile(`fog${i % 4}.png`)} style={{position: 'absolute', left: x, top: yy, width: w, height: w * 0.42, filter: 'brightness(0.25) blur(18px)'}} />; })}
    </div>
  );
};
/** N3 — sương tầng trên trời (trời xám phẳng → mây sương trôi chậm) + quầng mặt trời mờ sau sương */
export const SkyFog: React.FC<{f: number; y0: number; y1: number; op?: number; seed?: number; sun?: [number, number, number, number]}> = ({f, y0, y1, op = 0.3, seed = 5, sun}) => {
  const R = rng(seed);
  return <>
    {sun && <div style={{position: 'absolute', left: sun[0] - sun[2] * 4, top: sun[1] - sun[2] * 4, width: sun[2] * 8, height: sun[2] * 8, borderRadius: '50%', opacity: sun[3] * (0.9 + 0.1 * Math.sin(f / 70)),
      background: `radial-gradient(circle, rgba(255,246,222,1) 0%, rgba(255,240,205,0.85) ${(100 / 8).toFixed(1)}%, rgba(255,236,200,0.25) 30%, rgba(255,236,200,0) 70%)`}} />}
    {Array.from({length: 6}, (_, i) => { const w = 1300 + R() * 900, h = (y1 - y0) * (0.8 + R() * 0.6), x0 = -900 + R() * 3000, y = y0 + R() * (y1 - y0) - h / 2, sp = 0.12 + R() * 0.18, k = Math.floor(R() * 4);
      const x = ((x0 + f * sp + 1400) % 4200) - 1400; const breathe = 0.75 + 0.25 * Math.sin(f / (90 + i * 13) + i * 2.1);
      return <Img key={i} src={staticFile(`fog${k}.png`)} style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: op * breathe}} />; })}
  </>;
};
/** N9 — sương sát mặt đất che nhẹ chân người (cảnh sương): dải mờ mỏng trôi ngang ngay đường chân, nằm TRƯỚC nhân vật */
export const GroundMist: React.FC<{f: number; y: number; op?: number; seed?: number; h?: number}> = ({f, y, op = 0.22, seed = 9, h = 90}) => {
  const R = rng(seed);
  return <>{Array.from({length: 4}, (_, i) => { const w = 1600 + R() * 800, x0 = -1200 + R() * 2600, sp = 0.35 + R() * 0.4, k = Math.floor(R() * 4);
    const x = ((x0 + f * sp + 1600) % 4400) - 1600; const a = 0.7 + 0.3 * Math.sin(f / 60 + i * 1.7);
    return <Img key={i} src={staticFile(`fog${k}.png`)} style={{position: 'absolute', left: x, top: y - h * 0.62 + (R() - 0.5) * 20, width: w, height: h, opacity: op * a, filter: 'blur(4px)'}} />; })}</>;
};
