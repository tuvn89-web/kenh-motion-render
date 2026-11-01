// Painterly cartoon characters drawn in SVG: gradients, warm rim light, brown ink — no image assets.
import React from 'react';

const INK = '#3A2418';
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const ToonDefs: React.FC = () => (
  <defs>
    <radialGradient id="skinG" cx="0.4" cy="0.35" r="0.75">
      <stop offset="0" stopColor="#F6C59A" />
      <stop offset="0.65" stopColor="#E3A273" />
      <stop offset="1" stopColor="#B9714C" />
    </radialGradient>
    <radialGradient id="skinG2" cx="0.45" cy="0.3" r="0.8">
      <stop offset="0" stopColor="#E9B88E" />
      <stop offset="0.7" stopColor="#CC8C62" />
      <stop offset="1" stopColor="#9C5E3F" />
    </radialGradient>
    <linearGradient id="tunicA" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#D9844A" />
      <stop offset="1" stopColor="#8E4A2A" />
    </linearGradient>
    <linearGradient id="tunicB" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#6F9DB0" />
      <stop offset="1" stopColor="#2F5568" />
    </linearGradient>
    <linearGradient id="woodG" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#5C3A22" />
      <stop offset="0.35" stopColor="#B07A48" />
      <stop offset="0.7" stopColor="#8A5A34" />
      <stop offset="1" stopColor="#4A2C18" />
    </linearGradient>
    <radialGradient id="cheek">
      <stop offset="0" stopColor="#E8706A" stopOpacity="0.55" />
      <stop offset="1" stopColor="#E8706A" stopOpacity="0" />
    </radialGradient>
  </defs>
);

type Eyes = 'open' | 'wide' | 'squeeze' | 'half';
const Eye: React.FC<{x: number; y: number; r: number; mode: Eyes; look?: [number, number]}> = ({x, y, r, mode, look = [0, 0]}) => {
  if (mode === 'squeeze')
    return <path d={`M${x - r} ${y - r * 0.2}L${x + r * 0.2} ${y + r * 0.25}L${x - r} ${y + r * 0.6}`} fill="none" stroke={INK} strokeWidth={r * 0.35} strokeLinecap="round" strokeLinejoin="round" />;
  const sy = mode === 'wide' ? 1.2 : mode === 'half' ? 0.55 : 1;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={r * 0.85} ry={r * sy} fill="#FFFDF6" stroke={INK} strokeWidth={r * 0.18} />
      <circle cx={x + look[0] * r * 0.3} cy={y + look[1] * r * 0.3 + (mode === 'half' ? r * 0.15 : 0)} r={r * (mode === 'wide' ? 0.36 : 0.46)} fill="#2A1A12" />
      <circle cx={x + look[0] * r * 0.3 + r * 0.16} cy={y + look[1] * r * 0.3 - r * 0.18} r={r * 0.14} fill="#fff" />
      {mode === 'half' && <path d={`M${x - r * 0.9} ${y - r * 0.15}Q${x} ${y - r * 0.55} ${x + r * 0.9} ${y - r * 0.15}`} fill="#E3A273" stroke={INK} strokeWidth={r * 0.18} />}
    </g>
  );
};

/** limb as a tapered skin-coloured stroke with ink outline (through an elbow point) */
const Limb: React.FC<{a: [number, number]; m: [number, number]; b: [number, number]; w: number; col: string}> = ({a, m, b, w, col}) => {
  const d = `M${a[0]} ${a[1]}Q${m[0]} ${m[1]} ${b[0]} ${b[1]}`;
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + 6} strokeLinecap="round" />
      <path d={d} fill="none" stroke={col} strokeWidth={w} strokeLinecap="round" />
    </g>
  );
};

