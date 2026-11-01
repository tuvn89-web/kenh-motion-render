// Code-drawn layers for lane ED A/C (approved 24/10: code may draw text/numbers in INFOGRAPHICS only).
// Every fx is authored in the kit canvas' own pixels and lives inside a 2.5D plane, so the camera moves it
// exactly like the painted layer it sits on. Times are seconds of the shot's local clock.
import React from 'react';

export type Fx = {
  type: 'phone' | 'balance' | 'circle' | 'highlight' | 'timecard' | 'paper';
  at?: number; dur?: number;
  rect?: [number, number, number, number]; // x, y, w, h in canvas px
  text?: string;
  p?: Record<string, number>;
};

// ---------------------------------------------------------------- palette (house: muted warm pastel, dark ink)
export const ED = {
  paper: '#F1E8D8', paper2: '#E7DBC6', ink: '#2F2721', ink2: '#6E6157', sage: '#9DB3A2', sageDk: '#5E7F6E',
  coral: '#C65B45', coralLt: '#E7A08E', mustard: '#E3B64C', cream: '#FBF5EA', bubble: '#E6DED1',
};
const SERIF = 'Fraunces, Georgia, serif';
const SANS = 'Inter, Arial, sans-serif';

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t: number, at: number, dur: number) => clamp((t - at) / Math.max(1e-4, dur));
const eOut = (u: number) => 1 - Math.pow(1 - u, 3);
const eInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const eBack = (u: number) => {
  const c = 1.9;
  return u <= 0 ? 0 : u >= 1 ? 1 : 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
};
const rnd = (i: number, k = 0) => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** Hand-inked wobble for strokes (deterministic per id). */
const InkFilter: React.FC<{id: string; scale?: number; seed?: number}> = ({id, scale = 2.4, seed = 3}) => (
  <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={seed} result="n" />
    <feDisplacementMap in="SourceGraphic" in2="n" scale={scale} xChannelSelector="R" yChannelSelector="G" />
  </filter>
);

/** Paper ground with fibre noise — the infographic stands in the same printed world as the illustrations. */
export const PaperGround: React.FC<{w: number; h: number; id: string}> = ({w, h, id}) => (
  <svg width={w + 1600} height={h + 1000} style={{position: 'absolute', left: -800, top: -500}}>
    <defs>
      <filter id={`${id}-n`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={7} />
        <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.2  0 0 0 0.09 0" />
      </filter>
      <radialGradient id={`${id}-v`} cx="50%" cy="45%" r="75%">
        <stop offset="0.55" stopColor={ED.paper} stopOpacity={0} />
        <stop offset="1" stopColor="#B9A587" stopOpacity={0.55} />
      </radialGradient>
    </defs>
    <rect width={w + 1600} height={h + 1000} fill={ED.paper} />
    <rect width={w + 1600} height={h + 1000} filter={`url(#${id}-n)`} />
    <rect x={800} y={500} width={w} height={h} fill={`url(#${id}-v)`} />
  </svg>
);

// ---------------------------------------------------------------- 12-month balance chart (setup + reveal)
// Balance shape from the script: $7,800 on the dentist's card, paid down monthly, payments stop in month 10,
// $640 left at month 12. Only the two numbers the narration says ($7,800 earlier in the script, $640 here) are written.
const BAL = Array.from({length: 12}, (_, i) => (i < 9 ? 7800 - ((7800 - 640) * i) / 9 : 640));
const CX0 = 300, CX1 = 1620, BASE = 790, HMAX = 420;
const slot = (CX1 - CX0) / 12;
const bx = (i: number) => CX0 + slot * (i + 0.5);
const bh = (i: number) => (BAL[i] / 7800) * HMAX;
const BW = 66;

const Tag: React.FC<{x: number; y: number; text: string; s: number; color?: string; ink?: string; size?: number}> = ({x, y, text, s, color = ED.cream, ink = ED.ink, size = 34}) =>
  s <= 0 ? null : (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-text.length * size * 0.33 - 18} y={-size * 0.95} width={text.length * size * 0.66 + 36} height={size * 1.5} rx={10} fill={color} stroke={ED.ink} strokeWidth={3} />
      <text x={0} y={size * 0.12} textAnchor="middle" fontFamily={SERIF} fontWeight={800} fontSize={size} fill={ink}>
        {text}
      </text>
    </g>
  );

