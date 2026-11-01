import React from 'react';
import {INK} from '../lib/util';

export type Kind = 'hastatus' | 'signifer' | 'consul' | 'hannibal' | 'iberian' | 'gaul';
export type Expr = {
  eyes?: 'dot' | 'wide' | 'closed' | 'squint' | 'down';
  brows?: 'flat' | 'worried' | 'angry' | 'raised' | 'none';
  mouth?: 'flat' | 'smile' | 'frown' | 'open' | 'shout' | 'o' | 'smirk' | 'grit';
};
export type Pose = {
  legA?: number; legB?: number; // back / front leg angle (deg, + = forward)
  armA?: number; armB?: number; // back / front arm angle (deg, 0 = hanging, + = forward/up)
  forearmB?: number;
  tilt?: number; headTilt?: number; bob?: number; headFlip?: boolean;
};
export type PersonProps = {
  kind: Kind; x?: number; y?: number; s?: number; face?: 1 | -1;
  pose?: Pose; expr?: Expr; sil?: string; feather?: number; // feather sway
  hold?: 'pilum' | 'spear' | 'sword' | 'falcata' | 'standard' | 'shovel' | 'none';
  holdAngle?: number; shield?: boolean; helmet?: boolean; skin?: string; tunic?: string;
  prone?: boolean; cloakWave?: number; mud?: boolean; opacity?: number;
};

const SK = 4.5;
const cap = (x1: number, y1: number, len: number, ang: number, w: number) => {
  // capsule from (x1,y1) pointing down rotated by ang (deg, + = toward +x)
  const a = (ang * Math.PI) / 180; const x2 = x1 + Math.sin(a) * len, y2 = y1 + Math.cos(a) * len;
  return {x2, y2, d: `M${x1},${y1} L${x2},${y2}`, w};
};

const Limb: React.FC<{x: number; y: number; len: number; ang: number; w: number; fill: string; sil?: string; end?: 'foot' | 'hand' | 'none'; endFill?: string; pattern?: string}> = ({x, y, len, ang, w, fill, sil, end = 'none', endFill, pattern}) => {
  const c = cap(x, y, len, ang, w);
  const col = sil ?? fill;
  return (
    <g>
      <path d={c.d} stroke={sil ?? INK} strokeWidth={w + SK * 2} strokeLinecap="round" />
      <path d={c.d} stroke={col} strokeWidth={w} strokeLinecap="round" />
      {pattern && !sil && <path d={c.d} stroke={pattern} strokeWidth={w * 0.55} strokeLinecap="round" strokeDasharray="5 7" />}
      {end === 'foot' && <ellipse cx={c.x2 + 7} cy={c.y2 + 2} rx={13} ry={7.5} fill={sil ?? endFill ?? '#5d4130'} stroke={sil ?? INK} strokeWidth={SK} />}
      {end === 'hand' && <circle cx={c.x2} cy={c.y2} r={9} fill={sil ?? endFill ?? '#f0cfae'} stroke={sil ?? INK} strokeWidth={SK} />}
    </g>
  );
};

const OUTFIT: Record<Kind, {tunic: string; tunicD: string; skin: string; leg: string; legPat?: string; foot: string}> = {
  hastatus: {tunic: '#b33a2c', tunicD: '#8a2a21', skin: '#efcfae', leg: '#efcfae', foot: '#5d4130'},
  signifer: {tunic: '#b33a2c', tunicD: '#8a2a21', skin: '#e9c49e', leg: '#e9c49e', foot: '#5d4130'},
  consul: {tunic: '#8e2232', tunicD: '#6d1826', skin: '#ecc9a6', leg: '#ecc9a6', foot: '#4a3426'},
  hannibal: {tunic: '#e8dfcc', tunicD: '#c9bea6', skin: '#c48a5e', leg: '#c48a5e', foot: '#4a3426'},
  iberian: {tunic: '#ece6d8', tunicD: '#cfc6b2', skin: '#d9a77c', leg: '#d9a77c', foot: '#4a3426'},
  gaul: {tunic: '#e2b48c', tunicD: '#c99772', skin: '#e2b48c', leg: '#6a7d3c', legPat: '#a98a3c', foot: '#4a3426'},
};

