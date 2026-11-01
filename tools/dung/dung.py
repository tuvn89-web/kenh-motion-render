"""BỘ DỰNG CHUNG — bảng cảnh (ban-canh.json) + giọng đã căn chữ -> composition Remotion + bảng cảnh .md để duyệt.

    python3 tools/dung/dung.py <thư mục tập>            (chạy từ gốc project)

Có khuc.json (tools/dung/chia_khuc.py) → mỗi KHÚC là một composition riêng (T02-K01…), là một CỬA SỔ cắt từ cùng một
dòng thời gian của cả tập: giọng, nhạc nền, tiếng động liền một mạch qua ranh giới khúc (âm thanh cắt bằng `off`),
nên ghép các khúc (job "ghep" của trạm) ra đúng như dựng một mạch. Giọng: giong/vo-mix.wav + du-lieu/vo-times*.json
do tools/giong.py ghép từ các phần giọng ≤ 5000 ký tự (giong/P1.mp3, P2.mp3…).

Thư mục tập chứa: ban-canh.json, loi-doc.txt (đúng chữ đã đọc), du-lieu/vo-times.json + vo-times-words.json
(do tools/fa_vo.py tạo). Thiếu giọng thì ước tính thời gian để duyệt nhịp trước.

MỐC THỜI GIAN (anchor) — chuỗi bắt đầu bằng '@', dùng được ở mọi chỗ trong bảng cảnh:
    @s6            đầu câu 6 (đếm từ 0)          @s6.end        cuối câu 6
    @s6.w3         đầu từ thứ 3 của câu 6        @s6:six        đầu từ đầu tiên của câu 6 bắt đầu bằng "six"
    @s6:six.end    cuối từ đó                     … thêm +0.3 / -0.2 để lệch giây
  Trong một cảnh, mốc được đổi thành giây TÍNH TỪ ĐẦU CẢNH (camera, đồ hoạ). Ở 'at' của cảnh và ở âm thanh: giây tuyệt đối.
"""
import json, os, re, sys, math

sys.path.insert(0, os.path.dirname(__file__))
from camera_lib import PRESETS, clamp_keys  # noqa: E402

EP = os.path.abspath(sys.argv[1])
PROJ = os.path.abspath(os.getcwd())
B = json.load(open(os.path.join(EP, 'ban-canh.json'), encoding='utf-8'))
TEXT = open(os.path.join(EP, B.get('loi_doc', 'loi-doc.txt')), encoding='utf-8').read()
SENT = [s.strip() for s in re.split(r'(?<=[.?!])"?\s+(?=["A-Z])', TEXT.replace('\n', ' ')) if s.strip()]
LEAD = B.get('lead', 0.6)
TAIL = B.get('tail', 3.0)
DU = os.path.join(EP, 'du-lieu')

# ---------------------------------------------------------------- timing
tf = os.path.join(DU, 'vo-times.json')
wf = os.path.join(DU, 'vo-times-words.json')
clean = lambda w: [x.strip("'") for x in re.sub(r"[^a-z' ]", '', w.lower().replace('-', ' ')).split() if x.strip("'")]  # = tools/fa_vo.py
if os.path.exists(tf) and os.path.exists(wf):
    TS = [[a + LEAD, b + LEAD] for a, b in json.load(open(tf))]
    AL = [[w, a + LEAD, b + LEAD, o] for w, a, b, o in json.load(open(wf))]
    SRC = 'giọng thật (căn từng chữ)'
else:
    TS, AL, t = [], None, LEAD
    for i, s in enumerate(SENT):
        d = len(s.split()) / 3.1
        TS.append([round(t, 2), round(t + d, 2)])
        t += d + 0.4
    SRC = 'ƯỚC TÍNH (chưa có giọng)'
assert len(TS) == len(SENT), (len(TS), len(SENT))

