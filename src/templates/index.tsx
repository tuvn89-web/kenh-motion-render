// Scene templates. Each one reads params + beat times; beats come from the voiceover words when available.
import React from 'react';
import {
  BabyHead, Brush, C, Cat, Clock, Door, FONT2, Figure, GROUND, HText, HatchBar, Heart, MiniCatHead, Plate, Pop, Room, Wash, Yarn, walkPose,
} from '../components/draw';
import {eout, lerp, seg, smooth} from '../engine/core';
import {measure} from '../engine/fonts';
import {FONT} from '../components/draw';

export type TplProps = {
  t: number; dur: number; P: any; layer: 'world' | 'hud'; id: string;
  b: (name: string, def: number) => number;
};
type Tpl = React.FC<TplProps>;

// ---------------------------------------------------------------- title + stat grid
const TitleStatGrid: Tpl = ({t, P, layer, id, b}) => {
  if (layer !== 'world') return null;
  const sub = b('sub', 1.2);
  const grid = b('grid', 1.8);
  const lab = b('label', 4.3);
  const cols = 10;
  const sp = 78;
  const gx = 1030;
  const gy = 255;
  return (
    <g>
      <Wash cx={430} cy={455} rx={330} ry={210} col={C.accent} alpha={0.22} seed={3} prog={seg(t, 0, 0.8)} />
      <Wash cx={1380} cy={520} rx={470} ry={340} col={C.blue} alpha={0.16} seed={5} prog={seg(t, grid - 0.4, grid + 0.4)} />
      <HText id={`${id}big`} s={P.big} x={190} y={530} size={250} prog={eout(seg(t, 0.2, 1.0))} />
      <Brush pts={[[195, 575], [440, 562], [700, 570]]} prog={eout(seg(t, 0.95, 1.4))} w={16} col={C.accent} seed={11} taper={0.3} />
      <HText id={`${id}sub`} s={P.sub} x={198} y={665} size={64} prog={seg(t, sub, sub + 0.8)} />
      {Array.from({length: P.count}, (_, i) => {
        const rr = Math.floor(i / cols);
        const cc = i % cols;
        const stag = Math.max(0.008, Math.min(0.032, (lab - grid - 0.3) / P.count)); // squeeze pops to land before the label
        const ti = seg(t, grid + i * stag, grid + 0.3 + i * stag);
        return (
          <Pop key={i} t={ti} x={gx + cc * sp} y={gy + rr * sp} rot={0.6}>
            <MiniCatHead accent={i === P.count - 1} seed={600 + i * 5} />
          </Pop>
        );
      })}
      <HText id={`${id}lab`} s={P.count_label} x={gx + 4.5 * sp} y={885} size={96} col={C.accent} align="c" prog={seg(t, lab, lab + 0.7)} font={FONT2} bold />
      <Brush pts={[[gx + 4.5 * sp - 170, 905], [gx + 4.5 * sp + 170, 898]]} prog={eout(seg(t, lab + 0.6, lab + 1.0))} w={7} col={C.accent} seed={12} taper={0.4} />
    </g>
  );
};

const YARN_X = 330;
const CAT_X0 = 560;
const OWNER_X0 = 800;
const DOOR_X = 1560;
const OS = 1.25;
const CS = 1.3;

// ---------------------------------------------------------------- owner leaves the room
const RoomLeave: Tpl = ({t, P, layer, id, b}) => {
  const ck = b('clock', 1.6);
  const L = b('leave', 3.9);
  const Q = Math.max(b('question', L + 3.1), L + 2.9);
  if (layer === 'hud') {
    const a = 1 - seg(t, Q - 0.4, Q);
    const pa = eout(seg(t, ck - 0.1, ck + 0.3));
    if (a <= 0) return null;
    return (
      <g opacity={a}>
        {pa > 0 && (
          <g>
            <rect x={60} y={62} width={420 * pa} height={180} fill={C.paper} opacity={0.92} />
            <Brush pts={[[60, 62], [480, 60], [482, 242], [58, 244], [60, 62]]} prog={pa} w={5} seed={555} alpha={0.5} taper={0.05} />
          </g>
        )}
        <Clock x={150} y={150} prog={seg(t, ck, ck + 0.6)} hand={smooth(seg(t, ck + 0.6, L))} />
        <HText id={`${id}timer`} s={P.timer_label} x={235} y={172} size={70} prog={seg(t, ck + 0.4, ck + 0.9)} font={FONT2} bold />
      </g>
    );
  }
  const wt = smooth(seg(t, L, L + 2.2));
  const ox = lerp(OWNER_X0, DOOR_X + 85, wt);
  const pose = wt > 0 && wt < 1 ? walkPose((ox - OWNER_X0) / 42) : undefined;
  return (
    <g>
      <Room prog={seg(t, 0, 1.6)} t={t} />
      <Door x0={DOOR_X} opn={smooth(seg(t, L + 1.1, L + 1.7)) - smooth(seg(t, L + 2.7, L + 3.3))} prog={seg(t, 0.4, 1.2)} />
      <Yarn x={YARN_X} prog={seg(t, 0.9, 1.6)} roll={t * 0.3} />
      <Figure x={ox} s={OS} face={t > L - 0.2 ? 1 : -1} pose={pose} prog={seg(t, 0.5, 1.6)} alpha={1 - seg(t, L + 2.1, L + 2.6)} />
      <Cat x={CAT_X0} s={CS} face={-1} look={t > L + 0.7 ? 1 : -1} prog={seg(t, 0.8, 1.8)} tail={t * 2.2} />
      <Pop t={seg(t, Q, Q + 0.35)} x={CAT_X0 - 70} y={610} rot={0.8}>
        <HText id={`${id}q`} s="?" x={0} y={35} size={130} col={C.accent} align="c" font={FONT2} bold />
      </Pop>
    </g>
  );
};

