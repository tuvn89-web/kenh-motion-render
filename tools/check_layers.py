"""MÁY CHẤM ẢNH LỚP 2.5D — L1 (khớp khung) + L2 (ám xanh) cho mọi ảnh 'sửa ảnh' trong anh.json so với KEY nó sửa từ.

    python3 tools/check_layers.py <thư mục ảnh (có index.json)> <anh.json> [ra.json]

L1: ECC affine trên vùng NỀN (với ảnh xoá chủ thể) hoặc vùng CHỦ THỂ (với ảnh trên xanh) -> tỉ lệ, dx, dy (px).
    < 1 px: ĐẠT · < ~2% bề ngang: MỘT PHẦN (code chỉnh offset/scale) · lớn hơn: TRƯỢT.
L2: tỉ lệ điểm ảnh chủ thể còn ám xanh (g > max(r,b)+12). > 5% là đáng lo.
"""
import cv2, json, os, re, sys
import numpy as np

KIT, AJ = sys.argv[1], sys.argv[2]
OUT = sys.argv[3] if len(sys.argv) > 3 else None
idx = json.load(open(os.path.join(KIT, 'index.json')))
A = json.load(open(AJ, encoding='utf-8'))
refname = {re.match(r'REF_([A-Z]{3}\d{2}_\d+)_', a['ten']).group(1): a['ten'] for a in A['anh'] if re.match(r'REF_[A-Z]{3}\d{2}_\d+_', a['ten'])}


def im(n):
    f = idx.get(n)
    return cv2.imread(os.path.join(KIT, f)) if f else None


def alpha_green(img):
    b, g, r = [img[..., i].astype(np.int32) for i in range(3)]
    return 1 - np.clip((g - np.maximum(r, b) - 18) / 50, 0, 1)


def ecc(a, b, mask):
    ga = cv2.resize(cv2.cvtColor(a, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255, None, fx=0.5, fy=0.5)
    gb = cv2.resize(cv2.cvtColor(b, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255, None, fx=0.5, fy=0.5)
    m = cv2.resize(mask.astype(np.uint8) * 255, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_NEAREST)
    W = np.eye(2, 3, dtype=np.float32)
    try:
        _, W = cv2.findTransformECC(ga, gb, W, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), m, 5)
    except cv2.error:
        return None
    return float(np.sqrt(abs(np.linalg.det(W[:, :2])))), float(W[0, 2] * 2), float(W[1, 2] * 2)


res = {}
greens = {a['ten'] for a in A['anh'] if 'flat pure green' in a['prompt'] and a['prompt'].startswith('Edit')}
for a in A['anh']:
    m = re.match(r'Edit @([A-Z]{3}\d{2}_\d+)', a['prompt'])
    if not m or a['loai'] != 'sửa ảnh':
        continue
    key = refname.get(m.group(1))
    K, Lr = im(key), im(a['ten'])
    if K is None or Lr is None:
        res[a['ten']] = {'loi': 'thiếu ảnh'}
        continue
    if a['ten'] in greens:
        al = alpha_green(Lr)
        subj = al > 0.5
        e = ecc(K, Lr, cv2.erode(subj.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0)
        px = Lr[subj & (al > 0.98)].astype(np.int32)
        gc = float(np.mean(px[:, 1] > np.maximum(px[:, 0], px[:, 2]) + 12)) if len(px) else 0
        res[a['ten']] = {'so_voi': key, 'loai': 'chủ thể trên xanh', 'ecc': e, 'am_xanh': round(gc, 3)}
    else:
        # background vs background: mask out where the two differ a lot (the removed/changed subject)
        d = np.abs(K.astype(np.int32) - Lr.astype(np.int32)).mean(axis=2)
        ch = cv2.dilate((d > 25).astype(np.uint8), np.ones((31, 31), np.uint8)) > 0
        e = ecc(K, Lr, ~ch)
        res[a['ten']] = {'so_voi': key, 'loai': 'nền / biến thể', 'ecc': e, 'vung_doi': round(float(ch.mean()), 3)}
for n, v in res.items():
    e = v.get('ecc')
    if e:
        lech = max(abs(e[1]), abs(e[2]), abs(e[0] - 1) * 688)
        v['L1'] = 'ĐẠT' if lech < 1.5 else ('MỘT PHẦN' if lech < 0.02 * 1376 else 'TRƯỢT')
    print(f"{n:22s} {v.get('loai', ''):18s} " + (f"tỉ lệ {e[0]:.4f} dx {e[1]:+.1f} dy {e[2]:+.1f} → L1 {v['L1']}" if e else v.get('loi', 'ECC không hội tụ — soi bằng mắt'))
          + (f" · ám xanh {v['am_xanh'] * 100:.1f}%" if 'am_xanh' in v else ''))
if OUT:
    json.dump(res, open(OUT, 'w'), ensure_ascii=False, indent=1)
