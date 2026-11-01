"""GIỌNG ĐỌC — chia phần cho ElevenLabs, chuẩn hoá, căn từng chữ, ghép thành một dòng giọng cho cả tập.

ElevenLabs mỗi lần đọc tối đa 5000 ký tự → tập chia PHẦN GIỌNG (P1, P2…) ≤ 4800 ký tự, ranh giới trùng ranh giới khúc.

    python3 tools/giong.py <thư mục tập> --chia
        → giong/phan-giong.json + giong/P1-loi-doc.txt, P2-… (đúng chữ, giữ xuống dòng của kịch bản) để dán vào ElevenLabs.
    python3 tools/giong.py <thư mục tập>
        → đọc giong/P1.mp3, P2.mp3… (đủ hết mới chạy), căn chữ từng phần (pocketsphinx, offline), cắt lặng đầu/cuối,
          nối các phần cách nhau GAP giây → giong/vo-mix.wav (-16 LUFS) + du-lieu/vo-times.json + vo-times-words.json
          (chỉ số câu của CẢ TẬP). dung.py đọc hai file này cho mọi khúc → các khúc liền mạch khi ghép.
Tập không chia phần (demo): giong/vo.mp3 + loi-doc.txt như cũ.
"""
import json, os, re, subprocess, sys

EP = os.path.abspath(sys.argv[1])
HERE = os.path.dirname(os.path.abspath(__file__))
G = os.path.join(EP, 'giong')
DU = os.path.join(EP, 'du-lieu')
os.makedirs(G, exist_ok=True)
os.makedirs(DU, exist_ok=True)
MAXC, GAP, SR = int(sys.argv[sys.argv.index('--max') + 1]) if '--max' in sys.argv else 4800, 0.7, 48000
split = lambda t: [s.strip() for s in re.split(r'(?<=[.?!])"?\s+(?=["A-Z])', t.replace('\n', ' ')) if s.strip()]
txtf = os.path.join(EP, 'loi-doc.txt')
if not os.path.exists(txtf):
    txtf = os.path.join(EP, 'kich-ban.txt')
ORIG = open(txtf, encoding='utf-8').read()
SENT = split(ORIG)


def spans():
    """character span of every sentence in the ORIGINAL text (newlines kept)."""
    norm, out, p = ORIG.replace('\n', ' '), [], 0
    for s in SENT:
        i = norm.find(s, p)
        assert i >= 0, s[:40]
        out.append((i, i + len(s)))
        p = i + len(s)
    return out


if '--chia' in sys.argv:
    B = json.load(open(os.path.join(EP, 'ban-canh.json'), encoding='utf-8'))
    KL = json.load(open(os.path.join(EP, 'khuc.json'), encoding='utf-8'))
    sh = {s['id']: s for s in B['canh']}
    first = lambda a: 0 if a == 0 else int(re.match(r'@s(\d+)', a).group(1))
    ks = [first(sh[k['canh'][0]]['at']) for k in KL] + [len(SENT)]
    sp = spans()
    piece = lambda a, b: ORIG[sp[a][0]:sp[b - 1][1]].strip()
    parts, cur = [], []
    for i in range(len(KL)):
        trial = cur + [i]
        if cur and len(piece(ks[trial[0]], ks[i + 1])) > MAXC:
            parts.append(cur)
            cur = [i]
        else:
            cur = trial
    parts.append(cur)
    PJ = []
    for n, p in enumerate(parts, 1):
        a, b = ks[p[0]], ks[p[-1] + 1]
        t = piece(a, b)
        open(os.path.join(G, f'P{n}-loi-doc.txt'), 'w', encoding='utf-8').write(t + '\n')
        PJ.append({'id': f'P{n}', 'khuc': [KL[i]['id'] for i in p], 'cau': [a, b], 'ky_tu': len(t)})
        print(f"P{n}: {PJ[-1]['khuc'][0]}–{PJ[-1]['khuc'][-1]} · câu {a}–{b - 1} · {len(t)} ký tự")
    json.dump(PJ, open(os.path.join(G, 'phan-giong.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    sys.exit(0)

norm = ['highpass=f=70,acompressor=threshold=-24dB:ratio=2.5:attack=8:release=120:makeup=2,loudnorm=I=-16:TP=-1.5:LRA=7']
pj = os.path.join(G, 'phan-giong.json')
if not os.path.exists(pj):  # single voice file (demo layout)
    vo = os.path.join(G, 'vo.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', vo, '-af', norm[0], '-ar', str(SR), '-ac', '2', os.path.join(G, 'vo-mix.wav')], check=True)
    subprocess.run([sys.executable, os.path.join(HERE, 'fa_vo.py'), vo, txtf, os.path.join(DU, 'vo-times.json')], check=True)
    sys.exit(0)

PJ = json.load(open(pj, encoding='utf-8'))
miss = [p['id'] for p in PJ if not os.path.exists(os.path.join(G, p['id'] + '.mp3'))]
if miss:
    print('Chưa đủ giọng, thiếu:', ', '.join(m + '.mp3' for m in miss))
    sys.exit(1)
TS, WD, segs, t = [], [], [], 0.0
for p in PJ:
    mp3 = os.path.join(G, p['id'] + '.mp3')
    tf = os.path.join(DU, f"{p['id']}-vo-times.json")
    print(f"— {p['id']}")
    if not (os.path.exists(tf) and os.path.getmtime(tf) > os.path.getmtime(mp3)):  # căn rồi thì thôi
        subprocess.run([sys.executable, os.path.join(HERE, 'fa_vo.py'), mp3, os.path.join(G, p['id'] + '-loi-doc.txt'), tf], check=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3],
                               capture_output=True, text=True).stdout)
    ts = json.load(open(tf))
    wd = json.load(open(tf.replace('.json', '-words.json')))
    assert len(ts) == p['cau'][1] - p['cau'][0], f"{p['id']}: số câu căn được {len(ts)} ≠ {p['cau'][1] - p['cau'][0]}"
    a = max(0.0, ts[0][0] - 0.15)          # keep a breath before the first word
    b = min(ts[-1][1] + 0.3, dur)           # and the tail of the last one (never past the end of the file,
                                            # or every later part would drift early against vo-times)
    shift = t - a
    TS += [[round(x + shift, 3), round(y + shift, 3)] for x, y in ts]
    WD += [[w, round(x + shift, 3), round(y + shift, 3), o + p['cau'][0]] for w, x, y, o in wd]
    segs.append((mp3, a, b))
    t += (b - a) + GAP
# one continuous voice track: trimmed parts with GAP of silence between them, then normalised as a whole
inputs, flt = [], []
for i, (mp3, a, b) in enumerate(segs):
    inputs += ['-i', mp3]
    flt.append(f"[{i}:a]atrim={a}:{b},asetpts=PTS-STARTPTS,aresample={SR},afade=t=in:d=0.02,afade=t=out:st={b - a - 0.03}:d=0.03,apad=pad_dur={GAP}[p{i}]")
flt.append(''.join(f'[p{i}]' for i in range(len(segs))) + f"concat=n={len(segs)}:v=0:a=1,{norm[0]}[out]")
subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(flt), '-map', '[out]', '-ar', str(SR), '-ac', '2', os.path.join(G, 'vo-mix.wav')], check=True)
json.dump(TS, open(os.path.join(DU, 'vo-times.json'), 'w'))
json.dump(WD, open(os.path.join(DU, 'vo-times-words.json'), 'w'))
print(f"Giọng cả tập: {len(PJ)} phần · {len(TS)} câu · {t - GAP:.1f} giây → giong/vo-mix.wav")
