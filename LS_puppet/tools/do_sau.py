"""N2 — NỀN 2.5D THEO ĐỘ SÂU (31/10/2026): mỗi lớp nền không còn là "tấm bìa" phẳng — trong cùng một lớp, chỗ gần trôi nhanh hơn
chỗ xa khi máy lia / zoom (đồi xa – cây gần – mép đường gần ống kính tách nhau).
Nguồn: bản đồ độ sâu Depth Anything V2 Small (máy GitHub, cloud/ai/chay.py) của ảnh KEY — các lớp LYR/DRV cùng khung với KEY.
Dùng: python tools/do_sau.py <thư mục *.depth.png>  → src/scenes/depth.json (2 bản đồ data URI mỗi lớp) + tờ soát out/soat_do_sau.jpg

Toán (Stage, lớp ở độ sâu d0, máy (cx, cy, z)): điểm có độ sâu D lệch so với khi coi như ở d0 một đoạn
   Δ = (D − d0)·[ −(c − tâm) + (z − 1)·(w − tâm) ] / (1 + (z − 1)·d0)          (w = toạ độ điểm trong khung thế giới)
→ tách thành 3 lần feDisplacementMap: lia ngang (bản đồ T kênh R), lia dọc (T kênh G), zoom (bản đồ Z: R = (D−d0)(u−½), G = (D−d0)(v−½)).
Độ sâu tương đối của mô hình (trắng = gần) → D = d0 + κ·(da − mốc), mốc = trung vị của lớp; LỚP MẶT ĐẤT (d0 = 1) lấy mốc ở ĐƯỜNG CHÂN
nhân vật để chân người không trượt trên đất. |D − d0| ≤ RMAX (giữ biên độ nhỏ: viền vật gần chỉ giãn vài px, không rách).
Vùng gần được NỞ RA (dilate) trước khi làm mềm → vật gần mang theo cả viền của nó, không bị cắt cụt khi trượt qua nền xa.
"""
import os, re, io, sys, json, base64
import numpy as np, cv2
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUT = os.path.join(ROOT, 'public', 'cut')
RMAX = 0.12      # lệch độ sâu tối đa so với độ sâu của lớp
SPAN = 0.10      # khoảng 5–95% độ sâu trong lớp → ±SPAN
SC = 6           # bản đồ lưu ở 1/6 độ phân giải (mượt sẵn)

def locs():
    src = open(os.path.join(ROOT, 'src', 'scenes', 'loc.ts'), encoding='utf-8').read()
    out = {}
    for m in re.finditer(r'^\s+([A-Z]+): \{planes: \[(.*?)\], chars: (\d+), ground: ([^,]+),', src, re.M):
        loc, planes, g = m.group(1), m.group(2), m.group(4).split('/*')[0].strip()
        ps = [(n, float(d)) for n, d in re.findall(r"name: '([A-Z_]+)', depth: ([0-9.]+)", planes)]
        gm = re.match(r'V\(([0-9.]+)\)', g); gy = -135 + 1350 * float(gm.group(1)) if gm else float(g)
        out[loc] = (ps, gy)
    return out

def uri(rgb):
    small = cv2.resize(rgb, (rgb.shape[1] // SC, rgb.shape[0] // SC), interpolation=cv2.INTER_AREA)
    buf = io.BytesIO(); Image.fromarray(np.clip(small * 255 + 0.5, 0, 255).astype(np.uint8)).save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

def main():
    ddir = sys.argv[1]; out, tiles = {}, []
    for loc, (planes, gy) in locs().items():
        p = os.path.join(ddir, f'KEY_{loc}.depth.png')
        if not os.path.exists(p): print('! thiếu độ sâu', loc); continue
        da = np.asarray(Image.open(p)).astype(np.float32) / 65535; H, W = da.shape
        for name, d0 in planes:
            if d0 <= 0.1: continue   # trời: đã trôi theo gió
            a = np.asarray(Image.open(os.path.join(CUT, name + '.png')).convert('RGBA').resize((W, H)))[..., 3] > 128
            if a.sum() < 0.02 * a.size: continue
            v = (gy + 135) / 1350
            if d0 == 1:   # mặt đất nhân vật đứng: mốc ở đường chân
                band = np.zeros_like(a); band[int((v - 0.012) * H):int((v + 0.012) * H)] = True
                ref = float(np.median(da[band & a])) if (band & a).sum() > 50 else float(np.median(da[a]))
            else: ref = float(np.median(da[a]))
            lo, hi = np.percentile(da[a], 5), np.percentile(da[a], 95)
            k = min(1.0, 2 * SPAN / max(1e-3, hi - lo))
            dd = np.clip(k * (da - ref), -RMAX, RMAX)
            # lấp vùng trong suốt bằng giá trị gần nhất, nở vùng gần, làm mềm
            if (~a).any():
                idx = cv2.distanceTransformWithLabels((~a).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)[1]
                ys, xs = np.where(a); lab = np.zeros(idx.max() + 1, np.float32)
                src_lab = idx[a]; lab[src_lab] = dd[a]; dd = np.where(a, dd, lab[idx])
            near = cv2.dilate(dd, np.ones((25, 25), np.uint8))
            dd = cv2.GaussianBlur(np.maximum(dd, 0.6 * near + 0.4 * dd), (0, 0), 9)
            u = (np.arange(W, dtype=np.float32)[None, :] + 0.5) / W - 0.5; vv = (np.arange(H, dtype=np.float32)[:, None] + 0.5) / H - 0.5
            T = np.stack([0.5 + dd / (2 * RMAX), 0.5 + dd / (2 * RMAX), np.full_like(dd, 0.5)], -1)
            Z = np.stack([0.5 + dd * u / RMAX, 0.5 + dd * vv * (1350 / 2400) / RMAX, np.full_like(dd, 0.5)], -1)
            out[name] = {'r': RMAX, 't': uri(T), 'z': uri(Z)}
            im = Image.open(os.path.join(CUT, name + '.png')).convert('RGBA').resize((W // 4, H // 4)); bg = Image.new('RGBA', im.size, (235, 235, 235, 255)); bg.alpha_composite(im)
            col = cv2.applyColorMap(np.clip((dd / (2 * RMAX) + 0.5) * 255, 0, 255).astype(np.uint8), cv2.COLORMAP_TWILIGHT_SHIFTED)[..., ::-1]
            col = cv2.resize(col, (W // 4, H // 4))
            tiles.append((name, d0, bg.convert('RGB'), Image.fromarray(col)))
            print(f'{name:22s} d0={d0:.2f} mốc={ref:.2f} κ={k:.2f} lệch {dd.min():+.3f}…{dd.max():+.3f}')
    json.dump(out, open(os.path.join(ROOT, 'src', 'scenes', 'depth.json'), 'w'))
    S = Image.new('RGB', (2 * 688 + 10, 395 * len(tiles)), 'white')
    for i, (n, d0, a, b) in enumerate(tiles):
        S.paste(a, (0, i * 395)); S.paste(b, (698, i * 395))
    S.thumbnail((1400, 99999)); S.save(os.path.join(ROOT, 'out', 'soat_do_sau.jpg'), quality=80)
    print(len(out), 'lớp → src/scenes/depth.json', os.path.getsize(os.path.join(ROOT, 'src', 'scenes', 'depth.json')) // 1024, 'KB')

if __name__ == '__main__': main()
