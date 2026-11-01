"""PHỤ ĐỀ (H3, 29/10/2026): xuất .srt từ src/timeline.json (mốc thời gian từng chữ của giọng đọc) để tải lên YouTube cùng video.
Dùng: python tools/phu_de.py [tên ra]   → out/<tên>.srt (mặc định T01.srt)
- Mỗi câu kịch bản chia thành khối ≤ 2 dòng × 42 ký tự, ≤ 6 giây; ngắt ưu tiên ở dấu câu, rồi ở chỗ gần giữa.
- Khối bắt đầu đúng lúc chữ đầu tiên được đọc, giữ thêm 0,4 s sau chữ cuối (không chồng khối sau).
"""
import os, re, sys, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))
MAXC, MAXL, MAXD, HOLD = 42, 2, 6.0, 0.4

def tokens_with_time(line):
    toks = line['text'].split(); ws = line['words']
    if len(toks) == len(ws): return [(t, w['t']) for t, w in zip(toks, ws)]
    # số chữ lệch (vd số viết liền) → chia theo độ dài ký tự trong khoảng của câu
    a, b = line['start'], line['end']; tot = sum(len(t) for t in toks); acc = 0; out = []
    for t in toks: out.append((t, a + (b - a) * acc / tot)); acc += len(t)
    return out

def wrap(words):
    """chia một khối thành ≤ 2 dòng cân nhau"""
    s = ' '.join(words)
    if len(s) <= MAXC: return [s]
    best = None
    for i in range(1, len(words)):
        l1, l2 = ' '.join(words[:i]), ' '.join(words[i:])
        if len(l1) <= MAXC and len(l2) <= MAXC:
            sc = abs(len(l1) - len(l2)) - (8 if re.search(r'[,;:]$', words[i - 1]) else 0)
            if best is None or sc < best[0]: best = (sc, [l1, l2])
    return best[1] if best else [s]

cues = []
for li, line in enumerate(T['lines']):
    tw = tokens_with_time(line); i = 0
    while i < len(tw):
        j = i + 1
        while j < len(tw):   # nới khối tới khi quá 2 dòng / quá 6 s
            cand = [t for t, _ in tw[i:j + 1]]
            if len(' '.join(cand)) > MAXC * MAXL - 4 or tw[j][1] - tw[i][1] > MAXD: break
            j += 1
        # lùi về dấu câu gần nhất nếu khối bị cắt giữa câu
        if j < len(tw):
            for k in range(j - 1, i, -1):
                if re.search(r'[,;:.!?…]$', tw[k][0]): j = k + 1; break
        words = [t for t, _ in tw[i:j]]
        start = tw[i][1]; end = (tw[j][1] if j < len(tw) else line['end'] + HOLD)
        cues.append([start, end, wrap(words)]); i = j
for a, b in zip(cues, cues[1:]): a[1] = min(a[1], b[0] - 0.04)
ts = lambda x: f"{int(x // 3600):02d}:{int(x % 3600 // 60):02d}:{int(x % 60):02d},{int(round((x % 1) * 1000)) % 1000:03d}"
name = sys.argv[1] if len(sys.argv) > 1 else 'T01'
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
out = os.path.join(ROOT, 'out', name + '.srt')
open(out, 'w', encoding='utf-8').write('\n'.join(f"{k + 1}\n{ts(a)} --> {ts(b)}\n" + '\n'.join(lines) + '\n' for k, (a, b, lines) in enumerate(cues)))
print(len(cues), 'khối phụ đề →', out)
