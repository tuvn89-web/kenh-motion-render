"""Lấy tiếng động có giấy phép cho video (Cậu Cả cho phép 29/10/2026: chọn "cách 1" — máy GitHub tải từ thư viện Sonniss GDC).
Chỉ làm các việc sau, theo file việc cloud/am_thanh/<tên>.json:
  {"buoc": "tim_link"}                                  → tìm link các gói zip trên trang gdc.sonniss.com
  {"buoc": "liet_ke", "zip": [url, ...]}               → đọc MỤC LỤC từng zip từ xa (không tải cả gói), ghi danh sách file âm thanh
  {"buoc": "rut", "zip": url, "file": [tên trong zip]} → chỉ rút đúng các file đó, đổi sang FLAC, gói lại
  {"buoc": "tim_rut", "zip": [url theo thứ tự ưu tiên], "loai": {tên: [regex, số file tối đa]}}
        → lần lượt từng gói: đọc mục lục (từ xa nếu máy chủ cho, không thì tải gói về đĩa rồi xoá ngay), rút file khớp
          từng loại tiếng (cắt tối đa 75 giây, FLAC 48 kHz), dừng khi đủ mọi loại hoặc hết giờ
  {"buoc": "chon_rut", "file": [[url zip, đường dẫn trong zip, tên ra], ...], "giay": 90}
        → rút ĐÚNG danh sách đã chọn từ mục lục (gom theo gói, mỗi gói đọc từ xa hoặc tải về rồi xoá), đặt tên theo vai trò tiếng
Giấy phép Sonniss GDC: dùng thương mại, không cần ghi nguồn; KHÔNG phát tán lại file lẻ → kết quả chỉ để trong Releases của kho riêng tư."""
import json, os, re, sys, subprocess, urllib.request, zipfile
job = json.load(open(sys.argv[1])); out = 'ket_qua'; os.makedirs(out, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'}
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read().decode('utf-8', 'ignore')
if job['buoc'] == 'tim_link':
    links = set()
    for u in ['https://gdc.sonniss.com/', 'https://sonniss.com/gameaudiogdc']:
        try:
            s = get(u); open(os.path.join(out, re.sub(r'\W', '_', u) + '.html'), 'w').write(s)
            links |= set(re.findall(r'href=["\']([^"\']+)["\']', s)) | set(re.findall(r'https?://[^\s"\'<>]+\.(?:zip|torrent)', s))
        except Exception as e: print('lỗi', u, e)
    json.dump(sorted(links), open(os.path.join(out, 'links.json'), 'w'), indent=1); print('\n'.join(sorted(links)))
elif job['buoc'] == 'liet_ke':
    from remotezip import RemoteZip
    for u in job.get('trang', []):   # vd trang điều khoản giấy phép, lưu lại để đối chiếu
        try: open(os.path.join(out, re.sub(r'\W', '_', u)[-60:] + '.html'), 'w').write(get(u))
        except Exception as e: print('lỗi', u, e)
    for i, u in enumerate(job['zip']):
        try:
            with RemoteZip(u, headers=UA) as z:
                names = [f'{x.file_size}\t{x.filename}' for x in z.infolist() if x.filename.lower().endswith(('.wav', '.flac', '.mp3', '.ogg', '.aif', '.aiff'))]
            open(os.path.join(out, f'muc_luc_{i}.txt'), 'w').write(u + '\n' + '\n'.join(names)); print(u, len(names), 'file')
        except Exception as e: print('lỗi', u, e)
elif job['buoc'] == 'rut':
    from remotezip import RemoteZip
    os.makedirs('rut', exist_ok=True)
    with RemoteZip(job['zip'], headers=UA) as z:
        for n in job['file']:
            try:
                p = z.extract(n, 'rut'); dst = os.path.join('rut', re.sub(r'[^\w.-]+', '_', os.path.basename(n)).rsplit('.', 1)[0] + '.flac')
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-ac', '2', '-ar', '48000', dst], check=True); os.remove(p); print('ok', n)
            except Exception as e: print('lỗi', n, e)
    with zipfile.ZipFile(os.path.join(out, job.get('ten', 'am_thanh') + '.zip'), 'w') as zz:
        for f in sorted(os.listdir('rut')):
            if f.endswith('.flac'): zz.write(os.path.join('rut', f), f)

elif job['buoc'] == 'tim_rut':
    import time, shutil
    from remotezip import RemoteZip
    t_start = time.time(); budget = job.get('phut', 110) * 60
    loai = {k: (re.compile(v[0], re.I), v[1]) for k, v in job['loai'].items()}
    got = {k: [] for k in loai}; os.makedirs('rut', exist_ok=True); bang = []
    def need(): return [k for k, (rx, mx) in loai.items() if len(got[k]) < mx]
    for u in job['zip']:
        if not need() or time.time() - t_start > budget: break
        try:
            try: z = RemoteZip(u, headers=UA); src = 'xa'
            except Exception:
                tmp = 'goi.zip'; t0 = time.time()
                subprocess.run(['curl', '-sSL', '-A', UA['User-Agent'], '--retry', '3', '-o', tmp, u], check=True)
                z = zipfile.ZipFile(tmp); src = f'tải {os.path.getsize(tmp) / 1e9:.1f} GB / {time.time() - t0:.0f} s'
            names = [x.filename for x in z.infolist() if x.filename.lower().endswith(('.wav', '.flac', '.aif', '.aiff', '.mp3', '.ogg'))]
            open(os.path.join(out, 'muc_luc.txt'), 'a').write('\n'.join(u.rsplit('/', 1)[1] + '\t' + n for n in names) + '\n')
            print(u, len(names), 'file', src, 'còn thiếu:', need(), flush=True)
            for n in names:
                ks = [k for k in need() if loai[k][0].search(n)]
                if not ks: continue
                k = ks[0]
                try:
                    p = z.extract(n, 'tam'); dst = os.path.join('rut', f'{k}_{len(got[k]) + 1}.flac')
                    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-t', '75', '-ac', '2', '-ar', '48000', dst], check=True)
                    got[k].append(n); bang.append(f'{os.path.basename(dst)}\t{k}\t{u.rsplit("/", 1)[1]}\t{n}'); print('  +', k, n, flush=True)
                except Exception as e: print('  lỗi rút', n, e)
                shutil.rmtree('tam', ignore_errors=True)
            z.close()
        except Exception as e: print('lỗi gói', u, e)
        if os.path.exists('goi.zip'): os.remove('goi.zip')
    open(os.path.join(out, 'bang.tsv'), 'w').write('\n'.join(bang) + '\n')
    print('còn thiếu:', need())
    files = sorted(os.listdir('rut')); part, size, k = 1, 0, None
    for f in files:
        if k is None or size > 180e6: k = zipfile.ZipFile(os.path.join(out, f'am_thanh_{part}.zip'), 'w'); part += 1; size = 0
        k.write(os.path.join('rut', f), f); size += os.path.getsize(os.path.join('rut', f))

elif job['buoc'] == 'chon_rut':
    import shutil, time
    from remotezip import RemoteZip
    by = {}
    for u, n, dst in job['file']: by.setdefault(u, []).append((n, dst))
    os.makedirs('rut', exist_ok=True); bang = []; sec = str(job.get('giay', 90))
    for u, items in by.items():
        t0 = time.time()
        try:
            try: z = RemoteZip(u, headers=UA); src = 'xa'
            except Exception:
                subprocess.run(['curl', '-sSL', '-A', UA['User-Agent'], '--retry', '3', '-o', 'goi.zip', u], check=True)
                z = zipfile.ZipFile('goi.zip'); src = f'tải {os.path.getsize("goi.zip") / 1e9:.1f} GB'
            names = set(z.namelist())
            for n, dst in items:
                if n not in names: print('  không thấy', n); continue
                try:
                    p = z.extract(n, 'tam'); d = os.path.join('rut', dst + '.flac')
                    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-t', sec, '-ac', '2', '-ar', '48000', d], check=True)
                    bang.append(f'{dst}.flac\t{u.rsplit("/", 1)[1]}\t{n}'); print('  +', dst, '<-', n.rsplit('/', 1)[-1], flush=True)
                except Exception as e: print('  lỗi rút', n, e)
                shutil.rmtree('tam', ignore_errors=True)
            z.close(); print(u.rsplit('/', 1)[1], src, f'{time.time() - t0:.0f} s', flush=True)
        except Exception as e: print('lỗi gói', u, e)
        if os.path.exists('goi.zip'): os.remove('goi.zip')
    open(os.path.join(out, 'bang.tsv'), 'w').write('\n'.join(bang) + '\n')
    with zipfile.ZipFile(os.path.join(out, 'am_thanh_chon.zip'), 'w') as zz:
        for f in sorted(os.listdir('rut')): zz.write(os.path.join('rut', f), f)
    print('xong', len(bang), 'file')
