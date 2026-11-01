import React from 'react';
import {AbsoluteFill, getInputProps} from 'remotion';
import {Person, Standard} from '../chars/Person';
import {Horse} from '../chars/Horse';
import {Prone} from '../chars/Prone';
import {SkyGrad, Hills, TreeLine, Reeds, Ground, Clump, Water} from '../env/Env';
import {INK} from '../lib/util';

/* Ảnh GIỮ CHỖ cho mọi tên ảnh trong bộ prompt Nebula. Ảnh thật cùng tên sẽ thay thế. */
const P = (o: any) => o;
const SPR: Record<string, any> = {
  SPR_HAST_STAND: P({kind: 'hastatus', shield: true, hold: 'pilum', holdAngle: -14, pose: {armA: -6, armB: 10}}),
  SPR_HAST_WALK: P({kind: 'hastatus', shield: true, hold: 'pilum', holdAngle: -22, pose: {legA: -20, legB: 20, armA: 14, armB: -2, tilt: 2}}),
  SPR_HAST_RUN: P({kind: 'hastatus', shield: true, hold: 'pilum', holdAngle: 30, pose: {legA: -42, legB: 40, armA: 50, armB: -24, tilt: 9}, expr: {eyes: 'wide', brows: 'worried', mouth: 'shout'}}),
  SPR_HAST_SQUINT: P({kind: 'hastatus', shield: true, hold: 'pilum', holdAngle: -22, pose: {legA: -14, legB: 14, armA: 10, armB: -2, tilt: 4}, expr: {eyes: 'squint', brows: 'worried', mouth: 'frown'}}),
  SPR_HAST_SCARED: P({kind: 'hastatus', shield: true, hold: 'pilum', holdAngle: -14, pose: {armA: -6, armB: 10}, expr: {eyes: 'wide', brows: 'worried', mouth: 'o'}}),
  SPR_HAST_ASK: P({kind: 'hastatus', shield: true, hold: 'pilum', holdAngle: -14, pose: {armA: -6, armB: 10, headTilt: -5}, expr: {eyes: 'wide', brows: 'raised', mouth: 'open'}}),
  SPR_HAST_DEADPAN: P({kind: 'hastatus', shield: true, hold: 'pilum', holdAngle: -14, pose: {armA: -6, armB: 10}, expr: {eyes: 'squint', brows: 'flat', mouth: 'flat'}}),
  SPR_HAST_FIGHT: P({kind: 'hastatus', shield: true, hold: 'pilum', holdAngle: 55, pose: {legA: -22, legB: 24, armA: 40, armB: 55, tilt: 6}, expr: {eyes: 'wide', brows: 'angry', mouth: 'shout'}}),
  SPR_HAST_PULL: P({kind: 'hastatus', hold: 'none', pose: {tilt: -20, armA: 80, armB: 88, legA: -24, legB: 26}, expr: {eyes: 'squint', brows: 'angry', mouth: 'grit'}}),
  SPR_HAST_SHOVEL: P({kind: 'hastatus', hold: 'shovel', holdAngle: -10, pose: {armA: 120, armB: 20}, expr: {brows: 'raised'}}),
  SPR_SIGN_STAND: P({kind: 'signifer', hold: 'standard', holdAngle: 4, pose: {armB: 26}}),
  SPR_SIGN_PULL: P({kind: 'signifer', hold: 'none', pose: {tilt: -24, armA: 98, armB: 106, legA: -24, legB: 28}, expr: {eyes: 'closed', brows: 'angry', mouth: 'grit'}}),
  SPR_FLAM_FALL: P({kind: 'consul', rot: -80, pose: {legA: 60, legB: 70, armA: 130, armB: 150}, expr: {eyes: 'wide', brows: 'raised', mouth: 'o'}}),
  SPR_FLAM_LYING: P({kind: 'consul', rot: -92, mud: true, pose: {legA: 30, legB: 40, armA: 20, armB: 40}, expr: {eyes: 'squint', brows: 'worried', mouth: 'o'}}),
  SPR_FLAM_POINT: P({kind: 'consul', mud: true, pose: {armB: 95, armA: -6, headTilt: -6}, expr: {brows: 'angry', mouth: 'open'}}),
  SPR_HANN_STAND: P({kind: 'hannibal', pose: {armA: -20, armB: -14}, expr: {mouth: 'smirk'}}),
  SPR_IBER_CHARGE: P({kind: 'iberian', shield: true, hold: 'falcata', holdAngle: 0, pose: {legA: -40, legB: 38, armA: 40, armB: 150, tilt: 9}, expr: {brows: 'angry', mouth: 'shout'}}),
  SPR_GAUL_CHARGE: P({kind: 'gaul', shield: true, hold: 'spear', holdAngle: 70, pose: {legA: -40, legB: 38, armA: 40, armB: 60, tilt: 9}, expr: {brows: 'angry', mouth: 'shout'}}),
};
const HORSE: Record<string, any> = {
  SPR_FLAM_HORSE: {rider: {pose: {legA: 40, legB: 52, armA: 10, armB: 30}, expr: {mouth: 'smile'}}},
  SPR_FLAM_TROT: {gait: 6, gaitAmp: 18, rider: {pose: {legA: 40, legB: 52, armA: 20, armB: 60, tilt: 6}, expr: {brows: 'angry', mouth: 'grit'}, cloakWave: 10}},
  SPR_FLAM_REAR: {rear: 1, rider: {pose: {legA: 60, legB: 70, armA: 140, armB: 150, tilt: -25}, expr: {eyes: 'wide', brows: 'raised', mouth: 'o'}}},
  SPR_FLAM_SWORD: {gait: 3, gaitAmp: 8, rider: {pose: {legA: 40, legB: 52, armA: 20, armB: 150}, hold: 'sword', holdAngle: 10, expr: {brows: 'angry', mouth: 'shout'}, cloakWave: 12}},
};
export const PHSprite: React.FC = () => {
  const {name} = getInputProps() as any;
  if (HORSE[name]) {
    const h = HORSE[name];
    return <AbsoluteFill><svg width={1100} height={1100} viewBox="0 0 1100 1100"><Horse x={560} y={1060} s={2.6} rear={h.rear ?? 0} gait={h.gait ?? 0} gaitAmp={h.gaitAmp ?? 0}><Person kind="consul" x={-6} y={-96} s={0.92} cloakWave={h.rider.cloakWave ?? 5} {...h.rider} /></Horse></svg></AbsoluteFill>;
  }
  if (name === 'SPR_IBER_PRONE' || name === 'SPR_GAUL_PRONE') return <AbsoluteFill><svg width={1100} height={1100} viewBox="0 0 1100 1100"><Prone x={560} y={1060} s={2.6} kind={name === 'SPR_GAUL_PRONE' ? 'gaul' : 'iberian'} /></svg></AbsoluteFill>;
  if (name === 'SPR_GAUL_WATCH') return <AbsoluteFill><svg width={1100} height={1100} viewBox="0 0 1100 1100"><g transform="translate(550,1060) scale(2.2)"><path d="M-210,0 C-200,-90 -120,-130 -20,-128 C90,-126 160,-90 180,0 Z" fill="#6a7d3c" stroke={INK} strokeWidth={5} /><path d="M-110,-90 C-150,-170 -100,-250 -10,-254 C80,-256 120,-170 92,-100 C60,-70 -60,-66 -110,-90 Z" fill="#b9802f" stroke={INK} strokeWidth={5} /><path d="M-70,-200 C-50,-150 -60,-110 -80,-90 M0,-236 C10,-180 0,-130 -10,-92 M60,-200 C70,-160 66,-120 50,-96" stroke="#8f6020" strokeWidth={5} fill="none" /><path d="M140,-60 L300,-230" stroke={INK} strokeWidth={13} strokeLinecap="round" /><path d="M140,-60 L300,-230" stroke="#8b6b45" strokeWidth={6} /></g></svg></AbsoluteFill>;
  if (name === 'OBJ_MUDSTANDARD') return <AbsoluteFill><svg width={1100} height={1100} viewBox="0 0 1100 1100"><ellipse cx={550} cy={1040} rx={240} ry={36} fill="#6d5f43" stroke={INK} strokeWidth={5} /><g transform="translate(560,1040) rotate(-15) scale(2.4)"><path d="M0,10 L0,-330" stroke={INK} strokeWidth={13} strokeLinecap="round" /><path d="M0,10 L0,-330" stroke="#8b6b45" strokeWidth={6} /><g transform="translate(0,-160) scale(1.1)"><Standard /></g></g></svg></AbsoluteFill>;
  if (name === 'OBJ_MUDHELMET') return <AbsoluteFill><svg width={1100} height={1100} viewBox="0 0 1100 1100"><ellipse cx={550} cy={1010} rx={330} ry={50} fill="#5f5139" stroke={INK} strokeWidth={5} /><g transform="translate(540,990) rotate(-72) scale(3.2)"><path d="M-34,-186 C-30,-232 -6,-242 10,-242 C32,-242 46,-224 44,-188 Z" fill="#b38a44" stroke={INK} strokeWidth={4.5} /><path d="M-30,-232 C-20,-262 30,-266 46,-236 C44,-226 28,-236 10,-240 C-6,-238 -20,-232 -30,-232 Z" fill="#8f2328" stroke={INK} strokeWidth={3.5} /><path d="M-36,-188 L46,-188" stroke={INK} strokeWidth={5.5} /></g></svg></AbsoluteFill>;
  const c = SPR[name] ?? SPR.SPR_HAST_STAND; const {rot = 0, ...rest} = c;
  return <AbsoluteFill><svg width={1100} height={1100} viewBox="0 0 1100 1100"><g transform={`rotate(${rot},550,800)`}><Person x={550} y={1070} s={3.0} cloakWave={4} {...rest} /></g></svg></AbsoluteFill>;
};

