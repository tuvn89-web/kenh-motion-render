"""BỘ PROMPT ẢNH 2.5D — anh.json -> prompts.md theo quy ước w-v03-ed, kèm tiêu chuẩn duyệt TIẾNG VIỆT.

    python3 tools/dung/goi_anh.py <thư mục tập>

anh.json:
{ "ten": "...", "luu_vao": "D:\\\\kenh-motion\\\\AC_ed\\\\tap\\\\T02\\\\anh\\\\", "seed0": 81001,
  "chen": {"GARMENT": "...", "LOT": "Around her, ..."},          # cụm tự đặt, gọi bằng {TÊN}
  "anh": [ {"ten": "REF_CHR01_1_celeste", "loai": "tạo mới", "nap": ["@OBJ01_1"], "canh": "ref",
            "prompt": "... {STYLE} {AVOID}", "vai": "Celeste · z560 · key green", "ghi_chu": "...",
            "duyet": {"nhom": "K|L|", "ngu_canh": "câu kịch bản / vai trò", "R": ["R1 · …", "R2 · …"], "thuoc": "câu thước tiếng Anh"}} ] }
Cụm có sẵn: {STYLE} {AVOID} {AVOID_OBJ} {NOTEXT} {LAYERS} {KEEP} {GREEN} {WHITE}.
"""
import json, os, re, sys

EP = os.path.abspath(sys.argv[1])
A = json.load(open(os.path.join(EP, 'anh.json'), encoding='utf-8'))
NICHE = A.get('ngach', 'financial-magazine')
BASE = {
    'STYLE': (f"Premium editorial {NICHE} illustration, semi-realistic hand-drawn artwork, clean dark ink outlines, "
              "carefully rendered facial anatomy, subtle paper texture, muted warm pastel palette, sophisticated magazine aesthetic."),
    'AVOID': ("Avoid photorealism, 3D rendering, anime, exaggerated anatomy, brand logos, borders around the illustration, "
              "foreground blur, objects blocking frame edges."),
    'AVOID_OBJ': ("Avoid photorealism, 3D rendering, anime, exaggerated anatomy, brand logos, borders around the illustration, "
                  "turnaround sheets, model sheets, duplicate objects, inset frames."),
    'NOTEXT': 'No readable text anywhere.',
    'LAYERS': ("Clear separation between the depth planes, with empty space around the main silhouette. Everything in sharp focus, "
               "no depth-of-field blur, no motion blur. Keep every important detail inside the central 85% of the frame."),
    'KEEP': 'Keep the exact same framing, size, position, perspective and lighting. Change nothing else.',
    'GREEN': 'Replace everything else with a flat pure green background (#00FF00), no shadow on the background.',
    'WHITE': 'Replace everything else with a flat pure white background (#FFFFFF), no shadow on the background.',
}
SUB = {**BASE, **A.get('chen', {})}
GENERAL = open(os.path.join(os.path.dirname(__file__), 'tieu_chuan_chung.md'), encoding='utf-8').read()

# Tool Flow (botflow v6.9 · docs: project claude/MO_TA_TOOL_FLOW.md): thẻ @ ghi ĐÚNG TÊN ĐẦY ĐỦ của ảnh
# (Flow chọn ảnh có tiêu đề trùng hẳn; tool khoá prompt tới khi ảnh đó xong). Nguồn viết tắt @CHR01_1 → @REF_CHR01_1_celeste.
NAMES = [a['ten'] for a in A['anh']]
FULL = {m.group(1): n for n in NAMES for m in [re.match(r'REF_([A-Z]{3}\d{2}_\d+)_', n)] if m}
CO_SAN = set(A.get('co_san', []))  # ref đã gen ở Project Flow từ trước (mã ngắn hoặc tên đủ)
B, seen, errs = [], set(), []
for n in NAMES:
    if not re.fullmatch(r'[A-Za-z0-9_]+', n):
        errs.append(f"{n}: tên chỉ được A–Z a–z 0–9 _ (tool dùng '-' làm hậu tố -a/-b)")
    for o in NAMES:
        if o != n and re.search(r'(?<![A-Za-z0-9])' + re.escape(n) + r'(?![A-Za-z0-9])', o):
            errs.append(f"{n}: là đoạn tách rời của tên {o} (thẻ @{n} sẽ khoá nhầm)")
if len(set(NAMES)) != len(NAMES):
    errs.append('tên ảnh bị trùng')


def full(tag):
    return FULL.get(tag, tag)


