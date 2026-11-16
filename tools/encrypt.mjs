#!/usr/bin/env node
// BMAI Hub v2 – mã hóa dữ liệu xuất từ BMAI Agent Hub thành data/<agent>.json + data/status.json.
// CHỈ cần khóa công khai trong keys.json – không cần mật khẩu, không cần secret.
// Dùng: node tools/encrypt.mjs --in <thư mục dữ liệu thô, NGOÀI repo> [--keys keys.json] [--out data]
// Thư mục thô: briefs/<agent>/days/YYYYMMDD.json  và  radar/YYYYMMDD-HHMM.json (đúng cấu trúc ArtifactData out_dir).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { webcrypto as wc } from "node:crypto";
const subtle = wc.subtle;

const AGENTS = ["finance", "ai", "funds", "ip", "smb", "edu", "hotel", "agri"];
const KEEP_BRIEFS = +(process.env.BMAI_KEEP_BRIEFS || 14);
const KEEP_RADAR_DAYS = +(process.env.BMAI_KEEP_RADAR_DAYS || 14);
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") && a.push([v.slice(2), arr[i + 1]]), a), []));
const IN = args.in, KEYS = args.keys || "keys.json", OUT = args.out || "data";
if (!IN) { console.error("Thiếu --in <thư mục dữ liệu thô>"); process.exit(2); }
if (resolve(IN).startsWith(resolve(".") + "/")) { console.error("Thư mục dữ liệu thô phải nằm NGOÀI repo (tránh commit dữ liệu chưa mã hóa)."); process.exit(2); }

const EC = { name: "ECDH", namedCurve: "P-256" };
const te = new TextEncoder(), b64e = u => Buffer.from(u).toString("base64");
const readJSON = p => JSON.parse(readFileSync(p, "utf8"));
const jsonFiles = d => existsSync(d) ? readdirSync(d).filter(f => f.endsWith(".json")).sort().map(f => join(d, f)) : [];
const unwrapDoc = o => (o && o.data && typeof o.data === "object" && !Array.isArray(o.data)) ? o.data : o;
const okUrl = u => /^https?:/i.test(u || "") && !/claude\.ai/i.test(u);

async function seal(pubJwk, k, obj) {
  const pub = await subtle.importKey("jwk", pubJwk, EC, false, []);
  const eph = await subtle.generateKey(EC, true, ["deriveBits"]);
  const bits = await subtle.deriveBits({ name: "ECDH", public: pub }, eph.privateKey, 256);
  const hk = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const key = await subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: te.encode("bmai-v2|" + k) }, hk, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = wc.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(JSON.stringify(obj))));
  const { kty, crv, x, y } = await subtle.exportKey("jwk", eph.publicKey);
  return { v: 2, epk: { kty, crv, x, y }, iv: b64e(iv), ct: b64e(ct) };
}
function vnNow() {
  const d = new Date(Date.now() + 7 * 3600e3), p = n => String(n).padStart(2, "0");
  return { date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`, label: `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} (giờ VN)` };
}

const K = readJSON(KEYS);
if (K.v !== 2 || !K.pub) throw new Error("keys.json không đúng định dạng v2 – tạo lại bằng setup.html");
const now = vnNow();
const cutoff = new Date(Date.parse(now.date) - (KEEP_RADAR_DAYS - 1) * 864e5).toISOString().slice(0, 10);
const runs = jsonFiles(join(IN, "radar")).map(f => unwrapDoc(readJSON(f)));
mkdirSync(OUT, { recursive: true });
const stats = {};
for (const k of AGENTS) {
  const briefs = jsonFiles(join(IN, "briefs", k, "days")).map(f => unwrapDoc(readJSON(f))).filter(b => b && b.date)
    .map(b => { const c = { ...b }; delete c.updatedAt; delete c.agent; c.sources = (c.sources || []).filter(s => okUrl(s.url)); return c; })
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, KEEP_BRIEFS);
  const seen = new Set(), radar = [];
  for (const r of runs) for (const i of r.items || []) {
    const date = i.date || r.date;
    if (i.topic !== k || !date || date < cutoff) continue;
    const id = [date, i.time, i.summary].join("|"); if (seen.has(id)) continue; seen.add(id);
    radar.push({ date, time: i.time || "", level: i.level === "Cao" ? "Cao" : "Vừa", topic: k, summary: String(i.summary || "").slice(0, 400), url: okUrl(i.url) ? i.url : "", label: i.label || "" });
  }
  radar.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  writeFileSync(join(OUT, k + ".json"), JSON.stringify(await seal(K.pub[k], k, { briefs, radar })));
  stats[k] = { briefs: briefs.length, latest: briefs[0]?.date || "-", radar: radar.length };
}
writeFileSync(join(OUT, "status.json"), JSON.stringify({ v: 2, generated: now.label, at: new Date().toISOString(), agents: AGENTS.length }, null, 1));
console.log("generated:", now.label); console.table(stats);
