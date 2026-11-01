"""CHIA KHÚC — đề xuất cách chia một tập thành các khúc 20–60 s (Cậu Cả chốt 25/10: nhẹ máy, dễ xem/duyệt/sửa trong Studio).

    python3 tools/dung/chia_khuc.py <thư mục tập> [--min 20 --max 60 --dich 40]

Đọc ban-canh.json + du-lieu/timeline.json (chạy dung.py cả tập trước để có thời gian, thật hoặc ước tính).
Ranh giới khúc chỉ đặt ở cảnh bắt đầu ĐÚNG đầu câu (`@sN`) — để giọng đọc từng khúc trọn câu.
Ưu tiên cắt ở chỗ đổi đoạn (chữ cái đầu mã cảnh đổi: W→A, A→K…), độ dài gần --dich.
Ghi khuc.json (giữ nguyên "am-thanh" của khúc nào đã có) + khuc.md để duyệt.
"""
import json, os, re, sys

EP = os.path.abspath(sys.argv[1])
arg = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
MIN, MAX, AIM = arg('--min', 20), arg('--max', 60), arg('--dich', 40)
B = json.load(open(os.path.join(EP, 'ban-canh.json'), encoding='utf-8'))
T = json.load(open(os.path.join(EP, 'du-lieu', 'timeline.json')))
shots = B['canh']
t = dict(T['cuts'])
END = T['end']
sec = lambda sid: re.match(r'[A-Z]+', sid).group(0)
cand = [i for i, s in enumerate(shots) if s['at'] == 0 or re.fullmatch(r'@s\d+', str(s['at']))]
assert cand[0] == 0
pos = cand + [len(shots)]
tt = lambda i: t[shots[i]['id']] if i < len(shots) else END
INF = float('inf')
best = {0: (0.0, None)}
for j in pos[1:]:
    for i in pos:
        if i >= j or i not in best:
            continue
        L = tt(j) - tt(i)
        if L > MAX * 1.35:
            continue
        cost = ((L - AIM) / 10) ** 2 + (25 if L < MIN else 0) + (40 if L > MAX else 0)
        if j < len(shots) and sec(shots[j]['id']) == sec(shots[j - 1]['id']):
            cost += 3  # cutting inside a section costs a little
        if j < len(shots) and shots[j].get('dissolve'):
            cost -= 1  # a dissolve is a natural join (becomes a short dip)
        c = best[i][0] + cost
        if j not in best or c < best[j][0]:
            best[j] = (c, i)
cuts, j = [], len(shots)
while j:
    i = best[j][1]
    cuts.append((i, j))
    j = i
cuts.reverse()
old = {}
kf = os.path.join(EP, 'khuc.json')
if os.path.exists(kf):
    old = {k['id']: k for k in json.load(open(kf, encoding='utf-8'))}
K = []
for n, (i, j) in enumerate(cuts, 1):
    kid = f'K{n:02d}'
    ids = [s['id'] for s in shots[i:j]]
    k = {'id': kid, 'canh': ids}
    if kid in old and old[kid]['canh'] == ids and old[kid].get('am-thanh'):
        k['am-thanh'] = old[kid]['am-thanh']
    K.append(k)
json.dump(K, open(kf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
md = [f"# Chia khúc — {B.get('ten', '')}", '', f"{len(K)} khúc · mỗi khúc {MIN:.0f}–{MAX:.0f} s (thời gian {T['src']}).", '',
      '| khúc | lúc | dài | cảnh | câu | mở đầu |', '| --- | --- | --- | --- | --- | --- |']
for k, (i, j) in zip(K, cuts):
    s0 = 0 if shots[i]['at'] == 0 else int(str(shots[i]['at'])[2:])
    s1 = (int(str(shots[j]['at'])[2:]) - 1) if j < len(shots) else '…'
    md.append(f"| {k['id']} | {int(tt(i) // 60)}:{tt(i) % 60:04.1f} | {tt(j) - tt(i):.0f}s | {k['canh'][0]}–{k['canh'][-1]} ({len(k['canh'])}) | {s0}–{s1} | {shots[i].get('hinh', '')[:50]} |")
open(os.path.join(EP, 'khuc.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
print('\n'.join(md[2:3]))
print(' '.join(f"{k['id']}:{tt(i2) - tt(i1):.0f}s" for k, (i1, i2) in zip(K, cuts)))
