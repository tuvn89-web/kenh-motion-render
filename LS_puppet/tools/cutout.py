"""Tách nền ảnh Nano Banana -> PNG trong suốt.

Dùng:
  python tools/cutout.py in.jpg out.png            # nhân vật / đồ vật: tách nền + dọn mảnh vụn + cắt sát + căn chân giữa đáy
  python tools/cutout.py in.jpg out.png --layer    # lớp cảnh: chỉ tách vùng xanh, giữ nguyên khung
Nền xanh được nhận theo "độ xanh" (G trội hơn hẳn R và B), không phụ thuộc màu góc ảnh.
Với nhân vật: dải sương / mờ trắng dính mép ảnh và các mảnh ma nhỏ cũng bị bỏ.
"""
import sys, numpy as np, cv2
from PIL import Image

def greenness(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return g - np.maximum(r, b)

def key_green(a, layer=False):
    rgb = a[..., :3]
    gr = greenness(rgb)
    lo, hi = (16, 70) if layer else (28, 95)                    # lớp cảnh: khoá mạnh hơn để không còn quầng xanh quanh nắng/sương
    alpha = 1 - np.clip((gr - lo) / (hi - lo), 0, 1)           # 0 = nền xanh, 1 = giữ
    alpha = np.where(rgb[..., 1] < 90, 1.0, alpha)              # vùng tối không phải nền
    # khử ám xanh ở viền
    g = rgb[..., 1]
    if layer:   # lớp cảnh: khử xanh về giữa max(R,B) và trung bình R,B → quầng sương/nắng thành trắng-ấm thay vì vàng ô-liu
        lim = 0.6 * np.maximum(rgb[..., 0], rgb[..., 2]) + 0.4 * (rgb[..., 0] + rgb[..., 2]) / 2
        rgb[..., 1] = np.where(g > lim, lim, g)
    else:
        lim = np.maximum(rgb[..., 0], rgb[..., 2])
        rgb[..., 1] = np.where(g > lim, lim + (g - lim) * 0.12, g)
    a[..., :3] = rgb; a[..., 3] = np.minimum(a[..., 3], alpha * 255)
    return a

def clean_sprite(a, a0rgb, pick='largest'):
    """bỏ vùng sương/mờ sáng dính mép ảnh + mảnh vụn nhỏ; giữ khối nhân vật."""
    rgb = a[..., :3].astype(np.uint8); al = a[..., 3]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hazy = (hsv[..., 2] > 150) & (hsv[..., 1] < 70)              # sáng + nhạt màu = sương, nền trắng
    cand = ((al < 128) | hazy).astype(np.uint8)
    h, w = cand.shape; mask = np.zeros((h + 2, w + 2), np.uint8); bg = np.zeros_like(cand)
    for (x, y) in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)] + [(x, 0) for x in range(0, w, 64)] + [(x, h - 1) for x in range(0, w, 64)] + [(0, y) for y in range(0, h, 64)] + [(w - 1, y) for y in range(0, h, 64)]:
        if cand[y, x] and not bg[y, x]:
            m = np.zeros((h + 2, w + 2), np.uint8)
            cv2.floodFill(cand.copy(), m, (x, y), 2, flags=4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY)
            bg |= m[1:-1, 1:-1] > 0
    al = np.where(bg, 0, al)
    solid = (al > 128).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, 8)
    if n > 1:
        areas = st[1:, cv2.CC_STAT_AREA]; mi = 1 + int(areas.argmax()); big = areas.max()
        figs = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= big * 0.3]          # các "hình người" lớn (ảnh hay vẽ 2 bản)
        figs = sorted(figs, key=lambda i: st[i, cv2.CC_STAT_LEFT])                      # đánh số 1, 2, 3… từ trái sang phải
        if len(figs) > 1 and (pick in ('left', 'right') or str(pick).isdigit()):
            mi = figs[0] if pick == 'left' else figs[-1] if pick == 'right' else figs[min(int(pick), len(figs)) - 1]
            big = st[mi, cv2.CC_STAT_AREA]
        top = st[mi, cv2.CC_STAT_TOP]; mh = st[mi, cv2.CC_STAT_HEIGHT]; W = solid.shape[1]
        gr = greenness(a0rgb)
        dist = cv2.distanceTransform((lab != mi).astype(np.uint8), cv2.DIST_L2, 3)   # khoảng cách tới khối chính
        keep = np.zeros(n, bool)
        for i in range(1, n):
            if i == mi: keep[i] = True; continue
            area = st[i, cv2.CC_STAT_AREA]; cy = st[i, cv2.CC_STAT_TOP] + st[i, cv2.CC_STAT_HEIGHT] / 2
            m = lab == i
            floating = (cy < top + 0.25 * mh) and (dist[m].min() > 0.006 * W)      # lơ lửng phía trên, không chạm khối chính
            x0m, x1m = st[mi, cv2.CC_STAT_LEFT], st[mi, cv2.CC_STAT_LEFT] + st[mi, cv2.CC_STAT_WIDTH]
            x0, x1 = st[i, cv2.CC_STAT_LEFT], st[i, cv2.CC_STAT_LEFT] + st[i, cv2.CC_STAT_WIDTH]
            overlap = max(0, min(x1, x1m) - max(x0, x0m)) / max(1, min(x1 - x0, x1m - x0m))
            duplicate = area >= big * 0.3 and overlap < 0.2                          # bản vẽ thứ hai của cùng nhân vật
            ghost = (area < big * 0.005) or floating or duplicate or (gr[m].mean() > 8)          # vụn nhỏ / bóng ma / ám xanh
            keep[i] = not ghost
        km = keep[lab]
        km = cv2.dilate(km.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0   # giữ viền mềm quanh khối
        al = np.where(km, al, 0)
    a[..., 3] = al
    return a

def figures(path, min_share=0.3):
    """các "hình người" lớn trong ảnh gốc (ảnh AI vẽ nhiều bản / nhiều tư thế): [(x0, y0, x1, y1), …] xếp từ trái sang phải,
    đánh số 1, 2, 3… đúng như PICK trong nhap_anh.py"""
    a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32); a0 = a[..., :3].copy()
    a = key_green(a); al = a[..., 3]
    solid = cv2.morphologyEx((al > 128).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, 8)
    if n <= 1: return []
    big = st[1:, cv2.CC_STAT_AREA].max()
    f = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= big * min_share]
    f = sorted(f, key=lambda i: st[i, cv2.CC_STAT_LEFT])
    return [(st[i, 0], st[i, 1], st[i, 0] + st[i, 2], st[i, 1] + st[i, 3]) for i in f]

