import React, {useContext, useId} from 'react';
import {LightCtx} from '../scenes/light';
import {BEND_TOP} from './bendmap';
import {useCue, cuesOn} from '../lib/cue';
export const HEAD_ON = false;
export const SWAY_ON = false;
import {Img, staticFile} from 'remotion';
import {getInputProps} from 'remotion';
import {patchOf, contactOf, arOf, headOf, viaOf, turnOf, cutSrc} from './assets';

/**
 * Bộ chuyển động "con rối" cho nhân vật là ẢNH TĨNH (PNG nền trong suốt).
 * Số đo lấy từ video mẫu (720p):
 *  - thở: co giãn dọc neo ở bàn chân, đầu nhấp nhô ±1.5% chiều cao, chu kỳ ~3.3 s, chân đứng yên
 *  - chạy: ảnh tư thế chạy cố định, nảy mỗi ~7 khung (0.23 s), biên độ ~2.4% chiều cao
 *  - đi: nảy mỗi ~14 khung (0.47 s), biên độ ~1.6%, lắc ±2.5° quanh bàn chân
 *  - đổi hành động = đổi ảnh tư thế, kèm một nhịp nén/giãn ngắn
 */
export type Mode = 'idle' | 'walk' | 'run' | 'still';
export type Beat = {at: number; mode?: Mode; pose?: string; face?: 1 | -1; to?: number}; // to = x đích (đi/chạy tới)

export type PuppetProps = {
  /** ảnh theo tư thế, vd {stand:'sprites/roman_stand.png', run:'sprites/roman_run.png'} */
  poses: Record<string, string | {src: string; k: number; dir?: number}>; // k = tỉ lệ chiều cao ảnh tư thế so với tư thế chuẩn
  /** kịch bản chuyển động theo khung */
  beats: Beat[];
  f: number; x: number; y: number; h: number; // y = vị trí bàn chân, h = chiều cao hiển thị (px)
  face?: 1 | -1; seed?: number; speed?: number; shadow?: boolean; opacity?: number;
  /** hướng di chuyển khi x do code ngoài điều khiển (vd x = x0 + f*0.9): 1 = sang phải, -1 = sang trái; để kiểm tra đi giật lùi */
  move?: 1 | -1;
  /** ánh lửa hắt lên nhân vật (0..1, thường lấy từ flicker()) */
  light?: number;
  /** G4 — gật/nghiêng đầu ngay trên ảnh (mặc định bật cho người đủ lớn); 'listen' = nghiêng hẳn sang bên nghe */
  head?: boolean | 'listen';
  /** thử nghiệm: ép góc đầu (độ) */
  headDeg?: number;
  /** làm mờ (px) — người băng ngang sát ống kính */
  blur?: number;
  breath?: number; // biên độ thở (tỉ lệ), mặc định 0.015
  /** các khoảng khung [từ, đến) nhân vật đang nói → mấp máy môi (cần miếng vá talk/shut từ tools/va_mat.py) */
  talk?: [number, number][];
  /** chớp mắt ngẫu nhiên khi ảnh tư thế có miếng vá blink (mặc định bật) */
  blink?: boolean;
  /** người trong đám đông: thỉnh thoảng vấp nhẹ / khựng lại khi đang đi (C5) */
  life?: boolean;
  /** tắt chuyển động phụ (lông mũ, tóc đung đưa) — vd vật cứng */
  sway?: boolean;
};

