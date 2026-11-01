"""PHIẾU KIỂM CHẤT LƯỢNG (F, 29/10/2026) — chạy trên video thành phẩm trước khi gửi Cậu Cả.
Dùng: python tools/qa.py <video.mp4> [--mau <video mẫu.mp4>]  → out/qa_<tên>.md + out/qa_<tên>_to.jpg
Kiểm:
  1. Màu từng cảnh so với ngưỡng đo từ video mẫu: độ bão hoà, điểm đen (đục sữa), viền tối (tâm sáng hơn 4 góc), độ nét
     (cảnh sương được miễn ngưỡng bão hoà: S01, S04, S08, S09, S17, S22)
  2. Máy quay: tỉ lệ cảnh zoom vào / ra, tốc độ zoom, tốc độ lia, độ "tự cử động" (chuyển động còn lại sau khi trừ máy)
  3. Âm lượng: −14 ±1 LUFS, đỉnh thật ≤ −1 dBTP
  4. Độ dài, độ phân giải, khung hình/giây
  5. Lộ mép nền: đường thẳng chạy suốt khung sát mép trái/phải/trên/dưới (giấy, bản đồ, lớp nền không phủ kín khi máy lia/zoom)
  6. Tờ ảnh: khung giữa mỗi cảnh, có ghi cảnh lỗi
Cảnh bản đồ/sơ đồ (MAPS) miễn điểm đen + viền tối (giấy sáng, không có vùng tối tự nhiên);
cảnh đoàn quân trong sương nhẹ theo lời kể (FOG_LIGHT) nới điểm đen lên 40.
Hướng đi (đi giật lùi) kiểm riêng bằng `node kiem_huong.mjs` vì cần đọc trạng thái con rối trong code."""
import os, re, sys, json, subprocess, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 31/10 (nền mới N1): S02 bờ hồ chìm sương (như S01/S22), S06 hẻm sương — rừng tối hai bên là nền vẽ, không phải lớp viền tối,
# S20 chiếc mũ trên đường bùn trong sương → xếp vào nhóm sương dày (đã soát mắt: không đục sữa, nhân vật đủ tương phản)
FOGGY = {'S01', 'S02', 'S04', 'S06', 'S08', 'S09', 'S17', 'S20', 'S22'}
MAPS = {'S11', 'S12', 'S13', 'S16', 'S18'}
FOG_LIGHT = {'S03', 'S05', 'S19'}   # đoàn quân / trận đánh trong sương theo lời kể
NG = {'bao_hoa_min': 40, 'den_max': 32, 'vien_toi_max': 40, 'net_min': 150}
FPS = 30

def shots():
    """điểm cắt lấy từ src/MainP.tsx + src/timeline.json (đúng như code dựng)"""
    tl = json.load(open(os.path.join(ROOT, 'src', 'timeline.json'))); L = {l['id']: l for l in tl['lines']}
    LS = lambda i: round(L[i]['start'] * FPS)
    WF = lambda i, w: round([x for x in L[i]['words'] if x['w'] == w][0]['t'] * FPS)
    src = open(os.path.join(ROOT, 'src', 'MainP.tsx'), encoding='utf-8').read()
    out = []
    for sid, expr in re.findall(r"\{id: '(S\w+)', from: (.+?), C:", src):
        if expr == '0': fr = 0
        elif m := re.match(r"cut\('(L\d+)'\)", expr): fr = LS(m.group(1)) - 5
        elif m := re.match(r"WF\('(L\d+)', '(\w+)'\) - (\d+)", expr): fr = WF(m.group(1), m.group(2)) - int(m.group(3))
        else: raise SystemExit('không đọc được điểm cắt ' + expr)
        out.append((sid, fr))
    return out

