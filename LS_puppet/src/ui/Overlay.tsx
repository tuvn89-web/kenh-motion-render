import {useCue} from '../lib/cue';
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, getInputProps} from 'remotion';
const IP: any = getInputProps();
import {INK, clamp, easeOutBack, prog, easeOut, noise1} from '../lib/util';

export const FONT_T = '"Cormorant SC", "IM Fell English SC", serif';
export const FONT_L = '"IM Fell English SC", "Cormorant SC", serif';

/** grain + vignette finishing layer */
export const Finish: React.FC<{vig?: number; grain?: number; tint?: string; tintOp?: number}> = ({vig: vig0 = 0.85, grain: grain0 = 0.22, tint, tintOp = 0}) => {
  // 29/10: viền tối × 0,28 (video mẫu: tâm sáng hơn 4 góc ~18 mức; bản cũ ~77) và hạt giấy 5% — hai lớp này + sương làm hình "đục như giảm chất lượng"
  const vig = vig0 * 0.28, grain = Math.min(grain0, 0.05);
  // hạt giấy đứng yên: bản trước dịch hạt mỗi khung làm cả khung hình rung giật
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {tint && <AbsoluteFill style={{background: tint, opacity: tintOp, mixBlendMode: 'multiply'}} />}
      {!IP.nograin && <Img src={staticFile('grain.png')} style={{position: 'absolute', left: -10, top: -10, width: 1940, height: 1100, opacity: grain, mixBlendMode: 'overlay'}} />}
      {!IP.novig && <Img src={staticFile('vignette.png')} style={{position: 'absolute', inset: 0, width: 1920, height: 1080, opacity: vig}} />}
    </AbsoluteFill>
  );
};

/** place/time title: lower-left, ink rule drawn under it */
export const PlaceTitle: React.FC<{text: string; sub?: string; at: number; out: number; light?: boolean}> = ({text, sub, at, out, light = true}) => {
  const f = useCurrentFrame();
  const cue = useCue(); if (f === at) cue('title', 200, 900);
  const a = prog(f, at, at + 14, easeOut) * (1 - prog(f, out, out + 12));
  if (a <= 0) return null;
  const rule = prog(f, at + 4, at + 22, easeOut);
  const col = light ? '#f1e7d0' : INK;
  return (
    <div style={{position: 'absolute', left: 110, bottom: 120, opacity: a, transform: `translateY(${(1 - a) * 10}px)`, color: col, fontFamily: FONT_T, textShadow: light ? '0 2px 12px rgba(0,0,0,0.55)' : '0 0 14px rgba(255,248,230,0.9), 0 0 4px rgba(255,248,230,0.9)'}}>
      <div style={{fontSize: 74, letterSpacing: 6, fontWeight: 700, lineHeight: 1}}>{text}</div>
      <div style={{height: 3, width: 420 * rule, background: col, marginTop: 14, opacity: 0.85}} />
      {sub && <div style={{fontSize: 34, letterSpacing: 8, marginTop: 12, fontFamily: FONT_L}}>{sub}</div>}
    </div>
  );
};

/** nhãn giấy (kiểu video mẫu): đường chỉ vẽ từ VẬT ra nhãn trước, nhãn hiện bằng MÉP GIẤY RÁCH loang dần, không xoay;
    dòng phụ hiện từng chữ như đánh máy. (tx,ty) = điểm vật được chỉ; toạ độ màn hình 1920×1080 */
export const Tag: React.FC<{x: number; y: number; text: string; sub?: string; at: number; out?: number; tx?: number; ty?: number; size?: number; rot?: number; anchor?: 'c' | 'l' | 'r'; dark?: boolean}> = ({x, y, text, sub, at, out = 1e9, tx, ty, size = 32, rot = 0, anchor = 'c', dark = false}) => {
  const f = useCurrentFrame();
  const cue = useCue(); if (f === at) cue('tag', x, y);
  const line = tx !== undefined && ty !== undefined;
  const lp = line ? prog(f, at, at + 8, easeOut) : 1;
  const t0 = line ? at + 5 : at;
  const rv = clamp((f - t0) / 9);
  const fade = 1 - prog(f, out, out + 10);
  if ((lp <= 0 && rv <= 0) || fade <= 0) return null;
  const nz = noise1(Math.round(x * 7 + y * 13) % 997);
  const r = 96 * easeOut(rv);
  const clip = rv >= 1 ? 'none' : `polygon(${Array.from({length: 30}, (_, i) => { const a2 = (i / 30) * Math.PI * 2; const rr = r * (0.82 + 0.36 * nz(i * 0.9 + f * 0.15)); return `${(50 + Math.cos(a2) * rr).toFixed(1)}% ${(50 + Math.sin(a2) * rr).toFixed(1)}%`; }).join(',')})`;
  const tr = anchor === 'c' ? '-50%' : anchor === 'l' ? '0%' : '-100%';
  const nSub = sub ? Math.max(0, Math.floor((f - t0 - 10) * 1.6)) : 0;
  const col = dark ? '#f1e7d0' : INK;
  return (
    <>
      {line && (
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: fade, overflow: 'visible'}}>
          <circle cx={tx} cy={ty} r={7 * Math.min(1, lp * 3)} fill={col} />
          <line x1={tx} y1={ty} x2={tx! + (x - tx!) * lp} y2={ty! + (y - ty!) * lp} stroke={col} strokeWidth={3.5} strokeLinecap="round" />
        </svg>
      )}
      {rv > 0 && (
        <div style={{position: 'absolute', left: x, top: y, transform: `translate(${tr},-50%) rotate(${rot}deg)`, opacity: (0.35 + 0.65 * rv) * fade, clipPath: clip, background: '#efe5cc', border: `3px solid ${INK}`, borderRadius: 3, padding: sub ? '8px 22px 10px' : '8px 22px', color: INK, fontFamily: FONT_T, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 4px 0 rgba(42,33,27,0.25)'}}>
          <div style={{fontSize: size, letterSpacing: 2, lineHeight: 1.1}}><span style={{fontSize: size * 0.55, verticalAlign: 'middle', marginRight: 10}}>◆</span>{text}</div>
          {sub && <div style={{fontSize: size * 0.6, letterSpacing: 3, marginTop: 2, color: '#5b4636', minHeight: size * 0.7}}>{sub.slice(0, nSub)}</div>}
        </div>
      )}
    </>
  );
};

