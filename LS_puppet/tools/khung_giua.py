"""KHUNG TRUNG GIAN — nhập + soát tự động (K5, 31/10/2026)
Dùng: python tools/khung_giua.py <thư mục ảnh tải về (anh_D)> [thư mục ảnh gốc …]
  (nhap_anh.py tự gọi khi trong thư mục có ảnh IBT_* / SPR_HAST_FRONT*)
Mỗi ảnh khung giữa (bảng tools/chuyen.py):
  1. tách nền → public/cut/<tên>.png (như ảnh tư thế)
  2. đo trên CÙNG KHUNG Flow với ảnh đầu A (ảnh sửa từ @GOC_A nên cùng tỉ lệ vẽ): r = cao khung giữa / cao A, dx = lệch chỗ đặt chân
  3. soát: có thêm người? y hệt ảnh đầu (Flow không đổi gì)? giống ảnh cuối quá (vẽ luôn tư thế cuối)? 1/3 và 2/3 ngược thứ tự?
     màu lệch (vẽ lại cả người)? chân trượt khỏi chỗ cũ?
  4. khung đạt → src/puppet/via.json (Puppet tự phát khi cảnh đổi tư thế A → B); khung LỖI → không dùng, báo gen lại
  5. tờ soát out/soat_chuyen.jpg: A | khung giữa | B | chồng mờ cả dải (thấy đường đi của tay có mượt không)
"""
import os, re, sys, json, glob
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from cutout import key_green, clean_sprite, trim_center
from chuyen import TRANS, FRONT, TURN_OF
from goc_1_nguoi import consts, find, one_person

def fig(img_rgb, pick='largest'):
    """mặt nạ người trên khung (bỏ nền xanh, mảnh vụn, bản thứ hai) + số 'người' lớn trong ảnh"""
    rgb = np.asarray(img_rgb.convert('RGB')).astype(np.float32); H, W = rgb.shape[:2]
    a = np.concatenate([rgb.copy(), np.full((H, W, 1), 255, np.float32)], -1); a = key_green(a)
    solid = cv2.morphologyEx((a[..., 3] > 128).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, 8)
    big = st[1:, cv2.CC_STAT_AREA].max() if n > 1 else 0
    people = sum(1 for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= big * 0.3)
    a = clean_sprite(a, rgb.copy(), pick)
    return a, a[..., 3] > 128, people

def geo(m):
    ys, xs = np.where(m); y0, y1 = ys.min(), ys.max(); h = y1 - y0 + 1
    foot = m[int(y1 - 0.03 * h):y1 + 1]; fx = np.where(foot)[1].mean()
    return {'h': h, 'top': y0, 'bot': y1, 'fx': fx, 'x0': xs.min(), 'x1': xs.max()}

def norm_mask(m, g, H=360):
    """mặt nạ cắt sát, căn chân giữa, cao H — để so hình giữa các ảnh khác khung"""
    s = H / g['h']; crop = m[g['top']:g['bot'] + 1].astype(np.uint8) * 255
    w = max(1, int(crop.shape[1] * s)); c = cv2.resize(crop, (w, H), interpolation=cv2.INTER_AREA) > 127
    out = np.zeros((H, 3 * H), bool); ox = int(1.5 * H - g['fx'] * s)
    x0, x1 = max(0, ox), min(3 * H, ox + w); out[:, x0:x1] = c[:, x0 - ox:x1 - ox]; return out
iou = lambda a, b: (a & b).sum() / max(1, (a | b).sum())
def norm_gray(im, m, g, H=360):
    gr = np.asarray(im.convert('L')).astype(np.float32); gr[~m] = 255
    s = H / g['h']; crop = gr[g['top']:g['bot'] + 1]; w = max(1, int(crop.shape[1] * s))
    c = cv2.resize(crop, (w, H), interpolation=cv2.INTER_AREA); out = np.full((H, 3 * H), 255, np.float32); ox = int(1.5 * H - g['fx'] * s)
    x0, x1 = max(0, ox), min(3 * H, ox + w); out[:, x0:x1] = c[:, x0 - ox:x1 - ox]; return out
def changed(ga, gb, ma, mb):
    """tỉ lệ điểm ảnh trong người khác nhau rõ (nét, mảng màu) giữa hai ảnh đã căn chân + cùng cao"""
    u = ma | mb; d = np.abs(cv2.GaussianBlur(ga, (0, 0), 1.5) - cv2.GaussianBlur(gb, (0, 0), 1.5)) > 38
    return (d & u).sum() / max(1, u.sum())
def hue_hist(rgb, m):
    hsv = cv2.cvtColor(np.asarray(rgb.convert('RGB')), cv2.COLOR_RGB2HSV)
    h = cv2.calcHist([hsv], [0, 1], m.astype(np.uint8), [18, 4], [0, 180, 0, 256]); return cv2.normalize(h, h).flatten()