export const Person: React.FC<PersonProps> = (p) => {
  const {kind, x = 0, y = 0, s = 1, face = 1, pose = {}, expr = {}, sil, feather = 0, hold = 'none', holdAngle = -25, shield = false, prone = false, cloakWave = 0, mud = false, opacity = 1} = p;
  const O = {...OUTFIT[kind]};
  if (p.skin) { O.skin = p.skin; if (kind !== 'gaul') O.leg = p.skin; }
  if (p.tunic) O.tunic = p.tunic;
  const helmet = p.helmet ?? (kind === 'hastatus' || kind === 'signifer' || kind === 'consul');
  const {legA = -6, legB = 6, armA = -8, armB = 10, tilt = 0, headTilt = 0, bob = 0, headFlip = false} = pose;
  const F = (c: string) => sil ?? c;
  const st = sil ?? INK;
  const hipY = -62, shY = -124;
  const isGaul = kind === 'gaul';
  const torsoFill = isGaul ? O.skin : O.tunic;

  const body = (
    <g transform={`translate(0,${bob}) rotate(${tilt},0,${hipY})`}>
      {/* cloak (behind) */}
      {(kind === 'consul' || kind === 'hannibal') && (
        <path d={`M-14,-132 C-40,-110 ${-58 - cloakWave},-70 ${-62 - cloakWave * 1.4},-34 L-20,-40 C-24,-80 -18,-110 -6,-132 Z`} fill={F(kind === 'consul' ? '#a4262c' : '#4e2a5a')} stroke={st} strokeWidth={SK} strokeLinejoin="round" />
      )}
      {/* shield behind body */}
      {shield && (kind === 'hastatus' || kind === 'signifer') && (
        <g transform="translate(-30,-98) rotate(-8)">
          <ellipse rx={30} ry={56} fill={F('#8c3b28')} stroke={st} strokeWidth={SK} />
          {!sil && <><ellipse rx={23} ry={49} fill="none" stroke="#b5683f" strokeWidth={3} /><path d="M0,-46 L0,46" stroke="#c99a4a" strokeWidth={5} /><ellipse rx={8} ry={12} fill="#c99a4a" stroke={INK} strokeWidth={3} /></>}
        </g>
      )}
      {shield && kind === 'gaul' && (
        <g transform="translate(-30,-96) rotate(-6)">
          <rect x={-24} y={-62} width={48} height={124} rx={24} fill={F('#3f5a6e')} stroke={st} strokeWidth={SK} />
          {!sil && <><path d="M0,-56 L0,56" stroke="#2e4252" strokeWidth={6} /><ellipse rx={9} ry={16} fill="#8f7c5a" stroke={INK} strokeWidth={3} /></>}
        </g>
      )}
      {shield && kind === 'iberian' && (
        <g transform="translate(-28,-100)"><circle r={30} fill={F('#7a5838')} stroke={st} strokeWidth={SK} />{!sil && <><circle r={21} fill="none" stroke="#a37a4c" strokeWidth={3} /><circle r={8} fill="#b7a27a" stroke={INK} strokeWidth={3} /></>}</g>
      )}
      {/* back arm */}
      <Limb x={2} y={shY} len={54} ang={armA} w={14} fill={isGaul ? O.skin : O.tunicD} sil={sil} end="hand" endFill={O.skin} />
      {/* torso */}
      <path d={`M-22,${shY - 8} Q2,${shY - 16} 26,${shY - 8} L33,-54 Q2,-46 -29,-54 Z`} fill={F(torsoFill)} stroke={st} strokeWidth={SK} strokeLinejoin="round" />
      {!sil && kind === 'iberian' && <><path d="M-29,-54 Q2,-46 33,-54 L32,-62 Q2,-55 -28,-62 Z" fill="#9b1d2a" /><path d="M-10,-132 Q4,-122 18,-132" stroke="#9b1d2a" strokeWidth={6} fill="none" /></>}
      {!sil && isGaul && <><path d={`M-29,-54 Q2,-46 33,-54 L31,-70 Q2,-63 -27,-70 Z`} fill="#6a7d3c" stroke={INK} strokeWidth={3} /><path d="M-6,-132 Q6,-124 18,-132" stroke="#d4a43a" strokeWidth={6} fill="none" strokeLinecap="round" /></>}
      {!sil && kind === 'hannibal' && <><path d="M-24,-120 Q2,-126 28,-120 L30,-84 Q2,-80 -26,-84 Z" fill="#9c7a44" stroke={INK} strokeWidth={3} />{[-14, -2, 10, 22].map((xx) => <path key={xx} d={`M${xx - 6},-108 q6,7 12,0 M${xx - 6},-96 q6,7 12,0`} stroke="#6f5530" strokeWidth={2} fill="none" />)}</>}
      {!sil && kind === 'consul' && <><path d="M-24,-124 Q2,-130 28,-124 L31,-78 Q2,-72 -27,-78 Z" fill="#c99a4a" stroke={INK} strokeWidth={3.5} /><path d="M-6,-112 q8,7 16,0 M-4,-98 q6,5 12,0" stroke="#8f6a2f" strokeWidth={3} fill="none" />{[-24, -12, 0, 12, 24].map((xx) => <rect key={xx} x={xx - 4} y={-78} width={9} height={20} rx={2} fill="#e4dccb" stroke={INK} strokeWidth={2.5} />)}</>}
      {!sil && (kind === 'hastatus' || kind === 'signifer') && <><path d="M-18,-131 L20,-104 M26,-131 L-8,-104" stroke="#6b4a32" strokeWidth={4} /><rect x={-9} y={-121} width={24} height={24} rx={3} fill="#c99a4a" stroke={INK} strokeWidth={3.5} /><circle cx={3} cy={-109} r={5} fill="none" stroke="#8f6a2f" strokeWidth={2.5} /></>}
      {!sil && !isGaul && kind !== 'consul' && <rect x={-28} y={-78} width={60} height={9} rx={2} fill="#6b4a32" stroke={INK} strokeWidth={3} />}
      {!sil && kind === 'signifer' && <path d="M-22,-134 Q2,-150 28,-134 L28,-120 Q2,-130 -22,-120 Z" fill="#7a6248" stroke={INK} strokeWidth={3} />}
      {/* head */}
      <g transform={`rotate(${headTilt},4,-150)`}>
        <Head kind={kind} O={O} expr={expr} sil={sil} helmet={helmet} feather={feather} flip={headFlip} mud={mud} />
      </g>
      {/* front arm + held item */}
      <HeldItem hold={hold} armB={armB} holdAngle={holdAngle} sil={sil} />
      <Limb x={2} y={shY} len={54} ang={armB} w={14} fill={isGaul ? O.skin : O.tunic} sil={sil} end="hand" endFill={O.skin} />
    </g>
  );

  return (
    <g transform={`translate(${x},${y}) scale(${s * face},${s})${prone ? ' rotate(-88,0,-30) translate(40,40)' : ''}`} opacity={opacity}>
      <Limb x={-4} y={hipY} len={58} ang={legA} w={17} fill={isGaul ? O.leg : O.leg} sil={sil ? sil : undefined} end="foot" endFill={O.foot} pattern={O.legPat} />
      <Limb x={6} y={hipY} len={58} ang={legB} w={17} fill={O.leg} sil={sil} end="foot" endFill={O.foot} pattern={O.legPat} />
      {body}
    </g>
  );
};

