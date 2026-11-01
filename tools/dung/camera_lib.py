"""THƯ VIỆN CHUYỂN ĐỘNG MÁY — theo CẢM XÚC của đoạn kịch bản, không theo thói quen.

Bài học demo T02 (25/10): mọi cảnh đều trôi mượt cùng một tốc độ, đẩy vào giữa khung, thị sai đều đều
→ trông như video môi giới nhà đất. Kể chuyện thì máy ĐỨNG khi nhân vật đứng, GIẬT khi tin dữ đến,
RUN khi giận, LÙI khi buông. Mỗi kiểu dưới đây trả về (khoá máy, độ rung tay, phần thị sai).

Tham số chung (toạ độ = pixel của ảnh/canvas):
  wide=[x,y]   điểm nhìn toàn cảnh (mặc định giữa ảnh)      subject=[x,y]  mặt / vật chính
  z0, z1       độ phóng đầu / cuối                           hits=[giây]    khoảnh khắc (mốc @… đã đổi ra giây)
  fstop        độ mờ hậu cảnh (0 = nét hết, 1 = mặc định)    rz             nghiêng khung (radian, dương = nghiêng phải)
Thêm kiểu mới: viết một hàm, đăng ký vào PRESETS, ghi một dòng vào docs/may-quay.md.
"""


def _k(t, look, zoom, **kw):
    d = {'t': round(max(0.0, t), 3), 'look': [round(look[0], 1), round(look[1], 1)], 'zoom': round(zoom, 3)}
    d.update({k: (round(v, 4) if isinstance(v, float) else v) for k, v in kw.items() if v is not None})
    return d


def _c(canvas):
    return [canvas[0] / 2, canvas[1] / 2]


def lang(dur, canvas, wide=None, z0=1.04, drift=0.025, fstop=None, rz=None, **_):
    """BÌNH THẢN / thường nhật — máy gần như đứng yên, chỉ trôi rất nhẹ. Dùng nhiều: cho mắt nghỉ."""
    w = wide or _c(canvas)
    return [_k(0, w, z0, fstop=fstop, rz=rz), _k(dur, [w[0] + canvas[0] * 0.006, w[1]], z0 * (1 + drift), ease='linear', fstop=fstop, rz=rz)], 0.3, 0.3


def chen(dur, canvas, subject=None, z1=1.4, fstop=None, rz=None, **_):
    """CẮT CẬN — vào thẳng chi tiết (mặt, con số, bàn tay). Không trôi; giữ khung để lời nói làm việc."""
    s = subject or _c(canvas)
    return [_k(0, s, z1, fstop=fstop, rz=rz), _k(dur, s, z1 * 1.02, ease='linear', fstop=fstop, rz=rz)], 0.35, 0.3


def lang_chen(dur, canvas, wide=None, subject=None, z0=1.03, z1=1.42, hits=None, fstop=None, **_):
    """TOÀN → CẮT CẬN trong cùng cảnh: đứng toàn cảnh, đến mốc hits[0] thì cắt thẳng vào mặt/chi tiết."""
    w, s = wide or _c(canvas), subject or _c(canvas)
    h = (hits or [dur * 0.45])[0]
    return [_k(0, w, z0, fstop=fstop), _k(h - 0.02, w, z0 * 1.015, ease='linear', fstop=fstop),
            _k(h, s, z1, cut=True, fstop=fstop), _k(dur, s, z1 * 1.025, ease='linear', fstop=fstop)], 0.3, 0.3


def cang(dur, canvas, wide=None, subject=None, z0=1.0, z1=None, fstop=None, rz=0.012, **_):
    """CĂNG THẲNG / điềm gở — trườn vào RẤT CHẬM về phía mặt hoặc vật gây chuyện, khung nghiêng dần."""
    w, s = wide or _c(canvas), subject or _c(canvas)
    return [_k(0, w, z0, fstop=fstop, rz=0.0), _k(dur, s, z1 or z0 * 1.2, ease='inout', share=0.6, fstop=fstop, rz=rz)], 0.45, 0.5


def soc(dur, canvas, wide=None, subject=None, z0=1.02, z1=1.38, hits=None, jolt=3.5, push=0.6, fstop=None, **_):
    """SỮNG SỜ / tin dữ — đứng im, đến đúng chữ gây sốc thì ĐẨY vào dứt khoát nhưng mềm (≈0,6 s, chậm dần) + rung nhẹ.
    Cậu Cả duyệt 25/10: bản giật 0,2 s 'quá cứng và nhanh, không nhất thiết phải thế' → mặc định mềm; muốn gắt hơn thì hạ push / tăng jolt."""
    w, s = wide or _c(canvas), subject or _c(canvas)
    h = (hits or [0.25])[0]
    ks = [_k(0, w, z0, fstop=fstop)]
    if h > 0.05:
        ks.append(_k(h, w, z0 * 1.006, ease='linear', fstop=fstop))
    ks += [_k(h + push, s, z1, ease='out', jolt=jolt, shake=0.6, fstop=fstop), _k(dur, s, z1 * 1.02, ease='linear', shake=0.5, fstop=fstop)]
    return ks, 0.25, 0.35


