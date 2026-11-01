/* N2 — NỀN 2.5D THEO ĐỘ SÂU (31/10/2026). Bản đồ do tools/do_sau.py dựng từ độ sâu Depth Anything V2 Small (máy GitHub).
   Mỗi lớp nền cong theo độ sâu từng điểm khi máy lia / zoom: chỗ gần trôi nhanh hơn, chỗ xa trôi chậm hơn so với độ sâu chung của lớp.
   3 lần feDisplacementMap: lia ngang (bản đồ T kênh R), lia dọc (T kênh G), zoom (bản đồ Z) — scale tính mỗi khung từ máy.
   Máy ở vị trí gốc (960, 540, z = 1) thì ảnh y như cũ. */
import React, {useId} from 'react';
import DJ from './depth.json';
import type {Cam} from './Stage';

type DMap = {r: number; t: string; z: string};
const DEP = DJ as unknown as Record<string, DMap>;
/** 31/10: Cậu Cả bỏ — hàng rào trại (S14b, 1:27) bị phình cao, cọc nhân đôi khi máy zoom. Giữ code + bản đồ, tắt bằng DEPTH_ON. */
export const DEPTH_ON = false;
export const hasDepth = (name: string) => DEPTH_ON && name in DEP;
const LW = 2400, LH = 1350;
export const DepthWrap: React.FC<{name: string; d0: number; cam: Cam; children: React.ReactNode}> = ({name, d0, cam, children}) => {
  const id = 'dp' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const M = DEP[name]; const z0 = 1 + (cam.z - 1) * d0;
  const sx = 2 * M.r * (cam.x - 960) / z0, sy = 2 * M.r * (cam.y - 540) / z0, sz = -((cam.z - 1) / z0) * LW * M.r;
  const on = Math.abs(sx) + Math.abs(sy) + Math.abs(sz) > 0.3;
  return (
    <div style={{position: 'absolute', left: -240, top: -135, width: LW, height: LH, filter: on ? `url(#${id})` : undefined}}>
      {on && <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={id} filterUnits="userSpaceOnUse" x={-60} y={-60} width={LW + 120} height={LH + 120} colorInterpolationFilters="sRGB">
          <feImage href={M.t} x={0} y={0} width={LW} height={LH} preserveAspectRatio="none" result="t" />
          <feImage href={M.z} x={0} y={0} width={LW} height={LH} preserveAspectRatio="none" result="z" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale={sx} xChannelSelector="R" yChannelSelector="B" result="a" />
          <feDisplacementMap in="a" in2="t" scale={sy} xChannelSelector="B" yChannelSelector="G" result="b" />
          <feDisplacementMap in="b" in2="z" scale={sz} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>}
      {children}
    </div>
  );
};
