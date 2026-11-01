import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Puppet} from '../puppet/Puppet';
import {pose, cutSrc, has} from '../puppet/assets';
import {LightCtx, LIGHT} from './light';
import {clamp, easeInOut} from '../lib/util';

/* G3 — CẮT CẬN MẶT (duyệt 30/10, ảnh CU_* đợt D): chèn 0,3–2 s cận mặt vào đúng nhịp then chốt của lời kể.
   Nền = ảnh KEY_<bối cảnh> phóng to + mờ (cùng nơi, cùng ánh sáng với cảnh rộng); người = con rối bán thân CU_* (thở nhẹ,
   chớp mắt / mấp máy môi bằng miếng vá từ tools/va_mat.py), máy đẩy vào rất chậm quanh mắt; tuỳ chọn giật vào khi cắt (punch).
   Chưa có ảnh CU_* thì trả null → cảnh rộng hiện tiếp như cũ. */
/** vị trí ĐƯỜNG MẮT trên ảnh CU (tỉ lệ chiều cao, đo trên ảnh đã tách) → đặt mắt đúng dòng 1/3–1/2 khung */
export const CU_EYE: Record<string, number> = {CU_FLAM_SHOUT: 0.5, CU_HANN_SMIRK: 0.44, CU_HAST_HORN: 0.56, CU_FLAM_DREAD: 0.47};
/** 31/10: Cậu Cả bỏ cận mặt (sau lần render so tốc độ GitHub ↔ CircleCI). Giữ code, tắt bằng CU_ON — các cảnh tự về bản rộng như trước G3. */
export const CU_ON = false;
export const hasCU = (name: string) => CU_ON && has(name);
type P = {
  f: number; a: number; b: number; loc: string; name: string;
  /** x = tâm ảnh bán thân trên màn hình; h = chiều cao ảnh; eyeY = dòng mắt trên màn hình */
  x: number; h: number; eyeY?: number;
  /** điểm nhìn trên ảnh KEY (0..1) đặt vào giữa khung; bz = độ phóng nền */
  bg: [number, number]; bz?: number; blur?: number;
  talk?: [number, number][]; seed?: number;
  /** đẩy chậm suốt cú cận (tỉ lệ), giật vào lúc cắt (tỉ lệ, tắt dần ~3 khung), rung (px) */
  push?: number; punch?: number; shake?: number;
  /** vẽ thêm phía trên (bong bóng, nhãn…) — toạ độ màn hình, không đẩy theo máy */
  children?: React.ReactNode;
};
export const CloseUp: React.FC<P> = ({f, a, b, loc, name, x, h, eyeY = 470, bg, bz = 1.7, blur = 7, talk, seed = 1, push = 0.05, punch = 0, shake = 0, children}) => {
  if (!hasCU(name)) return null;
  const t = clamp((f - a) / Math.max(1, b - a)); const d = f - a;
  const eye = CU_EYE[name] ?? 0.5;
  const foot = eyeY + (1 - eye) * h;                        // đáy ảnh bán thân (luôn dưới mép khung)
  const pk = punch ? 1 + punch * Math.exp(-d / 3) : 1;
  const z = (1 + push * easeInOut(t)) * pk, zb = (1 + push * 0.45 * easeInOut(t)) * (punch ? 1 + punch * 0.5 * Math.exp(-d / 3) : 1);   // nền đẩy chậm hơn → có chiều sâu
  const sk = shake * Math.exp(-d / 5); const jx = Math.sin(d * 2.3) * sk, jy = Math.cos(d * 3.1) * sk * 0.7;
  // nền: ảnh KEY 2752×1536 phủ khung, điểm bg vào giữa, không lộ mép
  const S = (1920 / 2752) * bz, W = 2752 * S, H = 1536 * S;
  const left = Math.min(0, Math.max(1920 - W, 960 - bg[0] * W)), top = Math.min(0, Math.max(1080 - H, 540 - bg[1] * H));
  const org = `${x}px ${eyeY}px`;
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#cfd5cf'}}>
      <AbsoluteFill style={{transform: `translate(${jx * 0.5}px,${jy * 0.5}px) scale(${zb})`, transformOrigin: org}}>
        <Img src={staticFile(cutSrc('KEY_' + loc))} style={{position: 'absolute', left, top, width: W, height: H, filter: `blur(${blur}px) saturate(0.92)`}} />
      </AbsoluteFill>
      {/* không chớp mắt ngay lúc vừa cắt vào / sắp cắt ra (trông như giật hình) */}
      <AbsoluteFill style={{transform: `translate(${jx}px,${jy}px) scale(${z})`, transformOrigin: org}}>
        <LightCtx.Provider value={LIGHT[loc]}>
          <Puppet poses={{a: pose(name, name)}} f={f} x={x} y={foot} h={h} seed={seed} shadow={false} breath={0.005} talk={talk} blink={d >= 7 && f < b - 4} beats={[{at: 0, mode: 'idle', pose: 'a'}]} />
        </LightCtx.Provider>
      </AbsoluteFill>
      {children}
    </AbsoluteFill>
  );
};
