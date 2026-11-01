// Cinematic camera + GPU post stack shared by every 3D scene.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {Bloom, BrightnessContrast, DepthOfField, EffectComposer, HueSaturation, N8AO, ToneMapping, Vignette} from '@react-three/postprocessing';
import {ToneMappingMode} from 'postprocessing';

const sm = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
const nz = (k: number) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};
/** smooth 1D noise for handheld shake */
const noise1 = (t: number, seed: number) => {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return nz(i * 17.3 + seed) * (1 - u) + nz((i + 1) * 17.3 + seed) * u;
};

export type ShotKey = {t: number; pos: [number, number, number]; look: [number, number, number]; fov?: number};
export const shotAt = (keys: ShotKey[], T: number) => {
  let i = 0;
  while (i < keys.length - 2 && T > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const u = b.t > a.t ? sm((T - a.t) / (b.t - a.t)) : 0;
  const L = (x: number[], y: number[]) => x.map((v, k) => v + (y[k] - v) * u) as [number, number, number];
  return {pos: L(a.pos, b.pos), look: L(a.look, b.look), fov: (a.fov ?? 38) + ((b.fov ?? 38) - (a.fov ?? 38)) * u};
};

/** Keyframed camera with lens (fov) changes and a subtle handheld drift. */
export const CameraRig: React.FC<{keys: ShotKey[]; T: number; handheld?: number}> = ({keys, T, handheld = 1}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const s = shotAt(keys, T);
  const h = 0.012 * handheld;
  camera.position.set(s.pos[0] + noise1(T * 0.7, 1) * h, s.pos[1] + noise1(T * 0.9, 2) * h, s.pos[2] + noise1(T * 0.6, 3) * h);
  camera.lookAt(s.look[0] + noise1(T * 0.8, 4) * h * 0.6, s.look[1] + noise1(T * 0.75, 5) * h * 0.6, s.look[2]);
  if (Math.abs(camera.fov - s.fov) > 1e-3) {
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
  }
  return null;
};

/** GPU post: contact shadows (N8AO), bloom on lights, depth of field on a world target, filmic tone map, vignette. */
/** Colour grade now lives here (GPU) instead of a CSS filter over the canvas — much faster at 4K. */
export const Post: React.FC<{focus: [number, number, number]; dof?: number; bloom?: number; ao?: number; contrast?: number; saturation?: number}> = ({
  focus, dof = 1, bloom = 0.6, ao = 1, contrast = 0.06, saturation = 0.08,
}) => {
  const target = useMemo(() => new THREE.Vector3(), []);
  target.set(...focus);
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.45} intensity={2.2 * ao} distanceFalloff={0.6} quality="medium" halfRes color="#3B2E4F" />
      <DepthOfField target={target} focalLength={0.018} bokehScale={2.6 * dof} />
      <Bloom luminanceThreshold={0.82} luminanceSmoothing={0.2} intensity={bloom} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <BrightnessContrast contrast={contrast} />
      <HueSaturation saturation={saturation} />
      <Vignette offset={0.32} darkness={0.42} />
    </EffectComposer>
  );
};