// ---------------------------------------------------------------- owner returns, kitten greets, goes back to explore
const RoomReturn: Tpl = ({t, P, layer, id, b}) => {
  if (layer !== 'world') return null;
  const E = b('enter', 0);
  const R = b('run', E + 1.4);
  const K = b('back', R + 2.5);
  const LB = b('label', K + 0.7);
  const wt = smooth(seg(t, E + 0.5, E + 2.3));
  const ox = lerp(DOOR_X + 85, 1050, wt);
  const wave = smooth(seg(t, R + 1.0, R + 1.4)) - smooth(seg(t, K - 0.3, K + 0.1));
  const pose =
    wt > 0 && wt < 1
      ? walkPose(ox / 42)
      : {aR: [lerp(-12, 150, wave), lerp(-8, -30 + 22 * Math.sin(t * 14), wave)] as [number, number], aL: [lerp(16, 40, wave), -30 * wave] as [number, number]};
  const run = smooth(seg(t, R, R + 1.2));
  const bk = smooth(seg(t, K, K + 1.6));
  const cx = lerp(lerp(CAT_X0, 905, run), YARN_X + 125, bk);
  const moving = (run > 0 && run < 1) || (bk > 0 && bk < 1);
  const speed = run > 0 && run < 1 ? Math.sin(Math.PI * run) : 0;
  const face = t > K - 0.1 ? -1 : t > R - 0.1 ? 1 : -1;
  const hearts: [number, number][] = [[975, 600], [1015, 545], [935, 535]];
  return (
    <g>
      <Room t={t + 8} />
      <Door x0={DOOR_X} opn={smooth(seg(t, E, E + 0.5)) - smooth(seg(t, E + 2.1, E + 2.6))} />
      <Yarn x={YARN_X} roll={0.3 * (8 + t) + smooth(seg(t, K + 1.4, K + 2.4)) * 3.5} />
      <Figure x={ox} s={OS} face={-1} pose={pose} alpha={seg(t, E + 0.25, E + 0.6)} />
      <Cat x={cx} s={CS} face={face} look={t > E + 1 ? face : 1} phase={cx / 15} walking={moving ? 1 : 0} tail={t * 3} speed={speed} />
      {hearts.map(([hx, hy], k) => {
        const tk = seg(t, R + 1.3 + k * 0.18, R + 1.6 + k * 0.18);
        const fade = 1 - seg(t, K + 0.3, K + 0.7);
        if (fade <= 0 || tk <= 0) return null;
        const rise = 30 * seg(t, R + 1.3, K + 0.5);
        return (
          <g key={k} opacity={fade}>
            <Pop t={tk} x={hx + 6 * Math.sin(t * 5 + k)} y={hy - rise}>
              <Heart />
            </Pop>
          </g>
        );
      })}
      <Wash cx={1255} cy={282} rx={200} ry={55} col={C.accent} alpha={0.18} seed={9} prog={seg(t, LB, LB + 0.5)} />
      <HText id={`${id}lab`} s={P.label} x={1255} y={305} size={76} col={C.accent} align="c" prog={seg(t, LB + 0.1, LB + 0.8)} font={FONT2} bold />
      <Brush pts={[[1160, 335], [1110, 375], [1078, 418]]} prog={eout(seg(t, LB + 0.7, LB + 1.2))} w={7} col={C.accent} seed={77} taper={0.2} />
      <Brush pts={[[1055, 398], [1078, 420], [1100, 392]]} prog={seg(t, LB + 1.15, LB + 1.35)} w={7} col={C.accent} seed={78} taper={0.2} />
    </g>
  );
};

