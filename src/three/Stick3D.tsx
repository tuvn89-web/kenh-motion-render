// The channel's stick figure, in 3D: same proportions and the same pose library as the 2D figure,
// so a character can move between the paper, vector and 3D lanes without changing identity.
// Face: dot eyes with catch-lights, brows, expressive mouth; the face turns toward the camera.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Pose} from '../components/draw';

const K = 0.005; // 2D px -> world units (figure ≈ 1.8 tall)
const INK = '#1E1E26';
const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
const UNIT_SPH = new THREE.SphereGeometry(1, 14, 10);
const HEART = (() => {
  const h = new THREE.Shape();
  h.moveTo(0, -0.9);
  h.bezierCurveTo(-1.6, 0.1, -0.8, 1.3, 0, 0.45);
  h.bezierCurveTo(0.8, 1.3, 1.6, 0.1, 0, -0.9);
  return h;
})();

type V = [number, number, number];
const Bone: React.FC<{a: V; b: V; r: number}> = ({a, b, r}) => {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  return (
    <group>
      <mesh geometry={UNIT_CYL} position={mid} quaternion={q} scale={[r, len, r]} castShadow userData={{noOutline: true}}>
        <meshStandardMaterial color={INK} roughness={0.6} />
      </mesh>
      <mesh geometry={UNIT_SPH} position={va} scale={r} castShadow userData={{noOutline: true}}>
        <meshStandardMaterial color={INK} roughness={0.6} />
      </mesh>
      <mesh geometry={UNIT_SPH} position={vb} scale={r} castShadow userData={{noOutline: true}}>
        <meshStandardMaterial color={INK} roughness={0.6} />
      </mesh>
    </group>
  );
};

export type Expr = 'happy' | 'neutral' | 'sad' | 'surprised' | 'angry' | 'smug' | 'love';
export type Stick3DProps = {
  pos: V; yaw?: number; pose?: Pose; scale?: number; shirt?: string; faceTurn?: number;
  blink?: boolean | number; talk?: number; mood?: 'smile' | 'o' | 'flat' | 'sad'; T?: number;
  /** world [x, z] of the camera: the face turns toward it (max ±1.1 rad), like a 2D character cheating to camera */
  cam?: [number, number];
  expr?: Expr;
};

const BROW_TILT: Record<Expr, number> = {happy: 0.12, neutral: 0, sad: -0.45, surprised: 0.05, angry: 0.55, smug: 0.25, love: 0.15};
const BROW_LIFT: Record<Expr, number> = {happy: 0.02, neutral: 0, sad: 0.03, surprised: 0.1, angry: -0.04, smug: -0.02, love: 0.04};