const Check: React.FC<{x: number; y: number; s: number; on: boolean}> = ({x, y, s, on}) =>
  s <= 0 ? null : (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {on ? (
        <>
          <circle r={17} fill={ED.sageDk} />
          <path d="M-8 0 L-2 7 L9 -7" fill="none" stroke={ED.cream} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <circle r={15} fill="none" stroke={ED.ink2} strokeWidth={3} strokeDasharray="5 6" opacity={0.75} />
      )}
    </g>
  );

export const BalanceChart: React.FC<{t: number; p: Record<string, number>; id: string}> = ({t, p, id}) => {
  const reveal = (p.mode ?? 0) >= 1;
  const T = t + (p.offset ?? 0);
  const grow = (i: number) => (reveal ? 1 : eOut(prog(T, 0.3 + i * 0.17, 0.55)));
  const only = reveal ? 1 : eBack(prog(T, p.only ?? 99, 0.45));
  // reveal events
  const small = eOut(prog(T, p.small ?? 99, 0.45)); // coral on month 12 only (what she expected)
  const strike = prog(T, p.strike ?? 99, 0.35);
  const fill = (i: number) => {
    if (i === 11) return small;
    const k = 10 - i; // 11 -> 0 ... 1 -> 10 : sweeps back toward month 1
    return eOut(prog(T, (p.sweep ?? 99) + k * (p.step ?? 0.24), 0.4));
  };
  const bracket = eOut(prog(T, p.bracket ?? 99, 0.5));
  const col = prog(T, p.collapse ?? 99, 1.3);
  const box = eBack(prog(T, (p.collapse ?? 99) - 0.15, 0.45));
  const count = eInOut(prog(T, (p.collapse ?? 99) + 0.35, 0.95));
  const apr = eBack(prog(T, p.apr ?? 99, 0.4));
  const drain = (i: number) => 1 - eInOut(prog(T, (p.collapse ?? 99) + i * 0.05, 0.6));
  const title = eOut(prog(T, reveal ? -1 : 0, 0.5));
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <defs>
        <InkFilter id={`${id}-ink`} />
        <pattern id={`${id}-hatch`} width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width={12} height={12} fill={ED.coral} />
          <line x1={0} y1={0} x2={0} y2={12} stroke={ED.coralLt} strokeWidth={4} />
        </pattern>
      </defs>
      {/* title */}
      <g opacity={title * (1 - bracket)} transform={`translate(0 ${(1 - title) * 12})`}>
        <text x={CX0} y={118} fontFamily={SANS} fontWeight={700} fontSize={30} letterSpacing={5} fill={ED.ink2}>
          DENTAL CARD BALANCE
        </text>
        <text x={CX0} y={180} fontFamily={SERIF} fontWeight={600} fontSize={52} fill={ED.ink}>
          0% interest for 12 months
        </text>
      </g>
      {/* baseline + months */}
      <g filter={`url(#${id}-ink)`}>
        <line x1={CX0 - 30} y1={BASE} x2={CX1 + 30} y2={BASE} stroke={ED.ink} strokeWidth={4} strokeLinecap="round" />
      </g>
      {BAL.map((_, i) => (
        <text key={i} x={bx(i)} y={BASE + 46} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={26} fill={ED.ink2} opacity={grow(i)}>
          {i + 1}
        </text>
      ))}
      <text x={CX1 + 30} y={BASE + 92} textAnchor="end" fontFamily={SANS} fontWeight={700} fontSize={22} letterSpacing={4} fill={ED.ink2} opacity={grow(11)}>
        MONTH
      </text>
      {/* bars */}
      <g filter={`url(#${id}-ink)`}>
        {BAL.map((_, i) => {
          const h = bh(i) * grow(i);
          const f = fill(i) * drain(i);
          return (
            <g key={i}>
              <rect x={bx(i) - BW / 2} y={BASE - h} width={BW} height={h} fill={i >= 9 ? ED.paper2 : ED.sage} stroke={ED.ink} strokeWidth={3.5} />
              {f > 0 && <rect x={bx(i) - BW / 2} y={BASE - h * f} width={BW} height={h * f} fill={`url(#${id}-hatch)`} stroke={ED.ink} strokeWidth={3.5} />}
            </g>
          );
        })}
      </g>
      {/* monthly confirmation ticks: 9 photos, then none */}
      {BAL.map((_, i) => (
        <Check key={i} x={bx(i)} y={BASE - bh(i) - 34} s={eBack(prog(reveal ? 9 : T, 0.55 + i * 0.17, 0.35)) * (1 - col)} on={i < 9} />
      ))}
      <Tag x={bx(0)} y={BASE - bh(0) - 82} text="$7,800" s={eBack(prog(reveal ? 9 : T, 0.5, 0.4)) * (1 - col)} size={32} />
      <Tag x={bx(11)} y={BASE - bh(11) - 92} text="$640" s={only * (1 - col)} color={ED.mustard} size={40} />
      {/* strike over the month-12 expectation */}
      {strike > 0 && (
        <g filter={`url(#${id}-ink)`}>
          <line x1={bx(11) - 70} y1={BASE - bh(11) - 140} x2={bx(11) - 70 + 140 * strike} y2={BASE - bh(11) - 140 + 120 * strike} stroke={ED.coral} strokeWidth={9} strokeLinecap="round" opacity={1 - col} />
        </g>
      )}
      {/* bracket: twelve months of "no interest" */}
      {bracket > 0 && (
        <g opacity={bracket * (1 - col)} filter={`url(#${id}-ink)`}>
          <path d={`M${bx(0) - BW / 2} ${BASE - HMAX - 95} q0 -26 26 -26 L${960 - 26} ${BASE - HMAX - 121} q26 0 26 -24 q0 24 26 24 L${bx(11) + BW / 2 - 26} ${BASE - HMAX - 121} q26 0 26 26`} fill="none" stroke={ED.ink} strokeWidth={4} strokeDasharray={`${4000 * bracket} 4000`} />
          <text x={960} y={BASE - HMAX - 165} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={30} letterSpacing={5} fill={ED.ink}>
            12 MONTHS OF NO INTEREST
          </text>
        </g>
      )}
      {/* collapse: every month's charge streams into one line */}
      {col > 0 &&
        BAL.map((_, i) => {
          const u = eInOut(prog(T, (p.collapse ?? 99) + i * 0.05, 0.7));
          if (u <= 0 || u >= 1) return null;
          const x0 = bx(i), y0 = BASE - bh(i) / 2;
          const x1 = 960 + (rnd(i) - 0.5) * 120, y1 = 930;
          const x = x0 + (x1 - x0) * u;
          const y = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * 120;
          const r = 16 * (1 - u * 0.6);
          return <circle key={i} cx={x} cy={y} r={r} fill={ED.coral} stroke={ED.ink} strokeWidth={2.5} />;
        })}
      {box > 0 && (
        <g transform={`translate(960 930) scale(${box})`}>
          <rect x={-470} y={-62} width={940} height={124} rx={14} fill={ED.cream} stroke={ED.ink} strokeWidth={4} filter={`url(#${id}-ink)`} />
          <text x={-430} y={14} fontFamily={SANS} fontWeight={700} fontSize={30} letterSpacing={4} fill={ED.ink2}>
            INTEREST CHARGED
          </text>
          <text x={430} y={22} textAnchor="end" fontFamily={SERIF} fontWeight={800} fontSize={64} fill={ED.coral}>
            {'$' + Math.round(1219 * count).toLocaleString('en-US')}
          </text>
        </g>
      )}
      {apr > 0 && (
        <g transform={`translate(1440 430) rotate(-8) scale(${apr})`} filter={`url(#${id}-ink)`}>
          <rect x={-130} y={-48} width={260} height={92} rx={10} fill="none" stroke={ED.coral} strokeWidth={6} />
          <text x={0} y={4} textAnchor="middle" fontFamily={SERIF} fontWeight={800} fontSize={44} fill={ED.coral}>
            ≈27% APR
          </text>
          <text x={0} y={34} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={16} letterSpacing={3} fill={ED.coral}>
            BACK TO MONTH 1
          </text>
        </g>
      )}
    </svg>
  );
};

