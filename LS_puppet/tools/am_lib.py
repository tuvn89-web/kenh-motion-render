"""Thư viện tiếng tổng hợp bằng code (rút từ sfx.py) — dùng làm tiếng dự phòng khi chưa có file tiếng thật."""
import numpy as np
from scipy import signal
SR = 48000
rng = np.random.default_rng(1)
def put(bus, x, t, gain=1.0, pan=0.0):
    N = len(bus)
    if x.ndim == 1: x = np.stack([x * np.sqrt(0.5 * (1 - pan)), x * np.sqrt(0.5 * (1 + pan))], 1) * 1.414
    i = int(t * SR); j = min(N, i + len(x))
    if i >= N or j <= 0: return
    bus[max(0, i):j] += x[max(0, -i):j - i] * gain
def env(n, a=0.005, r=0.1):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def bp(x, lo, hi, o=2): return signal.sosfilt(signal.butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'high', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))
def norm(x, peak=1.0): m = np.max(np.abs(x)) + 1e-9; return x / m * peak
def reverb(x, dur=1.8, wet=0.35, damp=3000):
    n = int(dur * SR); ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n)); ir = lp(ir, damp); ir /= np.sqrt(np.sum(ir ** 2))
    y = signal.fftconvolve(x, ir); y = np.concatenate([y, np.zeros(len(x) + n - len(y))])[:len(x) + n]; xx = np.concatenate([x, np.zeros(n)])
    return xx * (1 - wet) + y * wet
def slowmod(n, rate=0.15, depth=0.5, seed=0):
    r = np.random.default_rng(seed); k = max(4, int(n / SR * rate * 4)); pts = r.random(k)
    m = np.interp(np.linspace(0, k - 1, n), np.arange(k), pts); return 1 - depth + depth * m

# ---------- sound recipes ----------
def wind(d, seed=0, lo=150, hi=900):
    x = bp(noise(d), lo, hi); x = x * slowmod(len(x), 0.25, 0.6, seed); return norm(x, 0.5)
def water(d, seed=0):
    x = bp(noise(d), 200, 1400) * slowmod(int(d * SR), 1.2, 0.85, seed); x += 0.4 * bp(noise(d), 1500, 4000) * slowmod(int(d * SR), 2.5, 0.9, seed + 1)
    return norm(x, 0.5)
def bird(f0=3200):
    d = 0.18; t = np.linspace(0, d, int(d * SR)); fr = f0 + 900 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 6)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(len(t), 0.01, 0.08) * 0.5
def crickets(d, seed=0):
    t = np.arange(int(d * SR)) / SR; x = np.sin(2 * np.pi * 4300 * t) * (np.sin(2 * np.pi * 28 * t) > 0.6) * (np.sin(2 * np.pi * 0.7 * t + seed) > -0.2)
    return lp(x, 6000) * 0.3
def step(seed=0):
    r = np.random.default_rng(seed); d = 0.12; x = bp(r.standard_normal(int(d * SR)), 80, 700) * np.exp(-np.linspace(0, 9, int(d * SR)))
    x += 0.35 * bp(r.standard_normal(int(d * SR)), 1800, 5000) * np.exp(-np.linspace(0, 14, int(d * SR)))
    return x
def jingle(seed=0):
    r = np.random.default_rng(seed); d = 0.25; t = np.arange(int(d * SR)) / SR; x = np.zeros_like(t)
    for k in range(4): x += np.sin(2 * np.pi * r.uniform(2500, 6500) * t) * np.exp(-t * r.uniform(25, 45)) * r.uniform(0.3, 1)
    return x * 0.25
def march(d, n_men=10, step_s=0.466, seed=0):
    out = np.zeros(int(d * SR)); r = np.random.default_rng(seed)
    for m in range(n_men):
        ph = r.uniform(0, step_s); g = r.uniform(0.4, 1.0); t = ph
        while t < d - 0.3:
            s = step(r.integers(1e6)) * g; i = int(t * SR); out[i:i + len(s)] += s[:len(out) - i]
            if r.random() < 0.35: j = jingle(r.integers(1e6)) * g * 0.6; out[i:i + len(j)] += j[:len(out) - i]
            t += step_s + r.normal(0, 0.012)
    return out
def horn(d=1.8, f0=233.0, seed=0):
    t = np.arange(int(d * SR)) / SR; vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t)
    seg = np.where(t < d * 0.35, f0, np.where(t < d * 0.55, f0 * 1.335, f0 * 1.5))
    fr = signal.lfilter([0.002], [1, -0.998], seg * vib) / 0.002 * 0.001 + seg * vib * 0  # glide
    fr = seg * vib
    ph = 2 * np.pi * np.cumsum(fr) / SR; x = signal.sawtooth(ph) * 0.6 + np.sin(ph) * 0.4
    x = lp(x, 1600, 2) * env(len(t), 0.08, 0.5); x = bp(x, 180, 2400)
    return norm(reverb(x, 2.6, 0.55, 2500), 0.8)
