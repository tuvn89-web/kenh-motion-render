import React from 'react';
import {INK} from '../lib/util';
/** tiny marching Roman for wide shots (cheap to draw) */
export const MiniRoman: React.FC<{x: number; y: number; s?: number; f: number; ph?: number; sil?: string; onlyTop?: boolean}> = ({x, y, s = 0.3, f, ph = 0, sil, onlyTop}) => {
  const t = (f * 2 * Math.PI) / 28 + ph; const b = -Math.abs(Math.cos(t)) * 6;
  const st = sil ?? INK; const F = (c: string) => sil ?? c;
  return (
    <g transform={`translate(${x},${y + b * s}) scale(${s})`}>
      {!onlyTop && <>
        <path d={`M-6,-60 L${-6 - Math.sin(t) * 18},0 M6,-60 L${6 + Math.sin(t) * 18},0`} stroke={st} strokeWidth={14} strokeLinecap="round" />
        <rect x={-24} y={-130} width={50} height={78} rx={10} fill={F('#b33a2c')} stroke={st} strokeWidth={6} />
        <ellipse cx={-26} cy={-96} rx={22} ry={44} fill={F('#8c3b28')} stroke={st} strokeWidth={6} />
        <path d="M20,-120 L44,-250" stroke={st} strokeWidth={8} />
      </>}
      <circle cx={4} cy={-166} r={34} fill={F('#efcfae')} stroke={st} strokeWidth={6} />
      <path d="M-32,-176 C-30,-210 -6,-218 8,-218 C30,-218 42,-204 40,-176 Z" fill={F('#c99a4a')} stroke={st} strokeWidth={6} />
      {[-10, 0, 10].map((dx, i) => <path key={i} d={`M${6 + dx * 0.4},-216 c-8,-22 -6,-46 ${dx * 0.8},-64 c6,18 7,42 ${-dx * 0.8 + 2},64 Z`} fill={F(i === 1 ? '#7c1f2e' : '#241f33')} stroke={st} strokeWidth={4} transform={`rotate(${Math.sin(t + i) * 4},6,-216)`} />)}
    </g>
  );
};
/** feather tips + helmet dome only (for fog shots) */
export const HelmetTop: React.FC<{x: number; y: number; s?: number; f: number; ph?: number; sil?: string}> = ({x, y, s = 0.5, f, ph = 0, sil}) => {
  const t = (f * 2 * Math.PI) / 28 + ph; const b = -Math.abs(Math.cos(t)) * 8;
  const st = sil ?? INK; const F = (c: string) => sil ?? c;
  return (
    <g transform={`translate(${x},${y + b * s}) scale(${s})`}>
      {[-12, 0, 12].map((dx, i) => <path key={i} d={`M${dx * 0.4},-40 C-8,-62 -7,-90 ${dx * 0.8},-108 C7,-90 8,-62 ${dx * 0.4},-40 Z`} fill={F(i === 1 ? '#7c1f2e' : '#241f33')} stroke={st} strokeWidth={4} transform={`rotate(${dx * 0.9 + Math.sin(t + i) * 5},0,-40)`} />)}
      <path d="M-40,0 C-38,-34 -16,-44 0,-44 C20,-44 40,-32 40,0 Z" fill={F('#c99a4a')} stroke={st} strokeWidth={5} />
      <circle cx={0} cy={-46} r={7} fill={F('#c99a4a')} stroke={st} strokeWidth={4} />
    </g>
  );
};
