import {cutSrc} from '../puppet/assets';
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {LOC} from './loc';
import {FogField, FogWisps} from '../env/Env';
import {LIGHT, LightCtx, NOLIGHT, Light} from './light';
import {CamCtx} from '../lib/cue';
import {WIND, hasSway, SwayLayer, SkyFog, GroundMist, CloudShadows} from './ambient';
import COLOR from './color.json';
import CC from './charcolor.json';
import {hasDepth, DepthWrap} from './depth';

export type Cam = {x: number; y: number; z: number; r?: number};
/** một nhóm đi theo máy với độ sâu `depth` (0 = đứng yên như trời, 1 = mặt đất, >1 = tiền cảnh) */
export const Depth: React.FC<{depth: number; cam: Cam; children?: React.ReactNode; style?: React.CSSProperties}> = ({depth, cam, children, style}) => {
  const z = 1 + (cam.z - 1) * depth; const tx = -(cam.x - 960) * depth, ty = -(cam.y - 540) * depth;
  return <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '960px 540px', transform: `translate(${tx}px,${ty}px) scale(${z}) rotate(${cam.r ?? 0}deg)`, ...style}}>{children}</div>;
};
export const LayerImg: React.FC<{name: string; style?: React.CSSProperties}> = ({name, style}) => (
  <Img src={staticFile(cutSrc(name))} style={{position: 'absolute', left: -240, top: -135, width: 2400, height: 1350, objectFit: 'cover', ...style}} />
);
/** dựng một bối cảnh: các lớp ảnh + sương code + nhân vật (children) chen đúng chỗ + phủ trước (front) */
/** đổi toạ độ thế giới (ở độ sâu depth) ra toạ độ màn hình theo máy — để nhãn/bong bóng bám đúng vật khi máy chuyển động */
export const toScreen = (cam: Cam, wx: number, wy: number, depth = 1): [number, number] => {
  const z = 1 + (cam.z - 1) * depth;
  return [960 + (wx - 960 - (cam.x - 960) * depth) * z, 540 + (wy - 540 - (cam.y - 540) * depth) * z];
};
/** Ins = hiệu ứng chèn sau lớp ảnh số `after`, đi theo máy với độ sâu `depth` (vd gợn nước trên mặt hồ, mặt trời sau rặng đồi) */
export type Ins = {after: number; depth: number; node: React.ReactNode};
/* SƯƠNG & KHÔNG KHÍ (29/10, sau góp ý "sương phủ cả video như giảm chất lượng"):
   - lớp cảnh càng xa càng nhạt, bớt tương phản, bớt màu (phối cảnh không khí) → chiều sâu thật, tiền cảnh + nhân vật giữ nét đậm
   - dải sương code mặc định chỉ nằm SAU lưng nhân vật (độ sâu < 1); cảnh cần sương trước mặt dùng `fogFront` (sương mặt đất nhìn từ cao)
     hoặc `wisps` (dải sương mỏng trôi ngang qua, cảnh hành quân / trận đánh)
   - có sương hay không là do LỜI KỂ từng cảnh quyết định (fogMul = 0 ở cảnh "hôm trước", thị trấn) */
/* N3/N4/N8/N9 (31/10) — cấu hình hậu cảnh theo bối cảnh:
   SKYFOG: sương tầng trên trời + quầng mặt trời mờ (trời xám phẳng → có chiều sâu); MIST: sương sát đất che nhẹ chân người (cảnh sương);
   SHADOWS: bóng mây lướt trên đồi (cảnh nắng); COLOR (tools/can_mau.py): kéo màu lớp nền về tông chung của nhóm giờ trong ngày */
