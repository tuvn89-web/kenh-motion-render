"""Ghép mắt / miệng: từ ảnh SỬA (EDT_*, Flow chỉ đổi mắt hoặc miệng) cắt ra một MIẾNG VÁ nhỏ đặt khớp lên ảnh tư thế đã tách nền.
Puppet dùng miếng vá để chớp mắt ngẫu nhiên và mấp máy môi khi nhân vật nói (bong bóng thoại).

Dùng: python tools/va_mat.py <thư mục ảnh Nebula> [thư mục khác…]   (ảnh gốc SPR_* và ảnh sửa EDT_* có thể ở hai thư mục)
  → public/cut/PAT_<ảnh gốc>_<kiểu>.png, src/puppet/patches.json, tờ soát out/soat_mat.jpg
Cách làm:
  1. Tìm ảnh đã tách (public/cut/SPR_*.png) nằm ở đâu trong ảnh Nebula gốc (khớp mẫu vùng đầu, thô → tinh).
  2. Căn ảnh sửa vào ảnh gốc (ECC affine toàn ảnh, rồi tịnh tiến riêng vùng đầu) — Flow thường xê dịch / co giãn vài px.
  3. Lấy vùng KHÁC NHAU trong vùng đầu → mặt nạ mềm → miếng vá RGBA (chỉ thay đúng chỗ đổi, phần còn lại trong suốt).
  4. Báo lỗi nếu ảnh sửa đổi quá nhiều (Flow vẽ lại cả đầu) hoặc căn không khớp → gen lại ảnh đó.
"""
import os, re, sys, json
import numpy as np, cv2
from PIL import Image

# ảnh sửa → (ảnh gốc, kiểu). blink = mắt nhắm; shut = miệng ngậm (ảnh gốc đang há miệng); talk = miệng mở (ảnh gốc đang ngậm)
EDITS_B = {
    'EDT_HASTSC_BLINK': ('SPR_HAST_SCARED', 'blink'),
    'EDT_HASTASK_SHUT': ('SPR_HAST_ASK', 'shut'),
    'EDT_HASTDP_TALK': ('SPR_HAST_DEADPAN', 'talk'),
    'EDT_HANN_BLINK': ('SPR_HANN_STAND', 'blink'),
    'EDT_FLAMPT_BLINK': ('SPR_FLAM_POINT', 'blink'),
    'EDT_FLAMPT_SHUT': ('SPR_FLAM_POINT', 'shut'),
}
EDITS_C = {   # đợt C (29/10): chớp mắt cho tư thế mới
    'EDT_HANNAR_BLINK': ('SPR_HANN_ARMS', 'blink'),
    'EDT_FLAMOR_BLINK': ('SPR_FLAM_ORDER', 'blink'),
    'EDT_SIGNSC_BLINK': ('SPR_SIGN_SCARED', 'blink'),
    'EDT_LEGFSC_BLINK': ('SPR_LEGF_SCARED', 'blink'),
}
EDITS_D = {   # đợt D (cận mặt G3): chớp mắt / ngậm miệng trên ảnh cận
    'EDT_CUFLAM_SHUT': ('CU_FLAM_SHOUT', 'shut'),
    'EDT_CUFLAM_BLINK': ('CU_FLAM_SHOUT', 'blink'),
    'EDT_CUHANN_BLINK': ('CU_HANN_SMIRK', 'blink'),
    'EDT_CUHAST_BLINK': ('CU_HAST_HORN', 'blink'),
}
EDITS = {**EDITS_B, **EDITS_C, **EDITS_D}
HEAD = 0.55          # vùng đầu = 55% chiều cao phía trên của ảnh đã tách (gồm cả mũ, lông chim; mặt chibi nằm ở 30–50%)
THR = 38             # ngưỡng khác màu (0..255) để coi là "đã đổi"
MAX_CHANGE = 0.30    # đổi quá 30% vùng đầu = Flow vẽ lại cả đầu → báo gen lại

def norm(fn):
    n = os.path.splitext(fn)[0]
    n = re.sub(r'_\d{8}[_-]?\d{4,6}$', '', n); n = re.sub(r'(-copy)$', '', n); n = re.sub(r'-[a-d]$', '', n); n = re.sub(r'(-copy)$', '', n)
    return n

