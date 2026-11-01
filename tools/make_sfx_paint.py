"""Extra procedural SFX for the PAINT lane: water lapping bed, wooden hammer thunk, splash."""
import numpy as np, wave
R = np.random.RandomState(23); SR = 44100
def save(name, x, vol=0.9):
    x = x / (np.max(np.abs(x)) + 1e-9) * vol
    st = np.stack([x, x], 1) if x.ndim == 1 else x
    with wave.open(f'public/sfx/{name}.wav', 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
t = lambda d: np.arange(int(SR * d)) / SR
lp = lambda x, k: np.convolve(x, np.ones(k) / k, mode='same')
# water lapping, 32 s stereo: low swell + gurgle bursts
tt = t(32); x = np.zeros((len(tt), 2))
for ch in range(2):
    n = R.normal(0, 1, len(tt)); body = lp(n, 120) - lp(n, 900)
    sw = 0.5 + 0.5 * np.sin(2 * np.pi * (0.23 + ch * 0.04) * tt + ch)
    gur = np.zeros(len(tt))
    for k in range(70):
        s = R.randint(0, len(tt) - 8000); d = R.randint(1500, 6000); f = R.uniform(250, 700)
        tl = np.arange(d) / SR
        gur[s:s + d] += np.sin(2 * np.pi * (f + 300 * tl / tl[-1]) * tl) * np.sin(np.pi * tl / tl[-1]) * R.uniform(0.1, 0.35)
    x[:, ch] = body * sw * 2.5 + gur
save('water', x, 0.5)
# thunk: low wooden knock (two damped modes + click)
tt = t(0.5)
th = np.sin(2 * np.pi * 95 * tt) * np.exp(-tt * 14) + 0.6 * np.sin(2 * np.pi * 210 * tt) * np.exp(-tt * 30) + 0.4 * np.sin(2 * np.pi * 520 * tt) * np.exp(-tt * 60)
th[:300] += R.normal(0, 1, 300) * np.linspace(1, 0, 300)
save('thunk', th, 0.9)
# splash: noise burst with falling band + droplets
tt = t(0.9); n = R.normal(0, 1, len(tt)); sp = (lp(n, 3) - lp(n, 25)) * np.exp(-tt * 6)
for k in range(12):
    s = R.randint(2000, len(tt) - 3000); tl = np.arange(2500) / SR; f = R.uniform(900, 2200)
    sp[s:s + 2500] += np.sin(2 * np.pi * (f + 1500 * tl) * tl) * np.exp(-tl * 60) * 0.5
save('splash', sp, 0.7)
print('paint sfx ok')
