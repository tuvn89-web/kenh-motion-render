import React from 'react';
import {INK} from '../lib/util';
const SK = 4.5;
const leg = (x: number, y: number, a1: number, a2: number, l1: number, l2: number) => {
  const r1 = (a1 * Math.PI) / 180, r2 = ((a1 + a2) * Math.PI) / 180;
  const kx = x + Math.sin(r1) * l1, ky = y + Math.cos(r1) * l1;
  const fx = kx + Math.sin(r2) * l2, fy = ky + Math.cos(r2) * l2;
  return {kx, ky, fx, fy};
};
export type HorseProps = {x?: number; y?: number; s?: number; face?: 1 | -1; gait?: number; gaitAmp?: number; rear?: number; color?: string; sil?: string; headDown?: number; children?: React.ReactNode};
/** side-view horse; origin = ground under belly. gait: phase frames; rear: 0..1 lifts front around hind hooves */
export const Horse: React.FC<HorseProps> = ({x = 0, y = 0, s = 1, face = 1, gait = 0, gaitAmp = 0, rear = 0, color = '#8a5232', sil, headDown = 0, children}) => {
  const st = sil ?? INK; const F = (c: string) => sil ?? c;
  const t = (gait * 2 * Math.PI) / 26;
  const L = [
    {x: 62, ph: 0, front: true, far: true}, {x: 76, ph: Math.PI, front: true, far: false},
    {x: -66, ph: Math.PI * 0.5, front: false, far: true}, {x: -52, ph: Math.PI * 1.5, front: false, far: false},
  ];
  const legs = (far: boolean) => L.filter((l) => l.far === far).map((l, i) => {
    const sw = Math.sin(t + l.ph) * gaitAmp;
    const a1 = (l.front ? 4 : -6) + sw * 0.8 - (l.front ? rear * 50 : 0);
    const a2 = (l.front ? 0 : 10) + Math.max(0, -Math.cos(t + l.ph)) * gaitAmp * 1.6 * (l.front ? -1 : 1) - (l.front ? rear * -70 : 0);
    const g = leg(l.x, -96, a1, a2, 50, 52);
    const col = far ? '#6c3f26' : color;
    return (
      <g key={i + (far ? 'f' : 'n')}>
        <path d={`M${l.x},-110 L${l.x},-96 L${g.kx},${g.ky} L${g.fx},${g.fy}`} stroke={st} strokeWidth={17 + SK * 2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={`M${l.x},-110 L${l.x},-96 L${g.kx},${g.ky} L${g.fx},${g.fy}`} stroke={F(col)} strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x={g.fx - 10} y={g.fy - 6} width={20} height={11} rx={3} fill={F('#2e211a')} stroke={st} strokeWidth={3} />
      </g>
    );
  });
  const bob = Math.sin(t * 2) * gaitAmp * 0.08;
  return (
    <g transform={`translate(${x},${y}) scale(${s * face},${s}) rotate(${-rear * 26},-60,0)`}>
      <g transform={`translate(0,${bob})`}>
        {legs(true)}
        {/* tail */}
        <path d={`M-92,-140 C-120,-130 ${-128 - gaitAmp * 0.5},-100 ${-118 - gaitAmp * 0.6},-62 C-112,-90 -104,-118 -88,-128 Z`} fill={F('#2e211a')} stroke={st} strokeWidth={3.5} />
        {/* body */}
        <path d="M-96,-132 C-100,-170 -40,-176 20,-170 C70,-168 96,-160 98,-128 C100,-96 70,-88 20,-90 C-30,-92 -92,-92 -96,-132 Z" fill={F(color)} stroke={st} strokeWidth={SK} />
        {!sil && <path d="M-70,-104 C-30,-96 30,-96 70,-104" stroke="#000" strokeOpacity={0.12} strokeWidth={10} fill="none" />}
        {/* neck + head */}
        <g transform={`rotate(${headDown},70,-150)`}>
          <path d="M58,-160 C70,-200 92,-232 118,-246 C132,-236 132,-222 124,-212 C112,-196 104,-170 100,-136 Z" fill={F(color)} stroke={st} strokeWidth={SK} strokeLinejoin="round" />
          <path d="M112,-252 C130,-262 150,-246 176,-218 C186,-206 178,-194 166,-196 C150,-200 132,-214 116,-212 Z" fill={F(color)} stroke={st} strokeWidth={SK} strokeLinejoin="round" />
          <path d="M116,-246 L118,-270 L128,-250 Z" fill={F(color)} stroke={st} strokeWidth={3} strokeLinejoin="round" />
          <path d="M60,-162 C72,-196 92,-228 116,-250 C108,-232 98,-214 90,-190 C82,-176 72,-166 60,-162 Z" fill={F('#2e211a')} stroke={st} strokeWidth={3} />
          {!sil && <><circle cx={140} cy={-236} r={4} fill={INK} /><circle cx={170} cy={-206} r={2.5} fill={INK} /><path d="M128,-222 L172,-212 M150,-240 L150,-206" stroke="#3a2a20" strokeWidth={3} /></>}
        </g>
        {/* saddle cloth */}
        {!sil && <path d="M-30,-168 L40,-168 L36,-120 L-26,-120 Z" fill="#9b2430" stroke={INK} strokeWidth={3.5} />}
        {children}
        {legs(false)}
      </g>
    </g>
  );
};