WT = []  # per sentence: list of (word as written, start, end)
for si, s in enumerate(SENT):
    words = s.split()
    if AL:
        toks = [w for w in AL if w[3] == si]
        out, k = [], 0
        for w in words:
            n = len(clean(w))
            if n == 0:  # pure symbols/digits: not spoken as a token — glue to the previous word's time
                t_ = out[-1][2] if out else toks[min(k, len(toks) - 1)][1]
                out.append((w, t_, t_))
                continue
            seg = toks[min(k, len(toks) - 1):min(k + n, len(toks))] or [toks[-1]]
            out.append((w, seg[0][1], seg[-1][2]))
            k += n
        WT.append(out)
    else:
        a, b = TS[si]
        tot = sum(len(w) + 1 for w in words)
        acc, out = 0, []
        for w in words:
            s0 = a + (b - a) * acc / tot
            acc += len(w) + 1
            out.append((w, s0, a + (b - a) * acc / tot))
        WT.append(out)
END = TS[-1][1] + TAIL


def anchor(x):
    m = re.fullmatch(r'@s(\d+)(?:\.w(\d+)|:([\w$\'-]+))?(\.end)?([+-][0-9.]+)?', x.replace(' ', ''))
    if not m:
        raise ValueError('mốc sai: ' + x)
    si = int(m.group(1))
    if m.group(2) is not None:
        w = WT[si][int(m.group(2))]
        t = w[2] if m.group(4) else w[1]
    elif m.group(3):
        key = m.group(3).lower()
        hit = next((w for w in WT[si] if re.sub(r"[^a-z0-9$']", '', w[0].lower()).startswith(key)), None)
        if not hit:
            raise ValueError(f'không thấy từ "{key}" trong câu {si}: {SENT[si]}')
        t = hit[2] if m.group(4) else hit[1]
    else:
        t = TS[si][1] if m.group(4) else TS[si][0]
    return round(t + float(m.group(5) or 0), 3)


def resolve(v, base=0.0):
    if isinstance(v, str) and v.startswith('='):  # phép tính trên mốc, vd "=(@s11.w13 - @s11 - 0.4)/11" (giây tuyệt đối)
        expr = re.sub(r'@s\d+(?:\.w\d+|:[\w$\'-]+)?(?:\.end)?', lambda m: str(anchor(m.group(0))), v[1:])
        return round(eval(expr, {'__builtins__': {}}), 3)
    if isinstance(v, str) and v.startswith('@'):
        return round(anchor(v) - base, 3)
    if isinstance(v, list):
        return [resolve(x, base) for x in v]
    if isinstance(v, dict):
        return {k: resolve(x, base) for k, x in v.items()}
    return v


# ---------------------------------------------------------------- shots -> scenes
CANVAS = B.get('canvas', [1376, 768])
shots = B['canh']
starts = [resolve(s['at']) for s in shots]
scenes = []
for i, sh in enumerate(shots):
    t0 = starts[i]
    t1 = starts[i + 1] if i + 1 < len(shots) else END
    nd = shots[i + 1].get('dissolve', 0) if i + 1 < len(shots) else 0
    dur = round(t1 - t0 + nd, 3)
    canvas = sh.get('canvas', CANVAS)
    layers = []
    for L in sh['lop']:
        d = {k: resolve(v, t0) for k, v in L.items() if k not in ('anh',)}
        d['name'] = d.pop('ten', L.get('anh') or 'code')
        d['file'] = L.get('anh', '')
        d['z'] = L.get('z', 0)
        if 'fx' in d:
            d['fx'] = [({'type': 'paper'} if f == 'paper' else f) for f in d['fx']]
        layers.append(d)
    cam = resolve(sh.get('may', {'kieu': 'lang'}), t0)
    kieu = cam.pop('kieu', 'lang')
    if kieu == 'keo':
        keys, hh, share = cam['keys'], cam.get('handheld', 0.5), cam.get('share', 0.35)
    else:
        keys, hh, share = PRESETS[kieu](dur, canvas, **cam)
    ov = sh.get('overscan', 1.12)
    if canvas != [1920, 1080]:
        clamp_keys(keys, canvas, ov, sh['id'])
    scenes.append({'name': sh['id'], 'from': round(t0, 3), 'canvas': canvas, 'overscan': ov, 'dissolve': sh.get('dissolve', 0),
                   'layers': layers, 'shot': {'duration': dur, 'camera': keys, 'handheld': hh, 'dollyShare': share}})