/* ---- lớp cảnh giữ chỗ (2400×1350 = 16:9) ---- */
const GREEN_OUT = (n: string) => !n.endsWith('_SKY');
const SK = (id: string, stops: [number, string][], sun?: [number, number]) => (
  <>
    <SkyGrad id={id} stops={stops} x={-240} y={-135} w={2400} h={1350} />
    {sun && <><defs><radialGradient id={id + 's'}><stop offset="0" stopColor="#fff2d0" stopOpacity={0.9} /><stop offset="1" stopColor="#fff2d0" stopOpacity={0} /></radialGradient></defs><circle cx={sun[0]} cy={sun[1]} r={380} fill={`url(#${id}s)`} /><circle cx={sun[0]} cy={sun[1]} r={46} fill="#fff6dc" stroke="#e6cf9a" strokeWidth={3} /></>}
  </>
);
const shore = (y: number, fill: string) => <path d={`M-240,${y} C300,${y - 12} 900,${y + 12} 1400,${y - 4} C1800,${y - 12} 2000,${y + 6} 2160,${y} L2160,1215 L-240,1215 Z`} fill={fill} stroke={INK} strokeWidth={4.5} />;
const W = {x0: -240, x1: 2160, bottom: 1215};
const LAYERS: Record<string, () => JSX.Element> = {
  LYR_LAKEDAWN_SKY: () => SK('ld', [[0, '#3a4a5c'], [0.55, '#8d9a9c'], [1, '#d9cdb1']], [1450, 520]),
  LYR_LAKEDAWN_FAR: () => <Hills seed={11} y={560} amp={170} freq={0.0018} fill="#6f7f80" stroke="#55626a" sw={3} {...W} />,
  LYR_LAKEDAWN_NEAR: () => <><Hills seed={12} y={640} amp={110} freq={0.0024} fill="#566664" stroke="#3c4648" sw={3.5} {...W} /><TreeLine seed={13} y={640} amp={110} freq={0.0024} size={34} step={70} fill="#4a5a55" stroke="#3c4648" sw={3} cypress={0.25} x0={-240} x1={2160} /></>,
  LYR_LAKEDAWN_GROUND: () => <><rect x={-240} y={690} width={2400} height={525} fill="#7d8f92" />{Array.from({length: 30}, (_, i) => <path key={i} d={`M${-200 + (i * 173) % 2300},${720 + (i * 61) % 220} l${60 + (i % 4) * 30},0`} stroke="#b9c6c2" strokeWidth={4} strokeLinecap="round" />)}{shore(960, '#4a4436')}</>,
  LYR_LAKEDAWN_FORE: () => <><Reeds x={-60} y={1215} seed={21} n={22} h={380} f={0} color="#2f3424" dark="#23271b" spread={300} /><Reeds x={2020} y={1215} seed={22} n={20} h={350} f={0} color="#2f3424" dark="#23271b" spread={280} /></>,
  LYR_FOGROAD_SKY: () => SK('fs', [[0, '#a3b1ae'], [0.6, '#d6d8cc'], [1, '#e2e1d4']]),
  LYR_FOGROAD_FAR: () => <Hills seed={321} y={470} amp={170} freq={0.0016} fill="#b6bfb7" stroke="#a0aaa3" sw={3} {...W} />,
  LYR_FOGROAD_NEAR: () => <><Hills seed={322} y={600} amp={150} freq={0.0021} fill="#8a9a85" stroke={INK} sw={4} hatch="#7a8a75" {...W} /><TreeLine seed={323} y={600} amp={150} freq={0.0021} size={50} step={78} fill="#6e8166" shade="#5f7158" cypress={0.25} x0={-240} x1={2160} /></>,
  LYR_FOGROAD_GROUND: () => <><path d="M-240,800 C300,790 900,812 1400,800 C1800,792 2000,806 2160,800 L2160,1215 L-240,1215 Z" fill="#9aa679" stroke={INK} strokeWidth={4.5} /><path d="M-240,905 C300,898 900,915 1400,905 C1800,898 2000,910 2160,905 L2160,1035 C1700,1028 900,1045 -240,1032 Z" fill="#c2b08a" stroke={INK} strokeWidth={4} /></>,
  LYR_FOGROAD_FORE: () => <><path d="M-240,1080 C300,1068 900,1090 1400,1076 C1800,1068 2000,1084 2160,1076 L2160,1215 L-240,1215 Z" fill="#7f9496" stroke={INK} strokeWidth={4} /><Reeds x={-80} y={1100} seed={331} n={24} h={360} f={0} spread={330} color="#5f6d3d" dark="#48542e" /><Reeds x={1990} y={1100} seed={332} n={22} h={330} f={0} spread={300} color="#5f6d3d" dark="#48542e" /></>,
  LYR_WIDEROAD_SKY: () => SK('wr', [[0, '#9eaeac'], [1, '#d7d8cb']]),
  LYR_WIDEROAD_FAR: () => <><Hills seed={41} y={300} amp={150} freq={0.0019} fill="#8b9a8a" stroke="#6e7c70" sw={3} {...W} /><TreeLine seed={42} y={300} amp={150} freq={0.0019} size={30} step={55} fill="#778a76" stroke="#5f6e62" sw={3} cypress={0.2} x0={-240} x1={2160} /></>,
  LYR_WIDEROAD_NEAR: () => <><Hills seed={43} y={520} amp={110} freq={0.0026} fill="#7b8d74" hatch="#6c7e66" {...W} /><TreeLine seed={44} y={520} amp={110} freq={0.0026} size={40} step={70} fill="#65795f" shade="#56694f" cypress={0.15} x0={-240} x1={2160} /></>,
  LYR_WIDEROAD_GROUND: () => <><path d="M-240,600 C300,590 900,610 1400,600 C1800,592 2000,606 2160,600 L2160,1215 L-240,1215 Z" fill="#93a07e" stroke={INK} strokeWidth={4} /><path d="M-240,705 C300,698 900,712 1400,702 C1800,696 2000,708 2160,702" stroke="#c3b18a" strokeWidth={34} fill="none" /></>,
  LYR_WIDEROAD_FORE: () => <><path d="M-240,830 C200,815 800,850 1400,830 C1800,818 2000,836 2160,826 L2160,1215 L-240,1215 Z" fill="#7f9395" stroke={INK} strokeWidth={4} />{Array.from({length: 24}, (_, i) => <path key={i} d={`M${-200 + (i * 197) % 2300},${880 + (i * 47) % 280} l${60 + (i % 4) * 30},0`} stroke="#b9c7c3" strokeWidth={4} strokeLinecap="round" />)}</>,
  LYR_HILLTOP_SKY: () => SK('ht', [[0, '#9fb7c0'], [0.6, '#e7dcc0'], [1, '#f2e6c8']], [1500, 380]),
  LYR_HILLTOP_FAR: () => <Hills seed={91} y={560} amp={120} freq={0.002} fill="#a7b4a8" stroke="#8e9c92" sw={3} {...W} />,
  LYR_HILLTOP_GROUND: () => <path d="M-240,820 C0,760 300,700 760,740 C1000,762 1150,820 1300,900 C1400,960 1450,1100 1500,1215 L-240,1215 Z" fill="#7a8c5e" stroke={INK} strokeWidth={4.5} />,
  LYR_HILLTOP_FORE: () => <><Reeds x={60} y={1215} seed={93} n={18} h={260} f={0} color="#6f7d4a" dark="#56643a" spread={420} /></>,
  LYR_TUSCANY_SKY: () => SK('tu', [[0, '#a7bfc6'], [1, '#ece2c6']]),
  LYR_TUSCANY_FAR: () => <><Hills seed={101} y={500} amp={110} freq={0.002} fill="#9fae8a" stroke="#7f8d6f" sw={3} {...W} /><TreeLine seed={102} y={500} amp={110} freq={0.002} size={34} step={80} fill="#788a63" stroke="#66764f" sw={3} cypress={0.45} x0={-240} x1={2160} /></>,
  LYR_TUSCANY_NEAR: () => <Hills seed={103} y={640} amp={80} freq={0.0028} fill="#c3b07a" stroke={INK} sw={4} hatch="#ad9b66" {...W} />,
  LYR_TUSCANY_GROUND: () => <><path d="M-240,800 L2160,800 L2160,1215 L-240,1215 Z" fill="#c9b386" stroke={INK} strokeWidth={4} />{Array.from({length: 16}, (_, i) => <ellipse key={i} cx={-180 + i * 150} cy={850 + (i * 37) % 300} rx={60 + (i % 4) * 20} ry={8 + (i % 3) * 4} fill="#b8a275" />)}</>,
  LYR_TUSCANY_FORE: () => <><Reeds x={-60} y={1215} seed={105} n={14} h={200} f={0} color="#8a9a52" dark="#6f7d40" spread={260} /><Reeds x={2060} y={1215} seed={106} n={14} h={200} f={0} color="#8a9a52" dark="#6f7d40" spread={260} /></>,
  LYR_ROMANCAMP_SKY: () => SK('rc', [[0, '#9fb0b6'], [1, '#e3d8bd']]),
  LYR_ROMANCAMP_FAR: () => <Hills seed={141} y={440} amp={120} freq={0.0025} fill="#a2ae9d" stroke="#8a978c" sw={3} {...W} />,
  LYR_ROMANCAMP_NEAR: () => <g>{Array.from({length: 72}, (_, i) => { const x = -240 + i * 34; const h = 90 + ((i * 37) % 13); return <path key={i} d={`M${x},640 L${x},${640 - h} L${x + 14},${640 - h - 14} L${x + 28},${640 - h} L${x + 28},640 Z`} fill="#86684a" stroke={INK} strokeWidth={3.5} />; })}<rect x={-240} y={590} width={2400} height={10} fill="#5e4630" />{[260, 760, 1500].map((x, i) => <g key={i} transform={`translate(${x},${700 - i * 4})`}><path d="M-110,0 L-60,-120 L60,-120 L110,0 Z" fill="#8a6a48" stroke={INK} strokeWidth={4.5} /><path d="M-30,0 L0,-96 L30,0 Z" fill="#4a3628" stroke={INK} strokeWidth={4} /></g>)}</g>,
  LYR_ROMANCAMP_GROUND: () => <><path d="M-240,700 L2160,700 L2160,1215 L-240,1215 Z" fill="#b9a781" stroke={INK} strokeWidth={4} />{Array.from({length: 18}, (_, i) => <ellipse key={i} cx={-180 + i * 140} cy={760 + (i * 41) % 400} rx={60 + (i % 4) * 22} ry={9 + (i % 3) * 4} fill="#a99772" />)}</>,
  LYR_ROMANCAMP_FORE: () => <><Clump cx={-80} cy={1180} r={140} seed={313} fill="#6b5a40" shade="#5a4b35" /><Clump cx={2040} cy={1190} r={120} seed={314} fill="#6b5a40" shade="#5a4b35" /></>,
  LYR_HILLTOWN_SKY: () => SK('hs', [[0, '#a7bfc6'], [1, '#ece2c6']]),
  LYR_HILLTOWN_FAR: () => <Hills seed={212} y={560} amp={90} fill="#a3b08c" stroke="#86947a" sw={3} {...W} />,
  LYR_HILLTOWN_NEAR: () => <Town broken={false} />,
  LYR_HILLTOWN_BROKEN: () => <Town broken />,
  LYR_POVHILL_SKY: () => SK('pv', [[0, '#b7c8cc'], [0.5, '#e9e8dc'], [1, '#eef0ea']]),
  LYR_POVHILL_FAR: () => <><Hills seed={171} y={430} amp={110} fill="#a9b5a6" stroke="#93a196" sw={3} {...W} /><rect x={-240} y={560} width={2400} height={700} fill="#cdd5d1" /></>,
  LYR_POVHILL_FORE: () => <><path d="M-240,1215 L-240,820 C-100,800 200,860 500,960 C700,1030 860,1100 1000,1215 Z" fill="#5e6e47" stroke={INK} strokeWidth={4.5} /><Reeds x={120} y={1215} seed={173} n={22} h={260} f={0} color="#5f6f3e" dark="#4b5a30" spread={600} /></>,
};
const Town: React.FC<{broken: boolean}> = ({broken}) => (
  <g>
    <path d="M300,1215 C400,800 700,600 960,580 C1220,600 1520,800 1620,1215 Z" fill="#8c9b6a" stroke={INK} strokeWidth={4.5} />
    <path d="M620,700 L620,560 L1300,560 L1300,700" fill="#d9c8a0" stroke={INK} strokeWidth={4.5} />
    {[[700, 480, 70], [880, 450, 90], [1060, 470, 80]].map(([x, y, w], i) => <g key={i}><rect x={x - w / 2} y={y} width={w} height={560 - y} fill="#e6d8b4" stroke={INK} strokeWidth={4} /><path d={`M${x - w / 2 - 10},${y} L${x},${y - 34} L${x + w / 2 + 10},${y} Z`} fill="#b5563a" stroke={INK} strokeWidth={4} strokeLinejoin="round" /></g>)}
    {broken ? <><path d="M1160,560 L1160,450 L1180,440 L1195,462 L1212,436 L1230,455 L1250,445 L1250,560 Z" fill="#d9c8a0" stroke={INK} strokeWidth={4.5} /><path d="M1140,560 L1170,530 L1210,545 L1250,525 L1280,560 Z" fill="#c8b48c" stroke={INK} strokeWidth={3.5} /></> : <><rect x={1160} y={340} width={90} height={220} fill="#d9c8a0" stroke={INK} strokeWidth={4.5} /><path d="M1150,340 L1205,300 L1260,340 Z" fill="#b5563a" stroke={INK} strokeWidth={4} /></>}
  </g>
);
export const PHLayer: React.FC = () => {
  const {name} = getInputProps() as any;
  const L = LAYERS[name];
  return (
    <AbsoluteFill style={{background: GREEN_OUT(name) ? '#00ff00' : undefined}}>
      <svg width={2400} height={1350} viewBox="-240 -135 2400 1350">{L ? L() : null}</svg>
    </AbsoluteFill>
  );
};