// ---------------------------------------------------------------- two-bar comparison
const BarCompare: Tpl = ({t, P, layer, id, b}) => {
  if (layer !== 'world') return null;
  const maxh = 520;
  const ga = seg(t, 0.8, 1.3);
  const AP = Math.max(b('approx', 6.6), 1.2 + (P.bars.length - 1) * 2.0 + 2.2);
  return (
    <g>
      <Wash cx={960} cy={560} rx={640} ry={360} col={C.blue} alpha={0.13} seed={21} prog={seg(t, 0, 0.9)} />
      <HText id={`${id}title`} s={P.title} x={960} y={165} size={92} align="c" prog={seg(t, 0.2, 1.2)} />
      <Brush pts={[[680, 195], [960, 186], [1240, 197]]} prog={eout(seg(t, 1.1, 1.5))} w={12} col={C.accent} seed={31} taper={0.3} />
      {ga > 0 && (
        <g>
          {[25, 50, 75, 100].map((q) => {
            const y = GROUND - (maxh * q) / 100;
            return (
              <g key={q}>
                <line x1={470} y1={y} x2={1470} y2={y} stroke={C.ink} strokeOpacity={0.18 * ga} strokeWidth={2.5} strokeDasharray="10 14" />
                <HText id={`${id}g${q}`} s={`${q}`} x={455} y={y + 9} size={30} col={C.grey} align="r" alpha={ga} />
              </g>
            );
          })}
        </g>
      )}
      <Brush pts={[[440, GROUND], [1500, GROUND]]} prog={eout(seg(t, 0.6, 1.2))} w={9} seed={32} taper={0.03} />
      {P.bars.map((bar: any, i: number) => {
        const cxb = 720 + i * 480;
        const w = 240;
        let g0 = b('bar0', 1.2);
        for (let k = 1; k <= i; k++) g0 = Math.max(b(`bar${k}`, 1.2 + k * 3.2), g0 + 2.0); // never grow on top of the previous bar
        const g = eout(seg(t, g0, g0 + 1.8));
        const col = bar.accent ? C.accent : C.grey;
        const h = ((maxh * bar.value) / 100) * g;
        const done = seg(t, g0 + 1.8, g0 + 2.1);
        const sc = 1 + 0.18 * Math.sin(Math.PI * done);
        return (
          <g key={i}>
            <HatchBar x={cxb - w / 2} w={w} h={h} col={col} seed={40 + i} id={`${id}b${i}`} />
            {g > 0 && (
              <g transform={`translate(${cxb} ${GROUND - h - 34}) scale(${sc})`}>
                <HText id={`${id}v${i}`} s={`${Math.round(bar.value * g)}%`} x={0} y={0} size={110} col={bar.accent ? C.accent : C.ink} align="c" font={FONT2} bold />
              </g>
            )}
            <HText id={`${id}l${i}`} s={bar.label} x={cxb + 22} y={912} size={58} align="c" prog={seg(t, g0 - 0.2, g0 + 0.4)} />
            <Pop t={seg(t, g0 + 0.2, g0 + 0.55)} x={cxb + 22 - measure(bar.label, 58, FONT) / 2 - 42} y={892} rot={0.5}>
              {bar.icon === 'baby' ? <BabyHead r={24} seed={810} /> : <MiniCatHead r={22} seed={800} />}
            </Pop>
          </g>
        );
      })}
      <Pop t={seg(t, AP, AP + 0.4)} x={960} y={470}>
        <HText id={`${id}ap`} s="≈" x={0} y={45} size={190} col={C.accent} align="c" font={FONT2} bold />
      </Pop>
      <HText id={`${id}note`} s={P.note} x={960} y={315} size={64} col={C.accent} align="c" prog={seg(t, AP + 0.4, AP + 1.1)} font={FONT2} bold />
    </g>
  );
};

// ---------------------------------------------------------------- Nano Banana plate + code overlays
const PlateScene: Tpl = ({t, dur, P, layer, id}) => {
  if (layer === 'world') {
    return (
      <g>
        <Plate src={P.src} t={t} dur={dur} from={P.from} to={P.to} alpha={seg(t, 0, 0.4)} />
        {P.figure && <Figure x={P.figure.x} ground={P.ground ?? GROUND} s={P.figure.s ?? 1.2} face={P.figure.face ?? 1} prog={seg(t, 0.3, 1.3)} mood={P.figure.mood} />}
        {P.cat && <Cat x={P.cat.x} ground={P.ground ?? GROUND} s={P.cat.s ?? 1.3} face={P.cat.face ?? -1} prog={seg(t, 0.5, 1.5)} tail={t * 2} />}
      </g>
    );
  }
  return P.caption_card ? (
    <g opacity={seg(t, 0.6, 1.0)}>
      <rect x={70} y={70} width={P.caption_card.length * 30 + 80} height={110} fill={C.paper} opacity={0.92} />
      <HText id={`${id}card`} s={P.caption_card} x={110} y={145} size={70} col={C.accent} font={FONT2} bold prog={seg(t, 0.8, 1.5)} />
    </g>
  ) : null;
};

export const TEMPLATES: Record<string, Tpl> = {
  title_stat_grid: TitleStatGrid,
  room_leave: RoomLeave,
  room_return: RoomReturn,
  bar_compare: BarCompare,
  plate: PlateScene,
};
