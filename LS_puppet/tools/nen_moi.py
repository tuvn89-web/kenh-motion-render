"""N1 + N6 (31/10/2026) — nhập đợt E (nền mới) và đợt F (vật tiền cảnh).
Dùng: python tools/nen_moi.py <thư mục ảnh (anh_EF)>  → public/cut/*.png + tờ soát out/soat_nen_moi.jpg

Nền mới KHÔNG nhờ Flow tách lớp: có ảnh gốc KEY_<NƠI> và ảnh "nền sạch" CLN_<NƠI> (Flow xoá vật tiền cảnh) cùng khung
→ vật = chỗ KEY khác CLN (làm mờ 2 px, lệch > 30, đóng lỗ, lấp kín bên trong, mép mềm), lấy màu từ KEY;
   chia theo hàng: vật phía trên dòng `mid` = lớp GIỮA (sau lưng nhân vật), phía dưới = lớp TIỀN CẢNH (trước mặt nhân vật).
   Lọc mảnh: tiền cảnh phải chạm gần đáy khung (≥ 85 %); lớp giữa bỏ mảnh < 0,4 % khung và mảnh lơ lửng (đáy trên dòng `midb`, mặc định 0,6 —
   mảnh sương/đá mờ KEY ≠ CLN trên sườn đồi: tách ra thành hình chữ H rách nét); `xmin` bỏ vật lệch trái (CLN xoá dở).
→ nền phía sau = KEY, chỉ vá bằng CLN ĐÚNG dưới chỗ vật đã tách (mép mềm 2 px, KHÔNG nở: nở ra thì vòng quanh vật là CLN, chỗ mặt nạ cắt
   ngang vật mờ trong sương lộ đường cắt cứng ngay cả khi máy đứng yên) → giữ nguyên nét ảnh gốc, CLN chỉ lấp lỗ;
   cắt ngang ở dòng `hv` (mép mềm): phần trên = lớp XA, phần dưới = lớp ĐẤT (nhân vật đứng).
→ trời: ảnh SKY_<NƠI>; lớp xa trong suốt ở chỗ giống trời (chỉ trên dòng `skyv`) để trời phía sau trôi theo gió.
Vật tiền cảnh FG_*: khoá nền xanh theo khoảng cách tới màu nền (lá cây xanh vẫn giữ màu), chỉ khử ám xanh ở dải mép;
   giữ NGUYÊN khung 16:9 (vị trí vật trên khung là bố cục đã chọn)."""
import os, sys, glob
import numpy as np, cv2
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUT = os.path.join(ROOT, 'public', 'cut')
# hv: dòng chia xa/đất (None = một lớp đất); mid: vật trên dòng này là lớp giữa (0 = mọi vật là tiền cảnh, 1 = mọi vật là lớp giữa)
# sky: tách trời theo SKY_ (chỉ trên dòng skyv); xmin: chỉ giữ vật có tâm bên phải tỉ lệ này
# shift: kéo cả ảnh lên (tỉ lệ khung), đáy bù bằng ảnh soi gương — các mốc hv/mid tính SAU khi kéo; obj False: không tách vật (nền = KEY)
SPEC = {
    'SHORE':  {'hv': 0.655, 'mid': 0.715, 'sky': True, 'skyv': 0.45},
    'DEFILE': {'hv': None, 'mid': 0.0, 'sky': False, 'xmin': 0.5},
    'SLOPE':  {'hv': 0.785, 'mid': 1.0, 'sky': False, 'shift': 0.07, 'obj': False},   # đường đất ở v 0,86–0,92 lọt ngoài khung (khung thấy v ≤ 0,9) → kéo ảnh lên 7 %
    # obj False: KHÔNG tách cây/đá thành lớp giữa — cây nửa chìm trong sương: mặt nạ cắt ngang thân cây mờ, máy zoom thì lớp giữa và lớp xa lệch nhau
    # → ngọn cây gãy khúc, mảnh lơ lửng (thử 31/10, S19 shot giáo bay z 1,5). Cây thuộc lớp xa, chỉ tách xa / đất.
    'MUD':    {'hv': 0.53, 'mid': 0.0, 'sky': False},
}

def load(d, name):
    f = sorted(glob.glob(os.path.join(d, name + '-*.jpg')) + glob.glob(os.path.join(d, name + '.jpg')) + glob.glob(os.path.join(d, name + '-*.png')))
    return np.asarray(Image.open(f[-1]).convert('RGB')).astype(np.float32) if f else None

def save(name, rgb, a):
    out = np.concatenate([np.clip(rgb, 0, 255), np.clip(a, 0, 1)[..., None] * 255], -1).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(os.path.join(CUT, name + '.png')); return name

def obj_mask(K, C):
    d = np.abs(cv2.GaussianBlur(K, (0, 0), 2) - cv2.GaussianBlur(C, (0, 0), 2)).max(2)
    m = (d > 30).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)   # lấp kín lỗ bên trong vật (tảng đá giống màu sườn đồi)
    full = np.zeros_like(m); cv2.drawContours(full, cs, -1, 1, -1)
    return cv2.dilate(full, np.ones((5, 5), np.uint8))

def pick(mb, keep):
    """giữ các mảnh của mặt nạ nhị phân mb thoả keep(stats) → mặt nạ mềm."""
    n, lab, st, cen = cv2.connectedComponentsWithStats(mb, 8)
    out = np.zeros(mb.shape, np.uint8)
    for i in range(1, n):
        if keep(st[i], cen[i]): out[lab == i] = 1
    return out

def ramp_rows(H, W, v, fe=0.012, below=True):
    y = (np.arange(H, dtype=np.float32)[:, None] + 0.5) / H
    r = np.clip((y - v) / fe + 0.5, 0, 1) if below else np.clip((v - y) / fe + 0.5, 0, 1)
    return np.repeat(r, W, 1)

