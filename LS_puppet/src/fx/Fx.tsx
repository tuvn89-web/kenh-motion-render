/* BỘ HIỆU ỨNG DÙNG CHUNG: lửa, đốm lửa bay, quầng sáng, gợn nước, đất bắn, giáo/tên bay, tia va chạm, bụi, mặt trời, đổi màu theo giờ.
   Mọi thứ tính tất định theo khung (f) và seed → render song song nhiều máy vẫn khớp nhau.
   Toạ độ là toạ độ thế giới 1920×1080 của lớp đặt hiệu ứng (đặt trong Stage/Depth để ăn theo máy). */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {INK, clamp, rng, noise1} from '../lib/util';
import {useCue} from '../lib/cue';

const SvgLayer: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', ...style}}>{children}</svg>
);

/* ---------- LỬA: 3 lớp lưỡi lửa thay hình liên tục (như video mẫu vẽ lửa từng khung) ---------- */
const flamePath = (w: number, h: number, f: number, seed: number, tongues: number, speed: number) => {
  const n = noise1(seed);
  const pts: [number, number][] = [[-w / 2, 0]];
  for (let i = 0; i < tongues; i++) {
    const u = (i + 0.5) / tongues; const cx = -w / 2 + w * u;
    const mid = 1 - Math.abs(u - 0.5) * 1.4;                         // lưỡi giữa cao nhất
    const tip = h * mid * (0.7 + 0.45 * n(f * speed + i * 3.1));
    const sway = (n(f * speed * 0.7 + i * 7.7) - 0.5) * w * 0.25;
    pts.push([cx - w / tongues * 0.45, -tip * 0.35], [cx + sway, -tip], [cx + w / tongues * 0.45, -tip * 0.35]);
  }
  pts.push([w / 2, 0]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const [x, y] = pts[i]; const [px, py] = pts[i - 1]; d += ` Q${(px + x) / 2 + (y < py ? -3 : 3)},${(py + y) / 2} ${x},${y}`; }
  return d + ` Q0,${h * 0.12} ${pts[0][0]},${pts[0][1]}Z`;
};
/* B5 (29/10): lưỡi lửa méo bằng nhiễu (feTurbulence) đổi mẫu mỗi 2 khung — "sôi" như lửa vẽ tay từng khung trên nét đôi của video mẫu;
   viền mực mảnh cho lớp ngoài để cùng nét vẽ với nhân vật */
export const Fire: React.FC<{x: number; y: number; s?: number; f: number; seed?: number; logs?: boolean}> = ({x, y, s = 1, f, seed = 1, logs = true}) => {
  const id = `fire${seed}_${Math.round(x)}`; const cue = useCue();
  if (f % 15 === 0) cue('fire', x, y, {s});
  return (
    <SvgLayer>
      <defs><filter id={id} x="-40%" y="-60%" width="180%" height="190%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves={2} seed={Math.floor(f / 2) + seed * 97} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={16} xChannelSelector="R" yChannelSelector="G" />
      </filter></defs>
      <g transform={`translate(${x},${y}) scale(${s})`}>
        {logs && <g stroke={INK} strokeWidth={4} strokeLinecap="round"><path d="M-60,8 L55,-6" stroke="#5a3b25" strokeWidth={14} /><path d="M-55,-6 L60,8" stroke="#6b452a" strokeWidth={14} /><path d="M-60,8 L55,-6 M-55,-6 L60,8" fill="none" strokeWidth={3} opacity={0.6} /></g>}
        <g filter={`url(#${id})`}>
          <path d={flamePath(120, 150, f, seed, 5, 0.22)} fill="#d9481e" opacity={0.95} stroke="#5b2410" strokeWidth={3} strokeLinejoin="round" />
          <path d={flamePath(92, 118, f + 7, seed + 11, 4, 0.27)} fill="#f28a1f" />
          <path d={flamePath(56, 80, f + 13, seed + 23, 3, 0.33)} fill="#ffd34f" />
        </g>
      </g>
    </SvgLayer>
  );
};

