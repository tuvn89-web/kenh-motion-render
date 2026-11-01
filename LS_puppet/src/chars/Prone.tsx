import React from 'react';
import {INK} from '../lib/util';
/** soldier lying on his belly, head up, looking right */
export const Prone: React.FC<{x: number; y: number; s?: number; kind?: 'gaul' | 'iberian' | 'african'; f?: number; sil?: string; face?: 1 | -1}> = ({x, y, s = 1, kind = 'iberian', f = 0, sil, face = 1}) => {
  const st = sil ?? INK; const F = (c: string) => sil ?? c;
  const skin = kind === 'gaul' ? '#e2b48c' : kind === 'african' ? '#7a4e33' : '#d9a77c';
  const body = kind === 'gaul' ? '#6a7d3c' : kind === 'african' ? '#b9a27a' : '#ece6d8';
  const breathe = Math.sin(f / 18) * 1.5;
  return (
    <g transform={`translate(${x},${y}) scale(${s * face},${s})`}>
      <path d="M-150,-14 L-60,-20" stroke={st} strokeWidth={30} strokeLinecap="round" />
      <path d="M-150,-14 L-60,-20" stroke={F(kind === 'gaul' ? '#6a7d3c' : skin)} strokeWidth={21} strokeLinecap="round" />
      <rect x={-80} y={-50 - breathe} width={110} height={46 + breathe} rx={22} fill={F(body)} stroke={st} strokeWidth={4.5} />
      {kind === 'iberian' && !sil && <path d="M-74,-8 L24,-8" stroke="#9b1d2a" strokeWidth={6} />}
      <path d="M10,-40 L70,-4" stroke={st} strokeWidth={22} strokeLinecap="round" /><path d="M10,-40 L70,-4" stroke={F(skin)} strokeWidth={13} strokeLinecap="round" />
      <circle cx={74} cy={-2} r={9} fill={F(skin)} stroke={st} strokeWidth={4} />
      <g transform="translate(40,-58)">
        <ellipse cx={0} cy={0} rx={34} ry={32} fill={F(skin)} stroke={st} strokeWidth={4.5} />
        {kind === 'gaul' && !sil && <path d="M-34,6 C-44,-26 -14,-46 12,-38 C28,-34 36,-22 32,-14 C14,-24 -4,-20 -16,-10 C-20,0 -24,10 -26,18 Z" fill="#b9802f" stroke={INK} strokeWidth={3} />}
        {kind !== 'gaul' && !sil && <path d="M-32,-4 C-30,-30 -6,-40 16,-34 C30,-30 36,-20 34,-14 C14,-22 -10,-18 -32,-4 Z" fill="#2c221b" stroke={INK} strokeWidth={3} />}
        {!sil && <><ellipse cx={14} cy={-4} rx={3.6} ry={5} fill={INK} /><ellipse cx={27} cy={-3} rx={3.6} ry={5} fill={INK} /><path d="M10,-14 L20,-17 M24,-17 L32,-13" stroke={INK} strokeWidth={3} strokeLinecap="round" /><path d="M18,14 L28,13" stroke={INK} strokeWidth={3} strokeLinecap="round" /></>}
      </g>
      <path d="M-30,-60 L150,-110" stroke={st} strokeWidth={9} strokeLinecap="round" /><path d="M-30,-60 L150,-110" stroke={F('#8b6b45')} strokeWidth={4} />
      <path d="M150,-110 l14,-10 l-4,16 Z" fill={F('#9aa3a8')} stroke={st} strokeWidth={3} />
    </g>
  );
};
