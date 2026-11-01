"""31/10/2026 — MÀU NHÂN VẬT THEO NỀN: nhân vật Flow vẽ rất rực (bão hoà ~145) trong khi nền sương chỉ 17–60 → người như dán lên cảnh.
Đo ảnh KEY từng bối cảnh → src/scenes/charcolor.json {bối cảnh: {sat, gain: [R, G, B]}}, Puppet áp bằng feColorMatrix (giữ đen là đen):
  - sat: bớt bão hoà theo độ rực của nền — sat = 0,55 + 0,45·√(bão hoà nền / bão hoà nền nắng), kẹp 0,74–1 (nền nắng TUSCANY = 1).
  - gain: cân trắng theo màu ánh sáng của nền (trung bình 15 % điểm sáng nhất, chia kênh lớn nhất) — kéo 50 %;
          nền tối (rừng, hẻm: độ sáng TB < 150) hạ nhẹ độ sáng nhân vật (^0,25, ≥ 0,92). Nhân kênh nên nét mực vẫn đen.
  - amb: màu ám của nền (trung bình chia độ sáng, kẹp 0,85–1,15) — phần màu bị bớt đi khi giảm bão hoà ngả về màu này thay vì xám trơn
          (sườn rừng ngả lục, bình minh ngả ấm) → nhân vật như đứng trong cùng một thứ ánh sáng với nền.
Thay cho lớp ám soft-light cũ (light.ts tintK): soft-light màu sáng nâng nét mực đen lên → nhìn như phủ một lớp màng mờ.
Dùng: python tools/mau_nhan_vat.py   (sau khi có KEY_<nơi>.png trong public/cut)"""
import os, glob, json
import numpy as np, cv2
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUNNY = 'TUSCANY'
def stats(p):
    im = np.asarray(Image.open(p).convert('RGB').resize((688, 384))).astype(np.float32).reshape(-1, 3)
    sat = cv2.cvtColor(im.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2HSV)[:, 0, 1].mean()
    lum = im @ [0.299, 0.587, 0.114]
    hi = im[lum > np.percentile(lum, 85)].mean(0); mean = im.mean(0)
    return sat, hi, mean, lum.mean()
S = {os.path.basename(p)[4:-4]: stats(p) for p in glob.glob(os.path.join(ROOT, 'public', 'cut', 'KEY_*.png'))}
ref = S[SUNNY][0]
out = {}
for loc, (sat, hi, mean, lum) in sorted(S.items()):
    s = float(np.clip(0.55 + 0.45 * np.sqrt(sat / ref), 0.74, 1.0))
    wb = 1 - 0.5 * (1 - hi / hi.max())                        # cân trắng theo ánh sáng nền
    g = wb / wb.max() * float(np.clip((lum / 150) ** 0.25, 0.92, 1.0))
    amb = np.clip(mean / lum, 0.85, 1.15)
    out[loc] = {'sat': round(s, 3), 'gain': [round(float(x), 3) for x in g], 'amb': [round(float(x), 3) for x in amb]}
    print(f"{loc:10s} nền bão hoà {sat:5.1f} → sat {s:.3f}  gain {out[loc]['gain']}  amb {out[loc]['amb']}")
json.dump(out, open(os.path.join(ROOT, 'src', 'scenes', 'charcolor.json'), 'w'), indent=1)