/* ---------- TIA NẮNG xuyên sương (B5): các vệt sáng toả từ mặt trời, rất mờ, thở chậm — "up on the slopes, the air was clear" ---------- */
export const GodRays: React.FC<{x: number; y: number; f: number; n?: number; len?: number; op?: number; color?: string; seed?: number; spread?: number; dir?: number}> = ({x, y, f, n = 7, len = 1400, op = 0.22, color = '#fff6dc', seed = 4, spread = 70, dir = 200}) => {
  const R = rng(seed); const nz = noise1(seed + 9);
  const rays = Array.from({length: n}, (_, i) => ({a: dir - spread / 2 + (spread * (i + R() * 0.6)) / n, w: 2 + R() * 4, ph: R() * 50}));
  return (
    <SvgLayer style={{mixBlendMode: 'screen'}}>
      <defs>
        <radialGradient id={`gr${seed}`} cx={x} cy={y} r={len} gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={color} stopOpacity={1} /><stop offset="0.55" stopColor={color} stopOpacity={0.35} /><stop offset="1" stopColor={color} stopOpacity={0} /></radialGradient>
        <filter id={`grb${seed}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={14} /></filter>
      </defs>
      <g filter={`url(#grb${seed})`}>{rays.map((r, i) => {
        const a = ((r.a + (nz(f * 0.01 + r.ph) - 0.5) * 4) * Math.PI) / 180, w = (r.w * Math.PI) / 180;
        const o = op * (0.55 + 0.45 * nz(f * 0.02 + r.ph * 3));
        return <path key={i} d={`M${x},${y} L${x + Math.cos(a - w) * len},${y + Math.sin(a - w) * len} L${x + Math.cos(a + w) * len},${y + Math.sin(a + w) * len} Z`} fill={`url(#gr${seed})`} opacity={o} />;
      })}</g>
    </SvgLayer>
  );
};

/* ---------- LẤP LÁNH trên mặt nước (B5): vệt sáng ngắn hiện rồi tắt ở vùng mặt hồ ---------- */
export const Glints: React.FC<{x0: number; x1: number; y0: number; y1: number; f: number; n?: number; seed?: number; color?: string; size?: number}> = ({x0, x1, y0, y1, f, n = 26, seed = 2, color = '#fffbea', size = 1}) => {
  const R = rng(seed); const ps = Array.from({length: n}, () => ({x: x0 + R() * (x1 - x0), y: y0 + R() * (y1 - y0), life: 18 + R() * 26, off: R() * 200, w: (10 + R() * 26) * size}));
  return (
    <SvgLayer>{ps.map((p, i) => {
      const t = ((f + p.off) % (p.life * 3)) / p.life; if (t > 1) return null;
      const k = (p.y - y0) / Math.max(1, y1 - y0);   // gần máy (dưới) thì vệt dài hơn
      return <path key={i} d={`M${p.x - p.w * (0.6 + k) / 2},${p.y} l${p.w * (0.6 + k)},0`} stroke={color} strokeWidth={2 + 2 * k} strokeLinecap="round" opacity={Math.sin(Math.PI * t) * 0.8} />;
    })}</SvgLayer>
  );
};

/* ---------- QUẦNG SÁNG chập chờn (cộng sáng) ---------- */
export const Glow: React.FC<{x: number; y: number; r: number; color?: string; f: number; seed?: number; amp?: number; op?: number; blend?: 'screen' | 'normal'}> = ({x, y, r, color = '#ffb35a', f, seed = 3, amp = 0.18, op = 0.55, blend = 'screen'}) => {
  const n = noise1(seed); const k = 1 + (n(f * 0.25) - 0.5) * 2 * amp;
  return <div style={{position: 'absolute', left: x - r * k, top: y - r * k, width: 2 * r * k, height: 2 * r * k, borderRadius: '50%', background: `radial-gradient(circle, ${color} 0%, ${color}88 30%, transparent 70%)`, opacity: op * k, mixBlendMode: blend, pointerEvents: 'none'}} />;
};
/** độ chập chờn của lửa (0..1) để hắt ánh ấm lên nhân vật đứng gần */
export const flicker = (f: number, seed = 3) => { const n = noise1(seed); return clamp(0.55 + (n(f * 0.25) - 0.5) * 0.7 + (n(f * 0.9 + 40) - 0.5) * 0.25); };

/* ---------- ĐỐM LỬA BAY lơ lửng (đêm) / bay lên từ đám cháy ---------- */
export const Embers: React.FC<{x: number; y: number; w: number; h: number; n?: number; f: number; seed?: number; rise?: number; color?: string; size?: number}> = ({x, y, w, h, n = 16, f, seed = 5, rise = 1.2, color = '#ffb347', size = 3}) => {
  const R = rng(seed); const ps = Array.from({length: n}, () => ({x: R() * w, life: 70 + R() * 90, off: R() * 300, sw: 6 + R() * 18, ph: R() * 6, s: size * (0.6 + R() * 0.8)}));
  return (
    <SvgLayer>
      <defs><filter id={`emb${seed}`} x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.2" /></filter></defs>
      {ps.map((p, i) => {
        const a = (f + p.off) % p.life; const t = a / p.life;
        const px = x + p.x + Math.sin(a / 14 + p.ph) * p.sw; const py = y + h - a * rise;
        const o = Math.sin(Math.PI * t) * (0.6 + 0.4 * Math.sin(a * 0.9 + p.ph));
        return <g key={i} opacity={clamp(o)}><circle cx={px} cy={py} r={p.s * 2.6} fill={color} filter={`url(#emb${seed})`} /><circle cx={px} cy={py} r={p.s} fill="#fff2c4" /></g>;
      })}
    </SvgLayer>
  );
};

