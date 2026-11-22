#!/usr/bin/env node
// BMAI Hub – kiểm tra an toàn & độ tươi dữ liệu (GitHub Actions hoặc chạy tay). Không cần thư viện ngoài.
//   node tools/bmai_guard.mjs safety     # data/<agent>.json phải là gói mã hóa v2; status.json không chứa nội dung
//   node tools/bmai_guard.mjs freshness  # lỗi nếu bản tin mới nhất cũ hơn ngày làm việc dự kiến
import { readFileSync, existsSync } from "node:fs";
const AGENTS = ["finance", "ai", "funds", "ip", "smb", "edu", "hotel", "agri"];
const STATUS_KEYS = new Set(["v", "generated", "at", "agents", "latestDate", "latest", "counts"]);
const fail = m => { console.log("::error::" + m); process.exit(1); };
const read = p => JSON.parse(readFileSync(p, "utf8"));

function safety() {
  for (const k of AGENTS) {
    const p = `data/${k}.json`;
    if (!existsSync(p)) fail(`Thiếu ${p}.`);
    const d = read(p), keys = Object.keys(d).sort().join(",");
    if (d.v !== 2 || keys !== "ct,epk,iv,v" || !d.epk?.x || !d.ct) fail(`${p} KHÔNG ở dạng mã hóa v2 – không được phép công khai.`);
  }
  const s = read("data/status.json");
  const extra = Object.keys(s).filter(k => !STATUS_KEYS.has(k));
  if (extra.length) fail(`status.json có trường lạ (có thể lộ nội dung): ${extra.join(", ")}`);
  for (const [k, v] of Object.entries(s.latest || {})) if (v !== null && !/^\d{4}-\d{2}-\d{2}$/.test(v)) fail(`status.json latest.${k} không phải ngày.`);
  console.log("OK: dữ liệu công khai đều đã mã hóa.");
}

// Agent chạy 8:01–8:21, Digest 8:41, Sync 8:50 (T2–T6, giờ VN) → sau 9:30 phải có bản tin của hôm nay.
function expectedDay() {
  const d = new Date(Date.now() + 7 * 3600e3), dow = () => d.getUTCDay();
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (!(dow() >= 1 && dow() <= 5 && mins >= 9 * 60 + 30)) d.setUTCDate(d.getUTCDate() - 1);
  while (dow() === 0 || dow() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function freshness() {
  if (!existsSync("data/status.json")) fail("Chưa có data/status.json – lượt đồng bộ chưa từng chạy.");
  const s = read("data/status.json"), exp = expectedDay();
  if (!s.latestDate) fail(`status.json chưa có latestDate (bản encrypt.mjs cũ hoặc Hub rỗng); lần đồng bộ cuối: ${s.generated || "?"}.`);
  const late = AGENTS.filter(k => !s.latest?.[k] || s.latest[k] < exp);
  if (s.latestDate < exp) fail(`Dữ liệu cũ: bản tin mới nhất ${s.latestDate}, dự kiến phải có ${exp} (đồng bộ lần cuối ${s.generated}). Kiểm tra: (1) scheduled task BMAI Agent 1–8 có ghi Hub không; (2) BMAI GitHub Sync có quyền push repo bmai-hub không.`);
  if (late.length) console.log(`::warning::Agent chưa có bản tin ${exp}: ${late.join(", ")}`);
  console.log(`OK: bản tin mới nhất ${s.latestDate} (dự kiến ${exp}).`);
}
({ safety, freshness }[process.argv[2]] || (() => { console.log("Dùng: node tools/bmai_guard.mjs safety|freshness"); process.exit(2); }))();
