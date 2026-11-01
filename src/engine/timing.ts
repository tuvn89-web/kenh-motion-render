// Turns episode.json + words.json (voiceover word timings) into an absolute timeline.
// Scenes and beats are anchored to SPOKEN WORDS, so re-recording the voice re-times the video automatically.
import type {TimeExpr} from './core';

export type Word = {text: string; start: number; end: number};
type Phrase = string | string[];
type BeatSpec = number | {say: Phrase; def: number; offset?: number};

export type SceneJson = {
  template: string;
  dur?: number;                       // nominal seconds (used when there is no voiceover yet)
  start?: Phrase;                     // words that open this scene
  beats?: Record<string, BeatSpec>;
  camera?: [TimeExpr, number, number, number][];
  transition_out?: 'swipe' | 'cut';
  params: any;
  captions?: [number, number, string][];
};
export type EpisodeJson = {
  meta: {width: number; height: number; fps: number; title?: string};
  style?: Record<string, string>;
  audio?: string | null;
  words?: string | null;
  captions?: boolean;
  lead?: number;   // seconds a scene starts before its anchor word
  tail?: number;   // seconds kept after the voice ends
  sfx?: {at: number | Phrase; offset?: number; file: string; volume?: number}[];
  scenes: SceneJson[];
};
export type SceneTL = SceneJson & {startSec: number; dur: number; beatsSec: Record<string, number>};
export type Timeline = {
  total: number; fps: number; width: number; height: number; style: Record<string, string>;
  audio: string | null; scenes: SceneTL[]; captions: {start: number; end: number; text: string}[];
  sfx: {start: number; file: string; volume: number}[]; warnings: string[];
};

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]/g, '');

const findPhrase = (words: Word[], phrase: Phrase, from: number): number => {
  const alts = Array.isArray(phrase) ? phrase : [phrase];
  for (const alt of alts) {
    const toks = alt.split(/\s+/).map(norm).filter(Boolean).slice(0, 4);
    if (!toks.length) continue;
    for (let i = Math.max(0, from); i <= words.length - toks.length; i++) {
      let ok = true;
      for (let k = 0; k < toks.length && ok; k++) ok = norm(words[i + k].text) === toks[k];
      if (ok) return i;
    }
  }
  return -1;
};

export const buildTimeline = (ep: EpisodeJson, words: Word[] | null, audioDur: number | null): Timeline => {
  const warnings: string[] = [];
  const lead = ep.lead ?? 0.12;
  const W = words && words.length ? words.filter((w) => norm(w.text)) : null;
  const starts: number[] = [];
  const startIdx: number[] = [];
  let cursor = 0;
  ep.scenes.forEach((sc, i) => {
    const nominalPrev = i ? starts[i - 1] + (ep.scenes[i - 1].dur ?? 6) : 0;
    if (i === 0) {
      starts.push(0);
      startIdx.push(0);
      return;
    }
    if (W && sc.start) {
      const k = findPhrase(W, sc.start, cursor);
      if (k >= 0) {
        starts.push(Math.max(starts[i - 1] + 0.5, W[k].start - lead));
        startIdx.push(k);
        cursor = k;
        return;
      }
      warnings.push(`scene ${i} (${sc.template}): start phrase not found -> ${JSON.stringify(sc.start)}`);
    }
    starts.push(nominalPrev);
    startIdx.push(cursor);
  });
  const lastNominal = starts[starts.length - 1] + (ep.scenes[ep.scenes.length - 1].dur ?? 6);
  const total = audioDur ? Math.max(audioDur + (ep.tail ?? 1.0), starts[starts.length - 1] + 1) : lastNominal;

  const scenes: SceneTL[] = ep.scenes.map((sc, i) => {
    const startSec = starts[i];
    const end = i < ep.scenes.length - 1 ? starts[i + 1] : total;
    const beatsSec: Record<string, number> = {};
    for (const [name, spec] of Object.entries(sc.beats ?? {})) {
      if (typeof spec === 'number') {
        beatsSec[name] = spec;
        continue;
      }
      let v = spec.def;
      if (W) {
        const k = findPhrase(W, spec.say, startIdx[i]);
        if (k >= 0 && W[k].start >= startSec - 0.01 && W[k].start <= end) v = W[k].start - startSec + (spec.offset ?? 0);
        else warnings.push(`scene ${i} beat "${name}": phrase not found inside scene -> ${JSON.stringify(spec.say)}`);
      }
      beatsSec[name] = v;
    }
    return {...sc, startSec, dur: end - startSec, beatsSec};
  });

  // captions: from real words when available, otherwise from the scene drafts
  let captions: Timeline['captions'] = [];
  if (ep.captions !== false) {
    if (W) {
      let line: Word[] = [];
      const flush = () => {
        if (line.length) captions.push({start: line[0].start, end: line[line.length - 1].end + 0.2, text: line.map((w) => w.text.trim()).join(' ')});
        line = [];
      };
      W.forEach((w, i) => {
        const gap = i && line.length ? w.start - W[i - 1].end : 0;
        if (gap > 0.6) flush();
        line.push(w);
        const tx = w.text.trim();
        if (line.length >= 7 || /[.!?]$/.test(tx) || (/[;:,]$/.test(tx) && line.length >= 3)) flush();
      });
      flush();
      captions = captions.map((c, i) => ({...c, end: i < captions.length - 1 ? Math.min(c.end, captions[i + 1].start) : c.end}));
    } else {
      scenes.forEach((sc) => (sc.captions ?? []).forEach(([a, b, s]) => captions.push({start: sc.startSec + a, end: sc.startSec + b, text: s})));
    }
  }

  const sfx: Timeline['sfx'] = [];
  for (const s of ep.sfx ?? []) {
    let at: number | null = typeof s.at === 'number' ? s.at : null;
    if (at === null && W) {
      const k = findPhrase(W, s.at as Phrase, 0);
      if (k >= 0) at = W[k].start;
      else warnings.push(`sfx ${s.file}: phrase not found`);
    }
    if (at !== null) sfx.push({start: at + (s.offset ?? 0), file: s.file, volume: s.volume ?? 0.6});
  }

  return {
    total, fps: ep.meta.fps, width: ep.meta.width, height: ep.meta.height, style: ep.style ?? {},
    audio: ep.audio ?? null, scenes, captions, sfx, warnings,
  };
};
