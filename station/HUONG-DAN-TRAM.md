# Trạm render kenh-motion (Windows, dùng GPU)

> **31/10/2026 — thư mục mới:** trạm nằm ở `D:\kenh-motion\3_may\tram\` (file việc ở `3_may\tram\jobs\`, kết quả `3_may\tram\done\`,
> tiến độ `3_may\tram\status.json`). Máy dựng: `3_may\ac-ed\`, `3_may\con-roi\`; dữ liệu tập: `4_tap\<ngách>\<tập>\`.
> Chuyển từ bố cục cũ: đóng cửa sổ trạm cũ → bấm đúp `3_may\tram\CHUYEN-TRAM.bat` (một lần).

## Cài một lần
1. Vào `D:\kenh-motion\3_may\tram\` → bấm đúp **setup.bat**.
   - Nếu máy chưa có Node.js, nó tự cài bằng winget, xong bảo bấm setup.bat lần nữa.
   - Lần đầu tải thư viện + trình duyệt render: 3–6 phút.
2. Bấm đúp **start-station.bat** → cửa sổ đen hiện "TRẠM RENDER ... đang chạy". Thu nhỏ, đừng tắt.
3. (Nên làm) bấm **install-autostart.bat** → trạm tự bật mỗi lần mở Windows.

## Cách nó làm việc
- Tổng Tham Mưu Trưởng thả file việc vào `D:\kenh-motion\3_may\tram\jobs\` (vd `meo-tap2.json`).
- Trạm render bằng GPU (ANGLE/Direct3D), mặc định **4K** (scale 2), chia đoạn 240 khung để Chrome không đầy bộ nhớ,
  hỏng giữa chừng thì chạy lại sẽ **tiếp tục từ đoạn đã xong**.
- Kết quả ở `D:\kenh-motion\3_may\tram\done\`: `<tên>.mp4`, `<tên>.sheet.jpg` (24 khung soát hình), `<tên>.result.json`.
- Tiến độ: `D:\kenh-motion\3_may\tram\status.json` (Tổng Tham Mưu Trưởng đọc file này). Nhật ký: `logs\`.

## Mẫu file việc
```json
{"composition": "Show3D", "props": {}, "scale": 2, "out": "show3d-4k"}
```
Tuỳ chọn: `"frames": 300` (chỉ render 300 khung đầu), `"chunk": 240`, `"concurrency": 6`, `"gl": "angle"`, `"keepParts": true`.
