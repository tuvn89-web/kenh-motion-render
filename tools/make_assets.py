"""Generates royalty-free assets procedurally: animated film-grain tiles and a small SFX/music kit.
Run: python tools/make_assets.py   (needs numpy, pillow)"""
import numpy as np, wave, os
from PIL import Image
R = np.random.RandomState(11)
os.makedirs('public/grain', exist_ok=True); os.makedirs('public/sfx', exist_ok=True)
# --- film grain: 8 tiles cycled per frame (fine grain + clumps), mid-grey so 'overlay' is neutral
for i in range(8):
    g = R.normal(0, 1, (540, 960)) * 0.6 + np.kron(R.normal(0, 1, (270, 480)), np.ones((2, 2))) * 0.4
    img = np.clip(128 + g * 22, 0, 255).astype(np.uint8)
    Image.fromarray(img).resize((1920, 1080), Image.BILINEAR).save(f'public/grain/g{i}.png', optimize=True)
SR = 44100
def save(name, x, vol=0.9):
    x = x / (np.max(np.abs(x)) + 1e-9) * vol
    st = np.stack([x, x], 1) if x.ndim == 1 else x
    with wave.open(f'public/sfx/{name}.wav', 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())
t = lambda d: np.arange(int(SR * d)) / SR
def env(n, a, r):  # attack/release envelope
    e = np.ones(n); ai = int(SR * a); ri = int(SR * r)
    e[:ai] = np.linspace(0, 1, ai); e[-ri:] *= np.exp(-np.linspace(0, 6, ri)); return e
def lp(x, k):  # crude low-pass (moving average)
    return np.convolve(x, np.ones(k) / k, mode='same')
# pop: pitched blip falling
tt = t(0.16); save('pop', np.sin(2 * np.pi * (900 - 2400 * tt) * tt) * np.exp(-tt * 38), 0.7)
# whoosh: band-passed noise swell
tt = t(0.7); n = R.normal(0, 1, len(tt)); w = lp(n, 6) - lp(n, 60)
save('whoosh', w * np.sin(np.pi * tt / 0.7) ** 2, 0.6)
# paper: crinkle bursts
tt = t(0.5); x = np.zeros(len(tt))
for k in range(18):
    s = R.randint(0, len(tt) - 2000); L = R.randint(300, 1800)
    x[s:s + L] += (lp(R.normal(0, 1, L), 2) - lp(R.normal(0, 1, L), 12)) * np.exp(-np.linspace(0, 5, L)) * R.uniform(0.3, 1)
save('paper', x, 0.5)
# chime: two soft bells
tt = t(1.6); x = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * d) for f, d in [(1318, 2.2), (1975, 3.0), (2637, 4.5)])
save('chime', x, 0.45)
# tick
tt = t(0.05); save('tick', R.normal(0, 1, len(tt)) * np.exp(-tt * 160), 0.5)
# swell (glow / reveal): rising filtered noise + tone
tt = t(1.4); n = lp(R.normal(0, 1, len(tt)), 20)
save('swell', (n * 0.6 + np.sin(2 * np.pi * (220 + 220 * tt) * tt) * 0.4) * (tt / 1.4) ** 2 * np.exp(-np.maximum(0, tt - 1.25) * 30), 0.5)
# meow-ish chirp (synthetic, cute)
tt = t(0.45); f = 600 + 500 * np.sin(np.pi * tt / 0.45); ph = 2 * np.pi * np.cumsum(f) / SR
save('chirp', (np.sin(ph) + 0.4 * np.sin(2 * ph)) * env(len(tt), 0.03, 0.2), 0.45)
# night ambience: crickets + soft wind, 32 s loop
tt = t(32); wind = lp(R.normal(0, 1, len(tt)), 400) * 3
cr = np.zeros(len(tt))
for k in range(6):
    f0 = R.uniform(3800, 4800); rate = R.uniform(3, 6); ph0 = R.uniform(0, 6)
    gate = (np.sin(2 * np.pi * rate * tt + ph0) > 0.6).astype(float) * (np.sin(2 * np.pi * 0.07 * tt + k) > -0.2)
    cr += np.sin(2 * np.pi * f0 * tt) * lp(gate, 200) * R.uniform(0.2, 0.5)
save('night', wind * 0.5 + cr * 0.25, 0.35)
# music pad: Am - F - C - G, warm detuned saws (low-passed), 32 s
tt = t(32); x = np.zeros((len(tt), 2))
chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [130.8, 196, 261.6], [196, 246.9, 293.7]]
seg = len(tt) // 8
for i in range(8):
    ch = chords[i % 4]; s = i * seg; tl = tt[:seg]
    e = env(seg, 1.2, 1.5)
    for j, f in enumerate(ch):
        for d, side in ((0.997, 0), (1.003, 1)):
            saw = 2 * ((f * d * tl) % 1) - 1
            x[s:s + seg, side] += lp(saw, 30) * e * 0.3
    bell = np.sin(2 * np.pi * ch[2] * 2 * tl) * np.exp(-tl * 3) * 0.15
    x[s:s + seg] += bell[:, None]
save('pad', x, 0.5)
print('assets ok')
