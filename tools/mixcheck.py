"""Offline mix of a Film25D cue list (same gain/fade maths as <Cue>) -> wav + loudness report, for QA without rendering frames."""
import json, re, subprocess, sys, numpy as np
src = open(sys.argv[1]).read()
SR = 48000
if sys.argv[1].endswith('.json'):  # du-lieu/am-thanh.json (cả tập)
    props = json.loads(src)
    end = props['end']
else:
    props = json.loads(src[src.index('defaultProps={') + len('defaultProps={'):src.rindex('}\n  />')])
    end = max(s['from'] + s['shot']['duration'] for s in props['scenes'])
mix = np.zeros((int(end * SR) + SR, 2), np.float32)
cache = {}
for c in props['cues']:
    f = c['f'] if '/' in c['f'] else f"assets/sfx/mix/{c['f']}.wav"
    if f not in cache:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'public/' + f, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
        cache[f] = np.frombuffer(raw, np.float32).reshape(-1, 2)
    o = int(c.get('off', 0) * SR)
    x = cache[f][o:o + int(c['len'] * SR)]
    t = np.arange(len(x)) / SR
    T, L = t + c.get('e0', 0), c.get('elen', c['len'])
    v = c['g'] * np.minimum(1, np.minimum(T / max(0.001, c.get('fi', 0.02)), (L - T) / max(0.001, c.get('fo', 0.05))))
    if c.get('duck'):
        d0, d1, lv = c['duck']
        v = v * np.interp(c['at'] + t, [d0 - 0.8, d0, d1, d1 + 0.8], [1, lv, lv, 1])
    v = np.clip(v, 0, 1)
    a = int(c['at'] * SR)
    n = min(len(x), len(mix) - a)
    mix[a:a + n] += x[:n] * v[:n, None]
out = sys.argv[2]
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', out], input=mix.tobytes())
print('peak dBFS', round(20 * np.log10(np.abs(mix).max() + 1e-9), 1))