const HeldItem: React.FC<{hold: string; armB: number; holdAngle: number; sil?: string}> = ({hold, armB, holdAngle, sil}) => {
  if (hold === 'none') return null;
  const a = (armB * Math.PI) / 180; const hx = 2 + Math.sin(a) * 54, hy = -124 + Math.cos(a) * 54;
  const st = sil ?? INK;
  const rot = holdAngle;
  if (hold === 'pilum' || hold === 'spear') {
    const long = hold === 'pilum' ? 190 : 210;
    return (
      <g transform={`translate(${hx},${hy}) rotate(${rot})`}>
        <path d={`M0,${long * 0.35} L0,${-long * 0.45}`} stroke={st} strokeWidth={11} strokeLinecap="round" />
        <path d={`M0,${long * 0.35} L0,${-long * 0.45}`} stroke={sil ?? '#8b6b45'} strokeWidth={5} strokeLinecap="round" />
        {hold === 'pilum' ? (
          <><path d={`M0,${-long * 0.45} L0,${-long * 0.72}`} stroke={st} strokeWidth={7} /><path d={`M0,${-long * 0.45} L0,${-long * 0.72}`} stroke={sil ?? '#9aa3a8'} strokeWidth={3} /><path d={`M-6,${-long * 0.72} L0,${-long * 0.8} L6,${-long * 0.72} Z`} fill={sil ?? '#9aa3a8'} stroke={st} strokeWidth={3} /></>
        ) : (
          <path d={`M-8,${-long * 0.45} L0,${-long * 0.6} L8,${-long * 0.45} Z`} fill={sil ?? '#9aa3a8'} stroke={st} strokeWidth={3.5} />
        )}
      </g>
    );
  }
  if (hold === 'sword' || hold === 'falcata') {
    return (
      <g transform={`translate(${hx},${hy}) rotate(${rot})`}>
        {hold === 'sword' ? <path d="M-6,-6 L-6,-92 L0,-104 L6,-92 L6,-6 Z" fill={sil ?? '#c3c9cc'} stroke={st} strokeWidth={3.5} /> : <path d="M-5,-6 C-12,-40 4,-70 14,-96 C10,-64 8,-34 6,-6 Z" fill={sil ?? '#c3c9cc'} stroke={st} strokeWidth={3.5} />}
        <rect x={-14} y={-8} width={28} height={7} rx={3} fill={sil ?? '#6b4a32'} stroke={st} strokeWidth={3} />
      </g>
    );
  }
  if (hold === 'standard') {
    return (
      <g transform={`translate(${hx},${hy}) rotate(${rot})`}>
        <path d="M0,120 L0,-210" stroke={st} strokeWidth={11} strokeLinecap="round" /><path d="M0,120 L0,-210" stroke={sil ?? '#8b6b45'} strokeWidth={5} />
        <Standard sil={sil} />
      </g>
    );
  }
  if (hold === 'shovel') {
    return (
      <g transform={`translate(${hx},${hy}) rotate(${rot})`}>
        <path d="M0,-90 L0,70" stroke={st} strokeWidth={11} strokeLinecap="round" /><path d="M0,-90 L0,70" stroke={sil ?? '#8b6b45'} strokeWidth={5} />
        <path d="M-16,70 L16,70 L12,104 Q0,114 -12,104 Z" fill={sil ?? '#8d969b'} stroke={st} strokeWidth={3.5} />
      </g>
    );
  }
  return null;
};

