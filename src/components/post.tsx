// Finishing layer shared by every lane: colour grade, animated film grain, vignette, word-synced captions, SFX.
import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export type Look = {contrast?: number; saturate?: number; tint?: string; tintAmt?: number; vignette?: number; grain?: number; lift?: number};
export const LOOKS: Record<string, Look> = {
  paperNight: {contrast: 1.06, saturate: 1.06, tint: '#3A4F8A', tintAmt: 0.1, vignette: 0.5, grain: 0.32},
  vectorGlow: {contrast: 1.08, saturate: 1.12, tint: '#2B1E5C', tintAmt: 0.08, vignette: 0.45, grain: 0.22},
  warm3D: {contrast: 1.05, saturate: 1.05, tint: '#FFB36B', tintAmt: 0.07, vignette: 0.4, grain: 0.26},
  neutral: {contrast: 1.04, saturate: 1.04, vignette: 0.32, grain: 0.22},
};

/** Grade wraps the picture (not captions/UI): contrast + saturation + soft-light tint. */
export const Grade: React.FC<{look?: Look; children: React.ReactNode}> = ({look = LOOKS.neutral, children}) => (
  <AbsoluteFill style={{filter: `contrast(${look.contrast ?? 1}) saturate(${look.saturate ?? 1})`}}>
    {children}
    {look.tint && <AbsoluteFill style={{backgroundColor: look.tint, opacity: look.tintAmt ?? 0.08, mixBlendMode: 'soft-light'}} />}
  </AbsoluteFill>
);

/** Vignette + film grain that changes every frame (static grain reads as a dirty screen). */
export const FilmFinish: React.FC<{look?: Look}> = ({look = LOOKS.neutral}) => {
  const frame = useCurrentFrame();
  const g = Math.floor(frame) % 8;
  // jitter the tile a few px so the 8-tile cycle never reads as a loop
  const jx = ((frame * 37) % 9) - 4;
  const jy = ((frame * 53) % 7) - 3;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(8,6,14,${look.vignette ?? 0.35}) 100%)`}} />
      <Img src={staticFile(`grain/g${g}.png`)} style={{position: 'absolute', left: jx - 8, top: jy - 8, width: 1936, height: 1096, mixBlendMode: 'overlay', opacity: look.grain ?? 0.22}} />
    </AbsoluteFill>
  );
};

export type CapWord = {text: string; start: number; end: number};

/** Word-by-word captions: each word pops on when it is spoken, keywords are inked in the accent colour. */
export const WordCaptions: React.FC<{words: CapWord[]; keywords?: string[]; maxWords?: number; y?: number; font?: string; size?: number; accent?: string; ink?: string; paper?: string}> = ({
  words, keywords = [], maxWords = 6, y = 1000, font = 'Patrick Hand', size = 58, accent = '#E35C2B', ink = '#232228', paper = '#F6F1E7',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = frame / fps;
  // group into lines (sentence ends or maxWords)
  const lines: CapWord[][] = [];
  let cur: CapWord[] = [];
  words.forEach((w, i) => {
    const gap = cur.length ? w.start - words[i - 1].end : 0;
    if (gap > 0.5 && cur.length) {
      lines.push(cur);
      cur = [];
    }
    cur.push(w);
    if (cur.length >= maxWords || /[.!?]$/.test(w.text)) {
      lines.push(cur);
      cur = [];
    }
  });
  if (cur.length) lines.push(cur);
  const line = lines.find((l, i) => T >= l[0].start - 0.05 && T < (lines[i + 1]?.[0].start ?? l[l.length - 1].end + 0.6) - 0.05);
  if (!line) return null;
  const lineEnd = line[line.length - 1].end + 0.5;
  const out = interpolate(T, [lineEnd - 0.15, lineEnd], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const kw = new Set(keywords.map((k) => k.toLowerCase()));
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y - size, display: 'flex', justifyContent: 'center', opacity: out}}>
      <div style={{display: 'flex', gap: size * 0.28, padding: '6px 28px 10px', borderRadius: 14, background: 'rgba(246,241,231,0.0)'}}>
        {line.map((w, i) => {
          const f = Math.round(w.start * fps);
          const s = spring({frame: frame - f, fps, config: {damping: 11, stiffness: 190, mass: 0.6}});
          const on = frame >= f - 1;
          const key = kw.has(w.text.toLowerCase().replace(/[^a-z0-9%'-]/g, ''));
          return (
            <span key={i} style={{
              fontFamily: font, fontSize: size * (key ? 1.12 : 1), color: key ? accent : ink, lineHeight: 1,
              opacity: on ? Math.min(1, s * 1.6) : 0.0, transform: `translateY(${(1 - s) * 18}px) scale(${0.8 + 0.2 * s})`, display: 'inline-block',
              WebkitTextStroke: `${size * 0.16}px ${paper}`, paintOrder: 'stroke fill', fontWeight: key ? 700 : 400,
              textShadow: '0 3px 10px rgba(0,0,0,0.18)',
            }}>
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Turn a sentence into approximate word timings (used until a real ElevenLabs words.json exists). */
export const fakeWords = (text: string, start: number, wps = 2.7): CapWord[] => {
  let t = start;
  return text.split(/\s+/).filter(Boolean).map((w) => {
    const d = (0.26 + w.length * 0.03) * (2.7 / wps);
    const o = {text: w, start: +t.toFixed(2), end: +(t + d).toFixed(2)};
    t += d + (/[.,!?]$/.test(w) ? 0.32 : 0.05);
    return o;
  });
};

export type Sfx = {at: number; file: string; vol?: number};
export const SfxTrack: React.FC<{cues: Sfx[]; beds?: {file: string; vol: number; from?: number; fadeIn?: number}[]}> = ({cues, beds = []}) => {
  const {fps, durationInFrames} = useVideoConfig();
  return (
    <>
      {beds.map((b, i) => (
        <Sequence key={`b${i}`} from={Math.round((b.from ?? 0) * fps)}>
          <Audio src={staticFile('sfx/' + b.file)} volume={(f) => b.vol * Math.min(1, f / ((b.fadeIn ?? 1) * fps)) * Math.min(1, (durationInFrames - f - (b.from ?? 0) * fps) / (1.2 * fps))} />
        </Sequence>
      ))}
      {cues.map((c, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(c.at * fps))}>
          <Audio src={staticFile('sfx/' + c.file)} volume={c.vol ?? 0.6} />
        </Sequence>
      ))}
    </>
  );
};