/* ---------- GỢN NƯỚC: vòng elip loang ra rồi mờ ---------- */
export const Ripples: React.FC<{x: number; y: number; f: number; n?: number; period?: number; r0?: number; spread?: number; color?: string; seed?: number}> = ({x, y, f, n = 3, period = 90, r0 = 20, spread = 160, color = '#eef3f2', seed = 0}) => (
  <SvgLayer>
    {Array.from({length: n}, (_, k) => {
      const a = (f + seed * 37 + (k * period) / n) % period; const t = a / period;
      return <ellipse key={k} cx={x} cy={y} rx={r0 + spread * t} ry={(r0 + spread * t) * 0.22} fill="none" stroke={color} strokeWidth={4 - 2.5 * t} opacity={(1 - t) * 0.8} />;
    })}
  </SvgLayer>
);

/* ---------- ĐẤT BẮN theo đường parabol (khi đào, khi ném) ---------- */
export const Clods: React.FC<{x: number; y: number; at: number[]; f: number; dir?: 1 | -1; n?: number; seed?: number; ground?: number; size?: number; color?: string}> = ({x, y, at, f, dir = 1, n = 6, seed = 9, ground, size = 14, color = '#6b5137'}) => {
  const R = rng(seed); const gy = ground ?? y + 60;
  const all = at.flatMap((a, j) => Array.from({length: n}, () => ({a, vx: dir * (2 + R() * 7), vy: -(9 + R() * 8), r: size * (0.5 + R() * 0.8), spin: (R() - 0.5) * 30, j})));
  return (
    <SvgLayer>
      {all.map((c, i) => {
        const t = f - c.a; if (t < 0) return null;
        const px = x + c.vx * t; const py = y + c.vy * t + 0.55 * t * t;
        if (py > gy + 4 && t > 4) return null;
        return <g key={i} transform={`translate(${px},${py}) rotate(${c.spin * t})`}><path d={`M${-c.r},0 Q${-c.r},${-c.r * 0.9} 0,${-c.r * 0.8} Q${c.r * 1.1},${-c.r * 0.7} ${c.r},0 Q${c.r * 0.6},${c.r * 0.8} 0,${c.r * 0.7} Q${-c.r * 0.9},${c.r * 0.6} ${-c.r},0Z`} fill={color} stroke={INK} strokeWidth={2.5} /></g>;
      })}
    </SvgLayer>
  );
};

/* ---------- GIÁO / TÊN BAY: vòng cung, mũi xoay theo hướng bay, có vệt mờ phía sau ---------- */
export type Shot = {x0: number; y0: number; x1: number; y1: number; at: number; dur: number; arc?: number; kind?: 'javelin' | 'arrow' | 'fire'};
export const Projectiles: React.FC<{shots: Shot[]; f: number; scale?: number}> = ({shots, f, scale = 1}) => {
  const cue = useCue(); shots.forEach((q) => { if (q.at === f) cue('throw', q.x0, q.y0); if (q.at + q.dur === f) cue('hit', q.x1, q.y1); });
  return (<SvgLayer>
    {shots.map((s, i) => {
      const t = (f - s.at) / s.dur; if (t < 0 || t > 1.02) return null;
      const P = (u: number) => [s.x0 + (s.x1 - s.x0) * u, s.y0 + (s.y1 - s.y0) * u - (s.arc ?? 120) * 4 * u * (1 - u)];
      const [px, py] = P(clamp(t)); const [qx, qy] = P(clamp(t - 0.04));
      const ang = (Math.atan2(py - qy, px - qx) * 180) / Math.PI; const L = (s.kind === 'arrow' ? 70 : 120) * scale;
      return (
        <g key={i}>
          <line x1={qx} y1={qy} x2={px} y2={py} stroke="#ffffff" strokeWidth={6 * scale} opacity={0.35} strokeLinecap="round" />
          <g transform={`translate(${px},${py}) rotate(${ang})`}>
            <line x1={-L} y1={0} x2={0} y2={0} stroke="#7a5534" strokeWidth={5 * scale} strokeLinecap="round" />
            <path d={`M0,${-6 * scale} L${16 * scale},0 L0,${6 * scale}Z`} fill="#b9b9b2" stroke={INK} strokeWidth={2} />
            {s.kind === 'fire' && <path d={`M${-L},0 q-20,-10 -36,0 q16,10 36,0`} fill="#f28a1f" />}
          </g>
        </g>
      );
    })}
  </SvgLayer>);
};

