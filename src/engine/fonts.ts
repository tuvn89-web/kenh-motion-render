import {staticFile} from 'remotion';

const FONTS: [string, string, string][] = [
  ['Patrick Hand', 'fonts/PatrickHand-Regular.ttf', '400'],
  ['Caveat', 'fonts/Caveat.ttf', '400 700'],
  ['Fredoka', 'fonts/Fredoka.ttf', '300 700'],
  // lane ED infographics (OFL): editorial serif for numbers/headlines, Inter for small labels and phone UI
  ['Fraunces', 'fonts/fraunces-latin-400-normal.woff2', '400'],
  ['Fraunces', 'fonts/fraunces-latin-600-normal.woff2', '600'],
  ['Fraunces', 'fonts/fraunces-latin-800-normal.woff2', '800'],
  ['Inter', 'fonts/inter-latin-400-normal.woff2', '400'],
  ['Inter', 'fonts/inter-latin-500-normal.woff2', '500'],
  ['Inter', 'fonts/inter-latin-600-normal.woff2', '600'],
  ['Inter', 'fonts/inter-latin-700-normal.woff2', '700'],
];

let loading: Promise<void> | null = null;
export const loadFonts = () => {
  if (!loading) {
    loading = Promise.all(
      FONTS.map(async ([family, file, weight]) => {
        const f = new FontFace(family, `url(${staticFile(file)})`, {weight});
        await f.load();
        document.fonts.add(f);
      }),
    ).then(() => undefined);
  }
  return loading;
};

let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();
export const measure = (s: string, size: number, font: string, bold = false) => {
  const key = `${font}|${bold}|${size}|${s}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  ctx!.font = `${bold ? 700 : 400} ${size}px "${font}"`;
  const w = ctx!.measureText(s).width;
  cache.set(key, w);
  return w;
};
