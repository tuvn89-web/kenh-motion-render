// Cel-shading + ink outline for any react-three-fiber scene.
// Call useToon() inside a <ThreeCanvas>: every MeshStandardMaterial becomes a 3-band toon material and
// every solid, rounded mesh gets an inverted-hull ink outline (constant thickness, extruded along normals).
import * as THREE from 'three';
import {useFrame} from '@react-three/fiber';

let GRAD: THREE.DataTexture | null = null;
export const toonGradient = () => {
  if (GRAD) return GRAD;
  const data = new Uint8Array([64, 64, 64, 255, 150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  GRAD = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  GRAD.minFilter = THREE.NearestFilter;
  GRAD.magFilter = THREE.NearestFilter;
  GRAD.generateMipmaps = false;
  GRAD.needsUpdate = true;
  return GRAD;
};

/** Shared "drawn look" uniforms for every toon material: rim light, comic hatching in shadows, shadow tint. */
export const TOON_FX = {
  rimColor: {value: new THREE.Color('#FFE2B8')},
  rimStrength: {value: 0.35},
  hatchSpacing: {value: 7.0}, // px at 1080p; scaled automatically with the render height
  hatchThreshold: {value: 0.22},
  hatchStrength: {value: 0.35},
  shadowTint: {value: new THREE.Color('#6D6FA8')},
  shadowTintAmt: {value: 0.28},
};
const patchToon = (m: THREE.MeshToonMaterial) => {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, TOON_FX);
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 rimColor; uniform float rimStrength; uniform float hatchSpacing; uniform float hatchThreshold;
uniform float hatchStrength; uniform vec3 shadowTint; uniform float shadowTintAmt;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `{
  vec3 Vd = normalize(vViewPosition);
  float ndv = clamp(dot(normalize(normal), Vd), 0.0, 1.0);
  float lum0 = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
  // cool, slightly purple shadows instead of grey ones (painterly)
  float sh = smoothstep(0.45, 0.08, lum0);
  outgoingLight = mix(outgoingLight, outgoingLight * shadowTint * 1.6, sh * shadowTintAmt);
  // warm rim light on silhouettes
  outgoingLight += rimColor * pow(1.0 - ndv, 3.0) * rimStrength * (0.4 + lum0);
  // comic hatching: diagonal ink lines appear only in the darkest areas
  float lum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
  float lines = step(0.62, fract((gl_FragCoord.x + gl_FragCoord.y) / hatchSpacing));
  float dark = smoothstep(hatchThreshold, hatchThreshold * 0.45, lum);
  outgoingLight *= 1.0 - hatchStrength * lines * dark;
}
#include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'toonfx1';
};

const outlineCache = new Map<string, THREE.Material>();
export const outlineMaterial = (thickness = 0.012, color = '#1E1E26') => {
  const key = `${thickness}|${color}`;
  const hit = outlineCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshBasicMaterial({color, side: THREE.BackSide});
  m.onBeforeCompile = (sh) => {
    sh.uniforms.thick = {value: thickness};
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float thick;')
      .replace('#include <begin_vertex>', 'vec3 transformed = position + normalize(normal) * thick;');
  };
  m.customProgramCacheKey = () => key;
  outlineCache.set(key, m);
  return m;
};

const SKIP_OUTLINE = new Set(['PlaneGeometry', 'CircleGeometry', 'RingGeometry', 'BoxGeometry', 'BufferGeometry']);

type Opts = {thickness?: number; ink?: string; maxOutlineSize?: number};
export const toonify = (root: THREE.Object3D, o: Opts = {}) => {
  const {thickness = 0.012, ink = '#1E1E26', maxOutlineSize = 3.2} = o;
  const grad = toonGradient();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.isOutline) return;
    const src = (mesh.userData.srcMat ?? mesh.material) as THREE.Material;
    if (src instanceof THREE.MeshStandardMaterial) {
      let toon = mesh.userData.toonMat as THREE.MeshToonMaterial | undefined;
      if (!toon) {
        toon = new THREE.MeshToonMaterial({gradientMap: grad});
        if (!mesh.userData.noFx) patchToon(toon);
        mesh.userData.srcMat = src;
        mesh.userData.toonMat = toon;
        mesh.material = toon;
      } else if (mesh.material !== toon) {
        // r3f swapped the JSX material back in; keep ours and remember the new source
        mesh.userData.srcMat = mesh.material;
        mesh.material = toon;
      }
      const s = mesh.userData.srcMat as THREE.MeshStandardMaterial;
      toon.color.copy(s.color);
      toon.map = s.map;
      toon.emissive.copy(s.emissive);
      toon.emissiveIntensity = s.emissiveIntensity;
      toon.side = s.side;
      toon.transparent = s.transparent;
      toon.opacity = s.opacity;
    }
    // outline
    if (mesh.userData.noOutline || mesh.userData.hasOutline) return;
    const g = mesh.geometry;
    if (!g || SKIP_OUTLINE.has(g.type) || !(mesh.material instanceof THREE.MeshToonMaterial)) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (g.boundingSphere && g.boundingSphere.radius > maxOutlineSize) return;
    const hull = new THREE.Mesh(g, outlineMaterial(thickness / Math.max(0.3, mesh.scale.x), ink));
    hull.userData.isOutline = true;
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.raycast = () => null;
    mesh.add(hull);
    mesh.userData.hasOutline = true;
  });
};

/** Hook: runs inside r3f's frame loop right before each render, so every rendered frame is toon. */
export const useToon = (o: Opts = {}) => {
  useFrame((state) => {
    // keep hatch line spacing constant relative to the frame (1080p, 4K...)
    TOON_FX.hatchSpacing.value = 7.0 * ((state.size.height * state.viewport.dpr) / 1080);
    toonify(state.scene, o);
  }, -1);
};
