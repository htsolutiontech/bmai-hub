# BMAI Hub – Vận hành đồng bộ

## Luồng dữ liệu (giờ VN)
1. 08:01–08:21 (T2–T6): BMAI Agent 1–8 ghi bản tin vào BMAI Agent Hub (`briefs/<agent>/days/<YYYYMMDD>`); BMAI Radar ghi `radar/` mỗi giờ 9:35–17:35.
2. 08:41: BMAI Digest gửi email tổng hợp.
3. 08:50 và 12:50 (hằng ngày): scheduled task **BMAI GitHub Sync** (nội dung trong `SYNC-PROMPT.md`) xuất Hub → `node tools/encrypt.mjs` → commit `data/*.json` → GitHub Pages.
4. GitHub Actions `bmai-guard` (`.github/workflows/bmai-guard.yml`): 10:23 (T2–T7) và 13:23 (T2–T6) kiểm tra đủ file công cụ, dữ liệu đã mã hóa, và có bản tin của ngày làm việc gần nhất. Lỗi → GitHub gửi email "Run failed: bmai-guard". Mỗi lần push vào `data/`, `tools/` cũng chạy kiểm tra an toàn.
   - Bật email: GitHub › Settings › Notifications › Actions › "Send notifications for failed workflows only".
   - Chạy tay: tab Actions › bmai-guard › Run workflow.

## Điều kiện bắt buộc
- Claude GitHub App phải được cấp cho repo `htsolutiontech/bmai-hub` (Contents: Read & write): https://github.com/apps/claude/installations/select_target
  Thiếu bước này thì tác vụ đồng bộ không push được. Đây là lý do repo đứng yên từ 17/11/2026.

## data/status.json (công khai)
Chỉ chứa thời điểm đồng bộ (`at`, `generated`), ngày bản tin mới nhất (`latestDate`, `latest.<agent>`) và số đếm (`counts`). Không có nội dung bản tin. `bmai_guard.mjs safety` từ chối mọi trường khác.

## Không xóa các file sau
`keys.json`, `index.html`, `setup.html`, `tools/encrypt.mjs`, `tools/bmai_guard.mjs`, `.github/workflows/bmai-guard.yml`.

## Lệnh thủ công
```bash
node tools/encrypt.mjs --in /tmp/bmai-plain   # thư mục thô NGOÀI repo
node tools/bmai_guard.mjs safety
node tools/bmai_guard.mjs freshness
```
