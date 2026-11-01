"""Tờ soát ảnh nhân vật / đồ vật: ảnh gốc Nebula (trái) cạnh ảnh đã tách nền (phải, nền xanh dương).
Dùng: python tools/soat_anh.py <thư mục ảnh Nebula>  → out/soat_anh_*.jpg, out/soat_huong.jpg, out/soat_nhieu.jpg
BẮT BUỘC xem trước khi đưa ảnh vào cảnh. Soát 4 điều:
  1. Ảnh gốc có 2 bản / nhiều tư thế không → out/soat_nhieu.jpg đánh số từng bản (1, 2, 3… từ trái sang): chọn bản
     đúng lời dặn nhất (dáng, nét mặt, đủ người) rồi ghi PICK trong tools/nhap_anh.py; người thứ hai đứng sát thì MASK
  2. Ảnh tách còn mảnh "ma" (mũ, chân, quầng mờ) không → MASK
  3. Nhân vật quay mặt / đi về phía nào → quay TRÁI thì ghi vào FACE trong src/puppet/assets.ts.
     Xem out/soat_huong.jpg (đầu + bàn chân phóng to): xét MŨI CHÂN TRƯỚC và MẮT. KHÔNG xét theo hướng giáo/khiên
     (T01: ảnh đi bộ vác giáo chĩa ra sau nhưng mũi chân chỉ phải → đi sang phải; đoán theo giáo làm cả đoàn quân đi giật lùi).
  4. Tư thế nằm/ngồi có vẽ sẵn độ nghiêng không → khi đặt lên dốc phải tính góc thật, không lật bừa
"""
import os, re, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import ImageFont
def font(size):   # phông có dấu tiếng Việt: Windows (Arial) hoặc Linux (DejaVu)
    for f in ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf']:
        if os.path.exists(f): return ImageFont.truetype(f, size)
    return ImageFont.load_default()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1]
cut = os.path.join(ROOT, 'public', 'cut'); out = os.path.join(ROOT, 'out'); os.makedirs(out, exist_ok=True)
raw = {}
for f in os.listdir(src):
    if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
        n = re.sub(r'_\d{8}[_-]?\d{4,6}$', '', os.path.splitext(f)[0]); n = re.sub(r'(-copy)?(-[a-d])?(-copy)?$', '', n)
        raw[n] = os.path.join(src, f)
names = sorted(n[:-4] for n in os.listdir(cut) if n.startswith(('SPR_', 'OBJ_', 'ANI_')) and n.endswith('.png'))
rows = []
for n in names:
    c = Image.open(os.path.join(cut, n + '.png')).convert('RGBA'); H = 300
    c = c.resize((max(1, int(c.size[0] * H / c.size[1])), H))
    bg = Image.new('RGBA', c.size, (60, 80, 130, 255)); bg.alpha_composite(c)
    row = Image.new('RGB', (540 + 20 + bg.size[0] + 10, H + 24), 'white')
    if n in raw:
        r = Image.open(raw[n]).convert('RGB'); r = r.resize((540, int(540 * r.size[1] / r.size[0])))
        row.paste(r.crop((0, 0, 540, min(r.size[1], H))), (0, 24))
    row.paste(bg.convert('RGB'), (560, 24))
    ImageDraw.Draw(row).text((4, 4), n, fill='black', font=font(15)); rows.append(row)
for k in range(0, len(rows), 8):
    part = rows[k:k + 8]; W = max(r.size[0] for r in part)
    s = Image.new('RGB', (W, sum(r.size[1] for r in part)), 'white'); y = 0
    for r in part: s.paste(r, (0, y)); y += r.size[1]
    p = os.path.join(out, f'soat_anh_{k // 8 + 1}.jpg'); s.save(p, quality=85); print('tờ soát:', p)

