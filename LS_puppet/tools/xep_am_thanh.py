"""XẾP TIẾNG SONNISS VÀO THƯ VIỆN (D3, 29/10/2026)
Dùng: python tools/xep_am_thanh.py <thư mục đã giải nén am_thanh_*.zip> <bang.tsv> [--lib am_thanh]
- bang.tsv (từ máy GitHub, bước tim_rut): <file rút> <loại> <gói zip> <tên gốc trong gói>
- Lọc theo TÊN GỐC (loại bỏ tiếng sai ngữ cảnh: còi xe, tuyết, cửa sổ, đám đông sân vận động…), đổi tên theo vai trò
  của bộ trộn (tools/am_thanh.py → ROLE): ngựa tách phi / kiệu / hí, lửa tách lửa trại / cháy lớn, braam → điểm nhấn…
- Ghi am_thanh/NGUON.tsv (file → gói, tên gốc) để tra giấy phép (Sonniss GDC: dùng thương mại, không cần ghi nguồn,
  KHÔNG phân phối lại file rời — chỉ để trong kho riêng tư và máy Cậu Cả).
"""
import os, re, sys, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, tsv = sys.argv[1], sys.argv[2]
LIB = sys.argv[sys.argv.index('--lib') + 1] if '--lib' in sys.argv else os.path.join(ROOT, 'am_thanh')
os.makedirs(LIB, exist_ok=True)
NO = {   # tên gốc chứa các từ này thì KHÔNG dùng cho loại đó
    'buoc_chan': r'snow|wood|metal|stair|concrete|tile|heel|ice|water|ladder|robot|creature|monster',
    'hanh_quan': r'band|drum|music|toy',
    'giap': r'sci.?fi|robot|space|mech|shield (power|energy|hum)|force ?field|electric',
    'ken': r'car|vehicle|truck|bike|clown|party|air ?horn|fog ?horn|ship|boat|train|bus|honk|toy|bicycle|dj|stadium',
    'dam_dong': r'stadium|sport|football|soccer|concert|applause|kids|children|school|ui|menu|button|game ?over|music',
    'kiem': r'cymbal|drum|pan|kitchen|cutlery|laser|sci.?fi|light ?saber|car|door|glass',
    'giao': r'sci.?fi|laser|magic|spell|ui|car|plane|jet|wind',
    'nga': r'door|car|bag|box|crate|furniture|book|phone',
    'dao_dat': r'snow|sand ?castle',
    'da_do': r'glass|ice|plastic|metal|car|building alarm|ui',
    'dong_dat': r'engine|car|truck|motor|train|space|sci.?fi|stomach|cat|purr',
    'qua': r'crowd|crown',
    'chim': r'parrot|seagull|gull|tropical|jungle|rainforest|toy|chicken|rooster|city|traffic|electronic',
    'nuoc': r'city|traffic|boat|engine|drain|sink|toilet|pipe|tap|faucet|shower',
    'gio': r'window|wind ?up|winding|chime|instrument|wind ?turbine|car|traffic|indoor|whistle|flute',
    'lua': r'gun|fire ?arm|firework|rocket|cannon|extinguish|alarm|torch whoosh|lighter|match|gas|stove|cooking',
    'nhac_nen': r'sci.?fi|space|robot|electronic|synth ?pop|dubstep|trailer voice',
    'giay': r'plastic|toilet|towel|money|bill',
    'ngua': r'toy|robot|pantomime|coconut|rocking',
}
def role(cat, name):
    n = name.lower()
    if cat in NO and re.search(NO[cat], n): return None
    if cat == 'ngua':
        if re.search(r'gallop|canter|run', n): return 'ngua_gallop'
        if re.search(r'neigh|whinn|snort|vocal|nicker|blow', n): return 'ngua_neigh'
        return 'ngua_trot'
    if cat == 'giao': return 'giao_bay' if re.search(r'spear|arrow|javelin|bow|throw', n) else 'whoosh'
    if cat == 'lua': return 'lua_chay_lon' if re.search(r'big|large|inferno|house|building|forest|roar|blaze|bonfire', n) else 'lua_trai'
    if cat == 'nhac_nen': return 'diem_nhan' if re.search(r'braam|hit|impact|boom|drop|stab', n) else 'nhac_cang_thang'
    if cat == 'dam_dong' and not re.search(r'cry|shout|yell|scream|charge|army|soldier|war|battle ?crowd|crowd|attack|fight', n): return None
    if cat == 'chim': return 'chim_sang' if re.search(r'dawn|morning|meadow|chorus|lark|song', n) else 'chim'
    if cat == 'nuoc': return 'nuoc_vo_bo' if re.search(r'lap|shore|lake|gentle|soft|calm', n) else 'nuoc'
    if cat == 'gio': return 'gio_nhe' if re.search(r'light|gentle|soft|calm|breeze|meadow|field', n) else 'gio'
    if cat == 'kiem': return 'kiem_va'
    if cat == 'nga': return 'nga_dat'
    if cat == 'giap': return 'giap_lach_cach'
    if cat == 'ken': return 'ken_xa'
    if cat == 'dam_dong': return 'dam_dong_la'
    if cat == 'buoc_chan': return 'buoc_chan_dat'
    return cat
count, rows, skipped = {}, [], []
for line in open(tsv, encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) < 4: continue
    f, cat, z, name = p[:4]
    fp = os.path.join(src, f)
    if not os.path.exists(fp): continue
    r = role(cat, name)
    if not r: skipped.append(f'{cat}\t{name}'); continue
    count[r] = count.get(r, 0) + 1; dst = f'{r}_{count[r]}.flac'
    shutil.copy(fp, os.path.join(LIB, dst)); rows.append(f'{dst}\t{z}\t{name}')
open(os.path.join(LIB, 'NGUON.tsv'), 'w', encoding='utf-8').write('file\tgói Sonniss\ttên gốc\n' + '\n'.join(rows) + '\n')
print('đã xếp:', ', '.join(f'{k} {v}' for k, v in sorted(count.items())))
print('bỏ (sai ngữ cảnh):', len(skipped)); [print('   ', s) for s in skipped[:40]]
