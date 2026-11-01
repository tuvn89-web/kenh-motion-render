"""BỘ TRỘN ÂM THANH v2 (D2–D5, 29/10/2026) — thay tools/sfx.py.
  D2  tiếng động KHỚP KHUNG: đọc build/cues.json (bước chân, vó ngựa, đổi tư thế, va chạm, giáo bay, bụi, lửa, nhãn…
      do code dựng hình in ra), đặt tiếng đúng khung, ĐỊNH VỊ TRÁI/PHẢI theo vị trí trên màn hình, GẦN/XA theo cỡ nhân vật
  D3  tiếng THẬT có giấy phép trong thư mục am_thanh/ (Sonniss GDC / Pixabay), thiếu loại nào thì dùng tiếng tổng hợp (am_lib.py)
  D4  nhạc mỏng (dây trầm ở đoạn căng thẳng) + điểm nhấn ở từ khoá, tự hạ khi có lời
  D5  hậu kỳ giọng: lọc trầm, khử xì, nén, sáng tiếng, vang phòng rất nhẹ; tiếng vang theo KHÔNG GIAN từng bối cảnh
Dùng: python tools/am_thanh.py [--lib am_thanh]  → public/mix.wav + build/mix.flac (−14 LUFS, đỉnh ≤ −1 dBTP), stems trong build/"""
import os, sys, json, glob, re, subprocess
import numpy as np, soundfile as sf
from scipy import signal
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import am_lib as L
from qa import shots as shot_list
SR, FPS = 48000, 30
dB = L.dB
LIB = sys.argv[sys.argv.index('--lib') + 1] if '--lib' in sys.argv else os.path.join(ROOT, 'am_thanh')
T = json.load(open(os.path.join(ROOT, 'src', 'timeline.json'))); LN = {l['id']: l for l in T['lines']}
TOT = T['frames'] / FPS + 0.5; N = int(TOT * SR)
R = np.random.default_rng(29)
WF = lambda i, w, n=0: [x for x in LN[i]['words'] if x['w'] == w][n]['t']
SH = shot_list(); SH.append(('END', T['frames']))
SPAN = {s: (a / FPS, b / FPS) for (s, a), (_, b) in zip(SH, SH[1:])}

# ---------- thư viện tiếng thật ----------
ROLE = {   # vai trò → tiền tố tên file (Pixabay theo danh sách am_thanh_can_tai.md, Sonniss theo loại rút)
 'step': ['buoc_chan_dat', 'buoc_chan'], 'march': ['hanh_quan'], 'armor': ['giap_lach_cach', 'giap'],
 'trot': ['vo_ngua_kieu', 'ngua_trot'], 'gallop': ['ngua_phi', 'ngua_gallop'], 'neigh': ['ngua_hi', 'ngua_neigh'],
 'horn': ['ken_xa', 'ken'], 'crowd': ['dam_dong_la', 'dam_dong'], 'clash': ['kiem_va', 'kiem'], 'throw': ['giao_bay', 'giao'],
 'fall': ['nga_dat', 'nga'], 'dig': ['dao_dat'], 'rubble': ['da_do'], 'quake': ['dong_dat'], 'crow': ['qua'], 'birds': ['chim_sang', 'chim'],
 'water': ['nuoc_vo_bo', 'nuoc'], 'wind': ['gio_nhe', 'gio'], 'fire': ['lua_trai', 'lua'], 'bigfire': ['lua_chay_lon', 'lua'],
 'strain': ['keo_cang'], 'whoosh': ['whoosh'], 'drone': ['nhac_cang_thang', 'nhac_nen'], 'endmusic': ['nhac_ket'], 'hit': ['diem_nhan'], 'paper': ['giay'],
 'pen': ['but'], 'token': ['quan_co'], 'tokens': ['quan_co_lan'], 'mappaper': ['giay_ban_do'],   # H4 tiếng bản đồ
}
_cache = {}
def files(role):
    out = []
    for pre in ROLE[role]:
        out += sorted(f for f in glob.glob(os.path.join(LIB, pre + '*')) if re.match(re.escape(pre) + r'(_\d+)?\.(wav|flac|mp3|ogg|m4a)$', os.path.basename(f), re.I))
        if out: break
    return out