# ---------------------------------------------------------------- sanity: order + very short shots
for a, b in zip(scenes, scenes[1:]):
    if b['from'] <= a['from']:
        print(f"  LỖI THỨ TỰ: {b['name']} ({b['from']:.2f}s) bắt đầu trước/ngay khi {a['name']} ({a['from']:.2f}s)")
for sc in scenes:
    if sc['shot']['duration'] < 1.0:
        print(f"  cảnh ngắn: {sc['name']} chỉ {sc['shot']['duration']:.2f}s")

# ---------------------------------------------------------------- sound
sd = {s['name']: s for s in scenes}


def cue(f, a, ln, g, fi=0.05, fo=0.1, off=0, duck=None):
    c = {'f': f, 'at': round(a, 2), 'len': round(ln, 2), 'g': g, 'fi': fi, 'fo': fo}
    if off:
        c['off'] = round(off, 2)
    if duck:  # [từ, đến, mức] giây tuyệt đối trên dòng thời gian cả tập
        c['duck'] = duck
    return c


CUES = []
if AL:
    CUES.append(cue(B.get('giong', f"kits/{B['kit']}/vo-mix.wav"), LEAD, END - LEAD, 1, 0.01, 0.05))
for c in B.get('am-thanh', []):
    g, fi, fo = c.get('g', 0.6), c.get('fi', 0.05), c.get('fo', 0.1)
    if 'canh' in c:  # bed under these shots
        for n in c['canh']:
            s = sd[n]
            CUES.append(cue(c['f'], s['from'], s['shot']['duration'], g, fi, fo))
    elif 'phone_pops' in c:  # one pop per monthly photo (same schedule as PhoneThread in src/ac/fx.tsx)
        s = sd[c['phone_pops']]
        p = next(f for L in s['layers'] for f in L.get('fx', []) if f['type'] == 'phone')['p']
        ds = [max(0.36, 1.15 * 0.74 ** i) for i in range(9)]
        k = p['fill'] / sum(ds)
        tt = 0.15
        for i, d in enumerate(ds):
            CUES.append(cue(c['f'], s['from'] + tt + d * k * 0.18, c.get('len', 0.65), round(g - i * 0.05, 2)))
            tt += d * k
    else:
        a = resolve(c['at'])
        if c.get('den') == 'END':
            ln = END - a
        else:
            ln = resolve(c['den']) - a if 'den' in c else c.get('len', 1.5)
        dk = [resolve(x) for x in c['duck'][:2]] + [c['duck'][2]] if c.get('duck') else None
        CUES.append(cue(c['f'], a, ln, g, fi, fo, c.get('off', 0), dk))
CUES = [c for c in CUES if c['len'] > 0.05]

# ---------------------------------------------------------------- subtitles (always prepared; switched on/off in Studio)
SUBS = [[w, round(a, 3), round(b, 3)] for sent in WT for (w, a, b) in sent]

comp = B['comp']
os.makedirs(os.path.join(PROJ, 'src', 'tap'), exist_ok=True)


def write_comp(comp, props, end):
    fn = re.sub(r'[^A-Za-z0-9]', '', comp)
    open(os.path.join(PROJ, 'src', 'tap', f'{fn}.tsx'), 'w', encoding='utf-8').write(f"""// {B.get('ten', comp)} — CHỈNH TRONG REMOTION STUDIO (khung bên phải, rồi Save). Dựng bởi tools/dung/dung.py ({SRC}).
import React from 'react';
import {{Composition}} from 'remotion';
import {{Film25D, filmMetadata}} from '../showcase/Film25D';
import {{filmSchema}} from '../edit/schema';

export const {fn}: React.FC = () => (
  <Composition id="{comp}" component={{Film25D}} schema={{filmSchema}} calculateMetadata={{filmMetadata}}
    durationInFrames={{{max(1, round(end * 30))}}} fps={{30}} width={{1920}} height={{1080}}
    defaultProps={{{json.dumps(props, ensure_ascii=False)}}}
  />
);
""")