/** dấu X đỏ vẽ bằng 2 nét cọ (nét 1 rồi nét 2), toạ độ màn hình */
export const BrushX: React.FC<{x: number; y: number; w?: number; h?: number; at: number; out?: number; color?: string}> = ({x, y, w = 120, h = 90, at, out = 1e9, color = '#c22d2b'}) => {
  const f = useCurrentFrame();
  const cue = useCue(); if (f === at) cue('brush', x, y);
  const p1 = prog(f, at, at + 6, easeOut), p2 = prog(f, at + 5, at + 11, easeOut), fade = 1 - prog(f, out, out + 8);
  if (p1 <= 0 || fade <= 0) return null;
  const L = Math.hypot(2 * w, 2 * h) * 1.05;
  const s = (d: string, p: number, k: number) => <><path d={d} stroke={color} strokeWidth={26} fill="none" strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - p)} /><path d={d} stroke="#8e1d1b" strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.35} strokeDasharray={L} strokeDashoffset={L * (1 - p)} transform={`translate(${k},${k})`} /></>;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: fade, overflow: 'visible'}}>
      {s(`M${x - w},${y - h} Q${x - 8},${y + 6} ${x + w},${y + h}`, p1, 4)}
      {p2 > 0 && s(`M${x + w},${y - h} Q${x + 6},${y - 4} ${x - w},${y + h}`, p2, -3)}
    </svg>
  );
};

/** đồ vật rơi xuống chỗ đặt (mờ dần hiện, chạm đất nén nhẹ) — bọc quanh hình vẽ của đồ vật */
export const DropIn: React.FC<{at: number; x: number; y: number; h?: number; children: React.ReactNode}> = ({at, x, y, h = 70, children}) => {
  const f = useCurrentFrame(); const t = clamp((f - at) / 6); if (f < at) return null;
  const land = f - at - 6; const sq = land >= 0 && land < 8 ? 1 - 0.12 * Math.exp(-land / 2.5) * Math.cos(land * 0.8) : 1;
  return <div style={{position: 'absolute', left: x, top: y - h * (1 - t * t), opacity: Math.min(1, t * 1.6), transform: `scale(${2 - sq},${sq})`, transformOrigin: 'center bottom'}}>{children}</div>;
};

/** speech bubble; (x,y) = tail tip */
export const Bubble: React.FC<{x: number; y: number; text: string; at: number; out?: number; side?: 'l' | 'r'; size?: number}> = ({x, y, text, at, out = 1e9, side = 'r', size = 38}) => {
  const f = useCurrentFrame();
  const cue = useCue(); if (f === at) cue('bubble', x, y);
  const pin = clamp((f - at) / 7);
  const a = pin * (1 - prog(f, out, out + 8));
  if (a <= 0) return null;
  const sc = 0.6 + 0.4 * easeOutBack(pin);
  const ox = side === 'r' ? 30 : -30;
  return (
    <div style={{position: 'absolute', left: x + ox, top: y - 40, transform: `translate(${side === 'r' ? '0' : '-100%'},-100%) scale(${sc})`, transformOrigin: side === 'r' ? 'bottom left' : 'bottom right', opacity: a}}>
      <div style={{position: 'relative', background: '#fbf7ee', border: `4px solid ${INK}`, borderRadius: 26, padding: '10px 26px 12px', fontFamily: FONT_L, fontSize: size, color: INK, whiteSpace: 'nowrap'}}>
        {text}
        <svg width={60} height={50} style={{position: 'absolute', bottom: -44, [side === 'r' ? 'left' : 'right']: 14} as any}>
          <path d={side === 'r' ? 'M4,0 L-14,46 L30,0' : 'M56,0 L74,46 L30,0'} transform={side === 'r' ? 'translate(14,0)' : 'translate(-14,0)'} fill="#fbf7ee" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <rect x={side === 'r' ? 14 : 10} y={-6} width={34} height={8} fill="#fbf7ee" />
        </svg>
      </div>
    </div>
  );
};

/** counting number with small caption */
export const Counter: React.FC<{x: number; y: number; to: number; at: number; dur?: number; out?: number; caption: string; size?: number; color?: string}> = ({x, y, to, at, dur = 24, out = 1e9, caption, size = 120, color = '#f1e7d0'}) => {
  const f = useCurrentFrame();
  const cue = useCue(); if (f === at) cue('counter', x, y);
  const a = clamp((f - at) / 8) * (1 - prog(f, out, out + 10));
  if (a <= 0) return null;
  const v = Math.round(to * prog(f, at, at + dur, easeOut));
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)', textAlign: 'center', opacity: a, color, fontFamily: FONT_T, textShadow: color === '#f1e7d0' ? '0 3px 18px rgba(0,0,0,0.6)' : '0 2px 10px rgba(255,255,255,0.5)'}}>
      <div style={{fontSize: size, fontWeight: 700, letterSpacing: 4, lineHeight: 1}}>{v.toLocaleString('en-US')}</div>
      <div style={{fontSize: size * 0.3, letterSpacing: 9, fontFamily: FONT_L, marginTop: 6}}>{caption}</div>
    </div>
  );
};
