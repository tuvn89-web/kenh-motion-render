"""VÙNG ĐẦU + BẢN ĐỒ XOAY ĐẦU (G4, 29/10/2026): cho con rối gật / nghiêng đầu NGAY TRÊN ẢNH GỐC (không tách mảnh, không đường nối).
Dùng: python tools/vung_dau.py            → src/puppet/headmap.json (bản đồ nhúng data URI), tờ soát out/soat_dau.jpg
Cách làm (mỗi ảnh tư thế đứng, khung dọc):
  1. Bỏ các nét mảnh (cán giáo, dây) bằng phép mở hình thái → còn khối thân.
  2. Cổ = hàng hẹp nhất của khối thân trong dải 36–60% chiều cao tính từ đỉnh (đầu chibi to, lông mũ ở trên).
  3. Vùng đầu = phần khối thân phía trên cổ, CHỈ khối nối với tâm đầu (bỏ mép khiên, tay xa), nới nhẹ + làm mềm mép.
  4. Bản đồ dịch chuyển cho phép xoay quanh điểm cổ: d = m·((y−cy), −(x−cx))/H, mã hoá R,G = 0,5 + d/(2A).
     Puppet dùng feDisplacementMap với scale = θ(rad)·2A·H (đơn vị px của khung ảnh) → đầu xoay θ, cổ uốn mềm, thân đứng yên.
"""
import os, io, json, glob, base64
import numpy as np, cv2
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUT = os.path.join(ROOT, 'public', 'cut')
SKIP_RE = ('PRONE', 'LYING', 'FALL', 'TROT', 'CHASE', 'HORSE', 'REAR', 'SWORD', 'HSHOCK', 'SITUP', 'PULL', 'RUN', 'TINYWALK')
NECK = {'HAST': 0.47, 'LEGA': 0.47, 'LEGB': 0.47, 'LEGC': 0.47, 'LEGD': 0.47, 'LEGE': 0.47, 'LEGF': 0.47, 'FLAM': 0.45, 'HANN': 0.45, 'SIGN': 0.51}
PAD = 0.12   # đệm mỗi phía, theo chiều cao ảnh
SC = 4   # bản đồ nhỏ hơn ảnh 4 lần (trường dịch chuyển trơn, feImage tự phóng)