def main():
    src = sys.argv[1].split(',')   # nhiều thư mục khung giữa: 'anh_D,anh_Dsua' — thư mục sau (đợt sửa) được ưu tiên
    dirs = sys.argv[2:] or [os.path.normpath(os.path.join(ROOT, '..', 'tap', 'T01', d)) for d in ('anh', 'anh_B', 'anh_C')]
    PICK, MASK = consts(); cutdir = os.path.join(ROOT, 'public', 'cut')
    cache = {}
    def base(n):   # ảnh đầu/cuối: ảnh gốc 1 người trên khung gốc
        if n not in cache:
            p = find(n, dirs)
            if not p: cache[n] = None
            else:
                im, _ = one_person(p, n, PICK, MASK); a, m, _ = fig(im); cache[n] = (im, m, geo(m))
        return cache[n]
    def people_in(n):   # ảnh gốc (khung Flow) của ảnh đầu có mấy bản người
        p = find(n, dirs)
        return fig(Image.open(p).convert('RGB'))[2] if p else 1
    def load_kt(n, A):
        p = find(n, src)
        if not p: return None
        im = Image.open(p).convert('RGB'); a, m, people = fig(im)
        if people > 1 and people_in(A) == people:   # ảnh khung giữa sửa trên ảnh gốc NHIỀU bản (đợt D cũ): lấy đúng bản đang dùng như ảnh đầu
            a, m, _ = fig(im, PICK.get(A, 'largest')); people = 1
        Image.fromarray(np.clip(trim_center(a.copy()), 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(cutdir, n + '.png'))
        return im, m, geo(m), people

    via, turn, rows, report = {}, {}, {}, []
    for name, A, B, fr, hold, pri, use in TRANS:
        k = load_kt(name, A)
        if not k: continue
        bA, bB = base(A), base(B)
        if not bA or not bB: report.append((name, 'LỖI', 'không thấy ảnh gốc ' + (A if not bA else B))); continue
        im, m, g, people = k; imA, mA, gA = bA; imB, mB, gB = bB
        r = g['h'] / gA['h']; dx = (g['fx'] - gA['fx']) / g['h']
        nK, nA, nB = norm_mask(m, g), norm_mask(mA, gA), norm_mask(mB, gB)
        gK, gA_, gB_ = norm_gray(im, m, g), norm_gray(imA, mA, gA), norm_gray(imB, mB, gB)
        cA, cB = changed(gK, gA_, nK, nA), changed(gK, gB_, nK, nB)        # khác ảnh đầu / khác ảnh cuối bao nhiêu
        sA, sB = 1 - cA, 1 - cB
        col = cv2.compareHist(hue_hist(im, m), hue_hist(imA, mA), cv2.HISTCMP_BHATTACHARYYA)
        bad, warn = [], []
        if people > 1: bad.append(f'có {people} người')
        if cA < 0.015: bad.append(f'gần y hệt ảnh đầu (chỉ khác {cA:.1%}) — Flow không đổi tư thế')
        elif (cB < 0.015) if fr == '2/3' else (cB < 0.04 and cB < 0.5 * cA): bad.append(f'giống ảnh cuối quá (chỉ khác {cB:.1%})')   # khung 2/3 vốn gần ảnh cuối
        if col > 0.35: bad.append(f'màu lệch nhiều ({col:.2f}) — vẽ lại cả người?')
        elif col > 0.22: warn.append(f'màu hơi lệch ({col:.2f})')
        if 'LYING' not in A:   # chỉ nằm → ngồi mới dời chỗ đặt hông; còn lại giữ chân đứng yên (Flow trượt người thì bỏ qua lệch)
            if abs(dx) > 0.05: warn.append(f'chân trượt {dx:+.0%} chiều cao (đã giữ chân tại chỗ)')
            dx = 0.0
        if not 0.75 < r < 1.35: warn.append(f'cỡ người đổi {r:.2f} lần')
        rows.setdefault((A, B), []).append((name, fr, im, m, g, sA, sB, bad, warn))
        report.append((name, 'LỖI' if bad else ('lưu ý' if warn else 'đạt'), '; '.join(bad + warn) or f'khác ảnh đầu {cA:.0%}, khác ảnh cuối {cB:.0%}'))
        if not bad:
            via.setdefault(f'{A}>{B}', {'hold': hold, 'frames': []})['frames'].append({'n': name, 'r': round(r, 4), 'dx': round(dx, 4), 'f': fr})
    for key, t in via.items():   # thứ tự khung theo vị trí trên đường đi; báo nếu 1/3 giống ảnh cuối hơn 2/3
        t['frames'].sort(key=lambda x: {'1/3': 1, '1/2': 2, '2/3': 3}[x.pop('f')])
    for (A, B), lst in rows.items():
        d = {fr: sA for _, fr, _, _, _, sA, _, _, _ in lst}
        if '1/3' in d and '2/3' in d and d['1/3'] < d['2/3']: report.append((f'{A}→{B}', 'lưu ý', 'khung 1/3 lại khác ảnh đầu nhiều hơn khung 2/3 — xem có đảo thứ tự không'))
    for name, A, use in FRONT:
        k = load_kt(name, A)
        if not k: continue
        bA = base(A); im, m, g, people = k; imA, mA, gA = bA
        col = cv2.compareHist(hue_hist(im, m), hue_hist(imA, mA), cv2.HISTCMP_BHATTACHARYYA)
        bad = ([f'có {people} người'] if people > 1 else []) + ([f'màu lệch nhiều ({col:.2f})'] if col > 0.35 else [])
        report.append((name, 'LỖI' if bad else 'đạt', '; '.join(bad) or 'khung nhìn thẳng'))
        if not bad:
            for s_, f_ in TURN_OF.items():
                if f_ == name: turn[s_] = {'n': name, 'r': round(g['h'] / gA['h'], 4), 'dx': 0.0}   # quay tại chỗ
        rows.setdefault((A, 'FRONT'), []).append((name, 'thẳng', im, m, g, 0, 0, bad, []))
    old = json.load(open(os.path.join(ROOT, 'src', 'puppet', 'via.json'))) if os.path.exists(os.path.join(ROOT, 'src', 'puppet', 'via.json')) else {'via': {}, 'turn': {}}
    old['via'].update(via); old['turn'].update(turn)
    json.dump(old, open(os.path.join(ROOT, 'src', 'puppet', 'via.json'), 'w'), indent=1, ensure_ascii=False)
    sheet(rows, base)
    for n, st, msg in report: print(f'{st:6s} {n}: {msg}')
    print(f"→ src/puppet/via.json: {sum(len(t['frames']) for t in via.values())} khung giữa, {len(turn)} khung quay; tờ soát out/soat_chuyen.jpg")

def sheet(rows, base, H=300):
    try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
    except Exception: F = None
    def tile(im, m, g, ref_g, tint=None):
        """cắt quanh người, chiều cao theo ảnh đầu (cùng khung) để thấy đúng cỡ"""
        s = H * 0.9 / ref_g['h']; pad = int(0.08 * ref_g['h'])
        x0 = int(min(g['x0'], ref_g['x0']) - pad); x1 = int(max(g['x1'], ref_g['x1']) + pad); y0 = int(ref_g['bot'] - ref_g['h'] / 0.9)
        y1 = int(ref_g['bot'] + 0.05 * ref_g['h'])
        a = np.asarray(im.convert('RGB')).copy(); a[~m] = (225, 230, 220)
        P = int(ref_g['h']); a = np.pad(a, ((P, P), (P, P), (0, 0)), constant_values=0); a[:P] = a[-P:] = (225, 230, 220); a[:, :P] = a[:, -P:] = (225, 230, 220)
        c = Image.fromarray(a).crop((x0 + P, y0 + P, x1 + P, y1 + P)); return c.resize((max(1, int(c.width * s)), max(1, int(c.height * s))))
    blocks = []
    for (A, B), lst in rows.items():
        imA, mA, gA = base(A)
        ts = [('ĐẦU ' + A.replace('SPR_', ''), tile(imA, mA, gA, gA), [])]
        for name, fr, im, m, g, sA, sB, bad, warn in sorted(lst, key=lambda x: x[1]):
            ts.append((f'{name} ({fr})', tile(im, m, g, gA), bad + warn))
        if B != 'FRONT':
            imB, mB, gB = base(B); ts.append(('CUỐI ' + B.replace('SPR_', ''), tile(imB, mB, gB, gB), []))
            # chồng mờ: ảnh đầu + các khung giữa (cùng khung) + ảnh cuối căn chân, cùng cao
            layers = [(imA, mA, gA)] + [(im, m, g) for _, _, im, m, g, *_ in sorted(lst, key=lambda x: x[1])]
            on = np.full((H, int(H * 1.6), 3), 255.0); cols = [(40, 90, 200), (40, 160, 70), (230, 140, 30), (200, 40, 40)]
            allg = layers + [(imB, mB, gB)]
            for i, (im_, m_, g_) in enumerate(allg):
                nm_ = norm_mask(m_, g_, H)[:, int(1.5 * H - 0.8 * H):int(1.5 * H + 0.8 * H)].astype(np.uint8)
                edge = cv2.morphologyEx(nm_, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0   # chỉ vẽ đường viền từng khung
                c = np.array(cols[min(i, 3)] if i < len(allg) - 1 else cols[3], float)
                on[edge] = c
            ts.append(('viền chồng: đầu xanh → giữa lá/cam → cuối đỏ', Image.fromarray(on.astype(np.uint8)), []))
        W = sum(t.width for _, t, _ in ts) + 12 * len(ts); R = Image.new('RGB', (W, H + 60), 'white'); d = ImageDraw.Draw(R); x = 0
        for lb, t, msgs in ts:
            R.paste(t, (x, 22)); d.text((x, 2), lb, fill=(0, 0, 0), font=F)
            if msgs: d.text((x, H + 26), ' | '.join(msgs)[:60], fill=(190, 30, 20), font=F)
            x += t.width + 12
        blocks.append(R)
    if not blocks: return
    Wm = max(b.width for b in blocks); S = Image.new('RGB', (Wm, sum(b.height + 10 for b in blocks)), 'white'); y = 0
    for b in blocks: S.paste(b, (0, y)); y += b.height + 10
    S.save(os.path.join(ROOT, 'out', 'soat_chuyen.jpg'), quality=85)

if __name__ == '__main__': main()