def load(path):
    if path not in _cache:
        try: x, sr = sf.read(path, dtype='float64', always_2d=True)
        except Exception:
            raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
            x, sr = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64), SR
        if sr != SR: x = signal.resample_poly(x, SR, sr, axis=0)
        if x.shape[1] == 1: x = np.repeat(x, 2, 1)
        x = x - x.mean(0); _cache[path] = x / (np.abs(x).max() + 1e-9)
    return _cache[path]
def real(role): return [load(f) for f in files(role)]
def oneshot(role, synth, k=None, dur=None, pitch=0.06):
    """một tiếng ngắn: lấy ngẫu nhiên từ tiếng thật (cắt đoạn có tiếng, đổi cao độ nhẹ cho khỏi lặp), không có thì tổng hợp"""
    rs = real(role)
    if not rs: x = synth(); return np.stack([x, x], 1) if x.ndim == 1 else x
    x = rs[R.integers(len(rs))] if k is None else rs[k % len(rs)]
    d = int((dur or 1.2) * SR)
    if len(x) > d:   # chọn một khúc có năng lượng cao (một cú va / một bước) thay vì lấy từ đầu file
        e = np.convolve(np.abs(x).mean(1), np.ones(2048) / 2048, 'same'); pk = np.argsort(e[: len(x) - d])[-50:]
        i = max(0, int(R.choice(pk)) - int(0.03 * SR)); x = x[i:i + d]
    if pitch: x = signal.resample(x, max(64, int(len(x) * (1 + R.uniform(-pitch, pitch)))), axis=0)
    return x * L.env(len(x), 0.004, min(0.25, len(x) / SR * 0.4))[:, None]
def bed(role, synth, d, seed=0):
    """nền dài d giây: tiếng thật lặp có chồng mép, không có thì tổng hợp"""
    n = int(d * SR); rs = real(role)
    if not rs: x = synth(d); return np.stack([x, x], 1)[:n] if x.ndim == 1 else x[:n]
    longs = [r for r in rs if len(r) >= min(n, 4 * SR)] or rs   # nền chỉ dùng bản ghi DÀI (một tiếng hô đơn lặp lại nghe rất giả)
    src = longs[seed % len(longs)]; out = np.zeros((n, 2)); pos = 0; xf = int(0.5 * SR); rr = np.random.default_rng(seed)
    while pos < n:
        st = int(rr.integers(0, max(1, len(src) - SR * 4))); seg = src[st:st + min(len(src) - st, n - pos + xf)]
        w = np.ones(len(seg)); k = min(xf, len(seg) // 2); w[:k] = np.linspace(0, 1, k); w[-k:] = np.linspace(1, 0, k)
        out[pos:pos + len(seg)] += seg[: n - pos] * w[: n - pos, None]; pos += max(1, len(seg) - xf)
    return out / (np.abs(out).max() + 1e-9)

# ---------- các bus ----------
BUS = {k: np.zeros((N, 2)) for k in ['sfx', 'amb', 'mus']}
def put(bus, x, t, gain=1.0, pan=0.0):
    if x.ndim == 1: x = np.stack([x, x], 1)
    pan = float(np.clip(pan, -1, 1)); g = np.array([np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)]) * 1.414
    i = int(t * SR); j = min(N, i + len(x))
    if i >= N or j <= 0: return
    BUS[bus][max(0, i):j] += x[max(0, -i): j - i] * g * gain
panx = lambda x: float(np.clip((x - 960) / 1100, -0.85, 0.85))
def far(x, h):   # xa: nhỏ + mất cao tần
    if h >= 220: return x
    return signal.sosfilt(signal.butter(2, 900 + 9000 * min(1, h / 220), 'low', fs=SR, output='sos'), x, axis=0)

