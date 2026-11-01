/* NGỮ PHÁP MÁY QUAY THEO NHỊP KỂ
   Đo từ video mẫu (121 shot): máy chủ yếu "vào nhanh rồi dừng êm" (40%), có zoom ra mở cảnh (31% shot),
   tốc độ zoom trung bình ~3%/giây, có cú đẩy nhanh vào từ khoá, máy bám nhân vật đang chạy, 10% shot đẩy vào rồi kéo ra.
   Bản cũ của mình: 63% shot trôi êm hai đầu, 78% shot đẩy vào → đều đều như video bất động sản.
   Mỗi câu kịch bản có một CẢM XÚC (MOOD) → máy tự chọn kiểu chuyển động. */
import type {Cam} from '../scenes/Stage';
import {clamp, easeInOut} from '../lib/util';

export type Ease = 'out' | 'in' | 'inout' | 'lin' | 'snap';
export const EZ: Record<Ease, (t: number) => number> = {
  out: (t) => 1 - Math.pow(1 - t, 3),      // vào nhanh, dừng êm (mặc định)
  snap: (t) => 1 - Math.pow(1 - t, 5),     // vào rất nhanh, dừng gắt hơn (đẩy nhanh)
  in: (t) => t * t * t,                    // chậm rồi nhanh (rình rập)
  inout: easeInOut,
  lin: (t) => t,
};

export type CamKey = {at: number; x?: number; y?: number; z?: number; e?: Ease};
/** đường đi của máy qua các mốc; mỗi đoạn dùng kiểu tăng tốc của mốc cuối đoạn (mặc định 'out') */
export const path = (f: number, keys: CamKey[]): Cam => {
  const full: Required<CamKey>[] = [];
  keys.forEach((k, i) => { const p = full[i - 1]; full.push({at: k.at, x: k.x ?? p?.x ?? 960, y: k.y ?? p?.y ?? 540, z: k.z ?? p?.z ?? 1, e: k.e ?? 'out'}); });
  if (f <= full[0].at) return {x: full[0].x, y: full[0].y, z: full[0].z};
  for (let i = 0; i < full.length - 1; i++) {
    const a = full[i], b = full[i + 1];
    if (f <= b.at) {
      const t = EZ[b.e](clamp((f - a.at) / Math.max(1, b.at - a.at)));
      // zoom nội suy theo log để tốc độ zoom nhìn đều mắt
      return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t)};
    }
  }
  const l = full[full.length - 1]; return {x: l.x, y: l.y, z: l.z};
};

/** đẩy nhanh vào từ khoá: z × (1 + amt) trong n khung, rồi giữ */
export const punch = (f: number, at: number, amt = 0.1, n = 7) => 1 + amt * EZ.snap(clamp((f - at) / n));

/** máy bám mục tiêu có độ trễ lò xo (giảm chấn tới hạn); tính tất định từ khung 0 nên render song song vẫn khớp */
export const follow = (f: number, target: (fr: number) => number, stiff = 0.03) => {
  let x = target(0), v = 0; const w = Math.sqrt(stiff);
  for (let i = 1; i <= f; i++) { const a = stiff * (target(i) - x) - 2 * w * v; v += a; x += v; }
  return x;
};

/** rung khi va chạm: tắt dần theo hàm mũ, tần số cao (không rung lắc kiểu cầm tay) */
export const impact = (f: number, at: number, amp = 10, n = 14): [number, number] => {
  const t = f - at; if (t < 0 || t > n) return [0, 0];
  const d = Math.exp(-t / (n / 4)); return [Math.sin(t * 2.9) * amp * d, Math.cos(t * 3.7) * amp * 0.6 * d];
};

export type Mood = 'reveal' | 'settle' | 'creep' | 'punch' | 'follow' | 'pushpull' | 'hold';
/** cảm xúc của từng câu (T01) → kiểu máy */
export const MOOD: Record<string, Mood> = {
  L01: 'reveal', L02: 'follow', L03: 'settle', L04: 'reveal', L05: 'punch', L06: 'punch', L07: 'punch', L08: 'creep',
  L09: 'pushpull', L10: 'settle', L11: 'follow', L12: 'settle', L13: 'pushpull', L14: 'creep', L15: 'settle', L16: 'punch',
  L17: 'settle', L18: 'reveal', L19: 'follow', L20: 'punch', L21: 'hold', L22: 'punch', L23: 'hold', L24: 'reveal',
};

type Frame = {x: number; y: number; z: number};
/** máy theo cảm xúc. `fr` = khung hình đích của shot; opt.at = các khung đẩy nhanh (mood 'punch');
    opt.from = điểm bắt đầu tuỳ chọn; opt.drift = trôi nhẹ cuối shot (mặc định 1.5% zoom) */
export const moodCam = (mood: Mood, f: number, dur: number, fr: Frame, opt: {at?: number[]; amt?: number; from?: Partial<Frame>; dx?: number; drift?: number} = {}): Cam => {
  const drift = opt.drift ?? 0.015, dx = opt.dx ?? 0;
  let c: Cam;
  switch (mood) {
    case 'reveal': { // bắt đầu chặt vào chi tiết rồi zoom ra mở cảnh, dừng êm
      const s = {x: opt.from?.x ?? fr.x, y: opt.from?.y ?? fr.y, z: opt.from?.z ?? fr.z * 1.25};
      c = path(f, [{at: 0, ...s}, {at: Math.round(dur * 0.7), ...fr, e: 'out'}, {at: dur, x: fr.x + dx, z: fr.z * (1 - drift * 0.5), e: 'lin'}]);
      break;
    }
    case 'settle': { // vào nhanh rồi dừng êm, sau đó trôi rất chậm
      const s = {x: opt.from?.x ?? fr.x - 40, y: opt.from?.y ?? fr.y, z: opt.from?.z ?? fr.z * 0.9};
      c = path(f, [{at: 0, ...s}, {at: Math.round(Math.min(dur * 0.4, 45)), ...fr, e: 'out'}, {at: dur, x: fr.x + dx, z: fr.z * (1 + drift), e: 'lin'}]);
      break;
    }
    case 'creep': // rình rập: chậm rồi nhanh dần
      c = path(f, [{at: 0, ...fr, ...opt.from}, {at: dur, x: fr.x + dx, y: fr.y, z: fr.z * 1.1, e: 'in'}]);
      break;
    case 'pushpull': { // đẩy vào chi tiết rồi kéo ra
      const m = Math.round(dur * 0.45);
      c = path(f, [{at: 0, ...fr, ...opt.from}, {at: m, x: fr.x + dx * 0.5, y: fr.y, z: fr.z * 1.18, e: 'out'}, {at: dur, x: fr.x + dx, z: fr.z * 0.98, e: 'inout'}]);
      break;
    }
    case 'punch': { // trôi chậm + đẩy nhanh vào các từ khoá
      const b = path(f, [{at: 0, ...fr, ...opt.from}, {at: dur, x: fr.x + dx, z: fr.z * (1 + drift), e: 'lin'}]);
      const k = (opt.at ?? []).reduce((m, a) => m * punch(f, a, opt.amt ?? 0.1), 1);
      c = {...b, z: b.z * k};
      break;
    }
    case 'follow': // x do shot tự bám (dùng follow()); ở đây chỉ đẩy nhẹ
      c = path(f, [{at: 0, ...fr, ...opt.from}, {at: dur, x: fr.x + dx, z: fr.z * (1 + drift * 2), e: 'lin'}]);
      break;
    default:
      c = path(f, [{at: 0, ...fr}, {at: dur, z: fr.z * (1 + drift), e: 'lin'}]);
  }
  return c;
};