def window(t0, t1, first, last, next_dissolve, names=None):
    """Scenes/cues/subtitles inside [t0, t1) of the whole-episode timeline, shifted to start at 0.
    t0/t1 are whole frames (k/30 s) so the chunks laid end to end are frame-exact against the one audio track."""
    sc = []
    for x in scenes:
        if (x['name'] in names) if names else (t0 - 1e-6 <= x['from'] < t1 - 1e-6):
            y = json.loads(json.dumps(x))
            a = max(x['from'], t0)
            y['from'] = round(a - t0, 3)
            y['shot']['duration'] = round(min(x['from'] + x['shot']['duration'], t1) - a, 3)  # no overlap into the next chunk
            sc.append(y)
    if not first and sc and sc[0]['dissolve']:
        sc[0]['dissolve'] = round(sc[0]['dissolve'] / 2, 2)  # a dissolve across the join becomes a short dip through black
    cu = []
    for c in CUES:
        a, b = c['at'], c['at'] + c['len']
        if b <= t0 or a >= t1:
            continue
        y = dict(c)
        y['at'] = round(max(a, t0) - t0, 3)
        y['len'] = round(min(b, t1) - max(a, t0), 3)
        if a < t0 or b > t1:  # clipped by the window: keep the cue's own fade envelope (Cue e0/elen)
            y['e0'] = round(max(0, t0 - a) + c.get('e0', 0), 3)
            y['elen'] = c.get('elen', c['len'])
        if a < t0:
            y['off'] = round(c.get('off', 0) + t0 - a, 3)
        if 'duck' in y:
            y['duck'] = [round(y['duck'][0] - t0, 3), round(y['duck'][1] - t0, 3), y['duck'][2]]
        cu.append(y)
    su = [[w, round(a - t0, 3), round(b - t0, 3)] for w, a, b in SUBS if t0 <= a < t1]
    p = {'kit': B['kit'], 'guides': False, 'dissolve': 0, 'scenes': sc, 'captions': [], 'cues': cu,
         'subs': {'on': bool(B.get('phu_de', False)), 'words': su}, 'fadeOut': 1.2 if last else round((next_dissolve or 0) / 2, 2)}
    return p, t1 - t0


KF = os.path.join(EP, 'khuc.json')
props = {'kit': B['kit'], 'guides': False, 'dissolve': 0, 'scenes': scenes, 'captions': [], 'cues': CUES,
         'subs': {'on': bool(B.get('phu_de', False)), 'words': SUBS}}
if os.path.exists(KF):
    KL = json.load(open(KF, encoding='utf-8'))
    st = {s['name']: s['from'] for s in scenes}
    dis = {s['name']: s['dissolve'] for s in scenes}
    bounds = [st[k['canh'][0]] for k in KL] + [END]
    fb = [0] + [round(b * 30) for b in bounds[1:]]  # chunk edges on whole frames
    for i, k in enumerate(KL):
        assert [s['name'] for s in scenes if bounds[i] - 1e-6 <= s['from'] < bounds[i + 1] - 1e-6] == k['canh'], f"khuc.json lệch bảng cảnh ở {k['id']} — chạy lại chia_khuc.py"
        nd = dis[KL[i + 1]['canh'][0]] if i + 1 < len(KL) else None
        p, d = window(fb[i] / 30, fb[i + 1] / 30, i == 0, i + 1 == len(KL), nd, set(k['canh']))
        write_comp(f"{comp}-{k['id']}", p, d)
    # one audio track for the whole episode — rendered once (codec wav) and laid under the joined chunks: no seams
    am = {'cues': CUES}
    open(os.path.join(PROJ, 'src', 'tap', re.sub(r'[^A-Za-z0-9]', '', comp) + 'AM.tsx'), 'w', encoding='utf-8').write(f"""// {B.get('ten', comp)} — TIẾNG cả tập (giọng + nhạc + hiệu ứng) trên một dòng thời gian. Dựng bởi tools/dung/dung.py.
// Trạm render riêng thành .wav rồi lót dưới các khúc đã ghép (job ghep "audio") → chỗ nối các khúc không có vết.
import React from 'react';
import {{Composition}} from 'remotion';
import {{AudioTrack}} from '../showcase/AudioTrack';

export const {re.sub(r'[^A-Za-z0-9]', '', comp)}AM: React.FC = () => (
  <Composition
    id="{comp}-AM"
    component={{AudioTrack}}
    durationInFrames={{{fb[-1]}}} fps={{30}} width={{640}} height={{360}}
    defaultProps={{{json.dumps(am, ensure_ascii=False)}}}
  />
);
""")
    old = os.path.join(PROJ, 'src', 'tap', re.sub(r'[^A-Za-z0-9]', '', comp) + '.tsx')
    if os.path.exists(old):
        os.remove(old)  # the whole episode is only reviewed as chunks
    print(f"  {len(KL)} khúc → src/tap/{re.sub(r'[^A-Za-z0-9]', '', comp)}K01.tsx …")