def head_map(name):
    a0 = np.asarray(Image.open(os.path.join(CUT, name + '.png')))[..., 3] > 128
    H, W = a0.shape
    if W / H > 1.15: return None
    # đệm trong suốt quanh ảnh: đầu xoay chìa ra ngoài khung ảnh gốc vẫn có bản đồ (không bị cắt thẳng ở mép)
    P = int(PAD * H); a = np.pad(a0, P); H, W = a.shape
    H0 = H - 2 * P; k = max(5, int(H0 * 0.02))
    op = cv2.morphologyEx(a.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))) > 0
    rows = np.where(op.any(1))[0]
    if not len(rows): return None
    top = rows[0]
    # cổ: tỉ lệ đo tay theo từng nhân vật (đầu chibi), rồi tinh chỉnh ±3% về hàng hẹp nhất của KHÚC chứa tâm thân
    g = NECK.get(name.split('_')[1][:4], 0.47)
    y70 = P + int(0.7 * H0)
    bx = int(np.median(np.where(op[y70])[0])) if op[y70].any() else W // 2
    def run(y, x):
        r = op[y]
        if not r[min(W - 1, max(0, x))]: return 10 ** 6
        l = x
        while l > 0 and r[l - 1]: l -= 1
        rr = x
        while rr < W - 1 and r[rr + 1]: rr += 1
        return rr - l + 1
    ys = list(range(P + int((g - 0.03) * H0), P + int((g + 0.03) * H0)))
    ny = min(ys, key=lambda y: run(y, bx))
    xs = np.where(op[ny])[0]; cx = float(bx)
    # khối nối với tâm đầu (0,17H phía trên cổ)
    region = op.copy(); region[ny + int(0.03 * H0):] = False
    n, lab = cv2.connectedComponents(region.astype(np.uint8), 8)
    hy = max(top, ny - int(0.17 * H0)); hxs = np.where(region[hy])[0]
    if not len(hxs): return None
    cxh = hxs[np.argmin(np.abs(hxs - cx))]
    m = (lab == lab[hy, cxh]).astype(np.float32)
    # chỉ trong bề ngang mũ/đầu (hàng rộng nhất của khối đầu, bỏ giáo/tay chìa ra xa)
    hb = np.where(m.any(1))[0]; wrow = max(hb, key=lambda y: (np.where(m[y])[0][-1] - np.where(m[y])[0][0]) if m[y].any() else 0)
    hx = np.where(m[wrow])[0]; xx0, xx1 = hx[0], hx[-1]
    xr = np.arange(W, dtype=np.float32); f = 0.03 * H0
    m *= np.clip(np.minimum(xr - (xx0 - f), (xx1 + f) - xr) / f, 0, 1)[None, :]
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(0.02 * H0) | 1,) * 2))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    m *= np.clip((ny + 0.035 * H0 - yy) / (0.07 * H0), 0, 1)          # cổ: chuyển mềm từ đầu (xoay) sang thân (đứng yên)
    m = cv2.GaussianBlur(m, (0, 0), 0.015 * H0)
    dx, dy = m * (yy - ny) / H0, -m * (xx - cx) / H0
    A = float(max(np.abs(dx).max(), np.abs(dy).max(), 1e-3))
    rgb = np.stack([0.5 + dx / (2 * A), 0.5 + dy / (2 * A), np.full_like(dx, 0.5)], -1)
    small = cv2.resize(rgb, (max(8, W // SC), max(8, H // SC)), interpolation=cv2.INTER_AREA)
    buf = io.BytesIO(); Image.fromarray(np.clip(small * 255 + 0.5, 0, 255).astype(np.uint8)).save(buf, 'PNG', optimize=True)
    uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()   # nhúng thẳng vào code: không nén WebP mất dữ liệu, không chờ tải
    return {'A': round(A, 4), 'pad': PAD, 'cx': round((cx - P) / (W - 2 * P), 4), 'cy': round((ny - P) / H0, 4), 'uri': uri}, m[P:-P, P:-P], (cx - P, ny - P)

def main():
    out, tiles = {}, []
    for p in sorted(glob.glob(os.path.join(CUT, 'SPR_*.png'))):
        n = os.path.basename(p)[:-4]
        if any(s in n for s in SKIP_RE): continue
        r = head_map(n)
        if not r: continue
        info, m, (cx, ny) = r; out[n] = info
        im = Image.open(p).convert('RGBA'); bg = Image.new('RGBA', im.size, (205, 215, 205, 255)); bg.alpha_composite(im)
        ov = np.zeros((im.height, im.width, 4), np.uint8); ov[..., 0] = 255; ov[..., 3] = (m * 110).astype(np.uint8)
        bg.alpha_composite(Image.fromarray(ov)); d = ImageDraw.Draw(bg); r0 = im.height * 0.012
        d.ellipse([cx - r0, ny - r0, cx + r0, ny + r0], fill=(0, 0, 255, 255))
        t = bg.convert('RGB'); t.thumbnail((240, 260)); tiles.append((n, t))
    json.dump(out, open(os.path.join(ROOT, 'src', 'puppet', 'headmap.json'), 'w'), indent=0)
    cols = 10; S = Image.new('RGB', (240 * cols, 280 * ((len(tiles) + cols - 1) // cols)), 'white'); d = ImageDraw.Draw(S)
    for i, (n, t) in enumerate(tiles):
        x, y = (i % cols) * 240, (i // cols) * 280; S.paste(t, (x, y + 18)); d.text((x + 2, y + 2), n.replace('SPR_', ''), fill='black')
    os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True); S.save(os.path.join(ROOT, 'out', 'soat_dau.jpg'), quality=85)
    print(len(out), 'ảnh có bản đồ xoay đầu → src/puppet/headmap.json, tờ soát out/soat_dau.jpg')

if __name__ == '__main__': main()
