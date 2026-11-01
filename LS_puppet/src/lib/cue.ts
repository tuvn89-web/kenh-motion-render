/* BẢNG ĐIỂM ÂM THANH (D2, 29/10): khi render với inputProps {cues: true} (không xuất hình), mỗi sự kiện có tiếng
   — bước chân, vó ngựa, đổi tư thế, quay người, va chạm, giáo bay, bụi, đất bắn, lửa, nhãn, bong bóng — in ra một dòng
   "CUE {…}" kèm khung TUYỆT ĐỐI, vị trí trên màn hình (để định vị trái/phải) và cỡ (gần/xa). tools/cues.mjs gom lại → build/cues.json */
import React, {useContext} from 'react';
import {getInputProps, useCurrentFrame} from 'remotion';
export const ShotCtx = React.createContext<{id: string; t0: number}>({id: '', t0: 0});
export type CamLike = {x: number; y: number; z: number};
export const CamCtx = React.createContext<CamLike | null>(null);
const ON = !!(getInputProps() as {cues?: boolean}).cues;
export const cuesOn = ON;
/** toạ độ màn hình của điểm (x, y) ở độ sâu 1 theo máy hiện tại (không có máy → giữ nguyên) */
export const scr = (cam: CamLike | null, x: number, y: number): [number, number] => {
  if (!cam) return [x, y]; const z = cam.z; return [960 + (x - 960 - (cam.x - 960)) * z, 540 + (y - 540 - (cam.y - 540)) * z];
};
/** hook: trả hàm emit(type, x, y, extra) — chỉ in khi đang xuất bảng điểm */
export const useCue = () => {
  const s = useContext(ShotCtx); const cam = useContext(CamCtx); const lf = useCurrentFrame();
  return (type: string, x = 960, y = 540, extra: Record<string, unknown> = {}) => {
    if (!ON) return;
    const [sx, sy] = scr(cam, x, y);
    console.log('CUE ' + JSON.stringify({t: s.t0 + lf, shot: s.id, type, x: Math.round(sx), y: Math.round(sy), z: cam?.z ?? 1, ...extra}));
  };
};
