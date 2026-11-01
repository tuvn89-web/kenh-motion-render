// 2.5D LAYER KIT — Nano Banana (or any) images -> keyed layers at depths -> camera.
// A kit lives in public/kits/<id>/ : the images + scene.json. Every image shares ONE canvas (the
// master frame), so layers line up by construction; this file only cuts them out and stacks them.
import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Img, continueRender, delayRender, staticFile} from 'remotion';
import {Cam, Dust, LightRays, P, Plane, Stage, camAt, hand} from './Stage';
import {Fx, FxLayer} from '../ac/fx';

// ---------------------------------------------------------------- keying
export type KeyMode = 'none' | 'white' | 'green' | 'black';
const keyCache = new Map<string, Promise<string>>();

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('không tải được ' + src));
    im.src = src;
  });

/** Stand-in for an image that is not in the kit yet (Studio review before Flow): a dark plate (base layer) or a
 *  small label on transparency (keyed layer), both naming the missing file. */
const placeholder = (src: string, mode: KeyMode) => {
  const c = document.createElement('canvas');
  c.width = 1376;
  c.height = 768;
  const ctx = c.getContext('2d')!;
  const name = decodeURIComponent(src.split('/').pop() ?? src);
  if (mode === 'none') {
    ctx.fillStyle = '#2b2a28';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    for (let x = 0; x < c.width; x += 86) ctx.strokeRect(x, 0, 86, c.height);
  }
  ctx.fillStyle = mode === 'none' ? 'rgba(255,255,255,0.75)' : 'rgba(120,255,140,0.9)';
  ctx.font = '600 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CHƯA CÓ ẢNH', c.width / 2, c.height / 2 - (mode === 'none' ? 24 : -60));
  ctx.font = '26px monospace';
  ctx.fillText(name, c.width / 2, c.height / 2 + (mode === 'none' ? 24 : 100));
  return c.toDataURL('image/png');
};

/**
 * white/black: flood-fill the background from the image border (so white INSIDE the subject survives),
 *   soft 2-px matte from colour distance, de-spill the background colour out of edge pixels.
 * green: global chroma key (for window cut-outs or a green-screen subject), green de-spill.
 */