/** manipular standard: an open hand on top of a pole, with discs and a crossbar */
export const Standard: React.FC<{sil?: string}> = ({sil}) => {
  const st = sil ?? INK;
  return (
    <g>
      <rect x={-16} y={-150} width={32} height={6} rx={3} fill={sil ?? '#c99a4a'} stroke={st} strokeWidth={3} />
      {[-128, -104, -80].map((yy) => <circle key={yy} cy={yy} r={11} fill={sil ?? '#d6b05a'} stroke={st} strokeWidth={3} />)}
      <path d="M-14,-150 L-16,-158 M14,-150 L16,-158" stroke={st} strokeWidth={3} />
      <path d="M-12,-158 C-14,-176 -16,-196 -10,-204 C-6,-196 -6,-184 -4,-178 L-4,-210 C-4,-218 4,-218 4,-210 L4,-182 L6,-212 C6,-220 14,-220 14,-212 L12,-178 L18,-200 C20,-206 26,-204 24,-196 L16,-160 Z" fill={sil ?? '#d6b05a'} stroke={st} strokeWidth={3.5} strokeLinejoin="round" />
    </g>
  );
};

const Head: React.FC<{kind: Kind; O: any; expr: Expr; sil?: string; helmet: boolean; feather: number; flip: boolean; mud: boolean}> = ({kind, O, expr, sil, helmet, feather, flip, mud}) => {
  const st = sil ?? INK;
  const F = (c: string) => sil ?? c;
  const {eyes = 'dot', brows = 'flat', mouth = 'flat'} = expr;
  const cx = 6, cy = -182;
  const face = (
    <g>
      {/* ear */}
      <ellipse cx={-14} cy={-180} rx={8} ry={11} fill={F(O.skin)} stroke={st} strokeWidth={SK} />
      {/* head */}
      <ellipse cx={cx} cy={cy} rx={37} ry={40} fill={F(O.skin)} stroke={st} strokeWidth={SK} />
      {!sil && <ellipse cx={cx - 8} cy={cy + 8} rx={26} ry={26} fill="#000" opacity={0.04} />}
      {!sil && mud && <><ellipse cx={18} cy={-170} rx={10} ry={6} fill="#6e5a40" opacity={0.8} /><ellipse cx={-6} cy={-200} rx={7} ry={4} fill="#6e5a40" opacity={0.8} /></>}
      {/* hair / beard */}
      {!sil && kind === 'hannibal' && <path d="M-26,-176 C-34,-206 -14,-226 8,-224 C30,-224 44,-210 42,-196 C34,-204 22,-208 10,-206 C2,-200 -8,-196 -12,-186 Z" fill="#231a16" />}
      {!sil && kind === 'hannibal' && <path d="M-6,-164 C-4,-140 10,-130 24,-134 C38,-138 44,-152 42,-168 C34,-158 22,-156 14,-158 C8,-160 0,-162 -6,-164 Z" fill="#231a16" stroke={INK} strokeWidth={3} />}
      {!sil && kind === 'gaul' && <><path d="M-30,-160 C-44,-196 -18,-232 12,-226 C40,-222 46,-200 40,-188 C30,-200 10,-206 -8,-198 C-16,-184 -18,-170 -16,-150 Z" fill="#b9802f" stroke={INK} strokeWidth={3} /><path d="M14,-166 C24,-172 36,-170 42,-162 C40,-152 34,-150 30,-156 C26,-162 20,-160 14,-158 Z" fill="#b9802f" stroke={INK} strokeWidth={2.5} /></>}
      {!sil && kind === 'iberian' && <path d="M-30,-190 C-28,-218 -2,-232 22,-226 C38,-220 44,-206 42,-198 C24,-206 0,-208 -30,-190 Z" fill="#3b2d24" stroke={INK} strokeWidth={3.5} />}
      {!sil && kind === 'consul' && <path d="M-16,-186 C-20,-176 -18,-166 -12,-160" stroke="#a8a8a2" strokeWidth={6} fill="none" strokeLinecap="round" />}
      {/* eyes */}
      <g transform="translate(0,7)">
        {!sil && <Eyes kind={kind} eyes={eyes} />}
        {!sil && <Brows kind={kind} brows={brows} />}
        {!sil && <path d="M41,-186 q7,5 1,10" stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />}
        {!sil && <Mouth mouth={mouth} kind={kind} />}
      </g>
    </g>
  );
  return (
    <g transform={flip ? `translate(${2 * cx},0) scale(-1,1)` : undefined}>
      {face}
      {helmet && kind !== 'consul' && (
        <g transform="translate(0,-14)">
          {/* Montefortino helmet with three feathers */}
          {[-12, 0, 12].map((dx, i) => (
            <g key={i} transform={`translate(${6 + dx * 0.4},-226) rotate(${dx * 0.9 + feather * (1 + i * 0.3)})`}>
              <path d="M0,0 C-7,-22 -6,-48 0,-66 C6,-48 7,-22 0,0 Z" fill={F(i === 1 ? '#7c1f2e' : '#241f33')} stroke={st} strokeWidth={3} />
              {!sil && <path d="M0,-4 L0,-58" stroke="#5d5470" strokeWidth={1.5} />}
            </g>
          ))}
          <path d="M-32,-188 C-34,-222 -12,-236 8,-236 C30,-236 46,-220 44,-190 L48,-186 L-38,-184 Z" fill={F('#c99a4a')} stroke={st} strokeWidth={SK} strokeLinejoin="round" />
          {!sil && <path d="M-26,-200 C-20,-224 0,-230 16,-228" stroke="#e6c27a" strokeWidth={4} fill="none" strokeLinecap="round" />}
          <path d="M-38,-186 L48,-186" stroke={st} strokeWidth={SK + 1} />
          <circle cx={6} cy={-238} r={7} fill={F('#c99a4a')} stroke={st} strokeWidth={3.5} />
          {/* cheek guard */}
          <path d="M-28,-186 L-2,-186 L-4,-158 Q-15,-150 -26,-158 Z" fill={F('#b8893e')} stroke={st} strokeWidth={3.5} strokeLinejoin="round" />
          {!sil && <circle cx={-15} cy={-172} r={2.5} fill={INK} />}
        </g>
      )}
      {helmet && kind === 'consul' && (
        <g transform="translate(0,-8)">
          <path d={`M-34,-186 C-30,-232 -6,-242 10,-242 C32,-242 46,-224 44,-188 Z`} fill={F('#c99a4a')} stroke={st} strokeWidth={SK} />
          <path d={`M-30,-232 C-20,-262 30,-266 46,-236 C${44 + feather},-226 ${28 + feather},-236 10,-240 C-6,-238 -20,-232 -30,-232 Z`} fill={F('#b3262c')} stroke={st} strokeWidth={3.5} />
          {!sil && <path d="M-24,-238 C-10,-254 20,-258 38,-244" stroke="#7f1a20" strokeWidth={2.5} fill="none" />}
          <path d="M-36,-188 L46,-188" stroke={st} strokeWidth={SK + 1} />
          {!sil && <path d="M40,-204 C46,-198 48,-192 46,-188" stroke={INK} strokeWidth={3} fill="none" />}
        </g>
      )}
    </g>
  );
};

