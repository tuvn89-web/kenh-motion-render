"""GIÓ LAY CỎ (H2, 29/10/2026): bản đồ uốn cho cỏ / lau sậy VẼ SẴN trong lớp ảnh nền — cỏ lay theo gió ngay trên ảnh gốc.
Dùng: python tools/gio_co.py      → src/scenes/sway.json (2 bản đồ data URI mỗi lớp), tờ soát out/soat_gio.jpg
Cách làm:
  - Chỉ dịch NGANG, độ lệch tăng theo chiều cao tính từ gốc cỏ: nét đứng (lá cỏ, cây lau) uốn cong; nền phẳng / nét ngang
    (mặt đường, mép nước) dịch ngang thì gần như không thấy → không cần tách từng ngọn cỏ.
  - 'rect' = dải vẽ tay (x0, x1, đỉnh ngọn, gốc) cho cỏ mọc trong lòng ảnh; 'edge' = ngọn cỏ chìa lên trên mép đất,
    gốc = mép trên của khối đặc (sau khi bỏ nét mảnh) theo từng cột.
  - Sóng gió chạy ngang: dx = amp·w·sin(kx − ωt). Lưu A = w·sin(kx), B = w·cos(kx); Stage ghép 2 lần feDisplacementMap
    với scale ∝ cos(ωt) và −sin(ωt) → sóng trôi mượt mà bản đồ đứng yên.
"""
import os, io, json, base64
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUT = os.path.join(ROOT, 'public', 'cut')
# lớp → (biên độ ở ngọn, px ảnh gốc 2752 rộng), các dải
SPEC = {
    # 31/10: Cậu Cả bỏ cỏ / lau lay gió (H2). Dải cũ để tham khảo — chỉ còn mặt nước lăn tăn:
    # 'LYR_FOGROAD_GROUND': (9, [('edge', 0.55, 80), ('rect', 0.0, 1.0, 0.765, 0.925)]),
    # 'DRV_TUSCANY_ROAD':   (10, [('rect', 0.0, 1.0, 0.74, 1.0)]),
    # 'LYR_LAKEDAWN_FORE':  (12, [('rect', 0.0, 1.0, 0.55, 0.94)]),
    # 'LYR_POVHILL_FORE':   (8, [('edge', 0.60, 110)]),
    # 'LYR_HILLTOP_GROUND': (9, [('rect', 0.0, 0.30, 0.55, 1.0)]),
    # N4 (31/10) tán cây lay gió — Cậu Cả bỏ cùng ngày (không đẹp). Dải cũ để tham khảo:
    # 'DRV_FOGROAD_HILLS': (5, [('rect', 0.0, 0.17, 0.33, 0.50), ('rect', 0.27, 0.33, 0.36, 0.52), ('rect', 0.69, 0.84, 0.43, 0.57), ('rect', 0.81, 0.90, 0.24, 0.52)]),
    # 'DRV_TUSCANY_HILLS': (6, [('rect', 0.0, 0.40, 0.10, 0.64), ('rect', 0.66, 1.0, 0.26, 0.69)]),
    # N4 mặt hồ lăn tăn — Cậu Cả bỏ 31/10. Dải cũ (sóng chạy dọc theo từng hàng) để tham khảo:
    # 'DRV_LAKEDAWN_LAKE':  (3, [('rect', 0.0, 1.0, 0.60, 1.02)], {'axis': 'y', 'wave': 0.03, 'per': 46, 'up': False}),
    # 'DRV_WIDEROAD_BOT':   (3, [('rect', 0.02, 1.0, 0.78, 1.02)], {'axis': 'y', 'wave': 0.03, 'per': 46, 'up': False}),
}
WAVE = 0.4   # bước sóng gió = 0,4 bề ngang ảnh
SC = 4

