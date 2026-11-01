import {getInputProps} from 'remotion';
import M from './manifest.json';
import PJ from './patches.json';
import CJ from './contact.json';
import HJ from './headmap.json';
import VJ from './via.json';
/** đuôi ảnh trong public/cut: máy nhà dùng png; render trên mây dùng webp (inputProps {cutExt:'webp'}) */
const EXT = String((getInputProps() as {cutExt?: string}).cutExt ?? 'png');
export const cutSrc = (name: string) => `cut/${name}.${EXT}`;
const MAN = M as unknown as Record<string, [number, number]>;
/** hướng mặt gốc của ảnh do AI vẽ: -1 = nhân vật quay/đi sang TRÁI. Puppet tự lật để nhân vật luôn quay theo hướng đi.
    Xác định bằng MŨI CHÂN TRƯỚC và MẮT trên tờ soát phóng to (out/soat_huong.jpg) — KHÔNG đoán theo hướng giáo/khiên.
    T01 đã soát: WALK phải (mặt thẳng, mũi chân trước chỉ phải), SQUINT trái, FIGHT trái, RUN/PULL/CHARGE/ngựa/nằm phải, ảnh đứng nhìn thẳng. */
export const FACE: Record<string, 1 | -1> = {SPR_HAST_SQUINT: -1, SPR_HAST_FIGHT: -1,
  // đợt B (soát 29/10): bản xoay 3/4 của lính LEG* quay TRÁI dù prompt dặn quay phải (mắt lệch trái, tai + vành gáy mũ bên phải, mũi chân trước chỉ trái).
  // LEGA_STAND, LEGA_WALK, LEGB_WALK, LEGE_STAND quay phải; HAST_POINT chỉ tay sang phải; tư thế mới của nhân vật chính quay phải hoặc nhìn thẳng.
  SPR_LEGA_SCARED: -1, SPR_LEGB_SCARED: -1, SPR_LEGB_STAND: -1, SPR_LEGC_SCARED: -1, SPR_LEGC_STAND: -1, SPR_LEGC_WALK: -1,
  SPR_LEGD_SCARED: -1, SPR_LEGD_STAND: -1, SPR_LEGD_WALK: -1, SPR_LEGE_SCARED: -1, SPR_LEGE_WALK: -1, SPR_LEGF_SCARED: -1, SPR_LEGF_STAND: -1, SPR_LEGF_WALK: -1,
  ...((getInputProps() as {faceOverride?: Record<string, 1 | -1>}).faceOverride ?? {})};
/** ảnh đã có trong public/cut chưa (manifest do tools/manifest.py ghi) */
export const has = (name: string) => name in MAN;
/** 'SPR_HAST_POINT|SPR_HAST_STAND' → ảnh đầu tiên đã có; chưa có ảnh nào thì lấy tên cuối (ảnh cũ). Ảnh mới về là tự dùng, không sửa cảnh. */
export const alt = (names: string) => { const l = names.split('|'); return l.find(has) ?? l[l.length - 1]; };
/** ảnh tư thế: name = tên ảnh Flow (vd SPR_HAST_SCARED, hoặc 'MỚI|CŨ'); base = tư thế chuẩn để giữ tỉ lệ chiều cao */
export const pose = (names: string, base: string) => { const name = alt(names); return {src: cutSrc(name), k: MAN[name] && MAN[base] ? MAN[name][1] / MAN[base][1] : 1, dir: FACE[name] ?? 1}; };
export const layer = (name: string) => cutSrc(name);
/** bộ tư thế của một nhân vật: mỗi ảnh hiển thị cùng chiều cao h (AI gen mỗi ảnh một tỉ lệ khung nên không suy từ pixel);
    k = tỉ lệ chiều cao riêng của tư thế đặc biệt (chạy chúi, ngả người, cưỡi ngựa…) */
export const poses = (_base: string, names: Record<string, string>, k: Record<string, number> = {}) => Object.fromEntries(Object.entries(names).map(([key, ns]) => { const n = alt(ns); return [key, {src: cutSrc(n), k: k[key] ?? 1, dir: FACE[n] ?? 1}]; }));

/* ---------- ĐÁM ĐÔNG: 6 người lính khác mặt (đợt B) xoay vòng cùng lính gốc ----------
   Mỗi người có đi / đứng / giật mình; tư thế khác (chạy, thủ thế…) dùng ảnh ĐỨNG của chính người đó để không "biến" thành người khác.
   k = chiều cao tương đối (người thấp đậm thấp hơn, người cao gầy cao hơn). Chưa có ảnh nào thì cả đám đông là lính gốc như cũ. */