const Eyes: React.FC<{kind: Kind; eyes: string}> = ({kind, eyes}) => {
  const E = [[14, -186], [31, -185]];
  return (
    <g>
      {E.map(([ex, ey], i) => {
        if (kind === 'hannibal' && i === 0) {
          return <g key={i}><path d={`M${ex - 6},${ey + 1} q6,4 12,0`} stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round" /><path d={`M${ex - 3},${ey - 14} L${ex + 4},${ey + 12}`} stroke="#8a4b3a" strokeWidth={3} strokeLinecap="round" /></g>;
        }
        if (eyes === 'closed') return <path key={i} d={`M${ex - 5},${ey} q5,4 10,0`} stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round" />;
        if (eyes === 'squint') return <path key={i} d={`M${ex - 6},${ey} L${ex + 6},${ey - 1}`} stroke={INK} strokeWidth={3.6} strokeLinecap="round" />;
        if (eyes === 'wide') return <g key={i}><ellipse cx={ex} cy={ey} rx={7.5} ry={9.5} fill="#fff" stroke={INK} strokeWidth={2.5} /><circle cx={ex + 1.5} cy={ey} r={3.4} fill={INK} /></g>;
        if (eyes === 'down') return <ellipse key={i} cx={ex} cy={ey + 3} rx={4} ry={4.5} fill={INK} />;
        return <ellipse key={i} cx={ex} cy={ey} rx={4.3} ry={6.2} fill={INK} />;
      })}
    </g>
  );
};
const Brows: React.FC<{kind: Kind; brows: string}> = ({brows}) => {
  if (brows === 'none') return null;
  const b: Record<string, string> = {
    flat: 'M8,-198 L20,-198 M26,-197 L37,-197',
    worried: 'M8,-197 L20,-202 M26,-202 L37,-196',
    angry: 'M8,-203 L20,-197 M26,-197 L37,-203',
    raised: 'M8,-204 Q14,-208 20,-205 M26,-205 Q32,-208 37,-204',
  };
  return <path d={b[brows] ?? b.flat} stroke={INK} strokeWidth={3.6} strokeLinecap="round" fill="none" />;
};
const Mouth: React.FC<{mouth: string; kind: Kind}> = ({mouth}) => {
  const m: Record<string, JSX.Element> = {
    flat: <path d="M20,-163 L30,-163" stroke={INK} strokeWidth={3.4} strokeLinecap="round" />,
    smile: <path d="M17,-166 Q25,-158 33,-166" stroke={INK} strokeWidth={3.4} fill="none" strokeLinecap="round" />,
    smirk: <path d="M18,-163 Q27,-160 34,-168" stroke={INK} strokeWidth={3.4} fill="none" strokeLinecap="round" />,
    frown: <path d="M18,-160 Q25,-167 32,-160" stroke={INK} strokeWidth={3.4} fill="none" strokeLinecap="round" />,
    open: <ellipse cx={25} cy={-162} rx={6} ry={7} fill="#5a2320" stroke={INK} strokeWidth={3} />,
    o: <ellipse cx={26} cy={-163} rx={4} ry={5} fill="#5a2320" stroke={INK} strokeWidth={2.5} />,
    shout: <path d="M14,-170 Q26,-174 36,-168 Q34,-150 24,-150 Q14,-152 14,-170 Z" fill="#5a2320" stroke={INK} strokeWidth={3} />,
    grit: <g><rect x={16} y={-168} width={18} height={9} rx={3} fill="#fff" stroke={INK} strokeWidth={3} /><path d="M22,-168 L22,-159 M28,-168 L28,-159" stroke={INK} strokeWidth={1.6} /></g>,
  };
  return m[mouth] ?? m.flat;
};

/** walking pose helper */
export const walk = (f: number, speed = 1, amp = 22, phase = 0): Pose => {
  const t = (f * speed * 2 * Math.PI) / 28 + phase;
  const sn = Math.sin(t);
  return {legA: -amp * sn, legB: amp * sn, armA: amp * 0.7 * sn - 4, armB: -amp * 0.5 * sn + 8, bob: -Math.abs(Math.cos(t)) * 4 + 2, tilt: 2};
};