# ---------- D2: tiếng theo bảng điểm ----------
cues = json.load(open(os.path.join(ROOT, 'build', 'cues.json')))
fires, pens, cams, last_tok = {}, {}, {}, {}
for c in cues:
    t, ty, h = c['t'] / FPS, c['type'], c.get('h', 200) * c.get('z', 1); p = panx(c['x'])
    gsz = float(np.clip(h / 300, 0.15, 1.8))
    if ty in ('step', 'run', 'stop') and h >= 110:
        x = oneshot('step', lambda: L.step(int(R.integers(1e6))), dur=0.35); g = dB(-27 if ty == 'step' else -23 if ty == 'run' else -29) * gsz ** 0.8
        put('sfx', far(x, h), t, g, p)
        if R.random() < 0.3 and ty != 'stop': put('sfx', far(oneshot('armor', lambda: L.jingle(int(R.integers(1e6))), dur=0.4), h), t + 0.02, g * 0.6, p)
    elif ty == 'hoof':
        for dt in (0, 0.11):
            x = oneshot('trot', lambda: L.hooves(0.2, 9, int(R.integers(1e6))), dur=0.25); put('sfx', far(x, h), t + dt, dB(-24) * gsz ** 0.6, p)
    elif ty in ('pose', 'turn') and h >= 150:
        put('sfx', oneshot('armor', lambda: L.jingle(int(R.integers(1e6))), dur=0.5), t, dB(-30 if ty == 'pose' else -33) * gsz ** 0.6, p)
    elif ty == 'clash': put('sfx', oneshot('clash', lambda: L.clang(int(R.integers(1e6))), dur=0.9), t, dB(-21), p)
    elif ty == 'throw': put('sfx', oneshot('throw', lambda: L.whoosh(0.5), dur=0.6), t, dB(-25), p)
    elif ty == 'hit': put('sfx', oneshot('fall', lambda: L.thud(0.4), dur=0.5), t, dB(-24), p)
    elif ty == 'dust': put('sfx', oneshot('fall', lambda: L.thud(0.5), dur=0.6), t, dB(-24) * c.get('s', 1), p)
    elif ty == 'fire': fires.setdefault(c['shot'], []).append((t, c['x'], c.get('s', 1)))
    elif ty in ('tag', 'title'): put('sfx', oneshot('paper', lambda: L.paper(0.45), dur=0.6), t, dB(-25), p * 0.5)
    elif ty == 'brush': put('sfx', oneshot('whoosh', lambda: L.whoosh(0.35), dur=0.45), t, dB(-24), p * 0.5)
    elif ty == 'bubble': put('sfx', L.tick(), t, dB(-24), p)
    elif ty == 'counter':
        for k in range(9): put('sfx', L.tick() * 0.5, t + k * 0.09, dB(-29))
    elif ty == 'whip': put('sfx', oneshot('whoosh', lambda: L.whoosh(0.5), dur=0.6), t - 0.2, dB(-20))
    # H4 — bản đồ: bút cào giấy theo nét đang vẽ, quân cờ gỗ đặt xuống, cả nắm quân dồn vào, giấy sột soạt khi lia
    elif ty == 'pen': pens.setdefault(c['shot'], []).append((c['t'], c.get('k', ''), c.get('p', 0), c['x']))
    elif ty == 'token':
        if t - last_tok.get(c['shot'], -9) >= 0.07:
            last_tok[c['shot']] = t; sz = c.get('s', 1)
            put('sfx', oneshot('token', lambda: L.tick(), dur=0.22, pitch=0.1), t - 0.01, dB(-20) * sz ** 0.7, p * 0.6)
    elif ty == 'scatter': put('sfx', oneshot('tokens', lambda: L.rubble(0.8, 2), dur=1.1, pitch=0.03), t - 0.05, dB(-21) * c.get('s', 1))
    elif ty == 'mapcam': cams.setdefault(c['shot'], []).append((c['t'], c['cx'], c['cy'], c['zz']))
