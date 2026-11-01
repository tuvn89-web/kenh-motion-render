"""Đóng gói tài nguyên một tập để render trên mây.

Dùng: python cloud/day_tai_nguyen.py <thư mục public của project> <thư mục ra> [--audio mix.wav]
- public/cut/*.png → <ra>/cut/*.webp (WebP chất lượng 92, kênh trong suốt giữ nguyên; 323 MB → ~24 MB với tập T01)
- public/<audio>    → <ra>/mix.flac (không mất chất lượng)
Sau đó đẩy <ra> thành nhánh riêng tai-nguyen/<kênh>-<tập> (xem cloud/HUONG-DAN.md).
"""
import os, subprocess, sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
audio = sys.argv[sys.argv.index('--audio') + 1] if '--audio' in sys.argv else 'mix.wav'
os.makedirs(os.path.join(out, 'cut'), exist_ok=True)
n = 0
for f in sorted(os.listdir(os.path.join(src, 'cut'))):
    if not f.lower().endswith('.png') or f.startswith('_'): continue
    with Image.open(os.path.join(src, 'cut', f)) as im:
        im.save(os.path.join(out, 'cut', f[:-4] + '.webp'), 'WEBP', quality=92, method=4, alpha_quality=100)
    n += 1
print('ảnh:', n)
a = os.path.join(src, audio)
if os.path.exists(a):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a, '-c:a', 'flac', os.path.join(out, 'mix.flac')], check=True)
    print('tiếng: mix.flac')
else:
    print('không thấy', a, '— video sẽ không có tiếng nếu file việc có "audio"')