const SKYFOG: Record<string, {y0: number; y1: number; op: number; sun?: [number, number, number, number]}> = {
  FOGROAD: {y0: 40, y1: 300, op: 0.3, sun: [1450, 150, 48, 0.32]},
  LAKEDAWN: {y0: 80, y1: 330, op: 0.14},
  SHORE: {y0: 40, y1: 320, op: 0.2},
};
const MIST: Record<string, number> = {FOGROAD: 0.14, SHORE: 0.12, DEFILE: 0.1, SLOPE: 0.1, MUD: 0.12};
const SHADOWS: Record<string, {after: number; depth: number; yTop: number; op: number}> = {
  TUSCANY: {after: 1, depth: 0.6, yTop: 420, op: 0.15},
  HILLTOWN: {after: 1, depth: 1, yTop: 470, op: 0.12},
};
const CSSCOL = COLOR as Record<string, string>;
const CHARCOL = CC as unknown as Record<string, {sat: number; gain: [number, number, number]; amb?: [number, number, number]}>;   // màu nhân vật theo nền (tools/mau_nhan_vat.py)
export const Stage: React.FC<{loc: string; cam: Cam; f: number; children?: React.ReactNode; front?: React.ReactNode; swap?: Record<string, string>; fogMul?: number; extraBehind?: React.ReactNode; ins?: Ins[]; air?: number; fogFront?: number; wisps?: number; light?: Partial<Light>; focus?: number; dof?: number}> = ({loc, cam, f, children, front, swap = {}, fogMul = 1, extraBehind, ins = [], air = 1, fogFront = 0, wisps = 0, light, focus = 1, dof = 1}) => {
  const L = LOC[loc];
  const items: React.ReactNode[] = [];
  const fogs = L.fog.filter((fg) => fg.depth < 1 || fogFront > 0).map((fg) => ({...fg, op: fg.op * fogMul * (fg.depth >= 1 ? fogFront : 1)})).filter((fg) => fg.op > 0.01);
  L.planes.forEach((p, i) => {
    const d = p.depth, a = air * Math.max(0, 0.8 - d) / 0.8;   // 0 ở mặt đất, tới 1 ở bầu trời
    const airF = a > 0.02 ? `saturate(${(1 - 0.32 * a).toFixed(3)}) contrast(${(1 - 0.24 * a).toFixed(3)}) brightness(${(1 + 0.07 * a).toFixed(3)})` : '';
    // B3 — độ sâu trường ảnh: máy càng gần (z lớn) thì lớp càng xa mặt phẳng nét (`focus`, mặc định = nhân vật) càng mờ
    const bl = dof * Math.max(0, cam.z - 1.3) * 4.5 * Math.abs(d - focus) * (d > focus ? 0.7 : 1);
    const filt = ((CSSCOL[loc] ?? '') + ' ' + airF + (bl > 0.3 ? ` blur(${bl.toFixed(2)}px)` : '')).trim();
    // H2 — trời trôi theo gió; cỏ vẽ sẵn trong lớp nền lay theo gió (ambient.tsx)
    const nm = swap[p.name] ?? p.name; const drift = d <= 0.1 ? (WIND[loc] ?? 0.1) * f : 0;
    items.push(<Depth key={'p' + i} depth={p.depth} cam={cam} style={filt ? {filter: filt} : undefined}>
      {hasDepth(nm)   // N2 — lớp cong theo độ sâu từng điểm khi máy chạy (depth.tsx)
        ? <DepthWrap name={nm} d0={p.depth} cam={cam}>{hasSway(nm) ? <SwayLayer name={nm} f={f} style={{left: 0, top: 0}} /> : <LayerImg name={nm} style={{left: 0, top: 0}} />}</DepthWrap>
        : hasSway(nm) ? <SwayLayer name={nm} f={f} /> : <LayerImg name={nm} style={drift ? {transform: `translateX(${drift.toFixed(2)}px)`} : undefined} />}
    </Depth>);
    fogs.filter((fg) => fg.depth > p.depth && fg.depth <= (L.planes[i + 1]?.depth ?? 99)).forEach((fg, k) => items.push(<Depth key={`f${i}_${k}`} depth={fg.depth} cam={cam}><FogField f={f} y={fg.y} rows={2} op={fg.op} seed={11 + i * 7 + k} drift={0.3} h={fg.h ?? 400} /></Depth>));
    if (i === 0 && SKYFOG[loc] && p.depth <= 0.1 && fogMul > 0) { const k = SKYFOG[loc]; items.push(<Depth key="skf" depth={0.08} cam={cam}><SkyFog f={f} y0={k.y0} y1={k.y1} op={k.op * Math.min(1, fogMul)} sun={k.sun} seed={L.ground} /></Depth>); }
    if (i === 0 && extraBehind) items.push(<Depth key="xb" depth={0.2} cam={cam}>{extraBehind}</Depth>);
    if (SHADOWS[loc] && SHADOWS[loc].after === i) { const k = SHADOWS[loc]; items.push(<Depth key="csh" depth={k.depth} cam={cam}><CloudShadows f={f} yTop={k.yTop} op={k.op} seed={L.ground} /></Depth>); }
    ins.filter((x) => x.after === i).forEach((x, k) => items.push(<Depth key={`in${i}_${k}`} depth={x.depth} cam={cam}>{x.node}</Depth>));
    if (i === L.chars) {
      items.push(<Depth key="chars" depth={1} cam={cam}>{children}</Depth>);
      if (wisps > 0) items.push(<Depth key="wisps" depth={1.1} cam={cam}><FogWisps f={f} y={L.ground - 120} op={wisps} seed={L.ground} /></Depth>);
      if (MIST[loc] && fogMul > 0) items.push(<Depth key="mist" depth={1.02} cam={cam}><GroundMist f={f} y={L.ground + 14} op={MIST[loc] * Math.min(1, fogMul)} seed={L.ground + 3} /></Depth>);
    }
  });
  const lt: Light = {...(LIGHT[loc] ?? NOLIGHT), grade: CHARCOL[loc], ...light};
  return <CamCtx.Provider value={cam}><LightCtx.Provider value={lt}><AbsoluteFill style={{overflow: 'hidden'}}>{items}{front}</AbsoluteFill></LightCtx.Provider></CamCtx.Provider>;
};
