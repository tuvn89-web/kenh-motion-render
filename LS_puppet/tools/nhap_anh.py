"""Nhập ảnh Nebula vào project: chuẩn hoá tên, tách nền, căn chân, ghi manifest.
Dùng: python tools/nhap_anh.py <thư mục ảnh tải từ Nebula>
- Bỏ hậu tố -a/-b/-c/-d, -copy và đuôi _<ngày giờ> của file tải tay.
- SPR_* / OBJ_MUD*  → tách nền xanh, cắt sát, căn bàn chân giữa đáy  → public/cut/
- LYR_*_SKY          → giữ nguyên khung                               → public/cut/
- LYR_* còn lại       → tách nền xanh, giữ khung                       → public/cut/
- CHR_/ANI_/KEY_/OBJ_STANDARD là ảnh tham chiếu, không dùng khi dựng.
- IBT_* / SPR_HAST_FRONT* (khung trung gian / khung quay người, đợt D2) → tools/khung_giua.py: tách, đo theo ảnh đầu, soát, ghi src/puppet/via.json
- EDT_* (ảnh sửa mắt / miệng, đợt B) → tools/va_mat.py ghép thành miếng vá PAT_* (cần ảnh gốc SPR_* chưa tách: tìm trong thư mục
  này, trong --goc <thư mục>, hoặc mặc định ../tap/T01/anh cạnh thư mục project)
"""
import os, re, sys, subprocess
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1]; out = os.path.join(ROOT, 'public', 'cut'); os.makedirs(out, exist_ok=True)
def base(fn):
    n = os.path.splitext(fn)[0]
    n = re.sub(r'_\d{8}[_-]?\d{4,6}$', '', n)        # đuôi ngày giờ khi tải tay
    n = re.sub(r'(-copy)$', '', n); n = re.sub(r'-[a-d]$', '', n); n = re.sub(r'(-copy)$', '', n)
    return n
# Ảnh AI vẽ nhiều bản / nhiều tư thế: chọn bản 'left' / 'right' hoặc số thứ tự '1', '2', '3'… tính từ trái sang
# (số in trên tờ out/soat_nhieu.jpg). Mặc định: bản lớn nhất.
PICK = {'SPR_HANN_STAND': 'left', 'SPR_HAST_SCARED': 'left', 'SPR_HAST_FIGHT': 'right',
        # đợt B: Flow vẽ bản 1 nhìn thẳng, bản 2 xoay 3/4 sang phải (đúng lời dặn) → lấy bản 2; nhân vật lấy bản nhìn thẳng cho khớp ảnh đứng
        'SPR_FLAM_ORDER': '2', 'SPR_HANN_ARMS': '1',
        **{f'SPR_LEG{v}_{p}': '2' for v in 'ABCDEF' for p in ('WALK', 'STAND', 'SCARED')}}
SKIP = set()    # ảnh lỗi cần gen lại (đợt B: SPR_LEGF_STAND đã gen lại ở đợt C)
# Vùng phủ xanh trước khi tách nền (u0, v0, u1, v1 theo tỉ lệ khung): xoá phần AI vẽ thừa.
MASK = {'OBJ_MUDSTANDARD': [(0.551, 0.3616, 1, 0.648), (0.52, 0.648, 1, 0.839), (0.627, 0.839, 1, 1)],   # người cầm cờ đứng cạnh
        'SPR_SIGN_STAND': [(0.636, 0.62, 0.72, 0.95), (0.598, 0.855, 0.6135, 0.95)],                   # bàn chân "ma" sau cán cờ
        'SPR_FLAM_LYING': [(0.15, 0, 1, 0.335), (0, 0, 0.15, 0.28)],                                    # 2 chỏm mũ "ma" phía trên
        # đợt B: bóng "ma" mờ hai bên người lính (chân, khiên, chỏm lông)
        'SPR_LEGA_STAND': [(0.625, 0.6, 1, 1), (0, 0.6, 0.37, 1)],
        'SPR_LEGA_WALK': [(0.70, 0.58, 1, 1), (0.66, 0.72, 1, 1), (0, 0.66, 0.375, 1)],
        'SPR_LEGE_STAND': [(0.628, 0.55, 1, 1), (0, 0.55, 0.375, 1), (0, 0, 0.375, 0.3), (0.628, 0, 1, 0.3)],
        # đợt C: đôi chân + khiên "ma" mờ bên phải người lính nhỏ
        'SPR_HAST_TINYWALK': [(0.655, 0.70, 1, 1), (0.60, 0.92, 1, 1)],
        'OBJ_HELMTOP': [(0, 0.555, 1, 1)]}                                       # bỏ đám mây hoạt hình + lòng mũ: chỉ giữ chỏm mũ, lông, mũi giáo