/** Big, round worker with a mallet. swing: 0 = raised behind head, 1 = struck down. */
export const Bruno: React.FC<{x: number; y: number; s?: number; swing: number; squash?: number; eyes?: Eyes; mouth?: 'grit' | 'o' | 'grin'; breath?: number}> = ({
  x, y, s = 1, swing, squash = 0, eyes = 'open', mouth = 'grit', breath = 0,
}) => {
  const sq = 1 - squash * 0.08;
  // mallet arc around the shoulders
  const shX = 18;
  const shY = -250;
  const ang = lerp(-2.5, 0.35, swing); // radians from +x
  const R = 150;
  const hand: [number, number] = [shX + Math.cos(ang) * R * 0.55, shY + Math.sin(ang) * R * 0.55];
  const head: [number, number] = [shX + Math.cos(ang) * R * 1.35, shY + Math.sin(ang) * R * 1.35];
  return (
    <g transform={`translate(${x} ${y}) scale(${s} ${s * sq})`}>
      <ellipse cx={0} cy={4} rx={130} ry={18} fill="#1E140E" opacity={0.28} />
      {/* legs */}
      <Limb a={[-38, -95]} m={[-44, -50]} b={[-40, -8]} w={34} col="#5A4030" />
      <Limb a={[38, -95]} m={[44, -50]} b={[44, -8]} w={34} col="#5A4030" />
      <ellipse cx={-44} cy={-6} rx={30} ry={13} fill="#3A2418" />
      <ellipse cx={50} cy={-6} rx={30} ry={13} fill="#3A2418" />
      {/* belly / tunic */}
      <path d={`M-92 -150C-110 -60 -60 -80 0 -78C60 -80 112 -60 92 -150C80 -235 50 -262 0 -262C-50 -262 -80 -235 -92 -150Z`} fill="url(#tunicA)" stroke={INK} strokeWidth={6} transform={`scale(1 ${1 + breath * 0.02})`} />
      <path d="M-70 -110Q0 -92 70 -110" fill="none" stroke="#6E3418" strokeWidth={10} strokeLinecap="round" opacity={0.7} />
      <path d="M-40 -230Q-20 -170 -30 -120" fill="none" stroke="#F2B07A" strokeWidth={5} opacity={0.5} strokeLinecap="round" />
      {/* mallet */}
      <g>
        <line x1={hand[0]} y1={hand[1]} x2={head[0]} y2={head[1]} stroke={INK} strokeWidth={18} strokeLinecap="round" />
        <line x1={hand[0]} y1={hand[1]} x2={head[0]} y2={head[1]} stroke="#B07A48" strokeWidth={11} strokeLinecap="round" />
        <g transform={`translate(${head[0]} ${head[1]}) rotate(${(ang * 180) / Math.PI + 90})`}>
          <rect x={-46} y={-30} width={92} height={60} rx={14} fill="url(#woodG)" stroke={INK} strokeWidth={6} />
          <line x1={-30} y1={-30} x2={-30} y2={30} stroke="#3A2418" strokeWidth={4} opacity={0.6} />
          <line x1={30} y1={-30} x2={30} y2={30} stroke="#3A2418" strokeWidth={4} opacity={0.6} />
        </g>
      </g>
      {/* arms to the handle */}
      <Limb a={[-62, -228]} m={[(hand[0] - 62) / 2 - 30, (hand[1] - 228) / 2 + 10]} b={hand} w={36} col="#E3A273" />
      <Limb a={[70, -228]} m={[(hand[0] + 70) / 2 + 20, (hand[1] - 228) / 2 + 30]} b={[hand[0] + Math.cos(ang) * 30, hand[1] + Math.sin(ang) * 30]} w={36} col="#E3A273" />
      <circle cx={hand[0]} cy={hand[1]} r={22} fill="#E3A273" stroke={INK} strokeWidth={5} />
      {/* head */}
      <g transform="translate(6 -330)">
        <ellipse cx={0} cy={0} rx={82} ry={86} fill="url(#skinG)" stroke={INK} strokeWidth={6} />
        <path d="M-82 -14C-90 -88 70 -110 84 -24C60 -60 -40 -70 -82 -14Z" fill="#A8362A" stroke={INK} strokeWidth={6} />
        <ellipse cx={-6} cy={-58} rx={40} ry={14} fill="#C9473A" opacity={0.8} />
        <ellipse cx={-48} cy={30} rx={22} ry={16} fill="url(#cheek)" />
        <ellipse cx={52} cy={30} rx={22} ry={16} fill="url(#cheek)" />
        <Eye x={-26} y={-6} r={17} mode={eyes} look={[0.4, 0.4]} />
        <Eye x={30} y={-6} r={17} mode={eyes} look={[0.4, 0.4]} />
        <path d={`M-50 -32Q-28 ${eyes === 'squeeze' ? -24 : -40} -8 -30`} stroke="#3A2418" strokeWidth={12} strokeLinecap="round" fill="none" />
        <path d={`M14 -30Q34 ${eyes === 'squeeze' ? -24 : -40} 56 -32`} stroke="#3A2418" strokeWidth={12} strokeLinecap="round" fill="none" />
        <ellipse cx={4} cy={26} rx={24} ry={20} fill="#D98A62" stroke={INK} strokeWidth={5} />
        <ellipse cx={-4} cy={18} rx={8} ry={5} fill="#FFE0C0" opacity={0.6} />
        <path d="M-40 44Q-20 36 0 46Q20 36 42 44Q30 62 0 56Q-30 62 -40 44Z" fill="#4A2A1A" />
        {mouth === 'o' && <ellipse cx={2} cy={66} rx={10} ry={13} fill="#5A1E18" stroke={INK} strokeWidth={4} />}
        {mouth === 'grit' && <rect x={-16} y={58} width={34} height={12} rx={4} fill="#FFF6E8" stroke={INK} strokeWidth={4} />}
        {mouth === 'grin' && <path d="M-22 58Q2 82 26 58" fill="#5A1E18" stroke={INK} strokeWidth={4} />}
        <path d="M-70 -30Q-60 -70 -10 -76" stroke="#FFD7A8" strokeWidth={6} fill="none" opacity={0.55} strokeLinecap="round" />
      </g>
    </g>
  );
};

