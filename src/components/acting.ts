// Pose library + pose player with overshoot and follow-through, so stick figures "act" instead of sliding.
import {Pose} from './draw';
import {clamp} from '../engine/core';

type P2 = [number, number];
export const POSES: Record<string, Required<Omit<Pose, 'bob'>>> = {
  stand: {lean: 0, aL: [16, -8], aR: [-12, -8], lL: [9, -2], lR: [-9, -2], drop: 0},
  relaxed: {lean: -2, aL: [8, -4], aR: [-6, -4], lL: [7, -2], lR: [-7, -2], drop: 0},
  wave: {lean: 0, aL: [16, -8], aR: [-128, -34], lL: [9, -2], lR: [-9, -2], drop: 0},
  point: {lean: 4, aL: [92, -4], aR: [-14, -10], lL: [12, -2], lR: [-10, -2], drop: 0},
  think: {lean: 3, aL: [42, 148], aR: [16, 84], lL: [9, -2], lR: [-9, -2], drop: 0},
  shrug: {lean: -3, aL: [42, 78], aR: [-42, -78], lL: [10, -2], lR: [-10, -2], drop: 0},
  cheer: {lean: -4, aL: [138, 22], aR: [-138, -22], lL: [14, -4], lR: [-14, -4], drop: 0},
  surprised: {lean: -8, aL: [64, 44], aR: [-64, -44], lL: [12, -2], lR: [-14, -2], drop: 0},
  call: {lean: 5, aL: [72, 104], aR: [-14, -10], lL: [10, -2], lR: [-10, -2], drop: 0},
  facepalm: {lean: 9, aL: [22, 160], aR: [-10, -6], lL: [9, -2], lR: [-9, -2], drop: 0},
  hug: {lean: 6, aL: [74, 58], aR: [74, 58], lL: [10, -2], lR: [-8, -2], drop: 0},
  crouch: {lean: 14, aL: [50, -20], aR: [30, -30], lL: [72, -118], lR: [40, -100], drop: 52},
  sit: {lean: -4, aL: [36, -30], aR: [26, -36], lL: [88, -88], lR: [84, -92], drop: 77},
  sad: {lean: 12, aL: [4, -2], aR: [-2, -2], lL: [6, -2], lR: [-6, -2], drop: 2},
};

const mix = (a: P2, b: P2, u1: number, u2: number): P2 => [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u2];
const overshoot = (t: number, k = 1.35) => {
  t = clamp(t);
  return 1 + (k + 1) * (t - 1) ** 3 + k * (t - 1) ** 2;
};

/** keys: [time, poseName][] — returns the blended pose at time T (0.42 s transitions, overshoot on the
 *  upper limb, 0.07 s lag on the forearm/shin for follow-through, idle sway between changes). */
export const posePlay = (keys: [number, string][], T: number, dur = 0.42): Pose => {
  let i = 0;
  while (i < keys.length - 1 && T >= keys[i + 1][0]) i++;
  const prev = POSES[keys[Math.max(0, i - 1)][1]] ?? POSES.stand;
  const tgt = POSES[keys[i][1]] ?? POSES.stand;
  const from = i === 0 ? tgt : prev;
  const u = (T - keys[i][0]) / dur;
  const u1 = overshoot(u);
  const u2 = overshoot((u * dur - 0.07) / dur);
  const pose: Pose = {
    lean: from.lean + (tgt.lean - from.lean) * u1,
    aL: mix(from.aL, tgt.aL, u1, u2), aR: mix(from.aR, tgt.aR, u1, u2),
    lL: mix(from.lL, tgt.lL, u1, u2), lR: mix(from.lR, tgt.lR, u1, u2),
    drop: from.drop + (tgt.drop - from.drop) * clamp(u1),
  };
  // secondary motion: idle sway; wave wiggle
  const sway = Math.sin(T * 1.7) * 1.5;
  pose.lean = (pose.lean ?? 0) + sway * 0.6;
  pose.aL = [pose.aL![0] + sway, pose.aL![1]];
  if (keys[i][1] === 'wave') pose.aR = [pose.aR![0], pose.aR![1] + Math.sin(T * 13) * 24 * clamp(u)];
  return pose;
};

/** Fake mouth flap from word timings (replace with real audio amplitude when a voice track exists). */
export const talkFromWords = (words: {start: number; end: number}[], T: number) => {
  const w = words.find((x) => T >= x.start && T <= x.end);
  if (!w) return 0;
  return 0.35 + 0.65 * Math.abs(Math.sin((T - w.start) * 22));
};
