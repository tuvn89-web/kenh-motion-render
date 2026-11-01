"""Đo CHỖ CHẠM ĐẤT THẬT của từng ảnh tư thế: đáy thân người, bỏ vật mảnh (giáo, kiếm, cán cờ) vì chúng hay thò thấp hơn thân.
Cách đo (chỉ ảnh nằm / ngồi, rộng > 1,8 lần cao): bỏ các mảnh rời dài-mảnh (giáo, kiếm vẽ tách khỏi thân) rồi lấy dòng thấp nhất còn lại.
→ src/puppet/contact.json {tên: phần chiều cao từ đáy ảnh lên tới đáy thân}. Puppet hạ ảnh xuống đúng lượng đó để THÂN chạm đất.
T01 (29/10): nhân vật nằm sấp ở 1:38 — cây giáo nằm dưới thân chạm dốc nên tưởng là đã sát đất, thân thật cách đất ~5% chiều cao.
Dùng: python tools/cham_dat.py [--soat]  (--soat: xuất out/soat_cham_dat.jpg — vạch đỏ = đáy ảnh, vạch xanh = đáy thân)"""
import os, sys, json, numpy as np, cv2
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cut = os.path.join(ROOT, 'public', 'cut'); out = {}
rows = []
for f in sorted(os.listdir(cut)):
    if not (f.startswith(('SPR_', 'OBJ_MUD', 'ANI_')) and f.endswith('.png')): continue
    n = f[:-4]; a = np.asarray(Image.open(os.path.join(cut, f)).convert('RGBA'))[..., 3]
    H = a.shape[0]; m = (a > 128).astype(np.uint8)
    W = a.shape[1]
    if W / H < 1.8: out[n] = 0; continue          # dáng đứng / đi: bàn chân dày, đã soát bằng mắt là chạm đất → không chỉnh
    # dáng nằm: cây giáo / kiếm vẽ RỜI nằm dưới thân → mảnh dài mảnh (rộng > 8 lần cao) tách riêng → bỏ khỏi phép đo
    nl, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    body = m.copy()
    for i in range(1, nl):
        w_, h_ = st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]
        if w_ > 8 * h_ and h_ < 0.12 * H: body[lab == i] = 0
    ys = np.where(body.any(1))[0]; yb = ys.max() if len(ys) else H - 1
    ya = np.where(m.any(1))[0].max()
    c = round((ya - yb) / H, 4)
    out[n] = c if c > 0.004 else 0
    if '--soat' in sys.argv and out[n] > 0: rows.append((n, a, ya, yb))
json.dump(out, open(os.path.join(ROOT, 'src', 'puppet', 'contact.json'), 'w'), indent=1)
print('ảnh có vật mảnh thò dưới thân:', {k: v for k, v in out.items() if v})
if rows:
    tiles = []
    for n, a, ya, yb in rows:
        H, W = a.shape; y0 = max(0, int(yb - H * 0.25))
        im = Image.fromarray(np.dstack([np.full_like(a, 235)] * 3)); al = Image.fromarray(a)
        src = Image.open(os.path.join(cut, n + '.png')).convert('RGBA'); bg = Image.new('RGBA', src.size, (235, 235, 225, 255)); bg.alpha_composite(src)
        t = bg.convert('RGB').crop((0, y0, W, H)); d = ImageDraw.Draw(t)
        d.line([(0, ya - y0), (W, ya - y0)], fill=(220, 0, 0), width=4); d.line([(0, yb - y0), (W, yb - y0)], fill=(0, 90, 220), width=4); d.text((6, 6), n, fill='black')
        t = t.resize((700, max(1, int(700 * t.size[1] / W)))); tiles.append(t)
    S = Image.new('RGB', (700, sum(t.size[1] + 6 for t in tiles)), 'white'); y = 0
    for t in tiles: S.paste(t, (0, y)); y += t.size[1] + 6
    S.save(os.path.join(ROOT, 'out', 'soat_cham_dat.jpg'), quality=85); print('tờ soát: out/soat_cham_dat.jpg')