export const keyImage = (src: string, mode: KeyMode, tol = 38): Promise<string> => {
  const k = `${src}|${mode}|${tol}`;
  const hit = keyCache.get(k);
  if (hit) return hit;
  const p = (async () => {
    let im: HTMLImageElement;
    try {
      im = await loadImg(src);
    } catch {
      return placeholder(src, mode); // image not generated yet: show its name instead of stalling the render
    }
    if (mode === 'none') return src;
    const W = im.naturalWidth;
    const H = im.naturalHeight;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d', {willReadFrequently: true})!;
    ctx.drawImage(im, 0, 0);
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const N = W * H;
    const alpha = new Float32Array(N).fill(1);
    if (mode === 'green') {
      for (let i = 0; i < N; i++) {
        const r = d[i * 4];
        const g = d[i * 4 + 1];
        const b = d[i * 4 + 2];
        const kk = g - Math.max(r, b);
        const a = 1 - Math.min(1, Math.max(0, (kk - 18) / 50));
        alpha[i] = a;
        if (kk > 0) d[i * 4 + 1] = Math.max(r, b); // de-spill: no pixel keeps a green cast
      }
    } else {
      // background colour = median of the border
      const border: number[][] = [];
      for (let x = 0; x < W; x += 4) border.push([x, 0], [x, H - 1]);
      for (let y = 0; y < H; y += 4) border.push([0, y], [W - 1, y]);
      const ch = (n: number) => border.map(([x, y]) => d[(y * W + x) * 4 + n]).sort((a, b) => a - b)[border.length >> 1];
      const bg = mode === 'black' ? [ch(0), ch(1), ch(2)] : [ch(0), ch(1), ch(2)];
      const dist = new Float32Array(N);
      for (let i = 0; i < N; i++) dist[i] = Math.max(Math.abs(d[i * 4] - bg[0]), Math.abs(d[i * 4 + 1] - bg[1]), Math.abs(d[i * 4 + 2] - bg[2]));
      // flood fill from every border pixel that looks like background
      const isBg = new Uint8Array(N);
      const stack = new Int32Array(N);
      let sp = 0;
      const push = (i: number) => {
        if (!isBg[i] && dist[i] < tol) {
          isBg[i] = 1;
          stack[sp++] = i;
        }
      };
      for (let x = 0; x < W; x++) {
        push(x);
        push((H - 1) * W + x);
      }
      for (let y = 0; y < H; y++) {
        push(y * W);
        push(y * W + W - 1);
      }
      while (sp > 0) {
        const i = stack[--sp];
        const x = i % W;
        if (x > 0) push(i - 1);
        if (x < W - 1) push(i + 1);
        if (i >= W) push(i - W);
        if (i < N - W) push(i + W);
      }
      // matte: bg = 0; pixels within 2 px of the bg get a soft alpha from colour distance
      const near = new Uint8Array(N);
      for (let pass = 0; pass < 2; pass++) {
        const src0 = pass === 0 ? isBg : near.slice();
        for (let i = 0; i < N; i++) {
          if (src0[i]) {
            const x = i % W;
            if (x > 0) near[i - 1] = 1;
            if (x < W - 1) near[i + 1] = 1;
            if (i >= W) near[i - W] = 1;
            if (i < N - W) near[i + W] = 1;
          }
        }
      }
      for (let i = 0; i < N; i++) {
        if (isBg[i]) alpha[i] = 0;
        else if (near[i]) alpha[i] = Math.min(1, Math.max(0, (dist[i] - tol * 0.35) / (tol * 1.6)));
      }
      // de-spill: remove the background colour mixed into semi-transparent edge pixels
      for (let i = 0; i < N; i++) {
        const a = alpha[i];
        if (a > 0 && a < 1) for (let n = 0; n < 3; n++) d[i * 4 + n] = Math.min(255, Math.max(0, (d[i * 4 + n] - (1 - a) * bg[n]) / a));
      }
    }
    // spill ring: within 3 px of the keyed background, pull green (or the bg colour) out of the fur edge
    if (mode === 'green') {
      let ring = new Uint8Array(N);
      for (let i = 0; i < N; i++) ring[i] = alpha[i] < 0.05 ? 1 : 0;
      for (let pass = 0; pass < 3; pass++) {
        const r0 = ring.slice();
        for (let i = 0; i < N; i++) {
          if (r0[i]) continue;
          const x = i % W;
          if ((x > 0 && r0[i - 1]) || (x < W - 1 && r0[i + 1]) || (i >= W && r0[i - W]) || (i < N - W && r0[i + W])) ring[i] = 2 + pass;
        }
      }
      for (let i = 0; i < N; i++) {
        if (ring[i] < 2) continue;
        const r = d[i * 4];
        const b = d[i * 4 + 2];
        const avg = (r + b) / 2;
        if (d[i * 4 + 1] > avg) d[i * 4 + 1] = avg; // lime fringe -> warm
      }
    }
    // choke: the outermost ring of the subject carries most of the old background -> fade it
    {
      const a0 = alpha.slice();
      for (let i = 0; i < N; i++) {
        if (a0[i] <= 0.05) continue;
        const x = i % W;
        const edge = (x > 0 && a0[i - 1] < 0.05) || (x < W - 1 && a0[i + 1] < 0.05) || (i >= W && a0[i - W] < 0.05) || (i < N - W && a0[i + W] < 0.05);
        if (edge) alpha[i] = a0[i] * 0.35;
      }
    }
    for (let i = 0; i < N; i++) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * alpha[i]);
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  })();
  keyCache.set(k, p);
  return p;
};