# Vòng tròn GIỮ NGUYÊN ảnh gốc bên trong vùng phủ xanh (cx, cy, r theo tỉ lệ khung; r theo chiều cao): 31/10 — hình chữ nhật
# xoá người cầm cờ cắt phẳng mép phải đĩa thứ nhất của cờ hiệu bàn tay đồng
KEEP = {'OBJ_MUDSTANDARD': [(1463 / 2752, 586 / 1536, 84 / 1536)]}
# Gỡ lớp sương xanh tràn lên vật (cutout.unhaze): cán + đĩa dưới của cờ hiệu bị ám ô-liu từ quầng "bóng ma" bên cạnh
UNHAZE = {'OBJ_MUDSTANDARD'}
ONLY = set(sys.argv[sys.argv.index('--chi') + 1].split(',')) if '--chi' in sys.argv else None   # --chi TEN1,TEN2: chỉ nhập lại vài ảnh
seen = {}
for fn in sorted(os.listdir(src)):
    if not fn.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')): continue
    n = base(fn)
    if n in seen: print('! trùng tên, giữ file sau:', seen[n], '->', fn)
    seen[n] = fn
done = 0
for n, fn in seen.items():
    p = os.path.join(src, fn); dst = os.path.join(out, n + '.png')
    if ONLY and n not in ONLY: continue
    if n in SKIP: print('- bỏ qua (cần gen lại):', n); continue
    if n.startswith('IBT_') or n.startswith('SPR_HAST_FRONT'): continue      # khung trung gian / khung quay: tools/khung_giua.py (tách + đo + soát) bên dưới
    if n.startswith(('SPR_', 'OBJ_MUD', 'OBJ_HELMTOP')): args = ['--pick', PICK[n]] if n in PICK else []
    elif n == 'ANI_HORSE': args = ['--pick', 'left']                          # ngựa không người cưỡi (lấy bản bên trái)
    elif n.startswith('KEY_'): args = ['--layer']                               # ảnh bối cảnh đầy đủ: dùng làm nền dự phòng
    elif n.startswith('LYR_') and n.endswith('_SKY'):
        Image.open(p).convert('RGB').save(dst); done += 1; print('ok', n, '(bầu trời)'); continue
    elif n.startswith('LYR_'): args = ['--layer']
    elif n.startswith('EDT_'): continue                                      # ảnh sửa mắt/miệng: ghép ở bước va_mat bên dưới
    elif n.startswith(('MAP_', 'RIG_')): continue                              # bản đồ vẽ tay / mảnh con rối: tools/ban_do.py, tools/rap_rig.py
    else: print('- bỏ qua (ảnh tham chiếu):', n); continue
    if n in MASK:
        im = Image.open(p).convert('RGB'); W, H = im.size
        from PIL import ImageDraw
        d = ImageDraw.Draw(im)
        for u0, v0, u1, v1 in MASK[n]: d.rectangle([u0 * W, v0 * H, u1 * W, v1 * H], fill=(0, 255, 0))
        if n in KEEP:
            src_im = Image.open(os.path.join(src, fn)).convert('RGB'); m = Image.new('L', (W, H), 0); dm = ImageDraw.Draw(m)
            for cu, cv, r in KEEP[n]: dm.ellipse([cu * W - r * H, cv * H - r * H, cu * W + r * H, cv * H + r * H], fill=255)
            im.paste(src_im, (0, 0), m)
        p = os.path.join(out, '_mask_tmp.png'); im.save(p)
    if n in UNHAZE: args = args + ['--unhaze']
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'cutout.py'), p, dst] + args, check=True); done += 1
    if n in MASK: os.remove(p)
if any(n.startswith('EDT_') and (not ONLY or n in ONLY) for n in seen):
    dirs = [src] + ([sys.argv[sys.argv.index('--goc') + 1]] if '--goc' in sys.argv else [])
    dflt = os.path.normpath(os.path.join(ROOT, '..', 'tap', 'T01', 'anh'))
    if os.path.isdir(dflt) and dflt not in dirs: dirs.insert(0, dflt)   # ảnh gốc trước, ảnh mới sau (cùng tên thì lấy ảnh mới)
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'va_mat.py')] + dirs, check=True)
if any(n.startswith(('IBT_', 'SPR_HAST_FRONT')) and (not ONLY or n in ONLY) for n in seen):   # K5: khung trung gian
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'khung_giua.py'), src] + ([sys.argv[sys.argv.index('--goc') + 1]] if '--goc' in sys.argv else []), check=True)
subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'manifest.py')], check=True)
subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'soat_anh.py'), src], check=True)   # tờ soát: xem trước khi đưa ảnh vào cảnh
print('Đã nhập', done, 'ảnh — xem out/soat_anh_*.jpg, out/soat_huong.jpg (hướng mặt → FACE trong assets.ts) và out/soat_mat.jpg (mắt/miệng) trước khi dựng')
