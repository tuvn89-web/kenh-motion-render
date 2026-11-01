import React from 'react';
import {AbsoluteFill, getInputProps} from 'remotion';
import {Person} from '../chars/Person';
import {Horse} from '../chars/Horse';
import {SkyGrad, Hills, TreeLine, Reeds, Ground, Clump} from '../env/Env';
import {INK} from '../lib/util';

/* Xuất ảnh giữ chỗ (placeholder) để thử bộ chuyển động con rối.
   Khi làm thật, các file này được thay bằng ảnh Nano Banana đã tách nền, cùng tên. */
const POSES: Record<string, any> = {
  stand: {pose: {armA: -6, armB: 10}, hold: 'pilum', holdAngle: -14, expr: {}},
  look: {pose: {armA: -6, armB: 10}, hold: 'pilum', holdAngle: -14, expr: {eyes: 'wide', brows: 'worried', mouth: 'o'}},
  walk: {pose: {legA: -20, legB: 20, armA: 14, armB: -2, tilt: 2}, hold: 'pilum', holdAngle: -22, expr: {}},
  run: {pose: {legA: -42, legB: 40, armA: 50, armB: -24, tilt: 9}, hold: 'pilum', holdAngle: 30, expr: {eyes: 'wide', brows: 'worried', mouth: 'shout'}},
  ask: {pose: {armA: -6, armB: 10, headTilt: -5}, hold: 'pilum', holdAngle: -14, expr: {eyes: 'wide', brows: 'raised', mouth: 'open'}},
  deadpan: {pose: {armA: -6, armB: 10}, hold: 'pilum', holdAngle: -14, expr: {eyes: 'squint', brows: 'flat', mouth: 'flat'}},
};
export const SpriteExport: React.FC = () => {
  const p: any = getInputProps();
  const kind = p.kind ?? 'hastatus';
  if (kind === 'horse') {
    return (
      <AbsoluteFill>
        <svg width={1100} height={1100} viewBox="0 0 1100 1100">
          <Horse x={560} y={1060} s={2.6} rear={p.rear ?? 0} gaitAmp={p.gallop ? 22 : 0} gait={p.gallop ? 6 : 0}>
            {p.rider && <Person kind="consul" x={-6} y={-96} s={0.92} pose={{legA: 40, legB: 52, armA: 10, armB: 30}} cloakWave={5} expr={{mouth: 'smile'}} />}
          </Horse>
        </svg>
      </AbsoluteFill>
    );
  }
  const P = POSES[p.pose ?? 'stand'];
  return (
    <AbsoluteFill>
      <svg width={700} height={1100} viewBox="0 0 700 1100">
        <Person kind={kind} x={340} y={1070} s={3.0} shield={kind === 'hastatus'} {...P} hold={kind === 'consul' ? 'none' : P.hold} cloakWave={4} />
      </svg>
    </AbsoluteFill>
  );
};
export const LayerExport: React.FC = () => {
  const p: any = getInputProps();
  const L = p.layer ?? 'sky';
  return (
    <AbsoluteFill>
      <svg width={2400} height={1350} viewBox="-240 -135 2400 1350">
        {L === 'sky' && <><SkyGrad id="sk" stops={[[0, '#93a9b1'], [0.65, '#dcd6c2'], [1, '#e9dfc5']]} x={-240} y={-135} w={2400} h={1350} /><defs><radialGradient id="sn"><stop offset="0" stopColor="#fff2d0" stopOpacity={0.9} /><stop offset="1" stopColor="#fff2d0" stopOpacity={0} /></radialGradient></defs><circle cx={1450} cy={420} r={380} fill="url(#sn)" /><circle cx={1450} cy={420} r={46} fill="#fff6dc" stroke="#e6cf9a" strokeWidth={3} /></>}
        {L === 'far' && <Hills seed={301} y={560} amp={180} freq={0.0017} fill="#a4b2a8" stroke="#8c9a92" sw={3} x0={-240} x1={2160} bottom={1215} />}
        {L === 'near' && <><Hills seed={302} y={690} amp={130} freq={0.0024} fill="#7f9277" stroke={INK} sw={4} hatch="#6f8268" x0={-240} x1={2160} bottom={1215} /><TreeLine seed={303} y={690} amp={130} freq={0.0024} size={52} step={80} fill="#61765a" shade="#52654c" cypress={0.3} x0={-240} x1={2160} /></>}
        {L === 'ground' && <><path d="M-240,860 C200,845 700,870 1100,858 C1500,846 1900,866 2160,858 L2160,1215 L-240,1215 Z" fill="#bca984" stroke={INK} strokeWidth={4.5} /><path d="M-240,980 C400,972 1200,990 2160,978" stroke="#a6936e" strokeWidth={60} fill="none" opacity={0.6} />{Array.from({length: 18}, (_, i) => <ellipse key={i} cx={-200 + i * 135 + (i % 3) * 30} cy={900 + (i * 53) % 280} rx={60 + (i % 4) * 25} ry={10 + (i % 3) * 5} fill="#a8956f" />)}</>}
        {L === 'fr_sky' && <SkyGrad id="fs" stops={[[0, '#a3b1ae'], [0.6, '#d6d8cc'], [1, '#e2e1d4']]} x={-240} y={-135} w={2400} h={1350} />}
        {L === 'fr_far' && <Hills seed={321} y={470} amp={170} freq={0.0016} fill="#b6bfb7" stroke="#a0aaa3" sw={3} x0={-240} x1={2160} bottom={1215} />}
        {L === 'fr_near' && <><Hills seed={322} y={600} amp={150} freq={0.0021} fill="#8a9a85" stroke={INK} sw={4} hatch="#7a8a75" x0={-240} x1={2160} bottom={1215} /><TreeLine seed={323} y={600} amp={150} freq={0.0021} size={50} step={78} fill="#6e8166" shade="#5f7158" cypress={0.25} x0={-240} x1={2160} /></>}
        {L === 'fr_ground' && <><path d="M-240,800 C300,790 900,812 1400,800 C1800,792 2000,806 2160,800 L2160,1215 L-240,1215 Z" fill="#9aa679" stroke={INK} strokeWidth={4.5} /><path d="M-240,905 C300,898 900,915 1400,905 C1800,898 2000,910 2160,905 L2160,1035 C1700,1028 900,1045 -240,1032 Z" fill="#c2b08a" stroke={INK} strokeWidth={4} />{Array.from({length: 16}, (_, i) => <ellipse key={i} cx={-180 + i * 150 + (i % 3) * 20} cy={930 + (i * 37) % 90} rx={50 + (i % 4) * 20} ry={7 + (i % 3) * 3} fill="#ad9b76" />)}</>}
        {L === 'fr_fore' && <><path d="M-240,1080 C300,1068 900,1090 1400,1076 C1800,1068 2000,1084 2160,1076 L2160,1215 L-240,1215 Z" fill="#7f9496" stroke={INK} strokeWidth={4} />{[0, 1, 2, 3, 4, 5].map((k) => <path key={k} d={`M${-150 + k * 420},${1130 + (k % 2) * 30} l120,0`} stroke="#c3d0cc" strokeWidth={5} strokeLinecap="round" />)}<Reeds x={-80} y={1100} seed={331} n={24} h={360} f={0} spread={330} color="#5f6d3d" dark="#48542e" /><Reeds x={1990} y={1100} seed={332} n={22} h={330} f={0} spread={300} color="#5f6d3d" dark="#48542e" /><Reeds x={900} y={1110} seed={333} n={8} h={170} f={0} spread={200} color="#5f6d3d" dark="#48542e" /></>}
        {L === 'fore' && <><Reeds x={-120} y={1215} seed={311} n={26} h={420} f={0} spread={360} color="#56643a" dark="#414d2b" /><Reeds x={2060} y={1215} seed={312} n={22} h={380} f={0} spread={320} color="#56643a" dark="#414d2b" /><Clump cx={-60} cy={1160} r={150} seed={313} fill="#46532f" shade="#3a4528" /><Clump cx={2000} cy={1180} r={130} seed={314} fill="#46532f" shade="#3a4528" /></>}
      </svg>
    </AbsoluteFill>
  );
};
