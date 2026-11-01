// Small reusable 3D props and ambient life for the sets.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const nz = (k: number) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};
type V = [number, number, number];

export const Pouf: React.FC<{pos: V; color?: string}> = ({pos, color = '#E3A04D'}) => (
  <group position={pos}>
    <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.3, 0.32, 0.32, 48]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
    {/* puffy cushioned top */}
    <mesh position={[0, 0.33, 0]} scale={[0.305, 0.07, 0.305]} castShadow receiveShadow>
      <sphereGeometry args={[1, 40, 20]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
    {/* tufted seam */}
    <mesh position={[0, 0.33, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{noOutline: true}}>
      <torusGeometry args={[0.3, 0.012, 8, 48]} />
      <meshStandardMaterial color="#B97A35" roughness={0.95} />
    </mesh>
  </group>
);

export const Cushion: React.FC<{pos: V; color?: string; rim?: string}> = ({pos, color = '#7FA3BF', rim = '#8FB3CC'}) => (
  <group position={pos}>
    <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.6, 0.63, 0.12, 48]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
    <mesh position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <torusGeometry args={[0.5, 0.13, 24, 64]} />
      <meshStandardMaterial color={rim} roughness={0.95} />
    </mesh>
  </group>
);

export const CoffeeTable: React.FC<{pos: V; rot?: number}> = ({pos, rot = 0}) => {
  const top = useMemo(() => new RoundedBoxGeometry(1.1, 0.07, 0.6, 4, 0.03), []);
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh geometry={top} position={[0, 0.42, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#B98552" roughness={0.7} />
      </mesh>
      {[[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.2, z]} castShadow>
          <cylinderGeometry args={[0.025, 0.02, 0.4, 10]} />
          <meshStandardMaterial color="#8A5E36" />
        </mesh>
      ))}
    </group>
  );
};

let STEAM_TEX: THREE.Texture | null = null;
const steamTex = () => {
  if (STEAM_TEX) return STEAM_TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  STEAM_TEX = new THREE.CanvasTexture(c);
  return STEAM_TEX;
};

/** Mug with rising, curling steam (sprites). */
export const Mug: React.FC<{pos: V; T: number; color?: string}> = ({pos, T, color = '#E35C2B'}) => {
  const tex = steamTex();
  return (
    <group position={pos}>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.045, 0.12, 24, 1, true]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{noOutline: true}}>
        <circleGeometry args={[0.045, 20]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.105, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{noOutline: true}}>
        <circleGeometry args={[0.046, 20]} />
        <meshStandardMaterial color="#5A3420" />
      </mesh>
      <mesh position={[0.06, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.03, 0.009, 8, 16, Math.PI]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {Array.from({length: 7}, (_, k) => {
        const u = (T * 0.35 + k / 7) % 1;
        const s = 0.04 + u * 0.12;
        return (
          <sprite key={k} position={[Math.sin(u * 7 + k) * 0.03 * (1 + u * 2), 0.13 + u * 0.45, Math.cos(u * 5 + k) * 0.02]} scale={[s, s, s]}>
            <spriteMaterial map={tex} transparent opacity={0.32 * Math.sin(Math.PI * u)} depthWrite={false} />
          </sprite>
        );
      })}
    </group>
  );
};

/** Sheer curtain panel that sways in a light draught (vertex wave every frame). */
export const SheerCurtain: React.FC<{pos: V; rotY?: number; w?: number; h?: number; T: number; color?: string}> = ({pos, rotY = 0, w = 0.9, h = 2.4, T, color = '#FFF4E2'}) => {
  const geo = useMemo(() => new THREE.PlaneGeometry(w, h, 18, 24), [w, h]);
  const base = useMemo(() => Float32Array.from(geo.getAttribute('position').array as Float32Array), [geo]);
  const arr = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < arr.count; i++) {
    const x = base[i * 3];
    const y = base[i * 3 + 1];
    const down = (h / 2 - y) / h; // 0 at the rod, 1 at the hem
    const folds = Math.sin(x * 22) * 0.025;
    const sway = Math.sin(T * 1.3 + y * 1.6 + x * 2) * 0.06 * down * down + Math.sin(T * 0.7 + x) * 0.02 * down;
    arr.setZ(i, folds + sway);
  }
  arr.needsUpdate = true;
  geo.computeVertexNormals();
  return (
    <mesh geometry={geo} position={pos} rotation={[0, rotY, 0]} userData={{noOutline: true}}>
      <meshStandardMaterial color={color} transparent opacity={0.55} side={THREE.DoubleSide} roughness={1} emissive="#FFE7C2" emissiveIntensity={0.15} />
    </mesh>
  );
};

/** Hand-painted wallpaper: soft stripes + tiny motif dots, as a canvas texture. */
export const useWallpaper = (base = '#F2E7D5', stripe = '#EADBC3', dot = '#D9B98F') =>
  useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 64) {
      g.fillStyle = stripe;
      g.fillRect(x + 22, 0, 20, 512);
    }
    for (let y = 16; y < 512; y += 48) {
      for (let x = 0; x < 512; x += 64) {
        g.fillStyle = dot;
        g.globalAlpha = 0.55;
        g.beginPath();
        g.ellipse(x + 2 + ((y / 48) % 2) * 32, y, 4, 6, 0.4, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
    }
    // brush streaks so it never looks printed
    for (let k = 0; k < 140; k++) {
      g.strokeStyle = `rgba(160,130,90,${0.03 + (nz(k) + 1) * 0.015})`;
      g.lineWidth = 2 + (nz(k * 3) + 1) * 2;
      g.beginPath();
      const x = (nz(k * 7) + 1) * 256;
      const y = (nz(k * 11) + 1) * 256;
      g.moveTo(x, y);
      g.lineTo(x + 30 + nz(k * 5) * 20, y + nz(k * 13) * 8);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [base, stripe, dot]);

/** A wallpapered plane laid just in front of a wall. */
export const PaperedPlane: React.FC<{pos: V; rotY?: number; w: number; h: number; tex: THREE.Texture}> = ({pos, rotY = 0, w, h, tex}) => {
  const t = useMemo(() => {
    const c = tex.clone();
    c.repeat.set(w / 1.4, h / 1.4);
    c.needsUpdate = true;
    return c;
  }, [tex, w, h]);
  return (
    <mesh position={pos} rotation={[0, rotY, 0]} receiveShadow userData={{noOutline: true}}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={t} roughness={0.95} />
    </mesh>
  );
};
