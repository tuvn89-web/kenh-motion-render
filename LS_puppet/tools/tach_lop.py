"""Tạo lớp phái sinh (DRV_*) từ ảnh đã tách nền trong public/cut theo tools/lop_plan.json.
Mỗi mục: src (tên ảnh), keep_v [v0,v1] / keep_u [u0,u1] (tỉ lệ 0..1, mép mềm), inpaint [[u0,v0,u1,v1],...] (vá vùng AI vẽ thừa),
fill_below {v, rgb} (tô kín phần dưới dòng v bằng màu cho khỏi lộ lỗ),
fill_under {src, v0, grow} (H2: xoá phần lớp TRƯỚC — vd lau sậy tiền cảnh — còn vẽ dính trong lớp này, lấp theo hàng ngang từ hai bên;
cỏ tiền cảnh lay theo gió thì không lộ bóng ma đứng yên phía sau). Dùng: python tools/tach_lop.py [tên…]"""
import os, json, numpy as np, cv2
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUT = os.path.join(ROOT, 'public', 'cut')
plan = json.load(open(os.path.join(ROOT, 'tools', 'lop_plan.json'), encoding='utf-8'))
def ramp(n, a, b, fe):
    x = np.arange(n) / n
    lo = np.clip((x - a) / fe + 0.5, 0, 1) if a > 0 else np.ones(n)
    hi = np.clip((b - x) / fe + 0.5, 0, 1) if b < 1 else np.ones(n)
    return lo * hi
import sys
ONLY = set(sys.argv[1:])
def fill_rows(a, m):
    """lấp các đoạn bị che (m) trên từng hàng bằng nội suy tuyến tính giữa điểm không che hai bên"""
    xs = np.arange(a.shape[1])
    for y in np.where(m.any(1))[0]:
        mm = m[y]
        if mm.all(): continue
        for c in range(a.shape[2]): a[y, mm, c] = np.interp(xs[mm], xs[~mm], a[y, ~mm, c])
for name, p in plan.items():
    if ONLY and name not in ONLY: continue
    src = os.path.join(CUT, p['src'] + '.png')
    if not os.path.exists(src): print('- thiếu', p['src']); continue
    a = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32); h, w = a.shape[:2]
    if 'fill_below' in p:
        v = p['fill_below']['v']; col = np.array(p['fill_below']['rgb'], np.float32); y = int(v * h)
        under = a[y:, :, 3:4] / 255.0
        a[y:, :, :3] = a[y:, :, :3] * under + col * (1 - under); a[y:, :, 3] = 255
    for (u0, v0, u1, v1) in p.get('inpaint', []):
        m = np.zeros((h, w), np.uint8); m[int(v0 * h):int(v1 * h), int(u0 * w):int(u1 * w)] = 255
        rgb = cv2.inpaint(a[..., :3].astype(np.uint8), m, 9, cv2.INPAINT_TELEA); a[..., :3] = rgb; a[..., 3] = np.maximum(a[..., 3], m)
    if 'fill_under' in p:
        fu = p['fill_under']; fa = np.asarray(Image.open(os.path.join(CUT, fu['src'] + '.png')))[..., 3] > 128
        g = max(3, int(fu.get('grow', 0.008) * w)) | 1
        fm = cv2.dilate(fa.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (g, g))) > 0
        fm[:int(fu['v0'] * h)] = False
        fill_rows(a, fm)
        a[..., :3] = np.where(fm[..., None], cv2.GaussianBlur(a[..., :3], (0, 0), 2), a[..., :3])
    if 'extend_below' in p:                                    # kéo dài hàng ở dòng v xuống đáy (nối tiếp mặt nước / mặt đất)
        y = int(p['extend_below'] * h); row = a[y - 3:y, :, :].mean(0)
        k = np.linspace(0, 1, h - y)[:, None, None]
        a[y:] = row[None] * (1 - 0.12 * k); a[y:, :, 3] = 255
        a[y - 12:y + 12, :, :3] = cv2.GaussianBlur(a[y - 12:y + 12, :, :3], (1, 15), 0)
    fe = p.get('feather', 0.012)
    if 'keep_v' in p: a[..., 3] *= ramp(h, p['keep_v'][0], p['keep_v'][1], fe)[:, None]
    if 'keep_u' in p: a[..., 3] *= ramp(w, p['keep_u'][0], p['keep_u'][1], fe)[None, :]
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(CUT, 'DRV_' + name + '.png'))
    print('ok DRV_' + name)
