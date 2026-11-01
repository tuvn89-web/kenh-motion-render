// Rigged 3D cat & dog built from primitives (toon-shaded + ink outline via useToon).
// Faces +x. Actions: stand · walk · trot · sit · lie · loaf, plus head look/tilt, ears, tail, blink, mouth.
import React from 'react';
import * as THREE from 'three';

type V = [number, number, number];
const v = (x: number, y: number, z: number): V => [x, y, z];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const SPH = new THREE.SphereGeometry(1, 24, 18);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14, 1);

export type Species = 'cat' | 'dog';
export type QuadAction = 'stand' | 'walk' | 'trot' | 'sit' | 'lie' | 'loaf';

const SPEC = {
  cat: {color: '#EFA35C', dark: '#C9773A', belly: '#F9D9B2', shoulder: 0.25, body: 0.36, bodyR: 0.135, head: 0.145, snout: 0.035, legR: 0.03, tailN: 12, tailLen: 0.44, tailR: 0.028},
  dog: {color: '#D9A15A', dark: '#9C6630', belly: '#F2D8AE', shoulder: 0.45, body: 0.5, bodyR: 0.19, head: 0.17, snout: 0.13, legR: 0.05, tailN: 8, tailLen: 0.32, tailR: 0.042},
};

const Seg: React.FC<{a: V; b: V; r: number; color: string; cast?: boolean}> = ({a, b, r, color, cast = true}) => {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return (
    <group>
      <mesh geometry={CYL} position={A.clone().add(B).multiplyScalar(0.5)} quaternion={q} scale={[r, d.length(), r]} castShadow={cast}>
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh geometry={SPH} position={B} scale={r} castShadow={cast}>
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </group>
  );
};
const Ball: React.FC<{p: V; s: V | number; color: string; rot?: V; noOutline?: boolean; basic?: boolean}> = ({p, s, color, rot = [0, 0, 0], noOutline, basic}) => (
  <mesh geometry={SPH} position={p} scale={s} rotation={rot} castShadow userData={noOutline ? {noOutline: true} : undefined}>
    {basic ? <meshBasicMaterial color={color} /> : <meshStandardMaterial color={color} roughness={0.85} />}
  </mesh>
);

export type QuadProps = {
  species?: Species; pos: V; yaw?: number; scale?: number; T: number;
  action?: QuadAction; /** 0..1 blend toward the action from 'stand' (use for smooth transitions) */ amount?: number;
  phase?: number; /** walk cycle phase (radians); drive it from distance travelled */
  look?: [number, number]; /** head yaw/pitch in radians */ tilt?: number;
  ears?: number; /** -1 flat … 0 neutral … 1 perked */ tailWag?: number; blink?: boolean; mouth?: number; color?: string;
};

