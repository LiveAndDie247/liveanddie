// Pull the full audio of the songs in archive/index.json (entries with "song": true) out of the
// original reels in the Instagram export scratch folder (~/igwork, made by ig-archive.mjs).
//   node tools/songs-audio.mjs        -> archive/a/<id>.m4a (AAC 128k), skips ones already made
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const WORK = path.join(os.homedir(), "igwork", "media");
if (!fs.existsSync(WORK)) { console.log(`no ${WORK}: run ig-archive.mjs on the export zips again first`); process.exit(1); }
const files = [];
const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(path.join(d, f.name)) : files.push(path.join(d, f.name)); };
walk(WORK);
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "archive/index.json"), "utf8"));
fs.mkdirSync(path.join(ROOT, "archive/a"), { recursive: true });
let made = 0, missing = 0;
for (const p of idx.filter(p => p.song)) for (const m of p.media.filter(m => m.audio)) {
  const out = path.join(ROOT, "archive", m.audio);
  if (fs.existsSync(out) && fs.statSync(out).size > 1000) continue;
  const src = files.find(f => path.basename(f).replace(/\.[^.]+$/, "").replace(/[^\w-]/g, "").slice(-24) === m.id);
  if (!src) { console.log(`  missing original for ${m.id}`); missing++; continue; }
  try {
    execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-vn", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out], { stdio: ["ignore", "inherit", "inherit"] });
    made++; console.log(`  ${p.date} ${(p.caption || "").split("\n")[0].slice(0, 50)}`);
  } catch (e) { console.log(`  failed ${m.id}`); }
}
const mb = fs.readdirSync(path.join(ROOT, "archive/a")).reduce((s, f) => s + fs.statSync(path.join(ROOT, "archive/a", f)).size, 0) / 1048576;
console.log(`\nDONE: ${made} new, ${missing} missing, ${mb.toFixed(1)} MB in archive/a/`);
