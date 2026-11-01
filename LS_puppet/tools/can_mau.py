"""N8 — ĐỒNG MÀU GIỮA CÁC NỀN (31/10/2026): mỗi nền Flow vẽ một tông hơi khác → cắt cảnh nhảy màu.
Đo ảnh KEY (độ sáng L, độ ấm b, bão hoà) rồi kéo NỬA ĐƯỜNG về trung vị của nhóm cùng giờ trong ngày (chỉ chỉnh lớp nền, không chỉnh nhân vật).
Nhóm: 'sang_suong' = sáng sớm có sương (đoạn hành quân, trận đánh, trại lính sáng hôm ấy), 'ngay' = cảnh nắng (hôm trước, thị trấn của Livy).
Dùng: python tools/can_mau.py → src/scenes/color.json {bối cảnh: chuỗi CSS filter}
      python tools/can_mau.py --giu-cu → giữ nguyên các nền đã có trong color.json (đã duyệt trên bản render), chỉ tính nền MỚI
      theo trung vị của các nền cũ — thêm nền giữa chừng không làm đổi màu những cảnh đã xem."""
import sys
import os, json, glob
import numpy as np, cv2
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GROUP = {'FOGROAD': 'sang_suong', 'WIDEROAD': 'sang_suong', 'LAKEDAWN': 'sang_suong', 'HILLTOP': 'sang_suong', 'POVHILL': 'sang_suong',
         'ROMANCAMP': 'sang_suong', 'SHORE': 'sang_suong', 'DEFILE': 'sang_suong', 'SLOPE': 'sang_suong', 'MUD': 'sang_suong',
         'TUSCANY': 'ngay', 'HILLTOWN': 'ngay'}
def stats(p):
    im = np.asarray(Image.open(p).convert('RGB').resize((688, 384)))
    lab = cv2.cvtColor(im, cv2.COLOR_RGB2LAB).astype(np.float32); hsv = cv2.cvtColor(im, cv2.COLOR_RGB2HSV)
    return {'L': float(lab[..., 0].mean() * 100 / 255), 'b': float(lab[..., 2].mean() - 128), 'sat': float(hsv[..., 1].mean())}
S = {os.path.basename(p)[4:-4]: stats(p) for p in glob.glob(os.path.join(ROOT, 'public', 'cut', 'KEY_*.png'))}
S = {k: v for k, v in S.items() if GROUP.get(k) == 'sang_suong'}   # cảnh nắng (hôm trước, thị trấn) giữ tông riêng có chủ đích
CJ = os.path.join(ROOT, 'src', 'scenes', 'color.json')
keep = json.load(open(CJ)) if '--giu-cu' in sys.argv and os.path.exists(CJ) else {}
out = dict(keep)
for loc, s in sorted(S.items()):
    if loc in keep: continue
    grp = [S[k] for k in S if GROUP[k] == GROUP[loc] and (not keep or k in keep)]
    tL, tb, ts = (float(np.median([g[x] for g in grp])) for x in ('L', 'b', 'sat'))
    sat = float(np.clip((ts / max(1, s['sat'])) ** 0.5, 0.82, 1.12))
    bri = float(np.clip((tL / s['L']) ** 0.25, 0.95, 1.06))
    warm = float(np.clip((tb - s['b']) / 40, 0, 0.05))          # nền lạnh hơn nhóm: sepia nhẹ cho ấm lên (nền ấm hơn: chỉ bớt bão hoà)
    css = f"saturate({sat:.3f}) brightness({bri:.3f})" + (f" sepia({warm:.3f})" if warm > 0.01 else "")
    out[loc] = css
    print(f"{loc:10s} L {s['L']:5.1f}→{tL:5.1f}  b {s['b']:+5.1f}→{tb:+5.1f}  sat {s['sat']:5.1f}→{ts:5.1f}  ⇒ {css}")
json.dump(out, open(CJ, 'w'), indent=1)
