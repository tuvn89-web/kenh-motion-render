// Editorial subtitles for lane ED: calm, readable, no bouncing. A whole line sits on screen; words already
// spoken are full white, words still coming are dimmed, money/number words take the house mustard.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';

export type SubWord = [string, number, number]; // text (as written in the script), start s, end s

const lines = (words: SubWord[], maxChars = 44) => {
  const out: SubWord[][] = [];
  let cur: SubWord[] = [];
  let len = 0;
  words.forEach((w, i) => {
    const gap = cur.length ? w[1] - words[i - 1][2] : 0;
    if (cur.length && (gap > 0.6 || len + w[0].length + 1 > maxChars)) {
      out.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(w);
    len += w[0].length + 1;
    // sentence end closes the line; a comma closes it when the line is already long
    if (/[.!?]["”]?$/.test(w[0]) || (/,$/.test(w[0]) && len > maxChars * 0.55)) {
      out.push(cur);
      cur = [];
      len = 0;
    }
  });
  if (cur.length) out.push(cur);
  return out;
};

const isNumberish = (t: string) => /\$|\d|percent|hundred|thousand|million/i.test(t);

export const EdSubtitles: React.FC<{words: SubWord[]; y?: number; size?: number}> = ({words, y = 968, size = 42}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const T = frame / fps;
  const ls = React.useMemo(() => lines(words), [words]);
  const i = ls.findIndex((l, k) => T >= l[0][1] - 0.08 && T < Math.min(l[l.length - 1][2] + 0.35, (ls[k + 1]?.[0][1] ?? 1e9) - 0.08));
  if (i < 0) return null;
  const line = ls[i];
  const a = Math.min(1, (T - (line[0][1] - 0.08)) / 0.12, (line[line.length - 1][2] + 0.35 - T) / 0.15);
  return (
    <div style={{position: 'absolute', left: 140, right: 140, top: y - size, display: 'flex', justifyContent: 'center', opacity: Math.max(0, a)}}>
      <div style={{fontFamily: 'Inter, Arial, sans-serif', fontWeight: 600, fontSize: size, lineHeight: 1.25, textAlign: 'center', letterSpacing: 0.2,
        padding: '6px 18px', borderRadius: 10, background: 'rgba(30,24,20,0.38)', boxShadow: '0 0 24px rgba(30,24,20,0.25)'}}>
        {line.map((w, k) => {
          const said = T >= w[1] - 0.03;
          const num = isNumberish(w[0]);
          return (
            <span key={k} style={{color: num ? '#F2C75C' : '#FBF5EA', opacity: said ? 1 : 0.55, textShadow: '0 2px 6px rgba(0,0,0,0.55)'}}>
              {w[0]}
              {k < line.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
};