/** Thin, nervous helper holding the pile steady. flinch: 0..1 */
export const Lino: React.FC<{x: number; y: number; s?: number; flinch: number; eyes?: Eyes; look?: [number, number]}> = ({x, y, s = 1, flinch, eyes = 'open', look = [-0.6, 0]}) => {
  const lean = lerp(0, 10, flinch);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={4} rx={80} ry={14} fill="#1E140E" opacity={0.28} />
      <Limb a={[-18, -150]} m={[-26, -80]} b={[-22, -8]} w={22} col="#4C5A66" />
      <Limb a={[18, -150]} m={[22, -80]} b={[24, -8]} w={22} col="#4C5A66" />
      <g transform={`rotate(${lean} 0 -150)`}>
        <path d="M-44 -150C-52 -240 -40 -330 0 -336C40 -330 52 -240 44 -150Z" fill="url(#tunicB)" stroke={INK} strokeWidth={6} />
        <path d="M-20 -320Q-26 -250 -18 -170" stroke="#A9CFE0" strokeWidth={5} fill="none" opacity={0.45} strokeLinecap="round" />
        {/* arms reaching to the pile (to the left) */}
        <Limb a={[-30, -300]} m={[-90, -270]} b={[-128, -230 + flinch * 10]} w={22} col="#CC8C62" />
        <Limb a={[-20, -280]} m={[-80, -220]} b={[-128, -170 + flinch * 10]} w={22} col="#CC8C62" />
        <g transform={`translate(0 ${-410 + flinch * 14}) rotate(${flinch * 8})`}>
          <ellipse cx={0} cy={0} rx={50} ry={74} fill="url(#skinG2)" stroke={INK} strokeWidth={6} />
          <path d="M-50 -20C-56 -86 46 -98 52 -28C30 -56 -20 -60 -50 -20Z" fill="#2E211C" stroke={INK} strokeWidth={5} />
          <Eye x={-18} y={-6} r={15} mode={eyes} look={look} />
          <Eye x={20} y={-6} r={15} mode={eyes} look={look} />
          <path d={`M-34 -30Q-18 ${-40 - flinch * 8} -4 -28`} stroke="#2E211C" strokeWidth={8} strokeLinecap="round" fill="none" />
          <path d={`M8 -28Q24 ${-40 - flinch * 8} 38 -30`} stroke="#2E211C" strokeWidth={8} strokeLinecap="round" fill="none" />
          <path d="M-6 6Q-30 40 -2 44" fill="#B87650" stroke={INK} strokeWidth={5} />
          {flinch > 0.5 ? (
            <path d="M-16 52Q2 46 20 52" stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
          ) : (
            <path d="M-14 50Q2 62 18 50" stroke={INK} strokeWidth={5} fill="#7A2A20" strokeLinecap="round" />
          )}
          <ellipse cx={-30} cy={26} rx={14} ry={10} fill="url(#cheek)" />
        </g>
      </g>
    </g>
  );
};