def boom(d=2.5, f0=48):
    t = np.arange(int(d * SR)) / SR; fr = f0 * (1 + 1.5 * np.exp(-t * 10))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 2.2); x += 0.3 * lp(noise(d), 200) * np.exp(-t * 8)
    return norm(reverb(x, 2.0, 0.3, 1200), 0.9)
def whoosh(d=0.6, up=True):
    n = int(d * SR); x = noise(d); fc = np.linspace(400, 3000, n) if up else np.linspace(3000, 400, n)
    y = np.zeros(n); bl = 2048
    for i in range(0, n, bl):
        c = fc[min(i, n - 1)]; y[i:i + bl] = bp(x[i:i + bl], c * 0.6, min(c * 1.6, 20000))
    return norm(y * np.sin(np.linspace(0, np.pi, n)) ** 2, 0.5)
def tick():  # paper/wood tick for labels
    d = 0.09; x = bp(noise(d), 900, 4000) * np.exp(-np.linspace(0, 30, int(d * SR))); x += 0.6 * np.sin(2 * np.pi * 680 * np.arange(int(d * SR)) / SR) * np.exp(-np.linspace(0, 40, int(d * SR)))
    return norm(x, 0.5)
def paper(d=0.5):
    x = hp(noise(d), 1500) * slowmod(int(d * SR), 30, 0.95, 3) * env(int(d * SR), 0.02, 0.2); return norm(x, 0.4)
def thud(d=0.5):
    t = np.arange(int(d * SR)) / SR; x = np.sin(2 * np.pi * (70 + 60 * np.exp(-t * 30)) * t) * np.exp(-t * 9) + 0.5 * bp(noise(d), 100, 1200) * np.exp(-t * 18)
    return norm(x, 0.9)
def clang(seed=0):
    r = np.random.default_rng(seed); d = 0.8; t = np.arange(int(d * SR)) / SR; x = np.zeros_like(t)
    for k in range(6): x += np.sin(2 * np.pi * r.uniform(900, 4200) * t) * np.exp(-t * r.uniform(6, 14)) * r.uniform(0.3, 1)
    x += bp(r.standard_normal(len(t)), 2000, 8000) * np.exp(-t * 60)
    return norm(x, 0.6)
def crowd(d, seed=0):
    r = np.random.default_rng(seed); x = np.zeros(int(d * SR))
    for k in range(5):
        c = r.uniform(350, 1100); y = bp(r.standard_normal(len(x)), c * 0.7, c * 1.4) * slowmod(len(x), r.uniform(2, 5), 0.8, r.integers(99)); x += y
    return norm(x, 0.6)
def hooves(d, rate=2.2, seed=0):
    out = np.zeros(int(d * SR)); r = np.random.default_rng(seed); t = 0.05
    while t < d - 0.2:
        for dt in (0, 0.09):
            d2 = 0.06; c = bp(r.standard_normal(int(d2 * SR)), 300, 2500) * np.exp(-np.linspace(0, 20, int(d2 * SR))); i = int((t + dt) * SR); out[i:i + len(c)] += c[:len(out) - i]
        t += 1 / rate
    return norm(out, 0.6)
def crackle(d, seed=0):
    r = np.random.default_rng(seed); out = 0.15 * lp(r.standard_normal(int(d * SR)), 400)
    for _ in range(int(d * 14)):
        i = r.integers(0, len(out) - 500); out[i:i + 300] += bp(r.standard_normal(300), 1500, 7000) * r.uniform(0.2, 1)
    return norm(out, 0.5)
def rumble(d):
    x = lp(noise(d), 90, 4) * (1 + 0.6 * np.sin(2 * np.pi * 7 * np.arange(int(d * SR)) / SR)); return norm(x * env(int(d * SR), 0.4, 1.2), 0.9)
def rubble(d=1.6, seed=0):
    r = np.random.default_rng(seed); out = np.zeros(int(d * SR))
    for _ in range(40):
        i = r.integers(0, len(out) - 4000); c = bp(r.standard_normal(3000), 200, 3000) * np.exp(-np.linspace(0, 12, 3000)) * r.uniform(0.2, 1); out[i:i + 3000] += c
    return norm(out, 0.7)
def scrape(d=0.5): x = bp(noise(d), 500, 3500) * env(int(d * SR), 0.05, 0.2); return norm(x, 0.5)
def creak(d=1.2):
    t = np.arange(int(d * SR)) / SR; pulses = (np.sin(2 * np.pi * (35 + 10 * np.sin(2 * np.pi * 0.8 * t)) * t) > 0.97).astype(float)
    return norm(bp(pulses, 300, 2500) * env(len(t), 0.1, 0.3), 0.5)
def drone(d, notes=(55.0, 82.41), seed=0):
    t = np.arange(int(d * SR)) / SR; x = np.zeros_like(t)
    for k, f0 in enumerate(notes):
        for h, a in ((1, 1), (2, 0.35), (3, 0.15)): x += a * np.sin(2 * np.pi * f0 * h * t * (1 + 0.0015 * np.sin(2 * np.pi * 0.11 * t + k)))
    x = lp(x, 700) * env(len(t), 2.0, 2.5); return norm(x, 0.6)


dB = lambda v: 10 ** (v / 20)