def weight(name, bands, up=True):
    a = np.asarray(Image.open(os.path.join(CUT, name + '.png')))[..., 3] > 128
    H, W = a.shape; yy = np.arange(H, dtype=np.float32)[:, None]; xx = np.arange(W, dtype=np.float32)[None, :]
    w = np.zeros((H, W), np.float32)
    for b in bands:
        if b[0] == 'rect':
            _, x0, x1, t, r = b; X0, X1, T, R = x0 * W, x1 * W, t * H, r * H; fx = 0.04 * W; fy = 0.03 * H
            lft = np.clip((xx - (X0 - fx)) / fx, 0, 1) if x0 > 0 else np.ones_like(xx)
            rgt = np.clip(((X1 + fx) - xx) / fx, 0, 1) if x1 < 1 else np.ones_like(xx)
            wx = np.minimum(lft, rgt)
            wy = (np.clip((R - yy) / (R - T), 0, 1) ** 1.2 if up else np.clip((R - yy) / fy, 0, 1)) * np.clip((yy - (T - fy)) / fy, 0, 1)
            w = np.maximum(w, wx * wy)
        else:
            _, y0, L = b; Y0 = int(y0 * H)
            op = cv2.morphologyEx(a.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))) > 0
            op[:Y0] = False
            has = op.any(0); root = np.where(has, op.argmax(0), H).astype(np.float32)
            root = cv2.blur(cv2.medianBlur(root.reshape(1, -1).astype(np.float32), 5).reshape(1, -1), (61, 1)).ravel()
            d = root[None, :] - yy
            wy = np.clip(d / L, 0, 1) * np.clip((2.0 * L - d) / (0.4 * L), 0, 1) * np.clip((yy - (Y0 - 0.04 * H)) / (0.04 * H), 0, 1)
            w = np.maximum(w, wy)
    return cv2.GaussianBlur(w, (0, 0), 10), a

def uri(arr):
    small = cv2.resize(arr, (arr.shape[1] // SC, arr.shape[0] // SC), interpolation=cv2.INTER_AREA)
    buf = io.BytesIO(); Image.fromarray(np.clip(small * 255 + 0.5, 0, 255).astype(np.uint8)).save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

def main():
    out, tiles = {}, []
    for name, spec in SPEC.items():
        amp, bands, opt = (spec + ({},))[:3]
        w, a = weight(name, bands, opt.get('up', True)); H, W = w.shape
        if opt.get('axis') == 'y':   # sóng chạy dọc (mặt nước): pha theo hàng
            k = 2 * np.pi / (opt.get('wave', WAVE) * H); ph = k * np.arange(H, dtype=np.float32)[:, None] + np.zeros((1, W), np.float32)
        else:
            k = 2 * np.pi / (opt.get('wave', WAVE) * W); ph = k * np.arange(W, dtype=np.float32)[None, :]
        A = np.stack([0.5 + 0.5 * w * np.sin(ph), np.full_like(w, 0.5), np.full_like(w, 0.5)], -1)
        B = np.stack([0.5 + 0.5 * w * np.cos(ph), np.full_like(w, 0.5), np.full_like(w, 0.5)], -1)
        out[name] = {'amp': amp / W, 'a': uri(A), 'b': uri(B), **({'per': opt['per']} if 'per' in opt else {})}
        im = Image.open(os.path.join(CUT, name + '.png')).convert('RGBA'); bg = Image.new('RGBA', im.size, (230, 230, 230, 255)); bg.alpha_composite(im)
        ov = np.zeros((H, W, 4), np.uint8); ov[..., 0] = 255; ov[..., 3] = (w * 140).astype(np.uint8); bg.alpha_composite(Image.fromarray(ov))
        t = bg.convert('RGB').resize((688, 384)); tiles.append(t)
    json.dump(out, open(os.path.join(ROOT, 'src', 'scenes', 'sway.json'), 'w'), indent=0)
    if not tiles: print('0 lớp có bản đồ gió (đã tắt hết) → src/scenes/sway.json = {}'); return
    S = Image.new('RGB', (688 * 2, 394 * ((len(tiles) + 1) // 2)), 'white')
    for i, t in enumerate(tiles): S.paste(t, ((i % 2) * 688, (i // 2) * 394))
    S.save(os.path.join(ROOT, 'out', 'soat_gio.jpg'), quality=85)
    print(len(out), 'lớp có bản đồ gió → src/scenes/sway.json, tờ soát out/soat_gio.jpg')

if __name__ == '__main__': main()