def key_fg(rgb):
    bgpx = rgb[(rgb[..., 1] > 180) & (rgb[..., 0] < 100) & (rgb[..., 2] < 100)]
    bg = np.median(bgpx, 0) if len(bgpx) > 1000 else np.array([0, 255, 0], np.float32)
    dist = np.sqrt(((rgb - bg) ** 2).sum(2))
    al = np.clip((dist - 60) / 80, 0, 1)
    solid = pick((al > 0.5).astype(np.uint8), lambda s, c: s[cv2.CC_STAT_AREA] > 400)
    al = al * cv2.dilate(solid, np.ones((5, 5), np.uint8))
    edge = cv2.dilate((al < 0.98).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0     # dải mép: khử ám xanh, bên trong giữ nguyên màu
    out = rgb.copy(); g = out[..., 1]; lim = np.maximum(out[..., 0], out[..., 2])
    out[..., 1] = np.where(edge & (g > lim), lim, g)
    return out, al

def main():
    d = sys.argv[1]; made = []
    for loc, p in SPEC.items():
        K, C = load(d, 'KEY_' + loc), load(d, 'CLN_' + loc)
        if K is None or C is None: print('! thiếu KEY/CLN', loc); continue
        if p.get('shift'):
            k = int(round(p['shift'] * C.shape[0])); up = lambda X: np.concatenate([X[k:], X[-1:-k - 1:-1]], 0)
            K, C = up(K), up(C)
        H, W = C.shape[:2]
        mb = obj_mask(K, C) if p.get('obj', True) else np.zeros((H, W), np.uint8); xmin = p.get('xmin', 0) * W
        upper = (ramp_rows(H, W, p['mid'], 0.001, below=False) > 0.5).astype(np.uint8)
        mid_b = pick(mb * upper, lambda s, c: s[cv2.CC_STAT_AREA] > 0.004 * H * W and c[0] >= xmin and s[cv2.CC_STAT_TOP] + s[cv2.CC_STAT_HEIGHT] >= p.get('midb', 0.6) * H) if p['mid'] > 0 else np.zeros_like(mb)
        fore_b = pick(mb * (1 - upper), lambda s, c: s[cv2.CC_STAT_TOP] + s[cv2.CC_STAT_HEIGHT] >= 0.85 * H and s[cv2.CC_STAT_AREA] > 1500 and c[0] >= xmin) if p['mid'] < 1 else np.zeros_like(mb)
        soft = lambda b: cv2.GaussianBlur(b.astype(np.float32), (0, 0), 1.5)
        kept = np.maximum(mid_b, fore_b)
        w = cv2.GaussianBlur(kept.astype(np.float32), (0, 0), 2)[..., None]   # vá ĐÚNG dưới vật (không nở): đứng yên thì mép vật ghép K lên K, không lộ đường cắt
        B = K * (1 - w) + C * w                                            # nền: ảnh gốc, chỉ vá bằng CLN dưới vật đã tách
        made.append(save('KEY_' + loc, K, np.ones((H, W))))
        sky_t = np.zeros((H, W), np.float32)
        S = load(d, 'SKY_' + loc) if p['sky'] else None
        if S is not None:
            made.append(save('SKY_' + loc, S, np.ones((H, W))))
            ds = np.abs(cv2.GaussianBlur(B, (0, 0), 4) - cv2.GaussianBlur(S, (0, 0), 4)).max(2)
            sk = ((ds < 14) & (ramp_rows(H, W, p['skyv'], 0.05, below=False) > 0.5)).astype(np.uint8)
            sk = cv2.morphologyEx(sk, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
            sky_t = cv2.GaussianBlur(sk.astype(np.float32), (0, 0), 6) * ramp_rows(H, W, p['skyv'], 0.08, below=False)
        if p['hv'] is None: made.append(save(f'DRV_{loc}_GND', B, 1 - sky_t))
        else:
            made.append(save(f'DRV_{loc}_FAR', B, (1 - sky_t) * ramp_rows(H, W, p['hv'] + 0.01, 0.02, below=False)))
            made.append(save(f'DRV_{loc}_GND', B, ramp_rows(H, W, p['hv'] - 0.01, 0.02, below=True)))
        if mid_b.any(): made.append(save(f'DRV_{loc}_MID', K, soft(mid_b)))
        if fore_b.any(): made.append(save(f'DRV_{loc}_FORE', K, soft(fore_b)))
    for f in sorted(glob.glob(os.path.join(d, 'FG_*.jpg'))):
        name = os.path.basename(f).split('-')[0].split('.')[0]
        rgb, al = key_fg(np.asarray(Image.open(f).convert('RGB')).astype(np.float32))
        made.append(save(name, rgb, al))
    # tờ soát: mỗi ảnh trên nền hồng sẫm
    tiles = []
    for n in made:
        im = Image.open(os.path.join(CUT, n + '.png')).convert('RGBA'); im.thumbnail((440, 248))
        bg = Image.new('RGBA', im.size, (255, 0, 255, 255)); bg.alpha_composite(im); tiles.append((n, bg.convert('RGB')))
    cols = 4; Sht = Image.new('RGB', (cols * 450, 262 * ((len(tiles) + cols - 1) // cols)), 'white'); dr = ImageDraw.Draw(Sht)
    for i, (n, t) in enumerate(tiles):
        x, y = (i % cols) * 450, (i // cols) * 262; Sht.paste(t, (x, y + 12)); dr.text((x + 2, y), n, fill='black')
    Sht.save(os.path.join(ROOT, 'out', 'soat_nen_moi.jpg'), quality=85)
    print(len(made), 'ảnh →', ', '.join(made))

if __name__ == '__main__': main()