export const VARIANTS: Record<string, number> = {LEGA: 1.06, LEGB: 0.92, LEGC: 0.98, LEGD: 0.95, LEGE: 0.96, LEGF: 1.0};
const HAST_KEYS = ['stand', 'walk', 'run', 'squint', 'scared', 'ask', 'deadpan', 'fight', 'pull', 'shovel', 'listen', 'point', 'head'];
const crowdCache: Record<string, ReturnType<typeof poses>> = {};
/** người thứ i trong đám đông. hero = bộ tư thế lính gốc (dùng nguyên khi lượt rơi vào lính gốc) */
export const crowd = (i: number, hero: ReturnType<typeof poses>): {poses: ReturnType<typeof poses>; k: number} => {
  const live = Object.keys(VARIANTS).filter((v) => has(`SPR_${v}_WALK`) && (has(`SPR_${v}_STAND`) || has(`SPR_${v}_SCARED`)));
  const all = ['HAST', ...live];
  const v = all[(((i * 5 + 3) % all.length) + all.length) % all.length];   // bước 5: hai người cạnh nhau ít khi trùng
  if (v === 'HAST') return {poses: hero, k: 1};
  if (!crowdCache[v]) {
    const stand = `SPR_${v}_STAND|SPR_${v}_SCARED`;   // thiếu ảnh đứng (vd chờ gen lại) thì dùng ảnh giật mình của chính người đó
    crowdCache[v] = poses(`SPR_${v}_STAND`, Object.fromEntries(HAST_KEYS.map((key) => [key, key === 'walk' ? `SPR_${v}_WALK` : key === 'scared' ? `SPR_${v}_SCARED|SPR_${v}_STAND` : stand])));
  }
  return {poses: crowdCache[v], k: VARIANTS[v]};
};

/* ---------- MIẾNG VÁ mắt / miệng (tools/va_mat.py) ---------- */
type Patch = {src: string; x: number; y: number; w: number; h: number};
const PAT = PJ as unknown as Record<string, Partial<Record<'blink' | 'talk' | 'shut', Patch>>>;
/** miếng vá của một ảnh tư thế (chỉ khi file miếng vá đã có trong public/cut); ar = rộng/cao của ảnh tư thế */
/** G4 — bản đồ xoay đầu trên chính ảnh (tools/vung_dau.py): A = biên độ mã hoá, cx/cy = điểm cổ (tỉ lệ khung), uri = ảnh bản đồ */
export const headOf = (name: string) => (HJ as unknown as Record<string, {A: number; pad?: number; cx: number; cy: number; uri: string}>)[name];
export const patchOf = (name: string) => {
  const e = PAT[name]; if (!e || !MAN[name]) return null;
  const r: Partial<Record<'blink' | 'talk' | 'shut', Patch>> & {ar: number} = {ar: MAN[name][0] / MAN[name][1]};
  for (const kind of ['blink', 'talk', 'shut'] as const) { const q = e[kind]; if (q && has(q.src)) r[kind] = {...q, src: cutSrc(q.src)}; }
  return r.blink || r.talk || r.shut ? r : null;
};

/** chỗ chạm đất thật (phần chiều cao từ đáy ảnh lên đáy thân) — ảnh nằm có giáo vẽ rời dưới thân: tools/cham_dat.py */
const CON = CJ as unknown as Record<string, number>;
export const contactOf = (name: string) => CON[name] ?? 0;
/** tỉ lệ rộng / cao của ảnh đã tách (để dựng khung bao đúng cỡ ảnh) */
/* K6 — KHUNG TRUNG GIAN giữa hai ảnh tư thế (tools/khung_giua.py → via.json, chỉ khung đã qua soát K5).
   via["A>B"] = {hold: số hình giữ mỗi khung, frames: [{n: tên ảnh, r: chiều cao so với ảnh A (cùng khung Flow), dx: lệch chỗ đặt chân / chiều cao}]}
   đổi ngược B→A dùng chính các khung đó theo thứ tự ngược. turn[ảnh] = khung NHÌN THẲNG khi quay trái ↔ phải (K7). */
type ViaFrame = {n: string; r: number; dx: number};
const VIA = VJ as unknown as {via: Record<string, {hold: number; frames: ViaFrame[]}>; turn: Record<string, ViaFrame>};
/** 31/10: Cậu Cả bỏ khung giữa ("không đáng thời gian gen ảnh so với giá trị") — tắt bằng VIA_ON: đổi tư thế quay về thay ảnh
    + khung nhoè 2 hình (K4, chỉ code) + 1 nhịp quá đà; quay người quay về lật gương. Giữ via.json + code để tham khảo. */
export const VIA_ON = false;
export const viaOf = (a: string, b: string) => {
  if (!VIA_ON) return null;
  const pick = (t: {hold: number; frames: ViaFrame[]}, rev: boolean) => { const fr = t.frames.filter((x) => has(x.n)); return fr.length ? {hold: t.hold, frames: rev ? [...fr].reverse() : fr, rev} : null; };
  const d = VIA.via[`${a}>${b}`], r = VIA.via[`${b}>${a}`];
  return d ? pick(d, false) : r ? pick(r, true) : null;
};
export const turnOf = (name: string) => { if (!VIA_ON) return null; const t = VIA.turn[name]; return t && has(t.n) ? t : null; };
export const arOf = (name: string) => (MAN[name] ? MAN[name][0] / MAN[name][1] : 0.6);
