/* ÁNH SÁNG THEO BỐI CẢNH (B2, 29/10): nhân vật "ăn" vào cảnh thay vì như sticker dán lên.
   sun: phía mặt trời trên màn hình (1 phải, -1 trái, 0 = sáng tán xạ trong sương)
   tint/tintK: màu ánh sáng chung phủ lên nhân vật (soft-light)      rim/rimK: viền sáng ở mép quay về phía mặt trời
   cast: độ đậm bóng đổ dài theo hướng nắng (0 = chỉ bóng tròn dưới chân)   haze: người nhỏ (ở xa) nhạt dần theo không khí */
import React from 'react';
/* N9 (31/10) wrapK — quầng không khí quanh nhân vật: ĐÃ BỎ cùng ngày (viền sáng ngoài nét → như ảnh dán, Cậu Cả thấy "lớp màu mờ").
   tint/tintK (soft-light) cũng thôi dùng cho nhân vật: thay bằng `grade` (charcolor.json — bớt bão hoà + cân trắng theo nền). */
export type Light = {sun: number; tint: string; tintK: number; rim: string; rimK: number; cast: number; haze: number; wrapK?: number; grade?: {sat: number; gain: [number, number, number]; amb?: [number, number, number]}};
export const NOLIGHT: Light = {sun: 0, tint: '#ffffff', tintK: 0, rim: '#ffffff', rimK: 0, cast: 0, haze: 0};
export const LIGHT: Record<string, Light> = {
  LAKEDAWN: {sun: 1, tint: '#ffcf9e', tintK: 0.18, rim: '#ffe2b8', rimK: 0.5, cast: 0, haze: 0.5},
  FOGROAD: {sun: 0, tint: '#b8c6cc', tintK: 0.16, rim: '#ffffff', rimK: 0, cast: 0, haze: 0.85},
  WIDEROAD: {sun: 0, tint: '#c2ccc8', tintK: 0.12, rim: '#ffffff', rimK: 0, cast: 0, haze: 0.7},
  HILLTOP: {sun: 1, tint: '#fff0d0', tintK: 0.12, rim: '#fff4d6', rimK: 0.65, cast: 0.2, haze: 0},
  TUSCANY: {sun: 1, tint: '#ffb766', tintK: 0.22, rim: '#ffd38a', rimK: 0.75, cast: 0.24, haze: 0.25},
  ROMANCAMP: {sun: -1, tint: '#f4d9c8', tintK: 0.12, rim: '#ffe6cf', rimK: 0.45, cast: 0.16, haze: 0.2},
  POVHILL: {sun: 1, tint: '#fff3d8', tintK: 0.1, rim: '#fff6dd', rimK: 0.55, cast: 0, haze: 0},
  SHORE: {sun: 0, tint: '#bcc6c6', tintK: 0.16, rim: '#ffffff', rimK: 0, cast: 0, haze: 0.85},
  DEFILE: {sun: 0, tint: '#c4cac4', tintK: 0.14, rim: '#ffffff', rimK: 0, cast: 0, haze: 0.8},
  SLOPE: {sun: 0, tint: '#bcc6c2', tintK: 0.14, rim: '#ffffff', rimK: 0, cast: 0, haze: 0.8},
  MUD: {sun: 0, tint: '#c8c6be', tintK: 0.16, rim: '#ffffff', rimK: 0, cast: 0, haze: 0.85},
  HILLTOWN: NOLIGHT,
};
export const LightCtx = React.createContext<Light>(NOLIGHT);