def gian(dur, canvas, subject=None, z0=1.1, hits=None, rz=0.028, fstop=None, **_):
    """TỨC GIẬN / bất bình — khung chật, nghiêng, rung tay mạnh; mỗi chữ nhấn (hits) giật vào một nấc."""
    s = subject or _c(canvas)
    ks, z, last = [_k(0, s, z0, rz=rz, shake=1.3, fstop=fstop)], z0, 0
    for h in sorted(hits or []):
        if h - last < 0.25 or h > dur - 0.2:
            continue
        ks.append(_k(h, s, z, ease='linear', rz=rz, shake=1.3, fstop=fstop))
        z *= 1.06
        ks.append(_k(h + 0.14, s, z, ease='snap', rz=rz, jolt=3.5, shake=1.4, fstop=fstop))
        last = h + 0.14
    ks.append(_k(dur, s, z * 1.01, ease='linear', rz=rz, shake=1.2, fstop=fstop))
    return ks, 1.3, 0.35


def ha_he(dur, canvas, wide=None, subject=None, z0=1.0, z1=1.22, fstop=None, **_):
    """HẢ HÊ / thoả mãn / tự đắc — bắt đầu sát mặt rồi LÙI RA thong thả, hơi vòng sang bên (có thị sai)."""
    w, s = wide or _c(canvas), subject or _c(canvas)
    return [_k(0, s, z1, ry=0.016, fstop=fstop), _k(dur, w, z0, ease='out', ry=-0.01, share=0.65, fstop=fstop)], 0.25, 0.65


def buon(dur, canvas, subject=None, z0=1.14, z1=1.0, fstop=None, **_):
    """BUỒN / lặng / buông xuôi — lùi rất chậm và hạ dần tầm nhìn; rung tay gần như không có."""
    s = subject or _c(canvas)
    return [_k(0, s, z0, fstop=fstop), _k(dur, [s[0], s[1] + canvas[1] * 0.04], z1, ease='inout', share=0.5, fstop=fstop)], 0.15, 0.5


def nhan_ra(dur, canvas, subject=None, z=1.12, v1=1.28, hits=None, fstop=None, **_):
    """VỠ LẼ — dolly-zoom: nhân vật giữ nguyên cỡ, thế giới phía sau kéo giãn. Cần ảnh 2.5D có lớp nền xa."""
    s = subject or _c(canvas)
    h = (hits or [0.3])[0]
    return [_k(0, s, z, vertigo=1.0, fstop=fstop), _k(h, s, z, vertigo=1.0, ease='linear', fstop=fstop),
            _k(min(dur, h + 2.2), s, z, vertigo=v1, ease='inout', fstop=fstop), _k(dur, s, z, vertigo=v1, ease='linear', fstop=fstop)], 0.2, 0.0


def do_theo(dur, canvas, path=None, z0=1.25, hits=None, fstop=None, **_):
    """ĐI THEO — lia theo một thứ đang chuyển động (vệt tô, ngón tay, chiếc xe). path=[[x,y],[x,y],…] rải đều hoặc theo hits."""
    p = path or [_c(canvas), _c(canvas)]
    ts = hits if hits and len(hits) == len(p) else [dur * i / (len(p) - 1) for i in range(len(p))]
    return [_k(t, pt, z0, ease='inout', fstop=fstop) for t, pt in zip(ts, p)], 0.35, 0.3


def nhip(dur, canvas, wide=None, z0=1.06, rz=0.0, fstop=None, **_):
    """DỰNG NHỊP / chuỗi chèn — khung tĩnh, mỗi cảnh lệch góc một chút (rz) để chuỗi cắt có nhịp."""
    w = wide or _c(canvas)
    return [_k(0, w, z0, rz=rz, fstop=fstop), _k(dur, w, z0 * 1.015, rz=rz, ease='linear', fstop=fstop)], 0.2, 0.3


def roi_di(dur, canvas, wide=None, z0=1.1, z1=1.0, fstop=None, **_):
    """RỜI ĐI / khép lại — khung toàn ĐỨNG YÊN để nhân vật tự ra khỏi khung, cuối cảnh mới lùi rất nhẹ."""
    w = wide or _c(canvas)
    return [_k(0, w, z0, fstop=fstop), _k(dur * 0.6, w, z0 * 0.995, ease='linear', fstop=fstop), _k(dur, w, z1, ease='inout', fstop=fstop)], 0.2, 0.6


PRESETS = {'lang': lang, 'chen': chen, 'lang-chen': lang_chen, 'cang': cang, 'soc': soc, 'gian': gian, 'ha-he': ha_he,
           'buon': buon, 'nhan-ra': nhan_ra, 'do-theo': do_theo, 'nhip': nhip, 'roi-di': roi_di}


def clamp_keys(keys, canvas, ov, name=''):
    """Không bao giờ lộ mép ảnh: |look - giữa| <= kích thước*(ov - 1/zoom)/(2*ov) trừ lề rung tay."""
    for k in keys:
        z = k['zoom'] * k.get('vertigo', 1) ** 0  # vertigo keeps framing
        for ax, size in ((0, canvas[0]), (1, canvas[1])):
            lim = size * (ov - 1 / z) / (2 * ov) - size * 0.012 * (1 + k.get('shake', 0.5))
            c = size / 2
            if lim < 0:
                lim = 0
            k['look'][ax] = round(min(max(k['look'][ax], c - lim), c + lim), 1)
