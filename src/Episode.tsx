import React, {useEffect, useState} from 'react';
import {
  AbsoluteFill, Audio, CalculateMetadataFunction, Img, Sequence, continueRender, delayRender, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {Brush, C, FONT, HText, SharedDefs, setStyle} from './components/draw';
import {CLOCK, Pt, lerp, resolveTime, seg, smooth} from './engine/core';
import {loadFonts} from './engine/fonts';
import {EpisodeJson, Timeline, Word, buildTimeline} from './engine/timing';
import {TEMPLATES} from './templates';

export type EpisodeProps = {episode: string; tl?: Timeline};

export const calcMeta: CalculateMetadataFunction<EpisodeProps> = async ({props}) => {
  const base = `episodes/${props.episode}/`;
  const ep: EpisodeJson = await (await fetch(staticFile(base + 'episode.json'))).json();
  let words: Word[] | null = null;
  if (ep.words) {
    try {
      words = await (await fetch(staticFile(base + ep.words))).json();
    } catch {
      words = null;
    }
  }
  const audioDur = ep.audio ? await getAudioDurationInSeconds(staticFile(base + ep.audio)) : null;
  const tl = buildTimeline(ep, words, audioDur);
  tl.warnings.forEach((w) => console.warn('[timeline]', w));
  return {
    durationInFrames: Math.max(1, Math.ceil(tl.total * tl.fps)),
    fps: tl.fps, width: tl.width, height: tl.height,
    props: {...props, tl},
  };
};

const camAt = (keys: [number, number, number, number][] | undefined, t: number): [number, number, number] => {
  if (!keys || !keys.length) return [960, 540, 1];
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3]];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b[0]) {
      const u = smooth((t - a[0]) / Math.max(1e-6, b[0] - a[0]));
      return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)];
    }
  }
  const k = keys[keys.length - 1];
  return [k[1], k[2], k[3]];
};

const Swipe: React.FC<{p: number}> = ({p}) => {
  if (p <= 0) return null;
  const xe = lerp(-250, 2170, smooth(p));
  const edge: Pt[] = Array.from({length: 13}, (_, i) => [xe + 60 * Math.sin(i * 0.9 + 1) + 40 * (i / 12 - 0.5), -60 + (i * 1200) / 12]);
  const poly = [[-50, -60], ...edge, [-50, 1140]].map((q) => q.join(' ')).join(' L');
  return (
    <g>
      <clipPath id="swipeClip">
        <path d={`M${poly}Z`} />
      </clipPath>
      <image href={staticFile('paper.jpg')} x={0} y={0} width={1920} height={1080} clipPath="url(#swipeClip)" />
      <Brush pts={edge} w={46} col={C.accent} seed={1234} amp={3} taper={0.1} boil={false} />
      <Brush pts={edge.map(([x, y]) => [x - 38, y] as Pt)} w={10} seed={1240} amp={3} taper={0.2} boil={false} alpha={0.7} />
    </g>
  );
};

export const Episode: React.FC<EpisodeProps> = ({episode, tl}) => {
  const [handle] = useState(() => delayRender('fonts'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadFonts().then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!tl) return null;
  setStyle(tl.style as any);
  const T = frame / fps;
  CLOCK.T = T;
  CLOCK.boil = Math.floor(frame / 4);
  let si = 0;
  tl.scenes.forEach((s, i) => {
    if (s.startSec <= T) si = i;
  });
  const sc = tl.scenes[si];
  const lt = T - sc.startSec;
  const Tpl = TEMPLATES[sc.template];
  const b = (name: string, def: number) => sc.beatsSec[name] ?? def;
  const bt = {...sc.beatsSec, end: sc.dur};
  const keys = (sc.camera ?? [])
    .map((k) => [resolveTime(k[0], bt), k[1], k[2], k[3]] as [number, number, number, number])
    .sort((a, c) => a[0] - c[0]);
  const [cx, cy, z] = camAt(keys, lt);
  const base = `episodes/${episode}/`;
  const cap = tl.captions.find((c) => c.start <= T && T < c.end);
  const tplProps = {t: lt, dur: sc.dur, P: sc.params, b, id: `s${si}`};
  return (
    <AbsoluteFill style={{backgroundColor: C.paper}}>
      <Img src={staticFile('paper.jpg')} style={{width: '100%', height: '100%'}} />
      {ready && (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
          <SharedDefs />
          <g transform={`translate(960 540) scale(${z}) translate(${-cx} ${-cy})`}>
            {Tpl ? <Tpl {...tplProps} layer="world" /> : null}
          </g>
          {Tpl ? <Tpl {...tplProps} layer="hud" /> : null}
          {sc.transition_out === 'swipe' && <Swipe p={seg(lt, sc.dur - 0.5, sc.dur)} />}
          {cap && (
            <g opacity={seg(T, cap.start, cap.start + 0.12) * (1 - seg(T, cap.end - 0.12, cap.end))}>
              <HText id="capsh" s={cap.text} x={962} y={1042} size={50} align="c" alpha={0.25} font={FONT} />
              <HText id="cap" s={cap.text} x={960} y={1038} size={50} align="c" outline={C.paper} font={FONT} />
            </g>
          )}
        </svg>
      )}
      {tl.audio && <Audio src={staticFile(base + tl.audio)} />}
      {tl.sfx.map((s, i) => (
        <Sequence key={i} from={Math.round(s.start * fps)}>
          <Audio src={staticFile('sfx/' + s.file)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