def locate(raw, cut):
    """vị trí (x, y) của góc trên-trái ảnh đã tách trong ảnh gốc. Ảnh tách = ảnh gốc cắt + dời (không co giãn)."""
    H = cut.shape[0]; head = cut[: int(H * HEAD)]
    m = (head[..., 3] > 230).astype(np.uint8)
    ys, xs = np.where(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    tpl = head[y0:y1, x0:x1, :3].astype(np.float32); tm = m[y0:y1, x0:x1].astype(np.float32)
    s = 4   # thô: 1/4
    small = cv2.resize(raw, None, fx=1 / s, fy=1 / s, interpolation=cv2.INTER_AREA).astype(np.float32)
    ts = cv2.resize(tpl, None, fx=1 / s, fy=1 / s, interpolation=cv2.INTER_AREA); ms = (cv2.resize(tm, (ts.shape[1], ts.shape[0])) > 0.9).astype(np.float32)
    r = cv2.matchTemplate(small, ts, cv2.TM_SQDIFF, mask=np.dstack([ms] * 3))
    _, _, (bx, by), _ = cv2.minMaxLoc(r)
    gx, gy = bx * s, by * s; R = 8   # tinh: ±8 px ở độ phân giải gốc
    ax0, ay0 = max(0, gx - R), max(0, gy - R)
    win = raw[ay0: gy + R + tpl.shape[0], ax0: gx + R + tpl.shape[1]].astype(np.float32)
    r = cv2.matchTemplate(win, tpl, cv2.TM_SQDIFF, mask=np.dstack([tm] * 3))
    mn, _, (bx, by), _ = cv2.minMaxLoc(r)
    err = mn / max(1, tm.sum() * 3)
    return ax0 + bx - x0, ay0 + by - y0, err

def align(base, edit, roi):
    """căn ảnh sửa vào ảnh gốc: affine toàn ảnh (1/2 độ phân giải) rồi tịnh tiến tinh trên vùng đầu"""
    if edit.shape != base.shape: edit = cv2.resize(edit, (base.shape[1], base.shape[0]), interpolation=cv2.INTER_CUBIC)
    g = lambda im: cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_RGB2GRAY), (0, 0), 1.5).astype(np.float32)
    s = 0.5; gb = cv2.resize(g(base), None, fx=s, fy=s); ge = cv2.resize(g(edit), None, fx=s, fy=s)
    w = np.eye(2, 3, dtype=np.float32)
    try: _, w = cv2.findTransformECC(gb, ge, w, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), None, 5)
    except cv2.error: pass
    w[:, 2] /= s
    al = cv2.warpAffine(edit, w, (base.shape[1], base.shape[0]), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    x0, y0, x1, y1 = roi; t = np.eye(2, 3, dtype=np.float32)
    try: _, t = cv2.findTransformECC(g(base)[y0:y1, x0:x1], g(al)[y0:y1, x0:x1], t, cv2.MOTION_TRANSLATION, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 100, 1e-6), None, 1)
    except cv2.error: pass
    al = cv2.warpAffine(al, t, (base.shape[1], base.shape[0]), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    return al, w, t

def greenmask(rgb):  # 1 = nhân vật, 0 = nền xanh
    r, g, b = [rgb[..., i].astype(np.int16) for i in range(3)]
    return ((g - np.maximum(r, b)) < 40).astype(np.uint8)

def make_patch(base_raw, edit_raw, cut):
    H, W = cut.shape[:2]
    ox, oy, lerr = locate(base_raw, cut)
    hx0, hy0 = max(0, ox), max(0, oy); hx1, hy1 = min(base_raw.shape[1], ox + W), min(base_raw.shape[0], oy + int(H * HEAD))
    al, w, t = align(base_raw, edit_raw, (hx0, hy0, hx1, hy1))
    B = base_raw[hy0:hy1, hx0:hx1].astype(np.int16); E = al[hy0:hy1, hx0:hx1].astype(np.int16)
    char = cv2.dilate(greenmask(base_raw[hy0:hy1, hx0:hx1]) | greenmask(al[hy0:hy1, hx0:hx1]), np.ones((3, 3), np.uint8))
    # chỉ xét trong khối nhân vật đã tách (bỏ bản vẽ thứ hai / mảnh ma đã loại)
    ca = cut[hy0 - oy: hy1 - oy, hx0 - ox: hx1 - ox, 3] > 30
    ca = cv2.dilate(ca.astype(np.uint8), np.ones((9, 9), np.uint8))
    d = (np.abs(E - B).max(-1) > THR).astype(np.uint8) * char * ca
    d = cv2.morphologyEx(d, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(d, 8)
    keep = np.zeros_like(d)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 25: keep[lab == i] = 1
    area = keep.sum(); headarea = max(1, (ca > 0).sum())
    info = {'locate_err': round(float(lerr), 1), 'change': round(area / headarea, 3), 'affine': np.round(w, 4).tolist(), 'shift': np.round(t[:, 2], 2).tolist()}
    if area == 0: return None, info
    m = cv2.dilate(keep, np.ones((9, 9), np.uint8)).astype(np.float32)
    m = cv2.GaussianBlur(m, (0, 0), 2.2) * cv2.dilate(greenmask(al[hy0:hy1, hx0:hx1]), np.ones((3, 3), np.uint8))
    ys, xs = np.where(m > 0.02); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb = al[hy0:hy1, hx0:hx1][y0:y1, x0:x1]
    pa = np.dstack([rgb, np.clip(m[y0:y1, x0:x1] * 255, 0, 255)]).astype(np.uint8)
    cx, cy = hx0 + x0 - ox, hy0 + y0 - oy   # toạ độ trong ảnh đã tách
    info['box'] = [int(cx), int(cy), int(x1 - x0), int(y1 - y0)]
    return pa, info

def sheet(rows, path):
    tiles = []
    for name, cut, pa, box in rows:
        x, y, w, h = box; pad = 60
        X0, Y0, X1, Y1 = max(0, x - pad), max(0, y - pad), min(cut.shape[1], x + w + pad), min(cut.shape[0], y + h + pad)
        bg = np.full((Y1 - Y0, X1 - X0, 3), (235, 235, 225), np.float32)
        def comp(im):
            a = im[Y0:Y1, X0:X1, 3:4] / 255.0; return bg * (1 - a) + im[Y0:Y1, X0:X1, :3] * a
        c2 = cut.astype(np.float32).copy(); a = pa[..., 3:4] / 255.0
        c2[y:y + h, x:x + w, :3] = c2[y:y + h, x:x + w, :3] * (1 - a) + pa[..., :3] * a
        c2[y:y + h, x:x + w, 3:4] = np.maximum(c2[y:y + h, x:x + w, 3:4], pa[..., 3:4])
        ov = comp(c2).copy(); cv2.rectangle(ov, (x - X0, y - Y0), (x - X0 + w, y - Y0 + h), (255, 0, 0), 2)
        t = np.hstack([comp(cut), comp(c2), ov]).astype(np.uint8)
        s = 300 / t.shape[0]; t = cv2.resize(t, None, fx=s, fy=s)
        lab = np.full((26, t.shape[1], 3), 255, np.uint8); cv2.putText(lab, name + '   goc | da va | khung va', (4, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 1)
        tiles.append(np.vstack([lab, t]))
    if not tiles: return
    Wd = max(t.shape[1] for t in tiles); out = np.vstack([np.pad(t, ((0, 6), (0, Wd - t.shape[1]), (0, 0)), constant_values=255) for t in tiles])
    Image.fromarray(out).save(path, quality=88)

if __name__ == '__main__':
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cutd = os.path.join(ROOT, 'public', 'cut'); pj = os.path.join(ROOT, 'src', 'puppet', 'patches.json')
    files = {}
    for d in sys.argv[1:]:
        for fn in sorted(os.listdir(d)):
            if fn.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')): files[norm(fn)] = os.path.join(d, fn)
    P = json.load(open(pj)) if os.path.exists(pj) else {}
    rows, bad = [], []
    for e, (b, kind) in EDITS.items():
        if e not in files: continue
        if b not in files or not os.path.exists(os.path.join(cutd, b + '.png')): print('! thiếu ảnh gốc', b, 'cho', e); continue
        HEAD = 0.9 if b.startswith('CU_') else 0.55   # ảnh cận mặt: mắt, miệng nằm gần hết khung
        base = np.asarray(Image.open(files[b]).convert('RGB')); edit = np.asarray(Image.open(files[e]).convert('RGB'))
        cut = np.asarray(Image.open(os.path.join(cutd, b + '.png')).convert('RGBA'))
        pa, info = make_patch(base, edit, cut)
        if pa is None or info['change'] > MAX_CHANGE:   # Flow có khi trả ảnh sửa bị LẬT NGANG so với ảnh gốc → thử lật lại
            pm, im = make_patch(base, np.ascontiguousarray(edit[:, ::-1]), cut)
            if pm is not None and (pa is None or im['change'] < info['change']): pa, info = pm, {**im, 'lat_nguoc': True}; print('  (ảnh sửa bị lật ngang — đã lật lại)')
        if pa is None: print('! không thấy chỗ nào đổi ở bản đang dùng (Flow sửa nhầm bản khác?):', e, info); bad.append(e); continue
        pn = f'PAT_{b}_{kind}'
        if info['change'] > MAX_CHANGE or info['locate_err'] > 400:
            # thường gặp: ảnh gốc có 2 bản vẽ mà Flow sửa nhầm bản KHÔNG được dùng → vùng đầu bản đang dùng không đổi, phải gen lại
            print(f"! {e}: đổi {info['change']:.0%} vùng đầu / khớp lệch {info['locate_err']} → KHÔNG dùng, gen lại (ảnh gốc nhiều bản: dặn rõ sửa bản nào)"); bad.append(e)
            rows.append((e + ' (LOI)', cut, pa, info['box'])); P.get(b, {}).pop(kind, None)
            if os.path.exists(os.path.join(cutd, pn + '.png')): os.remove(os.path.join(cutd, pn + '.png'))
            continue
        Image.fromarray(pa, 'RGBA').save(os.path.join(cutd, pn + '.png'))
        H, W = cut.shape[:2]; x, y, w, h = info['box']
        P.setdefault(b, {})[kind] = {'src': pn, 'x': round(x / W, 5), 'y': round(y / H, 5), 'w': round(w / W, 5), 'h': round(h / H, 5)}
        rows.append((e, cut, pa, info['box'])); print('ok', e, '→', pn, info)
    P = {k: v for k, v in P.items() if v}
    json.dump(P, open(pj, 'w'), indent=1)
    os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
    sheet(rows, os.path.join(ROOT, 'out', 'soat_mat.jpg'))
    print('miếng vá:', len(rows), '| cần xem lại:', bad or 'không', '| tờ soát: out/soat_mat.jpg')