export const Stick3D: React.FC<Stick3DProps> = ({
  pos, yaw = 0, pose, scale = 1, shirt = '#8FB3CC', faceTurn: ft = 0.65, blink = false, talk = 0, mood = 'smile', T = 0, cam, expr,
}) => {
  const ex: Expr = expr ?? (mood === 'sad' ? 'sad' : mood === 'o' ? 'surprised' : mood === 'flat' ? 'neutral' : 'happy');
  const blinkAmt = typeof blink === 'number' ? blink : blink ? 1 : 0;
  let faceTurn = ft;
  if (cam) {
    const dx = cam[0] - pos[0];
    const dz = cam[1] - pos[2];
    const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    faceTurn = Math.max(-1.1, Math.min(1.1, Math.atan2(lz, lx)));
  }
  const p = {lean: 0, aL: [16, -8], aR: [-12, -8], lL: [9, -2], lR: [-9, -2], bob: 0, drop: 0, ...pose} as Required<Pose>;
  const r = (d: number) => (d * Math.PI) / 180;
  const breath = Math.sin(T * 2.4) * 1.6;
  // 2D side-view math (x forward, y up), z separates near/far limbs
  const hipY = (152 - p.drop) * K + p.bob * K;
  const hip: V = [0, hipY, 0];
  const ln = r(p.lean);
  const neck: V = [Math.sin(ln) * 118 * K, hipY + Math.cos(ln) * 118 * K + breath * K, 0];
  const head: V = [neck[0] + Math.sin(ln) * 46 * K, neck[1] + 46 * K, 0];
  const sh: V = [neck[0] * 0.9 + hip[0] * 0.1, neck[1] * 0.9 + hip[1] * 0.1, 0];
  const limb = (o: V, a: [number, number], l1: number, l2: number, z: number): [V, V, V] => {
    const a1 = r(a[0]);
    const a2 = r(a[0] + a[1]);
    const o2: V = [o[0], o[1], z];
    const p1: V = [o[0] + Math.sin(a1) * l1 * K, o[1] - Math.cos(a1) * l1 * K, z];
    return [o2, p1, [p1[0] + Math.sin(a2) * l2 * K, p1[1] - Math.cos(a2) * l2 * K, z]];
  };
  const aF = limb(sh, p.aL, 62, 58, 0.07);
  const aB = limb(sh, p.aR, 62, 58, -0.07);
  const lF = limb(hip, p.lL, 77, 77, 0.05);
  const lB = limb(hip, p.lR, 77, 77, -0.05);
  const R = 42 * K;
  const rw = 0.026;
  // face frame on the head sphere, turned toward the camera by faceTurn
  const fd = new THREE.Vector3(Math.cos(faceTurn), 0, Math.sin(faceTurn));
  const right = new THREE.Vector3(-Math.sin(faceTurn), 0, Math.cos(faceTurn));
  const up = new THREE.Vector3(0, 1, 0);
  const hc = new THREE.Vector3(...head);
  const onFace = (u: number, v: number, lift = 0.004) => {
    const n = fd.clone().addScaledVector(right, u).addScaledVector(up, v).normalize();
    return {p: hc.clone().addScaledVector(n, R + lift), n};
  };
  const qFor = (n: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  const curve = ex === 'sad' ? -1 : ex === 'neutral' || ex === 'angry' ? 0.15 : ex === 'smug' ? 0.55 : 1;
  const mouthGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const w = ex === 'smug' ? 0.2 : 0.26;
    const off = ex === 'smug' ? 0.08 : 0;
    for (let i = 0; i <= 12; i++) {
      const u = -w + (2 * w * i) / 12 + off;
      const k = 1 - ((u - off) / w) ** 2;
      const v = -0.33 - 0.12 * k * curve + (ex === 'smug' ? (u - off) * 0.35 : 0);
      pts.push(onFace(u, v, 0.006).p.sub(hc));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.011, 6, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceTurn.toFixed(2), ex]);
  const browTilt = BROW_TILT[ex];
  const browLift = BROW_LIFT[ex];
  // torso direction for the shirt block
  const tv = new THREE.Vector3(neck[0] - hip[0], neck[1] - hip[1], 0);
  const tLen = tv.length();
  const tq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tv.clone().normalize());
  const shirtC = new THREE.Vector3(hip[0], hip[1], 0).addScaledVector(tv, 0.6);
  const open = (1 - blinkAmt) * (ex === 'surprised' ? 1.25 : ex === 'smug' ? 0.45 : 1);
  const mouthOpen = ex === 'surprised' && talk <= 0.06 ? 0.55 : talk;
  return (
    <group position={pos} rotation={[0, yaw, 0]} scale={scale}>
      {/* far limbs first */}
      <Bone a={aB[0]} b={aB[1]} r={rw} />
      <Bone a={aB[1]} b={aB[2]} r={rw} />
      <Bone a={lB[0]} b={lB[1]} r={rw} />
      <Bone a={lB[1]} b={lB[2]} r={rw} />
      <Bone a={hip} b={neck} r={rw * 1.05} />
      <mesh position={shirtC} quaternion={tq} castShadow>
        <capsuleGeometry args={[0.082, tLen * 0.42, 8, 18]} />
        <meshStandardMaterial color={shirt} roughness={0.9} />
      </mesh>
      <Bone a={lF[0]} b={lF[1]} r={rw} />
      <Bone a={lF[1]} b={lF[2]} r={rw} />
      <Bone a={aF[0]} b={aF[1]} r={rw} />
      <Bone a={aF[1]} b={aF[2]} r={rw} />
      {/* head */}
      <mesh position={head} castShadow>
        <sphereGeometry args={[R, 48, 36]} />
        <meshStandardMaterial color="#FFFDF8" roughness={0.8} emissive="#FFF6E8" emissiveIntensity={0.42} />
      </mesh>
      {/* eyes with catch-lights */}
      {[-1, 1].map((sx) => {
        const e = onFace(sx * 0.27, 0.1, 0.004);
        const hl = onFace(sx * 0.27 + 0.07, 0.17, 0.014);
        return (
          <group key={sx}>
            {ex === 'love' ? (
              <mesh position={e.p} quaternion={qFor(e.n)} scale={0.034} userData={{noOutline: true}}>
                <shapeGeometry args={[HEART]} />
                <meshBasicMaterial color="#E35C2B" side={THREE.DoubleSide} />
              </mesh>
            ) : (
              <mesh position={e.p} quaternion={qFor(e.n)} scale={[0.027, Math.max(0.004, 0.032 * open), 0.016]} userData={{noOutline: true}}>
                <sphereGeometry args={[1, 14, 12]} />
                <meshBasicMaterial color={INK} />
              </mesh>
            )}
            {open > 0.5 && ex !== 'love' && (
              <mesh position={hl.p} scale={0.008} userData={{noOutline: true}}>
                <sphereGeometry args={[1, 8, 6]} />
                <meshBasicMaterial color="#FFFFFF" />
              </mesh>
            )}
          </group>
        );
      })}
      {/* brows */}
      {[-1, 1].map((sx) => {
        // inner end (b0) drops for angry, rises for sad
        const b0 = onFace(sx * 0.15, 0.31 + browLift - browTilt * 0.07, 0.006).p;
        const b1 = onFace(sx * 0.4, 0.31 + browLift + browTilt * 0.07, 0.006).p;
        return <Bone key={`br${sx}`} a={b0.toArray() as V} b={b1.toArray() as V} r={0.009} />;
      })}
      {/* blush */}
      {[-1, 1].map((sx) => {
        const e = onFace(sx * 0.48, -0.16, 0.002);
        return (
          <mesh key={`b${sx}`} position={e.p} quaternion={qFor(e.n)} scale={[0.034, 0.024, 0.004]} userData={{noOutline: true}}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshBasicMaterial color="#F4A6A0" transparent opacity={ex === 'love' ? 0.95 : 0.7} />
          </mesh>
        );
      })}
      {/* mouth */}
      {mouthOpen > 0.06 ? (
        (() => {
          const m = onFace(0, -0.34, 0.008);
          return (
            <mesh position={m.p} quaternion={qFor(m.n)} scale={[ex === 'surprised' && talk <= 0.06 ? 0.028 : 0.042, 0.012 + 0.05 * mouthOpen, 0.018]} userData={{noOutline: true}}>
              <sphereGeometry args={[1, 14, 10]} />
              <meshBasicMaterial color="#3A1A22" />
            </mesh>
          );
        })()
      ) : (
        <mesh geometry={mouthGeo} position={hc} userData={{noOutline: true}}>
          <meshBasicMaterial color={INK} />
        </mesh>
      )}
    </group>
  );
};