# Tờ soát hướng: đầu (mắt) + bàn chân (mũi chân) phóng to của mọi ảnh dáng người SPR_
tiles = []
for n in [x for x in names if x.startswith('SPR_')]:
    c = Image.open(os.path.join(cut, n + '.png')).convert('RGBA'); W, H = c.size
    bg = Image.new('RGBA', c.size, (235, 235, 225, 255)); bg.alpha_composite(c); bg = bg.convert('RGB')
    head = bg.crop((0, int(H * 0.08), W, int(H * 0.45))); feet = bg.crop((0, int(H * 0.80), W, H))
    w = 420; head = head.resize((w, max(1, int(w * head.size[1] / W)))); feet = feet.resize((w, max(1, int(w * feet.size[1] / W))))
    t = Image.new('RGB', (w, head.size[1] + feet.size[1] + 34), 'white'); d = ImageDraw.Draw(t)
    d.text((4, 1), n + '   hướng: ____ (mũi chân trước / mắt)', fill='black', font=font(13))
    t.paste(head, (0, 18)); t.paste(feet, (0, head.size[1] + 28)); tiles.append(t)
if tiles:
    cols = 5; rowsN = (len(tiles) + cols - 1) // cols
    Hr = [max(t.size[1] for t in tiles[r * cols:(r + 1) * cols]) for r in range(rowsN)]
    s = Image.new('RGB', (430 * cols, sum(Hr)), 'white'); y = 0
    for r in range(rowsN):
        for i, t in enumerate(tiles[r * cols:(r + 1) * cols]): s.paste(t, (i * 430, y))
        y += Hr[r]
    p = os.path.join(out, 'soat_huong.jpg'); s.save(p, quality=85); print('tờ soát hướng:', p)

# Tờ soát ảnh NHIỀU BẢN: ảnh gốc có từ 2 hình người lớn trở lên, mỗi bản một khung đánh số (= số dùng trong PICK)
from cutout import figures
sys.path.insert(0, os.path.join(ROOT, 'tools'))
src_txt = open(os.path.join(ROOT, 'tools', 'nhap_anh.py'), encoding='utf-8').read()   # đọc PICK hiện tại (không chạy nhap_anh)
import ast   # lấy đúng câu gán PICK bằng cây cú pháp (PICK có f-string / ** nên không bắt bằng regex được)
PICK = next((eval(compile(ast.Expression(nd.value), 'PICK', 'eval')) for nd in ast.parse(src_txt).body
             if isinstance(nd, ast.Assign) and any(getattr(t, 'id', '') == 'PICK' for t in nd.targets)), {})
multi = []
for n in sorted(raw):
    if not n.startswith(('SPR_', 'OBJ_MUD')): continue
    try: boxes = figures(raw[n])
    except Exception: continue
    if len(boxes) < 2: continue
    im = Image.open(raw[n]).convert('RGB'); d = ImageDraw.Draw(im)
    for k, (x0, y0, x1, y1) in enumerate(boxes, 1):
        d.rectangle([x0, y0, x1, y1], outline=(255, 0, 0), width=8)
        d.rectangle([x0, y0, x0 + 110, y0 + 110], fill=(255, 0, 0)); d.text((x0 + 28, y0 + 4), str(k), fill='white', font=font(90))
    im = im.resize((900, int(900 * im.size[1] / im.size[0])))
    lab = Image.new('RGB', (900, 30), 'white'); ImageDraw.Draw(lab).text((6, 6), f"{n}   có {len(boxes)} bản   PICK hiện tại: {PICK.get(n, 'bản lớn nhất')}", fill='black', font=font(18))
    t = Image.new('RGB', (900, im.size[1] + 30), 'white'); t.paste(lab, (0, 0)); t.paste(im, (0, 30)); multi.append(t)
if multi:
    cols = 2; rowsN = (len(multi) + 1) // cols; Hm = max(t.size[1] for t in multi)
    s2 = Image.new('RGB', (910 * cols, Hm * rowsN), 'white')
    for i, t in enumerate(multi): s2.paste(t, ((i % cols) * 910, (i // cols) * Hm))
    p = os.path.join(out, 'soat_nhieu.jpg'); s2.save(p, quality=85); print(f'tờ soát nhiều bản: {p} ({len(multi)} ảnh cần chọn PICK)')