def take(role, d, seed, synth):
    """một khúc LIỀN dài d giây ở chỗ nhiều tiếng nhất của một bản ghi (nét bút liền, không lọt khoảng lặng giữa hai nét)"""
    rs = real(role); n = int(d * SR)
    if not rs: x = synth(d); return np.stack([x, x], 1)[:n] if x.ndim == 1 else x[:n]
    fit = [r for r in rs if len(r) >= n + SR // 5] or [max(rs, key=len)]   # ưu tiên bản ghi đủ dài cho cả nét
    src = fit[seed % len(fit)]
    while len(src) < n + SR: src = np.concatenate([src, src])
    e = np.convolve(np.abs(src).mean(1), np.ones(n) / n, 'valid'); i = int(np.argmax(e[: len(src) - n]))
    return src[i:i + n]
for s, ev in pens.items():   # nét vẽ: chỉ những khung nét đang DÀI RA (nét mờ dần lúc ẩn đi thì im)
    adv, last = {}, {}
    for fr, k, pp, x in sorted(ev):
        if k in last and pp <= last[k]: last[k] = pp; continue
        last[k] = pp; adv.setdefault(fr, []).append(x)
    runs = []
    for fr in sorted(adv):
        if runs and fr - runs[-1][1] <= 2: runs[-1][1] = fr; runs[-1][2] += adv[fr]; runs[-1][3] = max(runs[-1][3], len(adv[fr]))
        else: runs.append([fr, fr, list(adv[fr]), len(adv[fr])])
    for a, b, xs, nmax in runs:
        d = (b - a + 1) / FPS + 0.12
        x = take('pen', d, a, lambda dd: L.scrape(dd)) * L.env(int(d * SR), 0.03, 0.1)[:, None]
        put('sfx', x, a / FPS, dB(-22 + (2 if nmax > 2 else 0)), panx(np.mean(xs)) * 0.7)
for s, ev in cams.items():   # lia bản đồ: tiếng giấy theo tốc độ máy (px màn hình / khung)
    ev = np.array(sorted(ev)); fr = ev[:, 0]
    if len(ev) < 3: continue
    v = np.hypot(np.diff(ev[:, 1]), np.diff(ev[:, 2])) * ev[1:, 3] + np.abs(np.diff(ev[:, 3])) * 900
    k = np.clip((v - 1.5) / 9, 0, 1); k = np.convolve(k, np.ones(9) / 9, 'same')
    a = fr[1] / FPS; d = (fr[-1] - fr[1] + 1) / FPS
    if s in ('S11', 'S16', 'S18'): put('sfx', oneshot('mappaper', lambda: L.paper(0.4), dur=0.5), SPAN[s][0] + 0.02, dB(-25))   # cắt vào bản đồ: lật tờ giấy
    if k.max() < 0.08: continue
    x = bed('mappaper', lambda dd: L.paper(dd), d, seed=int(fr[0]))
    kk = np.interp(np.arange(len(x)) / SR, (fr[1:] - fr[1]) / FPS, k)
    put('sfx', x * kk[:, None], a, dB(-27))
for s, fs_ in fires.items():   # lửa: nền lách tách theo chỗ có lửa trong cảnh
    a, b = SPAN[s]; xm = np.mean([x for _, x, _ in fs_]); big = np.mean([q for _, _, q in fs_]) < 0.3
    x = bed('bigfire' if big else 'fire', lambda d: L.crackle(d, 3), b - a + 0.3, seed=len(s)); x *= L.env(len(x), 0.2, 0.25)[:, None]
    put('amb', x, a, dB(-27 if big else -24), panx(xm))

# ---------- nền không khí từng cảnh ----------
AMB = {   # cảnh: [(vai trò, dB, hàm tổng hợp dự phòng)]
 'S01': [('water', -27, L.water), ('wind', -34, L.wind), ('birds', -36, None)], 'S22': [('water', -26, L.water), ('wind', -33, L.wind), ('birds', -34, None)],
 'S02': [('wind', -32, L.wind), ('march', -22, None)], 'S03': [('wind', -31, L.wind), ('march', -27, None)], 'S04': [('wind', -32, L.wind), ('march', -31, None), ('water', -34, L.water)],
 'S05': [('wind', -31, L.wind)], 'S06': [('wind', -32, L.wind)], 'S07': [('wind', -36, L.wind)], 'S08': [('wind', -31, L.wind), ('march', -32, None)],
 'S09': [('wind', -30, L.wind), ('birds', -33, None)], 'S10': [('wind', -33, L.wind), ('birds', -36, None)],
 'S13': [('wind', -38, L.wind)], 'S14a': [('wind', -35, L.wind)], 'S14b': [('wind', -35, L.wind)], 'S15': [('wind', -35, L.wind)],
 'S16': [('wind', -33, L.wind), ('march', -34, None)], 'S17': [('wind', -31, L.wind), ('march', -33, None)],
 'S19': [('crowd', -24, L.crowd), ('wind', -33, L.wind)], 'S20': [('crowd', -26, L.crowd), ('wind', -33, L.wind)], 'S21': [('wind', -33, L.wind)],
}
for s, layers in AMB.items():
    a, b = SPAN[s]; d = b - a + 0.5
    for k, (role, g, syn) in enumerate(layers):
        if role == 'march': x = bed('march', lambda dd: L.march(dd, 12, seed=7), d, seed=k)
        elif role == 'birds':
            if real('birds'): x = bed('birds', None, d, seed=k)
            else:
                x = np.zeros((int(d * SR), 2))
                for tt in R.uniform(0.3, d - 0.5, 3): x[int(tt * SR): int(tt * SR) + len(L.bird())] += np.stack([L.bird(R.uniform(2700, 3700))] * 2, 1)[: len(x) - int(tt * SR)]
        else: x = bed(role, lambda dd: syn(dd, seed=k) if syn is not L.crowd else syn(dd, k), d, seed=k + len(s))
        x = x[: int(d * SR)] * L.env(min(len(x), int(d * SR)), 0.3, 0.3)[:, None]
        put('amb', x, a - 0.15, dB(g))

# ---------- sự kiện theo lời kể (giữ từ bản cũ, đổi sang tiếng thật nếu có) ----------
E = lambda i, w, n=0: WF(i, w, n)
horn = lambda f0: oneshot('horn', lambda: L.horn(1.8, f0), dur=2.2, pitch=0.03)
put('sfx', horn(220), E('L05', 'trumpet') + 0.15, dB(-17), -0.5); put('sfx', horn(247), E('L06', 'another') + 0.15, dB(-18), 0.6); put('sfx', horn(208), E('L07', 'another') + 0.15, dB(-17), -0.1)
put('sfx', oneshot('crow', lambda: L.bird(3000), dur=1.5), E('L05', 'trumpet') + 0.3, dB(-26), 0.3)
put('sfx', oneshot('hit', lambda: L.boom(3.0, 44), dur=3.0, pitch=0), E('L08', 'fifteen'), dB(-15))
for w, i in [('daring', 'L12'), ('moves', 'L14'), ('cavalry', 'L15')]: put('sfx', oneshot('whoosh', lambda: L.whoosh(0.8), dur=0.9), E(i, w) - 0.1, dB(-25))
put('sfx', oneshot('fall', lambda: L.thud(0.4), dur=0.5), E('L15', 'door') + 0.35, dB(-21))
put('sfx', oneshot('neigh', lambda: L.hooves(0.8, 6, 3), dur=1.6, pitch=0.02), E('L16', 'horse'), dB(-19), 0.1)
put('sfx', oneshot('fall', lambda: L.thud(0.6), dur=0.7), E('L16', 'threw') + 14 / 30, dB(-13), -0.2)
a, b = SPAN['S14b']
for k in range(3): put('sfx', oneshot('strain', lambda: L.creak(1.2), dur=1.3), a + 0.2 + k * 1.05, dB(-24), 0.1)
for k in range(4): put('sfx', oneshot('dig', lambda: L.scrape(0.35), dur=0.5), SPAN['S15'][0] + 40 / 30 + k * 0.42, dB(-25), 0.35)
for k, p in enumerate([-0.6, -0.2, 0.2, 0.6]): put('sfx', horn([220, 233, 247, 262][k]), E('L20', 'trumpets') + k * 0.13, dB(-19), p)
a = E('L20', 'came'); x = bed('crowd', lambda d: L.crowd(d, 5), 4.0, seed=3); put('sfx', x * L.env(len(x), 0.6, 1.2)[:, None], a, dB(-17))
put('sfx', oneshot('hit', lambda: L.boom(2.0, 46), dur=2.5, pitch=0), a, dB(-18))
for k in range(10): put('sfx', oneshot('clash', lambda: L.clang(k), dur=0.8), a + 0.9 + k * 0.28 + R.uniform(0, 0.12), dB(-25), R.uniform(-0.7, 0.7))
put('sfx', oneshot('gallop', lambda: L.hooves(1.6, 4, 9), dur=1.8, pitch=0.02), SPAN['S20'][0], dB(-22))
kc = E('L22', 'cut') + 6 / 30; put('sfx', oneshot('whoosh', lambda: L.whoosh(0.45), dur=0.5), kc - 0.3, dB(-20)); put('sfx', oneshot('hit', lambda: L.boom(2.5, 40), dur=2.5, pitch=0), kc, dB(-15))
put('sfx', oneshot('quake', lambda: L.rumble(3.2), dur=3.4, pitch=0), E('L23', 'earthquake') - 0.05, dB(-11))
put('sfx', oneshot('rubble', lambda: L.rubble(1.8, 5), dur=2.0), E('L23', 'earthquake') + 16 / 30, dB(-19), 0.35)

# ---------- D4: nhạc mỏng ----------
def music(role, a, b, notes, g):
    d = b - a + 1.0; x = bed(role, lambda dd: L.drone(dd, notes), d, seed=int(a)); x *= L.env(len(x), 1.5, 1.5)[:, None]; put('mus', x, a, dB(g))
music('drone', SPAN['S05'][0], SPAN['S07'][0], (55.0, 82.41), -30); music('drone', SPAN['S07'][0], SPAN['S10'][0], (51.9, 77.8), -28)
music('drone', SPAN['S16'][0], SPAN['S21'][0], (55.0, 65.4, 82.41), -29)
music('endmusic' if files('endmusic') else 'drone', SPAN['S22'][0], TOT - 0.5, (65.4, 98.0), -27 if files('endmusic') else -31)

# ---------- không gian: vang theo bối cảnh (gửi sang bus vang, riêng từng cảnh) ----------
SPACE = {'FOGROAD': (1.4, 0.22, 2600), 'LAKEDAWN': (2.2, 0.28, 3200), 'HILLTOP': (0.5, 0.08, 5000), 'TUSCANY': (0.7, 0.1, 4500),
         'ROMANCAMP': (0.9, 0.14, 3500), 'POVHILL': (1.2, 0.18, 3000), 'WIDEROAD': (1.6, 0.2, 2800), 'HILLTOWN': (1.8, 0.2, 3000), 'MAP': (0.4, 0.05, 6000)}
LOCOF = {'S01': 'LAKEDAWN', 'S22': 'LAKEDAWN', 'S04': 'WIDEROAD', 'S08': 'WIDEROAD', 'S09': 'HILLTOP', 'S10': 'TUSCANY', 'S14a': 'ROMANCAMP', 'S14b': 'ROMANCAMP',
         'S15': 'ROMANCAMP', 'S17': 'POVHILL', 'S21': 'HILLTOWN', 'S11': 'MAP', 'S12': 'MAP', 'S13': 'MAP', 'S16': 'MAP', 'S18': 'MAP'}
wet = np.zeros((N, 2))
for s, (a, b) in SPAN.items():
    if s == 'END': continue
    dur, w, damp = SPACE[LOCOF.get(s, 'FOGROAD')]; i0, i1 = int(a * SR), min(N, int(b * SR) + int(0.2 * SR))
    seg = BUS['sfx'][i0:i1]
    for ch in range(2):
        y = L.reverb(seg[:, ch], dur, 1.0, damp)[: N - i0]; wet[i0:i0 + len(y), ch] += y * w
BUS['sfx'] = BUS['sfx'] + wet

# ---------- D5: giọng ----------
vo, vsr = sf.read(os.path.join(ROOT, 'build', 'vo_full.wav'), dtype='float64')
if vo.ndim > 1: vo = vo.mean(1)
vo = signal.resample_poly(vo, SR, vsr); vo = L.hp(vo, 80, 2)
sib = L.bp(vo, 5000, 9000); es = np.sqrt(signal.sosfilt(signal.butter(1, 30, 'low', fs=SR, output='sos'), sib ** 2) + 1e-12)   # khử xì
thr = np.percentile(es, 92); red = np.where(es > thr, (thr / es) ** 0.6, 1.0); vo = vo - sib + sib * red
ev = np.sqrt(signal.sosfilt(signal.butter(1, 12, 'low', fs=SR, output='sos'), vo ** 2) + 1e-12); ref = np.percentile(ev[ev > ev.max() * 0.05], 70)
vo = vo * np.where(ev > ref, (ref / ev) ** (1 - 1 / 3), 1.0)                                                                        # nén 3:1
vo = vo + 0.32 * L.bp(vo, 2500, 5000) + 0.12 * L.lp(vo, 180)                                                                       # sáng + ấm
vo = L.reverb(vo, 0.45, 0.06, 6000)[: len(vo)]; vo = vo / (np.abs(vo).max() + 1e-9) * dB(-3)
V = np.zeros((N, 2)); n = min(N, len(vo)); V[:n] = vo[:n, None]

# ---------- ducking + tổng ----------
vk = np.abs(V[:, 0]); vk = signal.sosfilt(signal.butter(1, 3, 'low', fs=SR, output='sos'), vk); vk = np.clip(vk / (np.percentile(vk, 99) * 0.35 + 1e-9), 0, 1)
mix = V + BUS['sfx'] * (1 - 0.5 * vk)[:, None] + BUS['amb'] * (1 - 0.6 * vk)[:, None] + BUS['mus'] * (1 - 0.7 * vk)[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * dB(-1)
os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
raw = os.path.join(ROOT, 'build', 'mix_raw_v2.wav'); sf.write(raw, mix.astype(np.float32), SR)
for k in BUS: sf.write(os.path.join(ROOT, 'build', f'stem_{k}.wav'), (BUS[k] / (np.abs(BUS[k]).max() + 1e-9) * 0.8).astype(np.float32), SR)
# chuẩn âm lượng 2 lượt: −14 LUFS, đỉnh thật −1 dBTP
st = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = json.loads(st[st.rindex('{'): st.rindex('}') + 1])
af = f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', raw, '-af', af, '-ar', str(SR), os.path.join(ROOT, 'public', 'mix.wav')], check=True)
subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', os.path.join(ROOT, 'public', 'mix.wav'), os.path.join(ROOT, 'build', 'mix.flac')], check=True)
used = {r: len(files(r)) for r in ROLE}
print('tiếng thật:', {r: n for r, n in used.items() if n}, '| tổng hợp:', [r for r, n in used.items() if not n])
print('sự kiện từ bảng điểm:', len(cues), '| ra public/mix.wav, build/mix.flac')
