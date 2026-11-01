/* N6 (31/10/2026) — VẬT TIỀN CẢNH SÁT ỐNG KÍNH: ảnh FG_* (nền xanh, tools/nen_moi.py khoá) giữ nguyên khung 16:9 = bố cục đã vẽ
   (cành ở góc trên, đá góc dưới…). Gắn vào KHUNG HÌNH chứ không vào thế giới: máy đứng yên thì vật đứng yên đúng chỗ đã vẽ;
   máy lia thì vật trôi NHANH hơn cảnh (k = phần trôi thêm so với lớp nhân vật), máy đẩy vào thì vật phóng to nhanh hơn → cảm giác sát ống kính.
   Mờ + tối + bớt màu để làm khung, không giành mắt với nhân vật. `base` = máy lúc bắt đầu cảnh (mốc vị trí vẽ). */
import React from 'react';
import {Img, staticFile} from 'remotion';
import {cutSrc, has} from '../puppet/assets';
import type {Cam} from './Stage';

export const Fore: React.FC<{name: string; cam: Cam; base: Cam; k?: number; blur?: number; dim?: number; x?: number; y?: number; s?: number; flip?: boolean; op?: number}> = ({name, cam, base, k = 0.4, blur = 4, dim = 0.72, x = 0, y = 0, s = 1, flip = false, op = 1}) => {
  if (!has(name)) return null;
  const sc = s * Math.pow(cam.z / base.z, 1 + k);
  const tx = -(cam.x - base.x) * cam.z * (1 + k), ty = -(cam.y - base.y) * cam.z * (1 + k);
  return <Img src={staticFile(cutSrc(name))} style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '960px 540px', opacity: op,
    transform: `translate(${(x + tx).toFixed(1)}px,${(y + ty).toFixed(1)}px) scale(${sc.toFixed(4)})${flip ? ' scaleX(-1)' : ''}`,
    filter: `blur(${blur}px) brightness(${dim}) saturate(0.85)`}} />;
};
