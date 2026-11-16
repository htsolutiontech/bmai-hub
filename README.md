# bmai-hub — BMAI Agent Hub trên GitHub Pages (v2, tự đồng bộ 8:00 hằng ngày)

Site: `https://htsolutiontech.github.io/bmai-hub/` (đổi `bmai-hub` nếu đặt tên repo khác)

## Cách vận hành

```
BMAI Digest / Radar ──ghi──▶ BMAI Agent Hub (Claude)
                                   │  8:00 mỗi ngày: tác vụ "BMAI GitHub Sync"
                                   ▼
             đọc Hub → mã hóa bằng KHÓA CÔNG KHAI (keys.json) → commit data/*.json
                                   ▼
             GitHub Pages tự đăng (1–2 phút) → người xem đăng nhập bằng mật khẩu vai trò
```

- **Chỉ 1 repo công khai.** Không cần GitHub Actions, Secrets hay server.
- **Mã hóa bất đối xứng.** Bên đồng bộ chỉ có khóa công khai, nên không giữ mật khẩu hay khóa riêng nào. Khóa riêng của từng agent nằm trong `keys.json` và được khóa bằng mật khẩu vai trò (PBKDF2 210.000 vòng → AES-256-GCM). Giải mã dùng ECDH P-256 + HKDF → AES-256-GCM.
- **Phân quyền.** Admin xem đủ 8 agent và Radar. User *n* chỉ giải mã được agent *n*, kèm Radar của agent đó.
- **Phạm vi dữ liệu:** giữ 14 bản tin gần nhất cho mỗi agent và Radar của 14 ngày gần nhất.
- **Theo dõi:** `data/status.json` công khai, chỉ ghi giờ đồng bộ. Site tự hiện nhãn đỏ khi quá 36 giờ chưa đồng bộ.

## Cấu trúc repo

| File | Vai trò |
|---|---|
| `index.html` | Giao diện site (VI/EN, sáng/tối, mọi thiết bị) |
| `setup.html` | Tạo `keys.json` từ 9 mật khẩu, chạy ngay trong trình duyệt |
| `keys.json` | Khóa công khai + khóa riêng đã bọc bằng mật khẩu (bạn tạo ở bước 2) |
| `data/<agent>.json`, `data/status.json` | Dữ liệu đã mã hóa, do tác vụ đồng bộ ghi |
| `tools/encrypt.mjs` | Script mã hóa (Node ≥ 18, không cần thư viện) |
| `SYNC-PROMPT.md` | Prompt của tác vụ đồng bộ 8:00 |

## Cài đặt một lần (khoảng 10 phút)

1. **Tạo repo công khai** `htsolutiontech/bmai-hub`, rồi tải toàn bộ thư mục này lên.
   - Kể cả file `.nojekyll`. Có thể bỏ file `keys.json` mẫu nếu có.
2. **Tạo khóa:** mở `setup.html` trên máy (nhấp đúp file), nhập 9 mật khẩu (mỗi cái ≥ 10 ký tự, khác nhau), bấm *Tạo và tải keys.json*.
   - Tải `keys.json` lên thư mục gốc của repo.
3. **Bật Pages:** repo → Settings → Pages → *Deploy from a branch* → `main` / `(root)` → Save.
4. **Cho tác vụ quyền ghi repo:** mở tác vụ "BMAI GitHub Sync" trong mục Scheduled tasks của Claude, gắn repo `htsolutiontech/bmai-hub` vào môi trường của tác vụ với quyền ghi (kết nối GitHub).
5. **Chạy thử:** bấm *Run now* cho tác vụ, hoặc đợi 8:00 sáng mai.
   - Mở site và đăng nhập. Dòng "Dữ liệu ngày" phải hiện giờ vừa đồng bộ.

## Vận hành thường ngày

- Không cần làm gì: 8:00 mỗi ngày tự đồng bộ.
- Lỗi thì điện thoại nhận thông báo "BMAI GitHub Sync thất bại…". Thành công thì không có thông báo.
- **Đổi mật khẩu:** chạy lại `setup.html`, thay `keys.json`, rồi *Run now* tác vụ đồng bộ.
- **Muốn đồng bộ nhiều lần trong ngày:** sửa lịch của tác vụ, ví dụ 8:00, 12:00 và 18:00.
- **Kiểm tra nhanh:** mở `https://htsolutiontech.github.io/bmai-hub/data/status.json`.

## Chạy tay (dự phòng)

Xuất dữ liệu từ Hub ra một thư mục **ngoài repo**, có cấu trúc:
- `briefs/<agent>/days/YYYYMMDD.json`
- `radar/YYYYMMDD-HHMM.json`

Sau đó chạy:

```bash
node tools/encrypt.mjs --in ../bmai-plain && git add data && git commit -m "Sync" && git push
```

Thiết kế: Mr Thuong AgenticAI