// ---------------------------------------------------------------- scene.json
export type KitLayer = {
  name: string; file: string; z: number; key?: KeyMode; tol?: number; opacity?: number;
  blur?: number | 'auto'; maxBlur?: number; blend?: string;
  variants?: Record<string, string>; // e.g. {"blink": "cat-blink.png", "look": "cat-look.png"}
  breathe?: number; // idle breathing: vertical scale amplitude around the layer's bottom (0.01 = 1 %)
  sway?: number; // idle sway: skew amplitude in degrees
  pivot?: [number, number]; // canvas px for breathe/sway origin (e.g. where the subject sits)
  offset?: [number, number]; // canvas px nudge when an edit drifted the subject a little
  scale?: number; // size fix for the same reason (1 = as generated)
  shadow?: {x: number; y: number; rx: number; ry: number; o?: number}; // soft contact shadow (canvas px) under a cut-out subject
  move?: {at: number; dur: number; dx: number; dy: number}; // layer travels (canvas px) e.g. a car driving off, eased in
  fx?: Fx[]; // code-drawn marks/infographics on this plane (canvas px); file may be '' for a code-only plane
};
export type Ease = 'inout' | 'in' | 'out' | 'linear' | 'snap';
export type CamKey = {
  t: number; look: [number, number]; zoom: number; focus?: number; ry?: number; rx?: number; rz?: number; fstop?: number;
  cut?: boolean; // hard cut to this key (no move from the previous one)
  ease?: Ease; // easing of the move that ENDS at this key
  share?: number; // part of this key's zoom done by moving the camera (parallax) instead of the lens; default shot.dollyShare
  shake?: number; // handheld amount at this key
  jolt?: number; // impact at this key: a decaying shake (px at 1080p) — shock, slam, sudden realisation
  vertigo?: number; // dolly-zoom: >1 moves the camera in while the lens widens (subject holds size, world stretches)
};
export type KitShot = {
  duration: number;
  camera: CamKey[];
  handheld?: number;
  dollyShare?: number; // 0..1 part of the zoom done by moving the camera (default 0.3)
  variants?: {layer: string; name: string; from: number; to: number; fade?: number}[];
  rays?: {x: number; y: number; z?: number; strength: number; angle?: number; spread?: number; until?: number};
  dust?: {n: number; z: [number, number]; area: [number, number, number, number]};
  grade?: {vignette?: number; warm?: number};
};
export type Kit = {id: string; canvas: [number, number]; overscan?: number; layers: KitLayer[]; shot: KitShot};

export const useKitJson = (id: string, scene = 'scene') => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [h] = useState(() => delayRender('kit ' + id));
  useEffect(() => {
    fetch(staticFile(`kits/${id}/${scene}.json`))
      .then((r) => r.json())
      .then((j) => {
        setKit({...j, id});
        continueRender(h);
      });
  }, [id, scene, h]);
  return kit;
};

/** Keys every image of the kit (base + variants) before the first frame is captured. */
export const useKeyedKit = (kit: Kit | null) => {
  const [urls, setUrls] = useState<Record<string, string> | null>(null);
  const [h] = useState(() => delayRender('kit keying', {timeoutInMilliseconds: 120000}));
  useEffect(() => {
    if (!kit) return;
    (async () => {
      // index.json (built by the station) maps a name to the file as downloaded: "SBW_room" -> "SBW_room-a_20261024193343.jpg"
      let index: Record<string, string> = {};
      try {
        const r = await fetch(staticFile(`kits/${kit.id}/index.json`));
        if (r.ok) index = await r.json();
      } catch {}
      const resolve = (f: string) => index[f.replace(/\.(png|jpe?g|webp)$/i, '')] ?? f;
      const jobs: [string, Promise<string>][] = [];
      for (const L of kit.layers) {
        const files = [L.file, ...Object.values(L.variants ?? {})];
        for (const f of files) if (f) jobs.push([f, keyImage(staticFile(`kits/${kit.id}/${resolve(f)}`), L.key ?? 'none', L.tol)]);
      }
      return Promise.all(jobs.map(([, p]) => p)).then((res) => {
      const m: Record<string, string> = {};
        jobs.forEach(([f], i) => (m[f] = res[i]));
        setUrls(m);
        continueRender(h);
      });
    })();
  }, [kit, h]);
  return urls;
};

// canvas px -> screen px at the default camera
const geo = (kit: Kit) => {
  const ov = kit.overscan ?? 1.15;
  const w = 1920 * ov;
  const h = (w * kit.canvas[1]) / kit.canvas[0];
  const sx = (px: number) => (px / kit.canvas[0] - 0.5) * w;
  const sy = (py: number) => (py / kit.canvas[1] - 0.5) * h;
  return {w, h, sx, sy};
};

const EASE: Record<Ease, (u: number) => number> = {
  linear: (u) => u,
  in: (u) => u * u * u,
  out: (u) => 1 - Math.pow(1 - u, 3),
  inout: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  snap: (u) => 1 - Math.pow(1 - u, 5), // fast start, long settle: punch-ins
};

/** Camera from the shot's keys: look at a canvas point, zoom relative to the default framing at the focus depth.
 *  Keys with cut:true start a new set-up (hard cut); between keys the move uses the end key's easing. */