def trim_center(a, pad=6):
    al = a[..., 3] > 20
    ys, xs = np.where(al)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    a = a[y0:y1, x0:x1]; al = al[y0:y1, x0:x1]
    h = a.shape[0]; foot = al[int(h * 0.97):]                    # 3% dòng dưới cùng = chỗ chạm đất
    fx = np.where(foot)[1].mean() if foot.any() else a.shape[1] / 2
    half = int(max(fx, a.shape[1] - fx)) + pad
    out = np.zeros((h + pad, 2 * half, 4), np.float32)
    ox = int(half - fx); out[pad:pad + h, ox:ox + a.shape[1]] = a
    return out

def unhaze(a, a0rgb, H=(150, 240, 90), base=4, k=80):
    """31/10 — gỡ lớp sương xanh Flow vẽ quanh 'bóng ma' tràn lên vật (cán + đĩa cờ hiệu T01 bị ám ô-liu, nhạt như phủ màng):
    điểm ảnh bên trong vật có lục dư e = G − (R+B)/2 − base > 0 coi là trộn với màu sương H theo tỉ lệ h = e/k → tách ngược
    (gốc − h·H)/(1 − h). Khử ám xanh thường chỉ hạ kênh G nên giữ nguyên độ sáng → vẫn nhạt; tách ngược trả lại cả nét mực tối."""
    rgb = a0rgb; e = rgb[..., 1] - (rgb[..., 0] + rgb[..., 2]) / 2 - base
    h = np.clip(e / k, 0, 0.6)[..., None]
    fixed = np.clip((rgb - h * np.array(H, np.float32)) / (1 - h), 0, 255)
    w = (np.clip((a[..., 3] / 255 - 0.9) / 0.08, 0, 1) * (e > 0))[..., None]     # chỉ bên trong vật (mép bán trong suốt giữ khử xanh thường)
    a[..., :3] = a[..., :3] * (1 - w) + fixed * w
    return a

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    im = Image.open(src).convert('RGBA'); a = np.asarray(im).astype(np.float32)
    a0rgb = a[..., :3].copy()
    if a[..., 3].min() > 250: a = key_green(a, '--layer' in sys.argv)
    if '--unhaze' in sys.argv: a = unhaze(a, a0rgb)
    if '--layer' not in sys.argv:
        pick = sys.argv[sys.argv.index('--pick') + 1] if '--pick' in sys.argv else 'largest'
        a = clean_sprite(a, a0rgb, pick); a = trim_center(a)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(dst)
    print('ok', dst, a.shape[1], 'x', a.shape[0])
