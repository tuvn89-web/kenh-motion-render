"""MÁY AI trên máy GitHub (31/10/2026, N2 + N5): việc cần mô hình AI mà máy Claude không tải được.
  task "depth"   (N2): bản đồ độ sâu Depth Anything V2 SMALL (giấy phép Apache-2.0 — bản Base/Large là CC-BY-NC, KHÔNG dùng
                  cho kênh kiếm tiền). Ra <tên>.depth.png 16-bit cùng cỡ ảnh gốc, trắng = GẦN, đen = xa (độ sâu nghịch, tương đối).
  task "upscale" (N5): làm nét ×2 bằng Real-ESRGAN x4plus_anime_6B (BSD-3) qua thư viện spandrel; chạy ×4 rồi thu về ×2 (Lanczos),
                  kênh trong suốt chạy riêng qua cùng mô hình. Ra cut2x/<tên>.webp (q92, alpha 100) hoặc maps2x/<tên>.jpg.
Dùng: CHUNK=i/n python cloud/ai/chay.py <file việc.json> <thư mục tài nguyên> <thư mục ra>
"""
import os, sys, json, glob, time
import numpy as np
from PIL import Image
import torch

job = json.load(open(sys.argv[1])); A = sys.argv[2]; OUT = sys.argv[3]; os.makedirs(OUT, exist_ok=True)
i, n = map(int, os.environ.get('CHUNK', '0/1').split('/'))
files = sorted({f for pat in job['files'] for f in glob.glob(os.path.join(A, pat))})[i::n]
torch.set_num_threads(os.cpu_count() or 2)
print(f'đoạn {i}/{n}: {len(files)} ảnh, {os.cpu_count()} nhân', flush=True)
t00 = time.time()

if job['task'] == 'depth':
    from transformers import AutoImageProcessor, AutoModelForDepthEstimation
    M = 'depth-anything/Depth-Anything-V2-Small-hf'
    proc = AutoImageProcessor.from_pretrained(M); model = AutoModelForDepthEstimation.from_pretrained(M).eval()
    H_IN = int(job.get('height', 756))   # bội của 14; 16:9 → 756 × 1344
    for f in files:
        t0 = time.time(); im = Image.open(f).convert('RGB'); W, H = im.size
        x = proc(images=im, return_tensors='pt', size={'height': H_IN, 'width': int(round(H_IN * W / H / 14) * 14)}, keep_aspect_ratio=False)
        with torch.no_grad(): d = model(**x).predicted_depth[None]
        d = torch.nn.functional.interpolate(d, size=(H, W), mode='bicubic', align_corners=False)[0, 0].numpy()
        lo, hi = np.percentile(d, 0.5), np.percentile(d, 99.5); d = np.clip((d - lo) / max(1e-6, hi - lo), 0, 1)
        name = os.path.splitext(os.path.basename(f))[0]
        Image.fromarray((d * 65535).astype(np.uint16)).save(os.path.join(OUT, name + '.depth.png'))
        print(f'  {name}: {W}x{H} → {time.time() - t0:.1f} s', flush=True)

elif job['task'] == 'upscale':
    import urllib.request
    from spandrel import ModelLoader
    # mặc định realesr-animevideov3 (SRVGG gọn, nhanh hơn anime_6B ~10 lần trên CPU — lần chạy anime_6B 31/10 quá 13 phút/ảnh)
    url = {'animevideov3': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-animevideov3.pth',
           'anime6b': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth'}[job.get('model', 'animevideov3')]
    pth = '/tmp/' + os.path.basename(url)
    if not os.path.exists(pth): urllib.request.urlretrieve(url, pth)
    model = ModelLoader().load_from_file(pth).model.eval(); S = 4
    T, P = int(job.get('tile', 384)), 16

    def up(rgb):   # rgb float32 H×W×3 (0..1) → ×4, chia ô có chồng mép để không lộ đường nối
        H, W = rgb.shape[:2]; out = np.zeros((H * S, W * S, 3), np.float32)
        x = torch.from_numpy(rgb).permute(2, 0, 1)[None]
        for y0 in range(0, H, T):
            for x0 in range(0, W, T):
                y1, x1 = min(H, y0 + T), min(W, x0 + T)
                ya, xa, yb, xb = max(0, y0 - P), max(0, x0 - P), min(H, y1 + P), min(W, x1 + P)
                with torch.no_grad(): o = model(x[:, :, ya:yb, xa:xb]).clamp(0, 1)[0].permute(1, 2, 0).numpy()
                out[y0 * S:y1 * S, x0 * S:x1 * S] = o[(y0 - ya) * S:(y0 - ya + y1 - y0) * S, (x0 - xa) * S:(x0 - xa + x1 - x0) * S]
        return out
    budget = 60 * float(job.get('budget_min', 25))   # trần thời gian mỗi đoạn — hết thì dừng (tránh ngốn phút máy GitHub)
    for f in files:
        if time.time() - t00 > budget: print(f'  hết {budget / 60:.0f} phút — bỏ {os.path.basename(f)} và các ảnh sau', flush=True); break
        t0 = time.time(); im = Image.open(f); name, ext = os.path.splitext(os.path.basename(f)); W, H = im.size
        has_a = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
        im = im.convert('RGBA') if has_a else im.convert('RGB')
        a = np.asarray(im).astype(np.float32) / 255
        rgb = up(a[..., :3])
        big = Image.fromarray((rgb * 255 + 0.5).astype(np.uint8)).resize((W * 2, H * 2), Image.LANCZOS)
        if has_a:
            al = up(np.repeat(a[..., 3:4], 3, 2)).mean(2)
            big.putalpha(Image.fromarray((al * 255 + 0.5).astype(np.uint8)).resize((W * 2, H * 2), Image.LANCZOS))
        sub = 'maps2x' if '/maps/' in f else 'cut2x'; os.makedirs(os.path.join(OUT, sub), exist_ok=True)
        if ext.lower() in ('.jpg', '.jpeg'): big.convert('RGB').save(os.path.join(OUT, sub, name + '.jpg'), quality=92)
        else: big.save(os.path.join(OUT, sub, name + '.webp'), 'WEBP', quality=92, method=4, alpha_quality=100)
        print(f'  {name}: {W}x{H} → {W * 2}x{H * 2} ({time.time() - t0:.0f} s)', flush=True)
print(f'xong sau {time.time() - t00:.0f} s', flush=True)