export const kitCam = (kit: Kit, t: number): Cam => {
  const g = geo(kit);
  const fz = (k: CamKey) => k.focus ?? kit.layers[Math.floor(kit.layers.length / 2)].z;
  const toCam = (k: CamKey): Cam => {
    const z = fz(k);
    const s = (P + z) / P;
    // most of a push-in is optical (lens) so the picture keeps its painted proportions;
    // `share` of it is a real move toward the subject (that part makes the parallax)
    const share = k.share ?? kit.shot.dollyShare ?? 0.3;
    const v = k.vertigo ?? 1;
    const dz = (1 + (k.zoom - 1) * share) * v;
    return {x: g.sx(k.look[0]) * s, y: g.sy(k.look[1]) * s, dolly: (P + z) * (1 - 1 / dz), lens: k.zoom / dz, focus: z, ry: k.ry ?? 0, rx: k.rx ?? 0, rz: k.rz ?? 0, fstop: k.fstop ?? 1};
  };
  const ks = kit.shot.camera;
  let i = 0;
  while (i < ks.length - 1 && t >= ks[i + 1].t) i++;
  const a = ks[i];
  const b = ks[i + 1];
  let c: Cam;
  let shake: number;
  if (!b || b.cut) {
    c = toCam(a);
    shake = a.shake ?? kit.shot.handheld ?? 0.6;
  } else {
    const u = EASE[b.ease ?? 'inout'](Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
    const A = toCam(a);
    const B = toCam(b);
    const l = (p?: number, q?: number) => (p ?? 0) + ((q ?? 0) - (p ?? 0)) * u;
    c = {x: l(A.x, B.x), y: l(A.y, B.y), dolly: l(A.dolly, B.dolly), lens: l(A.lens, B.lens), focus: l(A.focus, B.focus), ry: l(A.ry, B.ry), rx: l(A.rx, B.rx), rz: l(A.rz, B.rz), fstop: l(A.fstop, B.fstop)};
    shake = l(a.shake ?? kit.shot.handheld ?? 0.6, b.shake ?? kit.shot.handheld ?? 0.6);
  }
  const hh = hand(t, shake);
  // impacts: every key with jolt that has already happened adds a fast decaying shake
  let jx = 0, jy = 0, jr = 0;
  for (const k of ks) {
    if (!k.jolt || t < k.t) continue;
    const u = t - k.t;
    const env = k.jolt * Math.exp(-u * 6.5);
    if (env < 0.05) continue;
    jx += env * Math.sin(u * 47 + 0.3);
    jy += env * Math.sin(u * 61 + 1.7) * 0.8;
    jr += env * 0.0009 * Math.sin(u * 39);
  }
  return {...c, x: c.x + hh.x + jx, y: c.y + hh.y + jy, rz: (c.rz ?? 0) + hh.rz + jr};
};

/** Where a point authored on a plane at depth z ends up on screen under this camera (same maths as the CSS stage). */
export const project = (cam: Cam, X: number, Y: number, z: number) => {
  const s = (P + z) / P;
  let x = X * s - cam.x;
  let y = Y * s - cam.y;
  let zz = -z - P + cam.dolly;
  const ry = cam.ry ?? 0, rx = cam.rx ?? 0, rz = cam.rz ?? 0;
  [x, zz] = [x * Math.cos(ry) + zz * Math.sin(ry), -x * Math.sin(ry) + zz * Math.cos(ry)];
  [y, zz] = [y * Math.cos(rx) - zz * Math.sin(rx), y * Math.sin(rx) + zz * Math.cos(rx)];
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  zz += P;
  const k = (P / (P - zz)) * (cam.lens ?? 1);
  return {x: 960 + x * k, y: 540 + y * k, scale: k};
};

const variantWeights = (kit: Kit, layer: string, t: number) => {
  const w: Record<string, number> = {};
  for (const v of kit.shot.variants ?? []) {
    if (v.layer !== layer) continue;
    const f = v.fade ?? 0.12;
    const a = Math.min(1, Math.max(0, Math.min((t - v.from) / f + 1, (v.to - t) / f + 1)));
    w[v.name] = Math.max(w[v.name] ?? 0, a);
  }
  return w;
};

/** Renders a kit at local time t (seconds). */
export const KitScene: React.FC<{kit: Kit; urls: Record<string, string>; t: number}> = ({kit, urls, t}) => {
  const g = geo(kit);
  const cam = kitCam(kit, t);
  const rays = kit.shot.rays;
  return (
    <AbsoluteFill>
      <Stage cam={cam}>
        {[...kit.layers]
          .sort((a, b) => b.z - a.z)
          .map((L) => {
            const vw = variantWeights(kit, L.name, t);
            const br = L.breathe ? 1 + Math.sin(t * 1.7) * L.breathe : 1;
            const sw = L.sway ? Math.sin(t * 0.8) * L.sway : 0;
            const piv = L.pivot ? `${(L.pivot[0] / kit.canvas[0]) * 100}% ${(L.pivot[1] / kit.canvas[1]) * 100}%` : '50% 100%';
            const sc = L.scale ?? 1;
            const inner: React.CSSProperties = {position: 'absolute', inset: 0, transformOrigin: piv, transform: `scale(${sc * (1 + (br - 1) * 0.5)}, ${sc * br}) skewX(${sw}deg)`};
            const mu = L.move ? Math.min(1, Math.max(0, (t - L.move.at) / Math.max(0.01, L.move.dur))) : 0;
            const me = mu * mu * mu; // eased in: starts slow, leaves fast
            const mv: [number, number] = L.move ? [L.move.dx * me, L.move.dy * me] : [0, 0];
            const top = Object.entries(vw).reduce((m, [, v]) => Math.max(m, v), 0);
            return (
              <Plane key={L.name} z={L.z} x={((L.offset?.[0] ?? 0) + mv[0]) / kit.canvas[0] * g.w} y={((L.offset?.[1] ?? 0) + mv[1]) / kit.canvas[1] * g.h} w={g.w} h={g.h} blur={L.blur ?? 'auto'} maxBlur={L.maxBlur} opacity={L.opacity ?? 1} blend={L.blend as React.CSSProperties['mixBlendMode']}>
                {L.shadow && (
                  <div style={{position: 'absolute', inset: 0, transformOrigin: piv, transform: `scale(${sc})`}}><div style={{position: 'absolute', left: `${((L.shadow.x - L.shadow.rx) / kit.canvas[0]) * 100}%`, top: `${((L.shadow.y - L.shadow.ry) / kit.canvas[1]) * 100}%`, width: `${((2 * L.shadow.rx) / kit.canvas[0]) * 100}%`, height: `${((2 * L.shadow.ry) / kit.canvas[1]) * 100}%`, borderRadius: '50%', background: `radial-gradient(ellipse at 50% 50%, rgba(20,10,5,${L.shadow.o ?? 0.45}), rgba(20,10,5,0) 70%)`}} /></div>
                )}
                <div style={inner}>
                  {L.file ? <Img src={urls[L.file]} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: top >= 0.999 ? 0 : 1}} /> : null}
                  {Object.entries(vw).map(([name, v]) =>
                    v > 0 && L.variants?.[name] ? <Img key={name} src={urls[L.variants[name]]} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: v}} /> : null,
                  )}
                  {L.fx && L.fx.length > 0 && (
                    <div style={{position: 'absolute', left: 0, top: 0, width: kit.canvas[0], height: kit.canvas[1], transform: `scale(${g.w / kit.canvas[0]})`, transformOrigin: '0 0'}}>
                      <FxLayer fx={L.fx} t={t} canvas={kit.canvas} id={`${kit.id}-${L.name}`.replace(/[^a-zA-Z0-9-]/g, '')} />
                    </div>
                  )}
                </div>
              </Plane>
            );
          })}
        {kit.shot.dust && (
          <Dust t={t} n={kit.shot.dust.n} zRange={kit.shot.dust.z} area={[g.sx(kit.shot.dust.area[0]), g.sy(kit.shot.dust.area[1]), g.sx(kit.shot.dust.area[2]), g.sy(kit.shot.dust.area[3])]} />
        )}
      </Stage>
      {rays && t < (rays.until ?? 1e9) && (
        (() => {
          const zSun = rays.z ?? Math.max(...kit.layers.map((L) => L.z));
          const p = project(cam, g.sx(rays.x), g.sy(rays.y), zSun);
          return <LightRays t={t} x={p.x} y={p.y} strength={rays.strength} angle={rays.angle ?? 2.6} spread={rays.spread ?? 0.9} bloom={0} />;
        })()
      )}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 55% 45%, rgba(0,0,0,0) 45%, rgba(10,5,5,${kit.shot.grade?.vignette ?? 0.45}) 100%)`}} />
    </AbsoluteFill>
  );
};