// ---------------------------------------------------------------- phone thread (monthly payment photos)
const Thumb: React.FC<{s?: number}> = ({s = 1}) => (
  <svg width={30 * s} height={30 * s} viewBox="0 0 30 30">
    <path d="M4 13h5v13H4z M10 25V13l5-9c2 0 3 1 3 3l-1 5h7c2 0 3 2 2.6 3.6l-2 8c-.4 1.5-1.6 2.4-3 2.4H12c-1 0-2-.4-2-1z" fill={ED.cream} />
  </svg>
);

type Item = {kind: 'chip' | 'photo' | 'thumb'; month: number; at: number; h: number};
/** months 1-9 accelerate; `fill` (s) squeezes them into the time the narration gives; month 10 arrives empty at `stop`. */
const buildThread = (stop: number, fill?: number): Item[] => {
  const ds = Array.from({length: 9}, (_, i) => Math.max(0.36, 1.15 * Math.pow(0.74, i)));
  const nat = ds.reduce((a, b) => a + b, 0);
  const k = fill ? fill / nat : 1;
  const items: Item[] = [];
  let at = 0.15;
  ds.forEach((d0, i) => {
    const d = d0 * k;
    const m = i + 1;
    items.push({kind: 'chip', month: m, at, h: 40}, {kind: 'photo', month: m, at: at + d * 0.18, h: 170}, {kind: 'thumb', month: m, at: at + d * 0.55, h: 62});
    at += d;
  });
  items.push({kind: 'chip', month: 10, at: Math.max(at + 0.3, stop), h: 40});
  return items;
};

