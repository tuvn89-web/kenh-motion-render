// Rigged glTF characters (CC0 Quaternius etc.) inside our toon world:
// deterministic animation (time set from the frame, never from a clock), blended clips,
// toon materials + skinned ink outline that follows the skeleton.
import React, {useEffect, useMemo, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {outlineMaterial, toonGradient, TOON_FX} from './toon';

type Loaded = {scene: THREE.Group; clips: THREE.AnimationClip[]};
const cache = new Map<string, Promise<Loaded>>();
const ready = new Map<string, Loaded>();
const loadGlb = (file: string) => {
  let p = cache.get(file);
  if (!p) {
    p = new GLTFLoader().loadAsync(staticFile(file)).then((g) => {
      const d = {scene: g.scene, clips: g.animations};
      ready.set(file, d);
      return d;
    });
    cache.set(file, p);
  }
  return p;
};

/** Call OUTSIDE the <ThreeCanvas> (in the composition): holds the frame until every model is parsed.
 *  (Hooks inside the canvas mount too late for Remotion to wait on them.) */
export const usePreloadGlbs = (files: string[]) => {
  const [handle] = useState(() => delayRender('glb ' + files.join(','), {timeoutInMilliseconds: 90000}));
  const [ok, setOk] = useState(false);
  useEffect(() => {
    Promise.all(files.map(loadGlb)).then(() => {
      setOk(true);
      continueRender(handle);
    });
  }, [handle]); // eslint-disable-line react-hooks/exhaustive-deps
  return ok;
};

export const useGlb = (file: string) => ready.get(file) ?? null;

const clipName = (c: THREE.AnimationClip) => c.name.split('|').pop() ?? c.name;

/** One animation layer: which clip plays when, at what speed; weights cross-fade over `fade` seconds. */
export type Track = {clip: string; from: number; to?: number; speed?: number; fade?: number; offset?: number; loop?: boolean};

const toonifyActor = (root: THREE.Object3D, ink: string, thickness: number, tint?: Record<string, string>) => {
  const grad = toonGradient();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.isOutline) return;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[];
    const toons = mats.map((s) => {
      const t = new THREE.MeshToonMaterial({gradientMap: grad, color: s.color?.clone() ?? new THREE.Color('#fff'), map: s.map ?? null});
      if (tint && tint[s.name]) t.color.set(tint[s.name]);
      // glTF colours are linear; a touch of lift keeps low-poly shading readable under toon bands
      t.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, TOON_FX);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 rimColor; uniform float rimStrength;')
          .replace(
            '#include <opaque_fragment>',
            `{ vec3 Vd = normalize(vViewPosition); float ndv = clamp(dot(normalize(normal), Vd), 0.0, 1.0);
  outgoingLight += rimColor * pow(1.0 - ndv, 3.0) * rimStrength * 1.2; }
#include <opaque_fragment>`,
          );
      };
      t.customProgramCacheKey = () => 'actorfx1';
      return t;
    });
    m.material = Array.isArray(m.material) ? toons : toons[0];
    m.userData.hasOutline = true; // tell the global toonify pass to leave it alone
    // ink outline: a hull sharing geometry (and skeleton, if skinned)
    const sk = m as THREE.SkinnedMesh;
    const ws = new THREE.Vector3();
    m.getWorldScale(ws);
    const ol = outlineMaterial(thickness / Math.max(1e-4, ws.x), ink);
    const hull = sk.isSkinnedMesh ? new THREE.SkinnedMesh(m.geometry, ol) : new THREE.Mesh(m.geometry, ol);
    if (sk.isSkinnedMesh) (hull as THREE.SkinnedMesh).bind(sk.skeleton, sk.bindMatrix);
    hull.userData.isOutline = true;
    hull.frustumCulled = false;
    hull.raycast = () => null;
    if (sk.isSkinnedMesh) {
      // a skinned hull must live next to the mesh (same parent) so it uses the same bind space
      m.parent?.add(hull);
      hull.position.copy(m.position);
      hull.quaternion.copy(m.quaternion);
      hull.scale.copy(m.scale);
    } else m.add(hull);
  });
};

export const GltfActor: React.FC<{
  file: string; T: number; tracks: Track[]; pos: [number, number, number]; yaw?: number; scale?: number;
  height?: number; ink?: string; thickness?: number; tint?: Record<string, string>; bones?: (b: Record<string, THREE.Bone>, T: number) => void;
}> = ({file, T, tracks, pos, yaw = 0, scale: scaleIn = 1, height, ink = '#1E1E26', thickness = 0.012, tint, bones}) => {
  const data = useGlb(file);
  const rig = useMemo(() => {
    if (!data) return null;
    const root = SkeletonUtils.clone(data.scene) as THREE.Group;
    root.updateMatrixWorld(true);
    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map<string, THREE.AnimationAction>();
    for (const c of data.clips) {
      const n = clipName(c);
      if (actions.has(n)) continue;
      const a = mixer.clipAction(c);
      a.play();
      a.setEffectiveWeight(0);
      actions.set(n, a);
    }
    const boneMap: Record<string, THREE.Bone> = {};
    root.traverse((o) => {
      if ((o as THREE.Bone).isBone) boneMap[o.name] = o as THREE.Bone;
    });
    // size from the bind pose: so callers can ask for a height in metres and get feet on the floor
    const box = new THREE.Box3().setFromObject(root, true);
    const size = box.getSize(new THREE.Vector3());
    return {root, mixer, actions, boneMap, toonDone: false, h: size.y || 1, minY: box.min.y, len: Math.max(size.x, size.z)};
  }, [data]);
  if (!rig) return null;
  const scale = height ? height / rig.h : scaleIn;
  // deterministic pose for time T
  const w = new Map<string, number>();
  for (const tr of tracks) {
    const fade = tr.fade ?? 0.35;
    const end = tr.to ?? 1e9;
    if (T < tr.from - fade || T > end + fade) continue;
    const win = Math.min(1, (T - (tr.from - fade)) / fade, (end + fade - T) / fade);
    const a = rig.actions.get(tr.clip);
    if (!a) continue;
    const d = a.getClip().duration;
    const local = (T - tr.from) * (tr.speed ?? 1) + (tr.offset ?? 0);
    a.time = tr.loop === false ? Math.max(0, Math.min(d - 1e-3, local)) : ((local % d) + d) % d;
    w.set(tr.clip, Math.max(w.get(tr.clip) ?? 0, Math.max(0, win)));
  }
  const tot = [...w.values()].reduce((s, v) => s + v, 0) || 1;
  rig.actions.forEach((a, n) => a.setEffectiveWeight((w.get(n) ?? 0) / tot));
  rig.mixer.update(0);
  bones?.(rig.boneMap, T);
  if (!rig.toonDone) {
    rig.root.updateMatrixWorld(true);
    toonifyActor(rig.root, ink, thickness / scale, tint);
    rig.toonDone = true;
  }
  return (
    <group position={pos} rotation={[0, yaw, 0]} scale={scale}>
      <group position={[0, -rig.minY, 0]}>
        <primitive object={rig.root} />
      </group>
    </group>
  );
};

/** Names of the clips in a glb (debug/QA). */
export const clipNames = (d: Loaded | null) => (d ? [...new Set(d.clips.map(clipName))] : []);