/** Wooden pile with ring end-grain, driven down by `sink` px. */
export const Pile: React.FC<{x: number; top: number; h: number; w?: number; sink?: number}> = ({x, top, h, w = 54, sink = 0}) => (
  <g transform={`translate(0 ${sink})`}>
    <rect x={x - w / 2} y={top} width={w} height={h} rx={8} fill="url(#woodG)" stroke={INK} strokeWidth={6} />
    {[0.25, 0.5, 0.75].map((k) => (
      <path key={k} d={`M${x - w / 2 + 6} ${top + h * k}q${w / 2} 6 ${w - 12} 0`} stroke="#4A2C18" strokeWidth={3} fill="none" opacity={0.6} />
    ))}
    <ellipse cx={x} cy={top} rx={w / 2} ry={10} fill="#D6A472" stroke={INK} strokeWidth={5} />
    <ellipse cx={x} cy={top} rx={w / 4} ry={5} fill="none" stroke="#9A6A3C" strokeWidth={3} />
  </g>
);

/** Boat with a standing boatman and pole — silhouetted, warm rim light. */
export const Boatman: React.FC<{x: number; y: number; s?: number; t: number}> = ({x, y, s = 1, t}) => {
  const pole = Math.sin(t * 1.6) * 6;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-170 0Q-120 34 0 36Q120 34 178 -14L150 4Q60 14 -20 12Q-110 10 -170 0Z" fill="#2A1E22" />
      <path d="M-160 2Q-60 14 150 2" stroke="#F2A65A" strokeWidth={3} opacity={0.7} fill="none" />
      <g transform={`translate(30 0) rotate(${pole * 0.4})`}>
        <path d="M-14 0L-10 -90Q0 -112 12 -90L16 0Z" fill="#2A1E22" />
        <circle cx={0} cy={-122} r={20} fill="#2A1E22" />
        <path d="M-26 -136Q0 -160 28 -136Q0 -146 -26 -136Z" fill="#2A1E22" />
        <path d="M14 -122q8 -10 8 0" stroke="#F2A65A" strokeWidth={3} fill="none" opacity={0.8} />
        <line x1={-60} y1={-150} x2={60 + pole} y2={60} stroke="#2A1E22" strokeWidth={6} strokeLinecap="round" />
      </g>
    </g>
  );
};

/** A flock of distant birds (V strokes) flapping. */
export const Birds: React.FC<{t: number; n?: number; x0: number; y0: number; vx: number; col?: string; seed?: number; s?: number}> = ({t, n = 7, x0, y0, vx, col = '#2A1E22', seed = 1, s = 1}) => (
  <g>
    {Array.from({length: n}, (_, i) => {
      const r1 = Math.sin(i * 12.9 + seed) * 0.5 + 0.5;
      const r2 = Math.sin(i * 78.2 + seed) * 0.5 + 0.5;
      const x = x0 + vx * t + i * 46 * s + r1 * 30;
      const y = y0 + r2 * 60 * s + Math.sin(t * 1.4 + i) * 6;
      const f = Math.sin(t * 9 + i * 1.7) * 7 * s;
      return <path key={i} d={`M${x - 12 * s} ${y - f}Q${x - 5 * s} ${y - 2} ${x} ${y}Q${x + 5 * s} ${y - 2} ${x + 12 * s} ${y - f}`} stroke={col} strokeWidth={2.6 * s} fill="none" strokeLinecap="round" />;
    })}
  </g>
);