export const PhoneThread: React.FC<{t: number; w: number; h: number; p: Record<string, number>}> = ({t, w, h, p}) => {
  const W = 390;
  const k = w / W;
  const H = h / k;
  const items = buildThread(p.stop ?? 6, p.fill);
  const HEAD = 92, FOOT = 74;
  const view = H - HEAD - FOOT;
  // smooth scroll: each item's height eases in as it appears
  let shown = 0;
  const pos: number[] = [];
  for (const it of items) {
    pos.push(shown);
    shown += it.h * eOut(prog(t, it.at, 0.3));
  }
  const scroll = Math.max(0, shown + 20 - view);
  const blink = Math.floor(t * 2) % 2 === 0;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${k})`, transformOrigin: '0 0', background: ED.cream, overflow: 'hidden', fontFamily: SANS}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: HEAD, height: view, overflow: 'hidden'}}>
        {items.map((it, i) => {
          const a = eOut(prog(t, it.at, 0.3));
          if (a <= 0) return null;
          const y = pos[i] - scroll + 10;
          if (it.kind === 'chip')
            return (
              <div key={i} style={{position: 'absolute', top: y, left: 0, right: 0, textAlign: 'center', opacity: a, fontSize: 13, fontWeight: 600, letterSpacing: 2, color: it.month >= 10 ? ED.coral : ED.ink2}}>
                MONTH {it.month}
              </div>
            );
          if (it.kind === 'photo')
            return (
              <div key={i} style={{position: 'absolute', top: y, left: 14, opacity: a, transform: `translateY(${(1 - a) * 14}px)`}}>
                <div style={{width: 210, height: 150, borderRadius: 18, background: ED.bubble, padding: 8, boxSizing: 'border-box'}}>
                  <div style={{width: '100%', height: '100%', borderRadius: 12, background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6}}>
                    <div style={{width: 40, height: 40, borderRadius: 20, background: ED.sageDk, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <svg width={22} height={22} viewBox="0 0 22 22">
                        <path d="M4 11 L9 16 L18 6" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div style={{fontSize: 15, fontWeight: 700, color: ED.ink}}>Payment received</div>
                    <div style={{width: 120, height: 6, borderRadius: 3, background: '#E4DED4'}} />
                    <div style={{width: 84, height: 6, borderRadius: 3, background: '#E4DED4'}} />
                  </div>
                </div>
              </div>
            );
          return (
            <div key={i} style={{position: 'absolute', top: y, right: 14, opacity: a, transform: `scale(${0.6 + 0.4 * eBack(prog(t, it.at, 0.35))})`, transformOrigin: '100% 50%'}}>
              <div style={{padding: '10px 16px', borderRadius: 22, background: ED.sageDk}}>
                <Thumb s={1.05} />
              </div>
            </div>
          );
        })}
      </div>
      {/* header */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: HEAD, background: 'rgba(251,245,234,0.97)', borderBottom: '1px solid #E2D8C8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10, boxSizing: 'border-box', gap: 4}}>
        <div style={{width: 40, height: 40, borderRadius: 20, background: ED.mustard, color: ED.ink, fontFamily: SERIF, fontWeight: 800, fontSize: 21, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>C</div>
        <div style={{fontSize: 14, fontWeight: 600, color: ED.ink}}>Celeste</div>
        <svg width={14} height={22} viewBox="0 0 14 22" style={{position: 'absolute', left: 16, top: 46}}>
          <path d="M11 2 L3 11 L11 20" fill="none" stroke={ED.sageDk} strokeWidth={3} strokeLinecap="round" />
        </svg>
      </div>
      {/* input */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: FOOT, background: ED.cream, borderTop: '1px solid #E2D8C8', display: 'flex', alignItems: 'center', padding: '0 14px', boxSizing: 'border-box'}}>
        <div style={{flex: 1, height: 40, borderRadius: 20, border: '1.5px solid #D9CFBF', display: 'flex', alignItems: 'center', paddingLeft: 16, fontSize: 15, color: '#A69886'}}>
          <span style={{opacity: t > (p.stop ?? 6) && blink ? 1 : 0, color: ED.sageDk, marginRight: 2}}>|</span>Message
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- small marks on painted carriers
export const InkCircle: React.FC<{t: number; at: number; dur: number; rect: [number, number, number, number]; id: string}> = ({t, at, dur, rect, id}) => {
  const u = eOut(prog(t, at, dur));
  if (u <= 0) return null;
  const [x, y, w, h] = rect;
  const cx = x + w / 2, cy = y + h / 2;
  const pts: string[] = [];
  const turns = 1.12;
  for (let i = 0; i <= 64; i++) {
    const a = -2.6 + (i / 64) * Math.PI * 2 * turns;
    const r = 1 + (rnd(i, 4) - 0.5) * 0.05 + (i / 64) * 0.06;
    pts.push(`${(cx + Math.cos(a) * (w / 2 + h * 0.35) * r).toFixed(1)},${(cy + Math.sin(a) * h * 0.85 * r).toFixed(1)}`);
  }
  const d = 'M' + pts.join(' L');
  const sw = Math.max(5, h * 0.07);
  return (
    <svg style={{position: 'absolute', inset: 0, overflow: 'visible'}} width="100%" height="100%">
      <defs>
        <InkFilter id={`${id}-c`} scale={sw * 0.5} />
      </defs>
      <path d={d} fill="none" stroke="#B8382A" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${u} 1`} opacity={0.88} filter={`url(#${id}-c)`} style={{mixBlendMode: 'multiply'}} />
    </svg>
  );
};