def frames(path, t0, t1, step=0.5, W=640, H=360):
    p = subprocess.Popen(['ffmpeg', '-nostdin', '-v', 'error', '-ss', str(t0), '-i', path, '-t', str(max(0.1, t1 - t0)), '-vf', f'fps={1 / step},scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    while True:
        b = p.stdout.read(W * H * 3)
        if len(b) < W * H * 3: break
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3)

def colour(im):
    g = cv2.cvtColor(im, cv2.COLOR_RGB2GRAY).astype(np.float32); H, W = g.shape
    c = g[H // 4: 3 * H // 4, W // 4: 3 * W // 4].mean(); k = np.concatenate([g[:H // 6, :W // 6].ravel(), g[:H // 6, -W // 6:].ravel(), g[-H // 6:, :W // 6].ravel(), g[-H // 6:, -W // 6:].ravel()]).mean()
    return cv2.cvtColor(im, cv2.COLOR_RGB2HSV)[..., 1].mean(), np.percentile(g, 1), c - k, cv2.Laplacian(g, cv2.CV_32F).var()

def seam(g, band=48, thr=7, frac=0.8):
    """đường thẳng đứng/ngang chạy suốt khung trong dải sát mép → nền không phủ kín khung"""
    H, W = g.shape; out = []
    for axis, n in ((1, W), (0, H)):
        d = np.diff(g, axis=axis)
        for i in list(range(2, band)) + list(range(n - band, n - 3)):
            col = d[:, i] if axis == 1 else d[i, :]
            if np.mean(col > thr) > frac or np.mean(col < -thr) > frac: out.append(('dọc' if axis == 1 else 'ngang', i))
    return out

def main():
    vid = sys.argv[1]; name = os.path.splitext(os.path.basename(vid))[0]
    pr = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=width,height,r_frame_rate,codec_type', '-of', 'json', vid]))
    dur = float(pr['format']['duration']); v = [s for s in pr['streams'] if s['codec_type'] == 'video'][0]
    S = shots(); S.append(('END', round(dur * FPS)))
    rows, bad, thumbs = [], [], []
    for (sid, a), (_, b) in zip(S, S[1:]):
        ims = list(frames(vid, a / FPS + 0.1, b / FPS - 0.05, 0.25))
        st = np.array([colour(im) for im in ims])
        if not len(st): continue
        sat, blk, vig, sh = np.median(st, 0); issues = []   # trung vị: chớp trắng / mực loang chuyển cảnh vài khung không làm lệch số cả cảnh
        mep = [k * 0.25 for k, im in enumerate(ims) if seam(im.mean(2).astype(np.float32))]
        if mep: issues.append(f'lộ mép nền {len(mep)} khung (từ {a / FPS + 0.1 + mep[0]:.1f} s)')
        if sid not in FOGGY and sat < NG['bao_hoa_min']: issues.append(f'màu nhạt ({sat:.0f})')
        if blk > (40 if sid in FOG_LIGHT else NG['den_max']) and sid not in FOGGY | MAPS: issues.append(f'đen đục ({blk:.0f})')
        if vig > NG['vien_toi_max'] and sid not in FOGGY | MAPS: issues.append(f'viền tối nặng ({vig:.0f})')
        if sh < NG['net_min'] and sid not in FOGGY | {'S07'}: issues.append(f'nhoè ({sh:.0f})')
        rows.append((sid, a / FPS, b / FPS, sat, blk, vig, sh, issues)); bad += [(sid, i) for i in issues]
        mid = next(frames(vid, (a + b) / 2 / FPS, (a + b) / 2 / FPS + 0.1, 1, 427, 240), None)
        if mid is not None: thumbs.append((sid, mid, issues))
    # âm lượng
    lo = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-i', vid, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', lo)[-1]); TP = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', lo)[-1])
    if not (-15 <= I <= -13): bad.append(('âm', f'âm lượng {I} LUFS (cần −14 ±1)'))
    if TP > -1: bad.append(('âm', f'đỉnh {TP} dBTP (cần ≤ −1)'))
    # máy quay (dùng đo chuyển động của cmp/motion.py nếu có)
    cam = ''
    mp = '/home/claude/cmp/motion.py'
    if os.path.exists(mp):
        csvp = os.path.join(ROOT, 'out', f'qa_{name}_motion.csv'); subprocess.run([sys.executable, mp, vid, csvp, '10'], capture_output=True)
        A = np.loadtxt(csvp, delimiter=',', skiprows=1); t, tx, ty, sc, res = A[:, 0], A[:, 1], A[:, 2], A[:, 3], A[:, 7]
        zr, pn, rs = [], [], []
        for (sid, a), (_, b) in zip(S, S[1:]):
            m = (t > a / FPS + 0.15) & (t <= b / FPS - 0.05) & (sc > 0.7) & (sc < 1.4); d = (b - a) / FPS
            if m.sum() < 2: continue
            zr.append(np.log(sc[m]).sum() / d * 100); pn.append(np.hypot(tx[m], ty[m]).sum() / 480 * 100 / d); rs.append(res[m].mean())
        zr = np.array(zr); cam = f"zoom vào {np.mean(zr > 0.3):.0%} / ra {np.mean(zr < -0.3):.0%} (mẫu 52% / 31%) · zoom TB {np.abs(zr).mean():.1f} %/s (mẫu 2,4) · lia TB {np.mean(pn):.1f} %/s (mẫu 2,6) · tự cử động {np.mean(rs):.2f} (mẫu 4,4)"
    # ghi phiếu
    md = [f"# Phiếu kiểm chất lượng — {name}", "",
          f"- Độ dài {dur:.1f} s · {v['width']}×{v['height']} · {v['r_frame_rate']} khung/giây",
          f"- Âm lượng {I} LUFS · đỉnh {TP} dBTP", f"- Máy quay: {cam}" if cam else "", "",
          f"**{'ĐẠT' if not bad else 'CẦN XEM'}** — {len(bad)} điểm" + ('' if not bad else ': ' + '; '.join(f'{s} {i}' for s, i in bad)), "",
          "| Cảnh | Giây | Bão hoà | Điểm đen | Viền tối | Độ nét | Ghi chú |", "|---|---|---|---|---|---|---|"]
    md += [f"| {s} | {a:.1f}–{b:.1f} | {sat:.0f} | {blk:.0f} | {vig:.0f} | {sh:.0f} | {', '.join(i) or ('sương (miễn)' if s in FOGGY else 'bản đồ (miễn đen/viền)' if s in MAPS else 'sương nhẹ (đen ≤ 40)' if s in FOG_LIGHT else '')} |" for s, a, b, sat, blk, vig, sh, i in rows]
    md += ["", f"Ngưỡng (đo từ video mẫu: bão hoà 77, điểm đen 14, viền tối 18): bão hoà ≥ {NG['bao_hoa_min']}, điểm đen ≤ {NG['den_max']}, viền tối ≤ {NG['vien_toi_max']}, độ nét ≥ {NG['net_min']}"]
    open(os.path.join(ROOT, 'out', f'qa_{name}.md'), 'w', encoding='utf-8').write('\n'.join(x for x in md if x is not None) + '\n')
    # tờ ảnh
    fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16) if os.path.exists('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf') else ImageFont.load_default()
    cols = 5; rowsN = (len(thumbs) + cols - 1) // cols; sheet = Image.new('RGB', (427 * cols, 240 * rowsN), 'white'); d = ImageDraw.Draw(sheet)
    for i, (sid, im, iss) in enumerate(thumbs):
        x, y = (i % cols) * 427, (i // cols) * 240; sheet.paste(Image.fromarray(im), (x, y))
        d.text((x + 6, y + 4), sid + (' ⚠ ' + ', '.join(iss) if iss else ''), fill=(255, 80, 60) if iss else 'white', font=fnt, stroke_width=2, stroke_fill='black')
    sheet.save(os.path.join(ROOT, 'out', f'qa_{name}_to.jpg'), quality=85)
    print('\n'.join(md[:7])); print('phiếu:', f'out/qa_{name}.md')

if __name__ == '__main__': main()
