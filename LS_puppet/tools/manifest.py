"""Ghi kích thước mọi ảnh đã tách trong public/cut vào src/puppet/manifest.json (Remotion dùng để giữ đúng tỉ lệ giữa các tư thế)."""
import os, json
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = os.path.join(ROOT, 'public', 'cut'); out = {}
for f in sorted(os.listdir(d)):
    if f.lower().endswith('.png'):
        with Image.open(os.path.join(d, f)) as im: out[f[:-4]] = list(im.size)
json.dump(out, open(os.path.join(ROOT, 'src', 'puppet', 'manifest.json'), 'w'), indent=1)
print(len(out), 'images')