else:
    write_comp(comp, props, END)
# registry of every episode composition
tsx = sorted(f[:-4] for f in os.listdir(os.path.join(PROJ, 'src', 'tap')) if f.endswith('.tsx') and f != 'index.tsx')
open(os.path.join(PROJ, 'src', 'tap', 'index.tsx'), 'w').write(
    "// Tự sinh bởi tools/dung/dung.py — mọi tập đã dựng.\nimport React from 'react';\n"
    + ''.join(f"import {{{n}}} from './{n}';\n" for n in tsx)
    + "\nexport const Episodes: React.FC = () => (\n  <>\n" + ''.join(f"    <{n} />\n" for n in tsx) + "  </>\n);\n")

# ---------------------------------------------------------------- bảng cảnh .md (để duyệt)
def loi(t0, t1):
    ws = [w for s in WT for w in s if t0 - 0.05 <= w[1] < t1 - 0.05]
    txt = ' '.join(w[0] for w in ws)
    return txt if len(txt) < 140 else txt[:66] + ' … ' + txt[-60:]


md = [f"# Bảng cảnh — {B.get('ten', comp)}", '',
      f"Thời gian: {SRC} · dài {END:.1f} giây · {len(scenes)} cảnh · cảnh dài trung vị {sorted(s['shot']['duration'] for s in scenes)[len(scenes) // 2]:.1f} giây.", '',
      '| # | lúc | lời | hình | ảnh | đồ hoạ | máy · cảm xúc | vào cảnh |', '| --- | --- | --- | --- | --- | --- | --- | --- |']
for i, (sh, sc) in enumerate(zip(shots, scenes)):
    t0 = sc['from']
    t1 = t0 + sc['shot']['duration'] - (scenes[i + 1]['dissolve'] if i + 1 < len(scenes) else 0)
    anh = ' + '.join(f"`{L['anh']}`" for L in sh['lop'] if L.get('anh')) or 'code'
    md.append(f"| {i + 1} · {sh['id']} | {int(t0 // 60)}:{t0 % 60:04.1f} ({t1 - t0:.1f}s) | {loi(t0, t1)} | {sh.get('hinh', '')} | {anh} | {sh.get('do_hoa', '—')} | "
              f"**{sh.get('may', {}).get('kieu', 'lang')}** · {sh.get('cam_xuc', '')} | {'hoà ' + str(sh['dissolve']) + 's' if sh.get('dissolve') else 'cắt'} |")
open(os.path.join(EP, 'ban-canh.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
json.dump({'src': SRC, 'end': END, 'cuts': [[s['name'], s['from']] for s in scenes]}, open(os.path.join(DU, 'timeline.json'), 'w'), indent=1)
json.dump({'end': END, 'cues': CUES}, open(os.path.join(DU, 'am-thanh.json'), 'w'), indent=0)  # cả tập, để soát âm thanh (tools/mixcheck.py)
print(f"{comp}: {SRC} · {END:.1f}s · {len(scenes)} cảnh · {len(CUES)} âm thanh · phụ đề {'BẬT' if props['subs']['on'] else 'tắt'}")