export const Quad3D: React.FC<QuadProps> = ({
  species = 'cat', pos, yaw = 0, scale = 1, T, action = 'stand', amount = 1, phase = 0, look = [0, 0], tilt = 0, ears = 0, tailWag = 0, blink = false, mouth = 0, color,
}) => {
  const S = SPEC[species];
  const col = color ?? S.color;
  const a = clamp(amount);
  const isSit = action === 'sit' ? a : 0;
  const isLie = action === 'lie' || action === 'loaf' ? a : 0;
  const moving = action === 'walk' || action === 'trot' ? a : 0;
  const gait = action === 'trot' ? 1.0 : 0.7;
  const breath = Math.sin(T * (species === 'dog' ? 3.2 : 2.2)) * 0.008;
  const H = S.shoulder;
  const L = S.body;
  // body pitch & height
  const hipY = lerp(lerp(H * 0.95, H * 0.32, isSit), H * 0.28, isLie) + Math.abs(Math.sin(phase)) * 0.015 * moving;
  const shY = lerp(lerp(H, H * 0.92, isSit), H * 0.33, isLie) + Math.abs(Math.cos(phase)) * 0.012 * moving;
  const hip: V = v(-L / 2 + isSit * L * 0.32, hipY, 0);
  const sh: V = v(L / 2, shY, 0);
  const legLen = H * 0.98;
  // legs: [x-attach, side z, front?, phase offset]
  const legs: [V, number, boolean, number][] = [
    [sh, 0.07, true, 0], [sh, -0.07, true, Math.PI], [hip, 0.07, false, Math.PI], [hip, -0.07, false, 0],
  ];
  const legPts = legs.map(([root, z, front, off]) => {
    const sw = Math.sin(phase + off) * 0.42 * gait * moving;
    const lift = Math.max(0, Math.cos(phase + off)) * 0.09 * moving;
    const top: V = v(root[0], root[1] - S.bodyR * 0.4, z);
    let knee: V;
    let foot: V;
    if (!front && isSit > 0) {
      // haunches: thigh forward along the ground
      knee = v(lerp(top[0] + Math.sin(sw) * legLen * 0.5, top[0] + legLen * 0.45, isSit), lerp(top[1] - legLen * 0.5, 0.08, isSit), z * 1.3);
      foot = v(lerp(top[0] + sw * 0.4, top[0] + legLen * 0.5, isSit), 0.03, z * 1.2);
    } else if (isLie > 0) {
      knee = v(top[0] + (front ? 0.12 : -0.05), lerp(top[1] - legLen * 0.5, 0.05, isLie), z * 1.5);
      foot = v(top[0] + (front ? 0.24 : 0.12), 0.03, z * (front ? 1.1 : 1.6));
    } else {
      knee = v(top[0] + Math.sin(sw) * legLen * 0.5 + (front ? 0 : -0.03), top[1] - Math.cos(sw) * legLen * 0.5 + lift * 0.5, z);
      foot = v(top[0] + Math.sin(sw) * legLen * 0.9 + (front ? 0.02 : 0.01), Math.max(0.03, lift + 0.03), z);
    }
    return {top, knee, foot};
  });
  // head
  const neckBase: V = v(sh[0] + 0.02, sh[1] + S.bodyR * 0.5, 0);
  const headUp = species === 'cat' ? 0.06 : 0.12;
  const hc: V = v(neckBase[0] + S.head * 0.55 + isLie * 0.04, neckBase[1] + headUp + isSit * 0.06 - isLie * 0.05, 0);
  // tail chain
  const tail: V[] = [];
  for (let i = 0; i <= S.tailN; i++) {
    const u = i / S.tailN;
    const wag = Math.sin(T * (species === 'dog' ? 14 : 3) - u * 2.2) * (species === 'dog' ? 0.5 : 0.25) * (0.3 + tailWag) * u;
    const up = species === 'cat' ? lerp(0.2, 1.4, u) * (1 - isLie * 0.8) : lerp(0.6, 0.9, u) * (0.6 + tailWag * 0.6);
    const curl = isLie * u * 1.6;
    tail.push(v(hip[0] - S.tailLen * u * Math.cos(up * 0.7) * (1 - curl * 0.3) + curl * 0.15 * u, hip[1] + 0.04 + S.tailLen * u * Math.sin(up * 0.6) * (1 - isLie * 0.7), wag * 0.35 + curl * 0.25 * u));
  }
  const bodyMid: V = v((hip[0] + sh[0]) / 2, (hip[1] + sh[1]) / 2 + breath, 0);
  const bodyLen = Math.hypot(sh[0] - hip[0], sh[1] - hip[1]);
  const bodyPitch = Math.atan2(sh[1] - hip[1], sh[0] - hip[0]);
  const earUp = clamp((ears + 1) / 2);
  return (
    <group position={pos} rotation={[0, yaw, 0]} scale={scale}>
      {/* body */}
      <group position={bodyMid} rotation={[0, 0, bodyPitch]}>
        <mesh geometry={SPH} scale={[bodyLen / 2 + S.bodyR * 0.9, S.bodyR * (1 + breath * 6), S.bodyR * 0.95]} castShadow>
          <meshStandardMaterial color={col} roughness={0.85} />
        </mesh>
        <mesh geometry={SPH} position={[0, -S.bodyR * 0.35, 0]} scale={[bodyLen / 2.2, S.bodyR * 0.7, S.bodyR * 0.8]} userData={{noOutline: true}}>
          <meshStandardMaterial color={S.belly} roughness={0.9} />
        </mesh>
        {species === 'cat' &&
          [-0.55, -0.15, 0.25].map((k, i) => {
            const ax = bodyLen / 2 + S.bodyR * 0.9;
            const f = Math.sqrt(Math.max(0.05, 1 - k * k));
            return (
              <mesh key={i} position={[k * ax, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[S.bodyR * 0.97 * f, S.bodyR * (1 + breath * 6) * f * 1.02, 0.16]} userData={{noOutline: true}}>
                <torusGeometry args={[1, 0.11, 6, 24, Math.PI]} />
                <meshStandardMaterial color={S.dark} roughness={0.85} />
              </mesh>
            );
          })}
      </group>
      {/* legs */}
      {legPts.map(({top, knee, foot}, i) => (
        <group key={i}>
          <Seg a={top} b={knee} r={S.legR * (i < 2 ? 1 : 1.25)} color={col} />
          <Seg a={knee} b={foot} r={S.legR * 0.9} color={col} />
          <Ball p={[foot[0] + 0.015, foot[1], foot[2]]} s={[S.legR * 1.5, S.legR * 1.0, S.legR * 1.3]} color={S.belly} />
        </group>
      ))}
      {/* tail */}
      {tail.slice(1).map((p, i) => (
        <Seg key={i} a={tail[i]} b={p} r={S.tailR * (1 - (i / S.tailN) * (species === 'cat' ? 0.3 : 0.6))} color={i > S.tailN - 3 && species === 'cat' ? S.dark : col} />
      ))}
      {/* neck */}
      <Seg a={neckBase} b={[hc[0] - S.head * 0.4, hc[1] - S.head * 0.3, 0]} r={S.bodyR * 0.55} color={col} />
      {/* head */}
      <group position={hc} rotation={[tilt, look[0], look[1]]}>
        <Ball p={[0, 0, 0]} s={[S.head * 1.05, S.head, S.head * 1.05]} color={col} />
        {/* muzzle */}
        {species === 'dog' ? (
          <group>
            <Ball p={[S.head * 0.95, -S.head * 0.25, 0]} s={[S.snout, S.head * 0.5, S.head * 0.55]} color={S.belly} />
            <Ball p={[S.head * 0.95 + S.snout * 0.92, -S.head * 0.12, 0]} s={[0.035, 0.03, 0.04]} color="#2A1E22" noOutline />
            <mesh position={[S.head * 1.1, -S.head * 0.62 - mouth * 0.02, 0]} scale={[0.05, 0.012 + mouth * 0.03, 0.035]} userData={{noOutline: true}}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshBasicMaterial color={mouth > 0.2 ? '#E26A7A' : '#2A1E22'} />
            </mesh>
          </group>
        ) : (
          <group>
            <Ball p={[S.head * 0.85, -S.head * 0.3, 0]} s={[S.head * 0.32, S.head * 0.3, S.head * 0.55]} color={S.belly} />
            <Ball p={[S.head * 1.0, -S.head * 0.12, 0]} s={[0.014, 0.011, 0.018]} color="#E2747E" noOutline basic />
            {mouth > 0.1 && <Ball p={[S.head * 1.0, -S.head * 0.42, 0]} s={[0.012, 0.012 + mouth * 0.022, 0.02]} color="#5A2630" noOutline basic />}
            {[-1, 1].flatMap((sz) => [-1, 1].map((sy) => (
              <mesh key={`${sz}${sy}`} position={[S.head * 0.95, -S.head * 0.3 + sy * 0.008, sz * S.head * 0.4]} rotation={[0, sz * 0.5, sy * 0.15]} userData={{noOutline: true}}>
                <boxGeometry args={[0.004, 0.003, 0.16]} />
                <meshBasicMaterial color="#FFF6E8" />
              </mesh>
            )))}
          </group>
        )}
        {/* eyes */}
        {[-1, 1].map((sz) => (
          <group key={sz} position={[S.head * 0.78, S.head * 0.18, sz * S.head * 0.42]}>
            <Ball p={[0, 0, 0]} s={[0.02, blink ? 0.004 : species === 'cat' ? 0.03 : 0.026, 0.026]} color="#1E1E26" noOutline basic />
            {!blink && <Ball p={[0.012, 0.01, -sz * 0.006]} s={0.007} color="#FFFFFF" noOutline basic />}
          </group>
        ))}
        {/* ears */}
        {[-1, 1].map((sz) =>
          species === 'cat' ? (
            <group key={sz} position={[-S.head * 0.08, S.head * 0.78, sz * S.head * 0.52]} rotation={[sz * lerp(0.75, 0.22, earUp), 0, lerp(-0.6, 0.05, earUp)]}>
              <mesh castShadow>
                <coneGeometry args={[S.head * 0.5, S.head * 0.95, 4]} />
                <meshStandardMaterial color={col} flatShading />
              </mesh>
              <mesh position={[0.016, -0.012, 0]} scale={[0.6, 0.72, 0.6]} userData={{noOutline: true}}>
                <coneGeometry args={[S.head * 0.5, S.head * 0.95, 4]} />
                <meshStandardMaterial color="#F2A69E" />
              </mesh>
            </group>
          ) : (
            <group key={sz} position={[-S.head * 0.15, S.head * 0.55, sz * S.head * 0.85]} rotation={[sz * lerp(0.15, -0.4, earUp), 0, lerp(-0.3, 0.5, earUp) + Math.sin(T * 6) * 0.05 * tailWag]}>
              <Ball p={[0, -S.head * 0.45, sz * 0.02]} s={[S.head * 0.32, S.head * 0.7, S.head * 0.12]} color={S.dark} />
            </group>
          ),
        )}
      </group>
      {/* collar */}
      {species === 'dog' && (
        <mesh position={[(neckBase[0] + hc[0] - S.head * 0.4) / 2, (neckBase[1] + hc[1] - S.head * 0.3) / 2, 0]}
          quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(hc[0] - S.head * 0.4 - neckBase[0], hc[1] - S.head * 0.3 - neckBase[1], 0).normalize())}
          userData={{noOutline: true}}>
          <torusGeometry args={[S.bodyR * 0.58, 0.024, 8, 24]} />
          <meshStandardMaterial color="#E35C2B" />
        </mesh>
      )}
    </group>
  );
};

/** Local head position of a Quad3D in a given resting action (for camera aiming / focus). */
export const quadHeadLocal = (species: Species = 'cat', action: QuadAction = 'stand', amount = 1): [number, number, number] => {
  const S = SPEC[species];
  const a = clamp(amount);
  const isSit = action === 'sit' ? a : 0;
  const isLie = action === 'lie' || action === 'loaf' ? a : 0;
  const H = S.shoulder;
  const L = S.body;
  const shY = lerp(lerp(H, H * 0.92, isSit), H * 0.33, isLie);
  const neckX = L / 2 + 0.02;
  const neckY = shY + S.bodyR * 0.5;
  const headUp = species === 'cat' ? 0.06 : 0.12;
  return [neckX + S.head * 0.55 + isLie * 0.04, neckY + headUp + isSit * 0.06 - isLie * 0.05, 0];
};
