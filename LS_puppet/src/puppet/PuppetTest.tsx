import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Puppet, Plane} from './Puppet';
import {mix} from '../lib/util';
import {Finish, Tag} from '../ui/Overlay';
import {useFonts} from '../ui/Fonts';

/** Cảnh thử bộ con rối: 6 lớp ảnh (bầu trời, hậu cảnh xa, hậu cảnh gần, ảnh nền, nhân vật, tiền cảnh) */
const Group: React.FC<{depth: number; cam: {x: number; y: number; z: number}; children: React.ReactNode}> = ({depth, cam, children}) => {
  const z = 1 + (cam.z - 1) * depth; const tx = -(cam.x - 960) * depth, ty = -(cam.y - 540) * depth;
  return <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '960px 540px', transform: `translate(${tx}px,${ty}px) scale(${z})`}}>{children}</div>;
};
const ROMAN = {stand: 'sprites/roman_stand.png', look: 'sprites/roman_look.png', walk: {src: 'sprites/roman_walk.png', k: 954 / 964}, run: {src: 'sprites/roman_run.png', k: 918 / 964}};

export const PuppetTest: React.FC = () => {
  useFonts();
  const f = useCurrentFrame();
  const cam = {x: mix(f, [[0, 940], [420, 1010]]), y: 540, z: mix(f, [[0, 1.0], [420, 1.07]])};
  return (
    <AbsoluteFill style={{background: '#cfd5cf', overflow: 'hidden'}}>
      <Plane src="layers/sky.png" depth={0.05} cam={cam} />
      <Plane src="layers/far.png" depth={0.3} cam={cam} />
      <Plane src="layers/near.png" depth={0.6} cam={cam} />
      <Plane src="layers/ground.png" depth={1} cam={cam} />
      <Group depth={1} cam={cam}>
        <Puppet poses={{stand: 'sprites/horse_rider.png', rear: {src: 'sprites/horse_rear.png', k: 926 / 933}}} beats={[{at: 0, mode: 'idle'}, {at: 330, pose: 'rear', mode: 'still'}, {at: 372, pose: 'stand', mode: 'idle'}]} f={f} x={1560} y={955} h={440} seed={5} breath={0.008} />
        <Puppet poses={ROMAN} beats={[{at: 0, mode: 'idle', pose: 'stand'}]} f={f} x={760} y={945} h={330} seed={1} />
        <Puppet poses={ROMAN} beats={[{at: 0, mode: 'idle', pose: 'look'}, {at: 300, face: -1}]} f={f} x={1060} y={955} h={340} seed={2} />
        <Puppet poses={ROMAN} beats={[{at: 0, mode: 'still', pose: 'walk'}, {at: 30, mode: 'walk', to: 430}, {at: 236, pose: 'stand', mode: 'idle'}]} f={f} x={-200} y={965} h={345} seed={3} />
        <Puppet poses={ROMAN} beats={[{at: 0, mode: 'still', pose: 'run'}, {at: 225, mode: 'run', to: -400}]} f={f} x={2300} y={1000} h={360} seed={4} face={-1} speed={2.1} />
      </Group>
      <Plane src="layers/fore.png" depth={1.4} cam={cam} />
      <Tag x={80} y={110} text="Thở: co giãn dọc, neo ở bàn chân" at={6} out={110} size={30} anchor="l" />
      <Tag x={80} y={110} text="Đi: nảy theo bước + lắc ±2,5°" at={120} out={222} size={30} anchor="l" />
      <Tag x={80} y={110} text="Chạy: nảy 7 khung/lần + chúi người" at={228} out={296} size={30} anchor="l" />
      <Tag x={80} y={110} text="Quay mặt: lật ngang trong 6 khung" at={300} out={326} size={30} anchor="l" />
      <Tag x={80} y={110} text="Đổi tư thế: thay ảnh + nén nhẹ" at={330} out={410} size={30} anchor="l" />
      <Finish />
    </AbsoluteFill>
  );
};