const FPS = 30;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const hash = (a: number, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
/** chớp mắt: mỗi 2,3–5 s một lần (lệch theo seed), nhắm 4 khung; thỉnh thoảng chớp đôi */
export const blinking = (f: number, seed: number) => {
  let t = 12 + Math.floor(hash(seed, 1) * 70), k = 0;
  while (t <= f) {
    if (f < t + 4) return true;
    if (hash(seed, k + 50) < 0.15 && f >= t + 8 && f < t + 12) return true;   // chớp đôi
    t += 70 + Math.floor(hash(seed, k + 2) * 80); k++;
  }
  return false;
};
/** mấp máy môi trong khoảng nói: âm tiết 3–5 khung, mở/ngậm xen kẽ, ngậm ở 2 khung cuối */
export const mouthOpen = (f: number, talk: [number, number][] | undefined, seed: number) => {
  if (!talk) return null;
  for (const [a, b] of talk) {
    if (f < a || f >= b) continue;
    if (f >= b - 2) return false;
    let t = a, k = 0, open = true;
    while (t <= f) { const len = 3 + Math.floor(hash(seed + k, 9) * 3); if (f < t + len) return open; t += len; open = !open; k++; }
    return open;
  }
  return null;   // không nói
};
const cyc = (f: number, frames: number, ph = 0) => ((f / frames + ph) % 1 + 1) % 1;

/** trạng thái tại khung f: mode, pose, hướng, x, thời điểm đổi trạng thái gần nhất */
function stateAt(p: PuppetProps) {
  const {beats, f} = p;
  let mode: Mode = 'idle', pose = Object.keys(p.poses)[0], face = p.face ?? 1, x = p.x, since = 0, prevFace = face, faceAt = -999;
  let prevPose = pose, poseAt = -999, posed = false;   // K6: tư thế trước + lúc đổi (beat đặt tư thế đầu tiên không tính là đổi)
  let segStart = 0, segX0 = p.x, segTo: number | undefined;
  const sorted = [...beats].sort((a, b) => a.at - b.at);
  for (const b of sorted) {
    if (b.at > f) break;
    // chốt vị trí của đoạn trước tại thời điểm b.at
    x = posAt(mode, segX0, segTo, segStart, b.at, p.speed);
    segX0 = x; segStart = b.at;
    if (b.mode) mode = b.mode;
    if (b.pose) { if (posed && b.pose !== pose) { prevPose = pose; poseAt = b.at; } pose = b.pose; posed = true; }
    if (b.face && b.face !== face) { prevFace = face; face = b.face; faceAt = b.at; }
    if (b.mode || b.to !== undefined) segTo = b.to;   // beat chỉ đổi tư thế / hướng thì vẫn đi tiếp tới đích cũ
    since = b.at;
  }
  x = posAt(mode, segX0, segTo, segStart, f, p.speed);
  // nhịp lấy đà (C3): beat đổi tư thế sắp tới
  const nb = sorted.find((b) => b.at > f && b.pose && b.pose !== pose);
  const nextPoseAt = nb ? nb.at : 1e9;
  const arrived = segTo !== undefined && x === segTo;
  const moving = (mode === 'walk' || mode === 'run') && !arrived;
  const mv = moving ? (segTo !== undefined ? Math.sign(segTo - segX0) : p.move ?? 0) : 0;
  return {mode: arrived && (mode === 'walk' || mode === 'run') ? ('idle' as Mode) : mode, pose, prevPose, poseAt, face, x, since, faceAt, prevFace, mv, nextPoseAt, arrivedAt: arrived ? arrivalFrame(mode, segX0, segTo!, segStart, p.speed) : -999};
}
const SPD = {walk: 3.2, run: 9.5}; // px/khung ở chiều cao 300 px (tự co theo h)
function posAt(mode: Mode, x0: number, to: number | undefined, start: number, f: number, speed = 1) {
  if (to === undefined || (mode !== 'walk' && mode !== 'run')) return x0;
  const v = SPD[mode] * speed; const dir = Math.sign(to - x0); const nx = x0 + dir * v * (f - start);
  return dir > 0 ? Math.min(nx, to) : Math.max(nx, to);
}
function arrivalFrame(mode: Mode, x0: number, to: number, start: number, speed = 1) {
  if (mode !== 'walk' && mode !== 'run') return -999; return start + Math.abs(to - x0) / (SPD[mode] * speed);
}

export const Puppet: React.FC<PuppetProps> = (p) => {
  const {f, y, h, seed = 0, shadow = true, opacity = 1, breath = 0.015} = p;
  const s = stateAt(p);
  const k = h / 300; // hệ số theo kích thước
  let sx = 1, sy = 1, dy = 0, rot = 0, lean = 0;
  const ph = (seed * 0.137) % 1;
  if (s.mode === 'idle' || s.mode === 'still') {
    if (s.mode === 'idle') {
      // thở: co giãn dọc neo ở chân (đầu nhấp nhô, chân yên)
      const b = Math.sin(2 * Math.PI * cyc(f, 3.3 * FPS, ph));
      sy = 1 + breath * b; sx = 1 - breath * 0.25 * b;
    }
  } else if (s.mode === 'walk') {
    const T = 14; const c = cyc(f - s.since, T, ph);     // lệch nhịp theo seed: đoàn quân không nhún đồng loạt
    dy = -Math.sin(Math.PI * c) * h * 0.016;           // nảy theo từng bước
    const step = Math.floor((f - s.since) / T + ph) % 2; // bước trái / phải
    rot = (step ? 1 : -1) * 2.5 * Math.sin(Math.PI * c); // lắc quanh bàn chân
    lean = 2;
    sy = 1 + 0.01 * Math.cos(2 * Math.PI * c);
  } else if (s.mode === 'run') {
    const T = 7; const c = cyc(f - s.since, T, ph);
    dy = -Math.sin(Math.PI * c) * h * 0.024;
    rot = 1.2 * Math.sin(2 * Math.PI * c);
    lean = 6;
    sy = 1 + 0.025 * Math.cos(2 * Math.PI * c); sx = 1 - 0.012 * Math.cos(2 * Math.PI * c);
  }
  // dừng lại sau khi đi/chạy: một nhịp nén-giãn tắt dần
  const since = f - s.arrivedAt;
  if (since >= 0 && since < 14) { const d = Math.exp(-since / 3); sy *= 1 - 0.03 * d; sx *= 1 + 0.015 * d; }   // 31/10: nén rồi đứng yên, không nảy lại
  // C3 — đổi tư thế theo nguyên tắc hoạt hình: LẤY ĐÀ (nén xuống, ngả ngược 4 khung trước) → đổi ảnh → VƯỢT ĐÀ (giãn lên rồi dao động tắt dần)
  const sp = f - s.since;
  const ant = clamp01(1 - (s.nextPoseAt - f) / 4);
  if (ant > 0) { sy *= 1 - 0.05 * ant; sx *= 1 + 0.03 * ant; rot -= 2.2 * ant * s.face; }
  // C5 — người trong đám đông thỉnh thoảng vấp / khựng nửa nhịp khi đang đi
  if (p.life && s.mode === 'walk') {
    const per = 150 + Math.floor(hash(seed, 77) * 160), t0 = Math.floor(hash(seed, 78) * per), tt = ((f - t0) % per + per) % per;
    if (tt < 12 && hash(seed, 79) < 0.6) { const e = Math.sin((Math.PI * tt) / 12); dy += h * 0.022 * e; rot += 5 * e * s.face; }
  }
  type E = {src: string; k: number; dir?: number; dx?: number; base?: string};
  const norm = (e: string | {src: string; k: number; dir?: number}): E => (typeof e === 'string' ? {src: e, k: 1, dir: 1} : e);
  const nm = (q: string) => q.replace(/^.*\//, '').replace(/\.[a-z]+$/, '');
  let E0 = norm(p.poses[s.pose] ?? Object.values(p.poses)[0]);
  // K6 — ĐỔI TƯ THẾ BẰNG KHUNG TRUNG GIAN (hoạt hình vẽ tay, mỗi khung giữ 2–3 hình); K4 — chưa có khung giữa thì 2 hình nhoè
  const tp = f - s.poseAt; let ghost: E | null = null, ghostOp = 0, smear = 0, settleAt = -999;
  if (s.poseAt > 0 && tp >= 0) {
    const EA = norm(p.poses[s.prevPose] ?? Object.values(p.poses)[0]);
    const tr = viaOf(nm(EA.src), nm(E0.src));
    if (tr) {
      const dur = tr.frames.length * tr.hold;
      if (tp < dur) { const fr = tr.frames[Math.floor(tp / tr.hold)]; const base = tr.rev ? E0 : EA;
        E0 = {src: cutSrc(fr.n), k: base.k * fr.r, dir: base.dir ?? 1, dx: fr.dx, base: nm(base.src)}; }
      settleAt = s.poseAt + dur;
    } else {
      if (tp < 2) { ghost = EA; ghostOp = tp === 0 ? 0.55 : 0.25; smear = tp === 0 ? 1.4 : 0.7; }
      settleAt = s.poseAt + 1;
    }
  }
  // K3 — tới tư thế cuối: một nhịp quá đà rồi dừng hẳn (không lắc kiểu lò xo)
  const tO = f - settleAt;
  if (tO === 0) { sy *= 1.035; sx *= 0.985; } else if (tO === 1) { sy *= 1.015; sx *= 0.995; }
  // K7 — quay mặt: có khung NHÌN THẲNG thì co nhẹ → nhìn thẳng (2 hình) → mở ra hướng mới; không có thì lật ngang qua 6 khung
  let face: number = s.face; const tf = f - s.faceAt;
  if (tf >= 0 && tf < 6) {
    const T = h >= 110 ? turnOf(nm(E0.src)) : null;
    if (T) {
      if (tf < 2) face = s.prevFace * (1 - 0.12 * tf);
      else if (tf < 4) { face = 1; E0 = {src: cutSrc(T.n), k: E0.k * T.r, dir: 1, dx: T.dx, base: nm(E0.src)}; }
      else face = s.face * (0.76 + 0.12 * (tf - 4));
    } else face = s.prevFace * Math.cos((Math.PI * tf) / 6) || 0.001;
  }
  const entry = E0; const src = entry.src; const hk = entry.k;
  const dir = entry.dir ?? 1; // hướng mặt gốc của ảnh
  // CHẶN ĐI GIẬT LÙI (tầng cảnh): ảnh được lật theo hướng gốc (dir) nên hướng mặt nhìn thấy = face; face phải trùng hướng di chuyển.
  // Hướng gốc của ảnh (FACE trong assets.ts) không kiểm được bằng code: xác định bằng mắt trên out/soat_huong.jpg.
  if (s.mv !== 0 && Math.sign(s.face) !== s.mv) {
    const msg = `[NGƯỢC CHIỀU] ${src} đi ${s.mv > 0 ? 'sang phải' : 'sang trái'} nhưng được đặt quay mặt ${s.face > 0 ? 'phải' : 'trái'} (khung ${f}, x ${Math.round(s.x)})`;
    if ((getInputProps() as {soat?: boolean}).soat) throw new Error(msg);
    console.warn(msg);
  }
  const lift = -dy;
  // miếng vá mắt / miệng (cùng hệ toạ độ ảnh tư thế, nằm trong khung lật nên tự lật theo)
  const name = src.replace(/^.*\//, '').replace(/\.[a-z]+$/, '');
  const P = patchOf(name);
  const imgFilter = p.light ? `sepia(${(0.45 * p.light).toFixed(3)}) saturate(${(1 + 0.5 * p.light).toFixed(3)}) brightness(${(1 + 0.16 * p.light).toFixed(3)})` : undefined;
  const patches: {src: string; x: number; y: number; w: number; h: number}[] = [];
  if (P) {
    const settled = sp < 0 || sp >= 6 || s.since === 0;   // không chớp ngay lúc đổi tư thế
    if (P.blink && p.blink !== false && settled && s.mode !== 'run' && blinking(f, seed)) patches.push(P.blink);
    const mo = mouthOpen(f, p.talk, seed);
    if (P.talk && mo === true) patches.push(P.talk);
    if (P.shut && mo !== true) patches.push(P.shut);   // ảnh gốc há miệng: ngậm lại khi không nói và giữa các âm tiết
  }
  const H0 = h * hk;
  const sink = contactOf(entry.base ?? name) * H0;   // hạ ảnh để THÂN chạm đất (bỏ qua giáo vẽ rời dưới thân); khung giữa theo ảnh đầu
  const ar = arOf(name), W0 = H0 * ar, DX = (entry.dx ?? 0) * H0;
  const G = ghost ? (() => { const gH = h * ghost.k, gn = nm(ghost.src); return {src: ghost.src, H: gH, W: gH * arOf(gn), sink: contactOf(gn) * gH, flip: (ghost.dir ?? 1) * dir}; })() : null;
  const L = useContext(LightCtx); const fid = 'pf' + useId().replace(/[^a-zA-Z0-9]/g, '');
  // D2 — bảng điểm âm thanh: bước chân / vó ngựa đúng khung chạm đất, đổi tư thế, quay người, dừng lại
  const cue = useCue();
  if (cuesOn) {
    const horse = /FLAM_(HORSE|TROT|CHASE|SWORD|HSHOCK|REAR)|ANI_HORSE/.test(name);
    const ex = {h: Math.round(h), src: name};
    if ((s.mode === 'walk' || s.mode === 'run') && f > s.since) {
      const T = s.mode === 'walk' ? 14 : 7;
      if (Math.floor((f - s.since) / T + ph) !== Math.floor((f - 1 - s.since) / T + ph)) cue(horse ? 'hoof' : s.mode === 'run' ? 'run' : 'step', s.x, y, ex);
    }
    if (f === s.since && s.since > 0) cue('pose', s.x, y - h * 0.5, ex);
    if (f === s.faceAt) cue('turn', s.x, y - h * 0.5, ex);
    if (Math.round(s.arrivedAt) === f) cue('stop', s.x, y, ex);
  }
  // C1 — chuyển động phụ: phần trên (lông mũ, tóc, đầu) đung đưa trễ nhịp so với thân; tỉ lệ theo bề ngang ảnh
  let sw = 0;   // 31/10: Cậu Cả bỏ rung lông mũ / tóc (không làm rung) — giữ code, tắt bằng SWAY_ON
  if (SWAY_ON && p.sway !== false && h >= 110 && ar < 1.6 && s.mode !== 'still') {
    if (s.mode === 'walk' || s.mode === 'run') { const T = s.mode === 'walk' ? 14 : 7; sw = (s.mode === 'walk' ? 0.011 : 0.018) * Math.sin(2 * Math.PI * (cyc(f - s.since, T, ph) - 0.3)) - 0.006 * s.mv * Math.sign(face * dir); }
    else sw = 0.006 * Math.sin((2 * Math.PI * f) / (2.7 * FPS) + ph * 6);
    if (sp >= 0 && sp < 18 && s.since > 0) sw += 0.02 * Math.exp(-sp / 5) * Math.sin(sp * 0.7) * Math.sign(face * dir);   // dư chấn khi đổi tư thế
    if (tf >= 0 && tf < 14) sw += 0.025 * Math.exp(-tf / 4) * Math.sin(tf * 0.6) * s.face;                               // quay mặt: lông mũ văng theo
  }
  const sunS = L.sun * Math.sign(face * dir || 1);   // phía mặt trời trong hệ toạ độ ảnh (ảnh có thể đang lật)
  // G4 — chuyển động phụ của ĐẦU trên chính ảnh (uốn bằng bản đồ dịch chuyển quanh điểm cổ, không tách mảnh):
  // trôi nhẹ khi đứng, nhún theo bước, gật theo âm tiết khi nói, giật nhẹ khi vừa đổi tư thế; dấu + = cúi về phía mặt nhìn
  // 31/10: Cậu Cả bỏ G4 (đầu gật/nghiêng bằng uốn ảnh) — trông như rung. Giữ code, tắt bằng HEAD_ON.
  const HM = HEAD_ON ? headOf(name) : undefined;
  let hd = 0;
  if (HM && p.head !== false && h >= 140 && s.mode !== 'run' && s.mode !== 'still') {
    hd = 1.2 * Math.sin((2 * Math.PI * f) / (3.9 * FPS) + ph * 5) + 0.45 * Math.sin((2 * Math.PI * f) / (1.7 * FPS) + ph * 11);
    if (s.mode === 'walk') hd = 0.8 * hd + 1.4 * Math.sin(2 * Math.PI * cyc(f - s.since, 14, ph) - 0.6);
    const talking = (p.talk ?? []).some(([a, b]) => f >= a && f < b);
    if (talking) hd += 2.6 * Math.abs(Math.sin(f * 0.42 + ph * 3)) - 0.8;
    if (p.head === 'listen' || s.pose === 'listen') hd += 4.5;
    if (sp >= 0 && sp < 18 && s.since > 0) hd += 3.5 * Math.exp(-sp / 4.5) * Math.sin(sp * 0.8);
    if (p.headDeg !== undefined) hd = p.headDeg;
    hd *= dir;   // ảnh gốc quay trái thì "cúi về phía mặt" là xoay ngược chiều kim đồng hồ (khung lật đã tính phần còn lại)
  }
  const hid = fid + 'h';
  const hScale = HM ? (hd * Math.PI / 180) * 2 * HM.A * H0 : 0;
  const HP = HM ? (HM.pad ?? 0) * H0 : 0;   // bản đồ có đệm quanh ảnh → đầu chìa ra ngoài khung vẫn đúng
  /* 31/10 (Cậu Cả: "như có lớp màu mờ phủ lên nhân vật / vật", "màu chưa hoà vào nền"):
     - BỎ quầng N9 (vòng sáng màu sương ngoài nét viền → viền trắng như ảnh dán) và lớp ám soft-light (màu sáng nâng nét mực đen lên → màng mờ)
     - THAY bằng chỉnh màu theo nền `L.grade` (charcolor.json, tools/mau_nhan_vat.py): bớt bão hoà + cân trắng, nhân kênh nên đen vẫn đen
     - viền nắng (rim) chỉ rọi lên phần tô màu sáng ngay trong nét mực, không phủ lên nét */
  const GR = L.grade; const gs = GR?.sat ?? 1, [gr, gg, gb] = GR?.gain ?? [1, 1, 1], amb = GR?.amb ?? [1, 1, 1];
  const useG = !!GR && (Math.abs(gs - 1) > 0.005 || Math.abs(gr - 1) + Math.abs(gg - 1) + Math.abs(gb - 1) > 0.005);
  const gm = useG ? (() => { const a = 0.2126, b = 0.7152, c = 0.0722, q = 1 - gs;
    // phần bão hoà bị bớt (q·độ sáng) ngả về màu ám của nền `amb` thay vì xám trơn
    return [0, 1, 2].map((i) => [a * q * amb[i] + (i === 0 ? gs : 0), b * q * amb[i] + (i === 1 ? gs : 0), c * q * amb[i] + (i === 2 ? gs : 0)].map((v) => v * [gr, gg, gb][i]))
      .map((row) => [...row, 0, 0].map((v) => v.toFixed(4)).join(' ')).join('  ') + '  0 0 0 1 0'; })() : '';
  const useF = sw !== 0 || useG || (L.rimK > 0 && L.sun !== 0);
  const hz = L.haze * clamp01(1 - h / 200);          // người nhỏ = ở xa → nhạt theo không khí
  const cssF = [useF ? `url(#${fid})` : '', hz > 0.02 ? `saturate(${(1 - 0.35 * hz).toFixed(3)}) contrast(${(1 - 0.25 * hz).toFixed(3)}) brightness(${(1 + 0.08 * hz).toFixed(3)})` : '',
    h < 110 ? 'drop-shadow(0 0 0.6px rgba(42,28,18,0.85)) drop-shadow(0 0 0.5px rgba(42,28,18,0.6))' : '', imgFilter ?? '', smear > 0 ? `blur(${(smear * 0.5).toFixed(2)}px)` : ''].join(' ').trim();
  const castK = shadow && L.cast > 0 && h >= 100 && ar < 1.6 ? L.cast : 0;
  return (
    <div style={{position: 'absolute', left: s.x, top: y, width: 0, height: 0, opacity, filter: p.blur ? `blur(${p.blur}px)` : undefined}}>
      {useF && <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={fid} x="-0.15" y="-0.06" width="1.3" height="1.12" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
          <feImage href={BEND_TOP} x={0} y={0} width={1} height={1} preserveAspectRatio="none" result="m" />
          <feDisplacementMap in="SourceGraphic" in2="m" scale={sw} xChannelSelector="R" yChannelSelector="G" result="sw" />
          {useG ? <feColorMatrix in="sw" type="matrix" values={gm} result="lit" /> : <feOffset in="sw" dx={0} dy={0} result="lit" />}
          <feOffset in="sw" dx={-0.016 * sunS} dy={0.006} result="sh" />
          <feComposite in="sw" in2="sh" operator="out" result="band" />
          <feGaussianBlur in="band" stdDeviation={0.002} result="bandb" />
          {/* chỉ chỗ tô màu sáng (R+G+B > 0,64) mới nhận viền nắng — nét mực tối giữ nguyên */}
          <feColorMatrix in="sw" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.4 1.4 1.4 0 -0.9" result="br" />
          <feComposite in="bandb" in2="br" operator="in" result="band2" />
          <feFlood floodColor={L.rim} floodOpacity={L.sun !== 0 ? L.rimK : 0} result="rc" />
          <feComposite in="rc" in2="band2" operator="in" result="rim" />
          <feBlend in="rim" in2="lit" mode="screen" result="o1" />
          <feComposite in="o1" in2="sw" operator="in" result="body" />
        </filter>
      </svg>}
      {shadow && <div style={{position: 'absolute', left: -h * 0.17 * (1 - lift / (h * 0.2)), top: -h * 0.018, width: h * 0.34 * (1 - lift / (h * 0.2)), height: h * 0.04, borderRadius: '50%', background: 'rgba(20,14,10,0.28)', filter: 'blur(3px)'}} />}
      {/* B2 — bóng đổ dài theo hướng nắng: chính hình nhân vật, đen, bẹt, nghiêng ra phía ngược mặt trời */}
      {castK > 0 && <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `skewX(${(-38 * L.sun).toFixed(1)}deg) scale(${sx * face * dir},${(-0.24 * sy).toFixed(3)})`, opacity: castK}}>
        <Img src={staticFile(src)} style={{position: 'absolute', left: -W0 / 2, top: -H0 + sink, height: H0, width: W0, filter: 'brightness(0) blur(2.5px)'}} />
      </div>}
      <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(0px,${dy}px) rotate(${rot + lean * s.face}deg) scale(${sx * face * dir},${sy})`}}>
        {G && <Img src={staticFile(G.src)} style={{position: 'absolute', left: -G.W / 2, top: -G.H + G.sink, width: G.W, height: G.H, opacity: ghostOp, transform: G.flip < 0 ? 'scaleX(-1)' : undefined, filter: `blur(${smear}px)`}} />}
        <div style={{position: 'absolute', left: -W0 / 2 + DX, top: -H0 + sink, width: W0, height: H0, filter: cssF || undefined}}>
          {Math.abs(hScale) > 0.05 && HM && <svg width={0} height={0} style={{position: 'absolute'}}>
            <filter id={hid} filterUnits="userSpaceOnUse" x={-HP} y={-HP} width={W0 + 2 * HP} height={H0 + 2 * HP} colorInterpolationFilters="sRGB">
              <feImage href={HM.uri} x={-HP} y={-HP} width={W0 + 2 * HP} height={H0 + 2 * HP} preserveAspectRatio="none" result="hm" />
              <feDisplacementMap in="SourceGraphic" in2="hm" scale={hScale} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>}
          <div style={{position: 'absolute', left: 0, top: 0, width: W0, height: H0, filter: Math.abs(hScale) > 0.05 ? `url(#${hid})` : undefined}}>
            <Img src={staticFile(src)} style={{position: 'absolute', left: 0, top: 0, width: W0, height: H0}} />
            {patches.map((q, i) => <Img key={i} src={staticFile(q.src)} style={{position: 'absolute', left: q.x * W0, top: q.y * H0, width: q.w * W0, height: q.h * H0}} />)}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Lớp cảnh có parallax: depth 0 = bầu trời (gần như đứng yên), 1 = mặt đất nơi nhân vật đứng, >1 = tiền cảnh */
export const Plane: React.FC<{src: string; depth: number; cam: {x: number; y: number; z: number}; w?: number; h?: number; x?: number; y?: number; drift?: number; f?: number}> = ({src, depth, cam, w = 2400, h = 1350, x = -240, y = -135, drift = 0, f = 0}) => {
  const z = 1 + (cam.z - 1) * depth;
  const tx = -(cam.x - 960) * depth + drift * f, ty = -(cam.y - 540) * depth;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '960px 540px', transform: `translate(${tx}px,${ty}px) scale(${z})`}}>
      <Img src={staticFile(src)} style={{position: 'absolute', left: x, top: y, width: w, height: h}} />
    </div>
  );
};
