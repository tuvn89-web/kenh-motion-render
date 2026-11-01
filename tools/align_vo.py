"""Sentence timings for the VO from silence gaps: choose sentence boundaries among the pauses (DP),
expected positions proportional to sentence length (characters), longer pauses preferred."""
import subprocess, re, json, sys
VO = sys.argv[1]; TXT = sys.argv[2]; OUT = sys.argv[3]
text = open(TXT).read().replace('\n', ' ')
SENT = [s.strip() for s in re.split(r'(?<=[.?!])"?\s+(?=["A-Z])', text) if s.strip()]
log = subprocess.run(['ffmpeg', '-hide_banner', '-i', VO, '-af', 'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-'], capture_output=True, text=True).stderr
st = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', log)]
en = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', log)]
dur = float(re.search(r'Duration: (\d+):(\d+):([0-9.]+)', log).group(3)) + 60 * int(re.search(r'Duration: (\d+):(\d+)', log).group(2))
gaps = [(a, b) for a, b in zip(st, en)]
# speech start/end
first = gaps[0][1] if gaps and gaps[0][0] < 0.05 else 0.0
if gaps and gaps[0][0] < 0.05: gaps = gaps[1:]
last = gaps[-1][0] if gaps and gaps[-1][1] >= dur - 0.05 else dur
if gaps and gaps[-1][1] >= dur - 0.05: gaps = gaps[:-1]
L = [len(s) + 12 for s in SENT]  # +12: a sentence end costs a little time on its own
tot = sum(L)
exp = []
c = 0
for l in L[:-1]:
    c += l
    exp.append(first + (last - first) * c / tot)
n, m = len(exp), len(gaps)
INF = 1e18
dp = [[INF] * (m + 1) for _ in range(n + 1)]
bk = [[-1] * (m + 1) for _ in range(n + 1)]
for j in range(m + 1): dp[0][j] = 0
for i in range(1, n + 1):
    for j in range(i, m + 1):
        g = gaps[j - 1]
        mid = (g[0] + g[1]) / 2
        cost = (mid - exp[i - 1]) ** 2 - 6.0 * (g[1] - g[0])
        best = min(range(i - 1, j), key=lambda k: dp[i - 1][k])
        dp[i][j] = dp[i - 1][best] + cost
        bk[i][j] = best
j = min(range(n, m + 1), key=lambda k: dp[n][k])
chosen = []
for i in range(n, 0, -1):
    chosen.append(j - 1)
    j = bk[i][j]
chosen.reverse()
TS = []
a = first
for gi in chosen:
    TS.append([round(a, 3), round(gaps[gi][0], 3)])
    a = gaps[gi][1]
TS.append([round(a, 3), round(last, 3)])
json.dump(TS, open(OUT, 'w'))
for (x, y), s in zip(TS, SENT):
    print(f'{x:6.2f} {y:6.2f}  {len(s.split()) / (y - x):4.1f} w/s  {s[:60]}')