export const Highlight: React.FC<{t: number; at: number; dur: number; rect: [number, number, number, number]; rot?: number}> = ({t, at, dur, rect, rot = -0.8}) => {
  const u = eInOut(prog(t, at, dur));
  if (u <= 0) return null;
  const [x, y, w, h] = rect;
  return (
    <div style={{position: 'absolute', left: x - h * 0.15, top: y, width: (w + h * 0.3) * u, height: h, background: 'rgba(245,205,60,0.62)', mixBlendMode: 'multiply', borderRadius: `${h * 0.18}px ${h * 0.35}px ${h * 0.25}px ${h * 0.4}px`, transform: `rotate(${rot}deg)`, transformOrigin: '0 50%'}} />
  );
};

export const TimeCard: React.FC<{t: number; at: number; dur: number; rect: [number, number, number, number]; text: string}> = ({t, at, dur, rect, text}) => {
  const a = Math.min(eOut(prog(t, at, 0.35)), 1 - prog(t, at + dur - 0.3, 0.3));
  if (a <= 0) return null;
  const [x, y, w, h] = rect;
  return (
    <div style={{position: 'absolute', left: x, top: y + (1 - a) * -10, width: w, height: h, opacity: a, background: ED.cream, border: `${Math.max(2, h * 0.04)}px solid ${ED.ink}`, borderRadius: h * 0.12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontWeight: 800, fontSize: h * 0.42, letterSpacing: h * 0.06, color: ED.ink, boxShadow: `0 ${h * 0.06}px 0 rgba(47,39,33,0.18)`}}>
      {text}
    </div>
  );
};

/** All fx of one layer, in canvas px. */
export const FxLayer: React.FC<{fx: Fx[]; t: number; canvas: [number, number]; id: string}> = ({fx, t, canvas, id}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: canvas[0], height: canvas[1]}}>
    {fx.map((f, i) => {
      const r = f.rect ?? [0, 0, canvas[0], canvas[1]];
      const at = f.at ?? 0;
      const fid = `${id}-${i}`;
      switch (f.type) {
        case 'paper':
          return <PaperGround key={i} w={canvas[0]} h={canvas[1]} id={fid} />;
        case 'balance':
          return <BalanceChart key={i} t={t - at} p={f.p ?? {}} id={fid} />;
        case 'phone':
          return (
            <div key={i} style={{position: 'absolute', left: r[0], top: r[1], width: r[2], height: r[3], borderRadius: (f.p?.radius ?? 0) * r[2], overflow: 'hidden'}}>
              <PhoneThread t={t - at} w={r[2]} h={r[3]} p={f.p ?? {}} />
            </div>
          );
        case 'circle':
          return <InkCircle key={i} t={t} at={at} dur={f.dur ?? 0.6} rect={r} id={fid} />;
        case 'highlight':
          return <Highlight key={i} t={t} at={at} dur={f.dur ?? 0.8} rect={r} rot={f.p?.rot} />;
        case 'timecard':
          return <TimeCard key={i} t={t} at={at} dur={f.dur ?? 2} rect={r} text={f.text ?? ''} />;
        default:
          return null;
      }
    })}
  </div>
);