for i, a in enumerate(A['anh']):
    p = a['prompt']
    for _ in range(3):
        p = re.sub(r'\{([A-Z_]+)\}', lambda m: SUB.get(m.group(1), m.group(0)), p)
    p = ' '.join(p.split())
    p = re.sub(r'@([A-Za-z0-9_]+)', lambda m: '@' + full(m.group(1)), p)
    if re.search(r'\{[A-Z_]+\}', p):
        errs.append(f"{a['ten']}: cụm chưa định nghĩa {re.findall(r'{[A-Z_]+}', p)}")
    if re.search(r'\S@', p):
        errs.append(f"{a['ten']}: thiếu khoảng trắng trước @")
    if '[' in p or ']' in p or '#..' in p or '..#' in p:
        errs.append(f"{a['ten']}: prompt chứa [ ] hoặc chuỗi bao của tool")
    if len(p) >= 2000:
        errs.append(f"{a['ten']}: {len(p)} ký tự (Flow cắt ở ~2000)")
    for tag in re.findall(r'@([A-Za-z0-9_]+)', p):
        if tag not in seen and tag not in CO_SAN and not any(full(c) == tag for c in CO_SAN):
            errs.append(f"{a['ten']}: gọi @{tag} trước khi ảnh đó được gen" + ('' if tag in NAMES else ' (không có ảnh tên này)'))
    seen.add(a['ten'])
    d = a.get('duyet', {})
    if not d.get('R'):
        errs.append(f"{a['ten']}: thiếu tiêu chuẩn duyệt")
    nap = ['@' + full(x.lstrip('@')) for x in a.get('nap', [])]
    B.append({**a, 'prompt': p, 'nap': nap, 'gen': f'{i + 1}/{len(A["anh"])}', 'seed': A.get('seed0', 81001) + i})
if errs:
    print('LỖI:\n  ' + '\n  '.join(errs))
    sys.exit(1)

N = len(B)
CR0, CR1 = '+*#', '#*+'  # bao tiêu chí duyệt dưới mỗi prompt (Cậu Cả chốt 25/10)
head = [f"# Bộ prompt 2.5D — {A['ten']} ({N} ảnh)", '',
        'Flow · Nano Banana 2 Standard · **tải 2K** · 16:9. Đi từ trên xuống dưới là đúng thứ tự gen. Ảnh sau gọi ảnh trước bằng `@` + **TÊN ĐẦY ĐỦ** (đúng tên ảnh trên Flow).',
        'Nhập thẳng file này vào tool Flow: định dạng tool *khuyên dùng* (tên bao bằng hai dấu thăng + ngoặc vuông, prompt bao bằng hai chấm + dấu thăng). Tiêu chí duyệt nằm ngay dưới mỗi prompt, bao đầu bằng cộng-sao-thăng, bao cuối bằng thăng-sao-cộng.',
        'Một lượt ra nhiều ảnh (-a/-b…): **chọn 1, xoá ảnh thừa trên Flow trước khi chạy ảnh gọi tới nó** (mỗi tên chỉ để lại một ảnh).',
        f"Lưu TẤT CẢ vào: `{A.get('luu_vao', 'tap\\\\<mã>\\\\anh\\\\')}` (đuôi tên Flow tự thêm không sao).",
        (f"**Ref đã có từ trước — phải có sẵn trong Project Flow:** {', '.join('`' + full(c) + '`' for c in A['co_san'])}." if A.get('co_san') else ''), '', GENERAL, '',
        '## Bảng gen', '', '| # | tên file | loại | nạp khi gen | cảnh | vào video |', '| --- | --- | --- | --- | --- | --- |']
head += [f"| {b['gen']} | `{b['ten']}` | {b['loai']} | {' · '.join(b.get('nap', [])) or '—'} | {b.get('canh', '')} | {b.get('vai', '—')} |" for b in B]
body = []
for b in B:
    body += ['', f"##[{b['ten']}]##", f"GEN: {b['gen']} · LOẠI: {b['loai']}" + (f" · NẠP: {' · '.join(b['nap'])}" if b.get('nap') else ''),
             f"MODEL: nano-banana-2 | AR: 16:9 | RES: 2K | SEED: {b['seed']}", f"PROMPT: ..# {b['prompt']} #.."]
    d = b['duyet']
    tag = {'K': 'C1–C5 + K1–K3', 'L': 'C1–C5 + L1–L4'}.get(d.get('nhom', ''), 'C1–C5')
    cr = [f"DUYỆT · chung: {tag}" + (f" · ngữ cảnh: {d['ngu_canh']}" if d.get('ngu_canh') else '')] + list(d['R'])
    if b.get('ghi_chu'):
        cr.append(f"Ghi chú: {b['ghi_chu']}")
    if d.get('thuoc'):
        cr.append(f"THUỐC A (chỉ dán khi trượt tỉ lệ cả 2 lượt): {d['thuoc']}")
    crit = '\n'.join(cr)
    if any(m in crit or m in b['prompt'] for m in (CR0, CR1)):
        sys.exit(f"{b['ten']}: chữ trùng dấu bao tiêu chí")
    body.append(f"{CR0} {crit} {CR1}")  # tiêu chí duyệt — bao +*# … #*+ (tool đọc riêng)
foot = ['', '## Bảng ghi kết quả', '', 'Ghi theo bảng này rồi mới bàn sửa — nhận xét kiểu "ảnh xấu" không sửa được gì.', '',
        '| # | tên file | lượt chọn | kết quả (ĐẠT / MỘT PHẦN / TRƯỢT) | trượt tiêu chí nào | có dùng thuốc |', '| --- | --- | --- | --- | --- | --- |']
foot += [f"| {b['gen']} | `{b['ten']}` | | | | |" for b in B]
open(os.path.join(EP, 'prompts.md'), 'w', encoding='utf-8').write('\n'.join(head + body + foot) + '\n')
wc = sorted(len(b['prompt'].split()) for b in B)
print(f"{N} ảnh · prompt dài nhất {max(len(b['prompt']) for b in B)} ký tự · trung vị {wc[N // 2]} từ")
