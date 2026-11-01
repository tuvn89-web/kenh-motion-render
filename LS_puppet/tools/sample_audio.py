"""Âm thanh cho mẫu 15 s: cắt từ public/mix.wav + thêm bước chân hành quân tới lúc dừng."""
import os, numpy as np, soundfile as sf
from scipy import signal
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
T0, DUR, STOP = 756 / 30, 15.0, (59 + 4) / 30   # STOP = giây (tính từ đầu mẫu) lúc hàng quân dừng khi kèn vang
x, sr = sf.read(ROOT + 'public/mix.wav', dtype='float64')
seg = x[int(T0 * sr): int((T0 + DUR) * sr)].copy()
rng = np.random.default_rng(3)
def bp(v, lo, hi): return signal.sosfilt(signal.butter(2, [lo, hi], 'band', fs=sr, output='sos'), v)
def step(g):
    n = int(0.12 * sr); s = bp(rng.standard_normal(n), 80, 700) * np.exp(-np.linspace(0, 9, n))
    s += 0.35 * bp(rng.standard_normal(n), 1800, 5000) * np.exp(-np.linspace(0, 14, n)); return s * g
steps = np.zeros(len(seg))
for m in range(8):
    t = rng.uniform(0, 0.47); g = rng.uniform(0.5, 1.0)
    while t < STOP - 0.05:
        s = step(g); i = int(t * sr); steps[i:i + len(s)] += s[:len(steps) - i]; t += 0.466 + rng.normal(0, 0.01)
steps *= 10 ** (-24 / 20) / max(1e-9, np.abs(steps).max()) * 3
seg += np.stack([steps, steps], 1)
fade = int(0.5 * sr); seg[-fade:] *= np.linspace(1, 0, fade)[:, None]
seg *= 10 ** (-1 / 20) / max(1.0, np.abs(seg).max() / 10 ** (-1 / 20)) if np.abs(seg).max() > 10 ** (-1 / 20) else 1
sf.write(ROOT + 'public/sample15.wav', seg.astype(np.float32), sr)
print('ok', len(seg) / sr)
