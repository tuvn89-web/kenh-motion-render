"""ẢNH GỐC 1 NGƯỜI cho Flow (K2, 31/10/2026): ảnh tư thế Flow hay vẽ 2 bản người → khi sửa, Flow dễ sửa nhầm bản kia.
Xuất lại mỗi ảnh tư thế đầu/cuối (tools/chuyen.py: GOC) thành ảnh 16:9 CHỈ CÒN đúng người đang dùng (PICK, MASK như nhap_anh.py),
giữ nguyên chỗ đứng và cỡ trên khung, phần còn lại tô xanh #00FF00 → tải lên Project Flow, gọi @GOC_<tên bỏ SPR_>.
Dùng: python tools/goc_1_nguoi.py <thư mục ra> [thư mục ảnh gốc …]   (mặc định tìm ../tap/T01/anh, anh_B, anh_C)
"""
import os, re, sys, ast, glob
import numpy as np, cv2
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from cutout import key_green, clean_sprite
from chuyen import GOC, goc

def consts():
    """đọc PICK, MASK trong nhap_anh.py (không chạy file đó)"""
    tree = ast.parse(open(os.path.join(ROOT, 'tools', 'nhap_anh.py'), encoding='utf-8').read()); out = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) and node.targets[0].id in ('PICK', 'MASK'):
            if node.targets[0].id == 'PICK':   # có biểu thức **{…} → tự dựng lại
                d = {}
                for k, v in zip(node.value.keys, node.value.values):
                    if k is None: d.update({f'SPR_LEG{a}_{p}': '2' for a in 'ABCDEF' for p in ('WALK', 'STAND', 'SCARED')})
                    else: d[ast.literal_eval(k)] = ast.literal_eval(v)
                out['PICK'] = d
            else: out['MASK'] = ast.literal_eval(node.value)
    return out['PICK'], out['MASK']

def find(name, dirs):
    for d in dirs[::-1]:   # thư mục sau (đợt mới) ưu tiên
        fs = [f for f in glob.glob(os.path.join(d, name + '*')) if re.fullmatch(re.escape(name) + r'(-[a-d])?(-copy)?(_\d{8}[_-]?\d{4,6})?\.(jpg|jpeg|png|webp)', os.path.basename(f), re.I)]
        if fs: return sorted(fs)[-1]
    return None

def one_person(path, name, PICK, MASK):
    im = Image.open(path).convert('RGB'); W, H = im.size
    if name in MASK:
        d = ImageDraw.Draw(im)
        for u0, v0, u1, v1 in MASK[name]: d.rectangle([u0 * W, v0 * H, u1 * W, v1 * H], fill=(0, 255, 0))
    rgb = np.asarray(im).astype(np.float32)
    a = np.concatenate([rgb.copy(), np.full((H, W, 1), 255, np.float32)], -1)
    a = key_green(a); a = clean_sprite(a, rgb.copy(), PICK.get(name, 'largest'))
    m = cv2.dilate((a[..., 3] > 8).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0   # giữ viền mềm vốn có trên nền xanh
    out = np.where(m[..., None], rgb, np.array([0, 255, 0], np.float32))
    return Image.fromarray(out.astype(np.uint8)), m

def main():
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    dirs = sys.argv[2:] or [os.path.normpath(os.path.join(ROOT, '..', 'tap', 'T01', d)) for d in ('anh', 'anh_B', 'anh_C')]
    PICK, MASK = consts(); tiles = []
    for n in GOC:
        p = find(n, dirs)
        if not p: print('! không thấy ảnh gốc', n); continue
        im, m = one_person(p, n, PICK, MASK)
        im.save(os.path.join(out, goc(n) + '.png')); print('ok', goc(n) + '.png', '←', os.path.basename(p))
        t = im.copy(); t.thumbnail((360, 200)); tiles.append((n, t))
    S = Image.new('RGB', (4 * 370, 220 * ((len(tiles) + 3) // 4)), 'white'); d = ImageDraw.Draw(S)
    for i, (n, t) in enumerate(tiles):
        x, y = (i % 4) * 370, (i // 4) * 220; S.paste(t, (x, y + 16)); d.text((x + 2, y + 2), goc(n), fill='black')
    S.save(os.path.join(out, '_soat_goc.jpg'), quality=85); print(len(tiles), 'ảnh →', out)

if __name__ == '__main__': main()