/* ---------- TIA VA CHẠM: chớp sao vàng ngắn (đấu nhau, trên bản đồ) ---------- */
export const Sparks: React.FC<{hits: {x: number; y: number; at: number}[]; f: number; s?: number}> = ({hits, f, s = 1}) => {
  const cue = useCue(); hits.forEach((h) => { if (h.at === f) cue('clash', h.x, h.y); });
  return (<SvgLayer>
    {hits.map((h, i) => {
      const t = (f - h.at) / 9; if (t < 0 || t > 1) return null;
      return <g key={i} transform={`translate(${h.x},${h.y}) scale(${s})`} opacity={1 - t}>
        {Array.from({length: 8}, (_, k) => { const a = (k / 8) * Math.PI * 2 + i; const r0 = 8 + 20 * t, r1 = 22 + 42 * t; return <line key={k} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke="#ffd65a" strokeWidth={5 - 3 * t} strokeLinecap="round" />; })}
        <circle r={10 * (1 - t)} fill="#fff6d2" />
      </g>;
    })}
  </SvgLayer>);
};

/* ---------- BỤI: cụm khói bụi phồng ra rồi tan ---------- */
export const DustPuffs: React.FC<{puffs: {x: number; y: number; at: number; s?: number}[]; f: number; color?: string; life?: number}> = ({puffs, f, color = '#d9ccaf', life = 34}) => {
  const cue = useCue(); puffs.forEach((q) => { if (q.at === f) cue('dust', q.x, q.y, {s: q.s ?? 1}); });
  return (<SvgLayer>
    <defs><filter id="dustblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter></defs>
    {puffs.map((p, i) => {
      const t = (f - p.at) / life; if (t < 0 || t > 1) return null; const s = p.s ?? 1;
      return <g key={i} opacity={(1 - t) * 0.85} filter="url(#dustblur)">{[-1, 0, 1].map((k) => <circle key={k} cx={p.x + k * 26 * s * (0.6 + t)} cy={p.y - 18 * s * t - (k === 0 ? 10 * s : 0)} r={(16 + 30 * t) * s} fill={color} />)}</g>;
    })}
  </SvgLayer>);
};

/* ---------- MẶT TRỜI: đĩa sáng + quầng, đi theo cung trong shot (đặt sau lớp trời) ---------- */
export const Sun: React.FC<{x: number; y: number; r?: number; color?: string; op?: number}> = ({x, y, r = 46, color = '#fff1c8', op = 1}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: op, pointerEvents: 'none'}}>
    <div style={{position: 'absolute', left: x - r * 7, top: y - r * 7, width: r * 14, height: r * 14, borderRadius: '50%', background: `radial-gradient(circle, ${color}cc 0%, ${color}55 18%, transparent 60%)`, mixBlendMode: 'screen'}} />
    <div style={{position: 'absolute', left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: '50%', background: color, boxShadow: `0 0 ${r}px ${color}`}} />
  </div>
);

/* ---------- ĐỔI MÀU THEO GIỜ: phủ màu (nhân) + vùng sáng (screen), chuyển dần trong shot ---------- */
export type Tone = {shade: string; light: string; k: number}; // shade nhân tối vùng tối, light hắt sáng ấm/lạnh, k cường độ
export const TONES = {
  dawn: {shade: '#3b4a6b', light: '#ffb98a', k: 0.55}, morning: {shade: '#8094a8', light: '#fff0d0', k: 0.25},
  noon: {shade: '#c8c4b8', light: '#fffbe8', k: 0.08}, golden: {shade: '#7a5a46', light: '#ffc46b', k: 0.4},
  dusk: {shade: '#3d2f4a', light: '#ff9a62', k: 0.55}, night: {shade: '#1b2236', light: '#8fa6d6', k: 0.7},
} satisfies Record<string, Tone>;
const mixHex = (a: string, b: string, t: number) => { const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
export const Grade: React.FC<{from: Tone; to?: Tone; t?: number}> = ({from, to, t = 0}) => {
  const T = to ?? from; const shade = mixHex(from.shade, T.shade, t), light = mixHex(from.light, T.light, t), k = from.k + (T.k - from.k) * t;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* soft-light: nhuộm sắc độ theo giờ nhưng giữ độ bão hoà + điểm đen (multiply cũ làm cả khung xám đục) */}
      <AbsoluteFill style={{background: shade, mixBlendMode: 'soft-light', opacity: k * 0.55}} />
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 60% 25%, ${light} 0%, transparent 65%)`, mixBlendMode: 'screen', opacity: k * 0.3}} />
    </AbsoluteFill>
  );
};
