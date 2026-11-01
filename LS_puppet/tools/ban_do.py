"""BẢN ĐỒ VẼ TAY (B4, đợt C — 29/10/2026): đưa ảnh MAP_* (Nebula/Flow) vào project.
Dùng: python tools/ban_do.py <thư mục ảnh tải về>   (vd ../tap/T01/anh_C)
- MAP_* → public/maps/<tên>.jpg (giữ nguyên khung 16:9, JPEG 92)
- ghi src/maps/painted.json {tên: [rộng, cao]} — code dựng chỉ dùng nền vẽ tay khi bản đồ có trong file này,
  thiếu thì tự quay về bản đồ vẽ bằng code (Maps.tsx)
- toạ độ đường, hồ, đồi, thị trấn… trên từng ảnh nằm trong src/maps/Painted.tsx (đo trên ảnh gốc, đơn vị = điểm ảnh gốc).
  Gen lại ảnh khác bố cục thì phải đo lại các hằng số đó (xem tờ out/soat_ban_do.jpg: lưới 100 px + điểm đã đo).
"""
import os, re, sys, json
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1]
out = os.path.join(ROOT, 'public', 'maps'); os.makedirs(out, exist_ok=True)
cal = os.path.join(ROOT, 'src', 'maps', 'painted.json')
info = json.load(open(cal)) if os.path.exists(cal) else {}
for fn in sorted(os.listdir(src)):
    if not fn.startswith('MAP_') or not fn.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')): continue
    n = re.sub(r'-[a-d]$', '', os.path.splitext(fn)[0])
    im = Image.open(os.path.join(src, fn)).convert('RGB')
    im.save(os.path.join(out, n + '.jpg'), quality=92)
    info[n] = list(im.size); print('ok', n, im.size)
json.dump(info, open(cal, 'w'), indent=1)

# tờ soát: lưới 100 px để đo toạ độ
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
tiles = []
for n, (w, h) in sorted(info.items()):
    im = Image.open(os.path.join(out, n + '.jpg')).convert('RGB'); d = ImageDraw.Draw(im)
    for x in range(0, w, 100): d.line([(x, 0), (x, h)], fill=(255, 0, 0) if x % 500 == 0 else (255, 160, 160), width=3 if x % 500 == 0 else 1)
    for y in range(0, h, 100): d.line([(0, y), (w, y)], fill=(255, 0, 0) if y % 500 == 0 else (255, 160, 160), width=3 if y % 500 == 0 else 1)
    tiles.append(im.resize((w // 2, h // 2)))
if tiles:
    sheet = Image.new('RGB', (max(t.width for t in tiles), sum(t.height for t in tiles)), 'white'); y = 0
    for t in tiles: sheet.paste(t, (0, y)); y += t.height
    sheet.save(os.path.join(ROOT, 'out', 'soat_ban_do.jpg'), quality=85); print('tờ soát: out/soat_ban_do.jpg')
