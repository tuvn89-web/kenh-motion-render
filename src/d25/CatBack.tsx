// A painted 2.5D cat puppet: seen from behind, sitting in a sunset window (backlit), built from parts
// (body, head, ears, tail, face) so it can breathe, sway its tail, twitch an ear, look back over its
// shoulder and blink. Same rig works with Nano Banana PNG parts later (swap the <path>s for <image>s).
import React from 'react';

const R = (i: number, k: number, seed = 3) => {
  const v = Math.sin(i * 12.9898 + k * 78.233 + seed * 37.719) * 43758.5453;
  return v - Math.floor(v);
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export type CatPose = {
  t: number; // seconds (idle motion)
  turn: number; // 0 = looking out of the window, 1 = looking back over the shoulder at us
  blink: number; // 0 open .. 1 closed
  earL: number; // ear twitch 0..1 (rotates the left ear toward the room)
  tailFlick: number; // 0..1 extra tail-tip curl
  light: number; // 1 = sunset backlight, 0 = dusk
  lamp: number; // warm room lamp fill on the face/side 0..1
};

const BODY = 'M250 588C118 590 92 522 108 452C124 382 168 334 184 276C196 232 304 232 316 276C332 334 376 382 392 452C408 522 382 590 250 588Z';

export const CatBack: React.FC<{pose: CatPose; w?: number}> = ({pose, w = 500}) => {
  const {t, turn, blink, earL, tailFlick, light, lamp} = pose;
  const br = 1 + Math.sin(t * 1.6) * 0.012; // breathing
  // tail: lies on the sill and hangs over its edge, sways; tip curls on flick
  const sw = Math.sin(t * 0.9) * 10 + Math.sin(t * 2.3) * 3;
  const tip = tailFlick * 40;
  const tail = `M318 572C392 586 436 590 452 612C468 634 ${470 + sw} 662 ${462 + sw} ${694 + tip * 0.2}C${456 + sw} ${716 - tip * 0.3} ${440 + sw - tip} ${724 - tip * 0.6} ${430 + sw - tip * 1.2} ${716 - tip}`;
  const rim = `rgba(255,${Math.round(lerp(190, 170, 1 - light))},${Math.round(lerp(120, 150, 1 - light))},${0.35 + 0.65 * light})`;
  const tu = Math.min(1, Math.max(0, turn));
  const sq = 1 - Math.sin(tu * Math.PI) * 0.12; // squash mid-turn sells the rotation
  const fur = React.useMemo(
    () =>
      Array.from({length: 220}, (_, i) => {
        const y = 250 + R(i, 1) * 330;
        const half = y < 300 ? 60 : y < 420 ? 60 + (y - 300) * 0.9 : 168 - (y - 420) * 0.15;
        const x = 250 + (R(i, 2) - 0.5) * 2 * half;
        const len = 10 + R(i, 3) * 18;
        const a = Math.PI / 2 + (x - 250) / 300 + (R(i, 4) - 0.5) * 0.4;
        return {x, y, x2: x + Math.cos(a) * len, y2: y + Math.sin(a) * len, c: R(i, 5) < 0.6 ? '#150C08' : '#7A4A2C', o: 0.25 + R(i, 6) * 0.35};
      }),
    [],
  );
  const stripes = [
    'M196 300Q250 288 304 300', 'M178 350Q250 334 322 350', 'M160 404Q250 386 340 404', 'M150 462Q250 444 350 462',
  ];
  const eyeOpen = 1 - Math.min(1, Math.max(0, blink));
  return (
    <svg viewBox="0 0 500 760" width={w} height={(w * 760) / 500} style={{overflow: 'visible'}}>
      <defs>
        <radialGradient id="cb-body" cx="0.5" cy="0.55" r="0.62">
          <stop offset="0" stopColor="#22140E" />
          <stop offset="0.72" stopColor="#3E2518" />
          <stop offset="0.93" stopColor="#7A4526" />
          <stop offset="1" stopColor="#D88A48" />
        </radialGradient>
        <radialGradient id="cb-head" cx="0.5" cy="0.55" r="0.6">
          <stop offset="0" stopColor="#26170F" />
          <stop offset="0.75" stopColor="#43291B" />
          <stop offset="0.95" stopColor="#8A5230" />
          <stop offset="1" stopColor="#D88A48" />
        </radialGradient>
        <linearGradient id="cb-face" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor={lamp > 0.3 ? '#B9774A' : '#8A5634'} />
          <stop offset="0.55" stopColor="#4A2C1C" />
          <stop offset="1" stopColor="#24150E" />
        </linearGradient>
        <radialGradient id="cb-iris" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F6E27A" />
          <stop offset="0.65" stopColor="#C9A23A" />
          <stop offset="1" stopColor="#6E5418" />
        </radialGradient>
        <filter id="cb-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <clipPath id="cb-clip">
          <path d={BODY} />
        </clipPath>
      </defs>

      {/* contact shadow on the sill (sun behind -> shadow falls toward us) */}
      <ellipse cx={250} cy={598} rx={170} ry={20} fill="#1A0F0A" opacity={0.55} />
      <path d="M120 596Q250 640 380 596L420 660Q250 700 80 660Z" fill="#1A0F0A" opacity={0.22 * light} filter="url(#cb-glow)" />

      {/* rim-light halo (backlight wraps around the silhouette) */}
      <g filter="url(#cb-glow)" opacity={0.9 * light}>
        <path d={BODY} fill="none" stroke={rim} strokeWidth={16} />
        <ellipse cx={250 + tu * 10} cy={206} rx={92} ry={80} fill="none" stroke={rim} strokeWidth={14} />
      </g>

      {/* tail */}
      <path d={tail} fill="none" stroke={rim} strokeWidth={40} strokeLinecap="round" opacity={0.7 * light} filter="url(#cb-glow)" />
      <path d={tail} fill="none" stroke="#4E3021" strokeWidth={30} strokeLinecap="round" />
      <path d={tail} fill="none" stroke="#2E1C14" strokeWidth={30} strokeLinecap="round" strokeDasharray="16 22" opacity={0.6} />

      {/* body */}
      <g transform={`translate(250 588) scale(${1 + (br - 1) * 0.6} ${br}) translate(-250 -588)`}>
        <path d={BODY} fill="url(#cb-body)" />
        <g clipPath="url(#cb-clip)">
          {stripes.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#24150F" strokeWidth={13 - i} strokeLinecap="round" opacity={0.55} />
          ))}
          {fur.map((f, i) => (
            <line key={i} x1={f.x} y1={f.y} x2={f.x2} y2={f.y2} stroke={f.c} strokeWidth={2.2} strokeLinecap="round" opacity={f.o} />
          ))}
          <path d="M128 520C140 456 186 420 226 416" fill="none" stroke="#C87A42" strokeWidth={5} opacity={0.35 * light} strokeLinecap="round" />
          <path d="M372 520C360 456 314 420 274 416" fill="none" stroke="#C87A42" strokeWidth={5} opacity={0.35 * light} strokeLinecap="round" />
          {/* lamp light grazing the near side as dusk falls */}
          <path d={BODY} fill="#FFB463" opacity={0.18 * lamp} transform="translate(-30 0)" />
        </g>
        <path d={BODY} fill="none" stroke={rim} strokeWidth={5} opacity={light} />
      </g>

      {/* head group: back-of-head crossfades into an over-the-shoulder look */}
      <g transform={`translate(${250 + tu * 14} 210) scale(${sq} 1) translate(-250 -210)`}>
        {/* ears (behind / around head) */}
        <g transform={`rotate(${-earL * 22 - tu * 8} 200 158)`}>
          <path d="M168 182L184 84L232 142Z" fill="#4A2E20" stroke={rim} strokeWidth={3} strokeLinejoin="round" />
          <path d="M180 166L188 104L218 144Z" fill="#2E1C14" opacity={0.7} />
        </g>
        <g transform={`rotate(${tu * 10} 300 158)`}>
          <path d="M268 142L316 84L332 182Z" fill="#4A2E20" stroke={rim} strokeWidth={3} strokeLinejoin="round" />
          <path d="M282 144L312 104L320 166Z" fill={tu > 0.5 ? '#C77E6A' : '#2E1C14'} opacity={tu > 0.5 ? 0.85 : 0.7} />
        </g>
        {/* back of head */}
        <g opacity={1 - tu}>
          <ellipse cx={250} cy={210} rx={92} ry={80} fill="url(#cb-head)" />
          <path d="M160 226L144 244L166 246L156 264L184 258Z M340 226L356 244L334 246L344 264L316 258Z" fill="#2E1B12" />
          <path d="M214 150Q250 140 286 150M206 176Q250 164 294 176" stroke="#24150F" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.5} />
          <ellipse cx={250} cy={210} rx={92} ry={80} fill="none" stroke={rim} strokeWidth={3} opacity={light} />
        </g>
        {/* over-the-shoulder: cheek, one eye, muzzle in profile toward the room */}
        <g opacity={tu}>
          <ellipse cx={250} cy={212} rx={92} ry={80} fill="url(#cb-face)" />
          <path d="M318 200Q352 214 350 238Q346 258 318 262Q300 262 292 252" fill="#9A633C" opacity={0.9} />
          <path d="M160 236L146 250L168 252L156 268L180 264" fill="#24150E" />
          <path d="M214 150Q250 140 286 150" stroke="#3A2419" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.45} />
          {/* eye (almond), lids for the blink */}
          <g transform="translate(296 196)">
            <ellipse rx={20} ry={15 * Math.max(0.06, eyeOpen)} fill="url(#cb-iris)" />
            <ellipse rx={3.2} ry={12 * Math.max(0.05, eyeOpen)} fill="#120A06" />
            {eyeOpen > 0.3 && <circle cx={-6} cy={-5 * eyeOpen} r={3.5} fill="#FFF8E6" opacity={0.9} />}
            <path d={`M-22 ${-2 - 13 * eyeOpen}Q0 ${-18 * eyeOpen - 4} 22 ${-2 - 13 * eyeOpen}`} stroke="#24150F" strokeWidth={4} fill="none" strokeLinecap="round" />
            <path d={`M-22 0Q0 ${14 * eyeOpen + 2} 22 0`} stroke="#24150F" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.7} />
          </g>
          {/* nose + mouth */}
          <path d="M342 226L354 230L346 240Z" fill="#B0645A" />
          <path d="M346 240Q344 252 334 254" stroke="#3A2419" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          {/* whiskers */}
          {[0, 1, 2].map((k) => (
            <path key={k} d={`M330 ${242 + k * 6}Q${380 + k * 4} ${236 + k * 10} ${420 + k * 6} ${238 + k * 16}`} stroke="#FFF1DA" strokeWidth={1.4} fill="none" opacity={0.75} />
          ))}
          <ellipse cx={250} cy={212} rx={92} ry={80} fill="none" stroke={rim} strokeWidth={3} opacity={light} />
        </g>
      </g>
    </svg>
  );
};
