#!/usr/bin/env node
// Every print gets a unique QR code that opens a page made only for that piece.
//   node tools/make-print-codes.js ARC-0802 ARC-0800 ...
// Creates  p/<token>/index.html  (deployed: animated ascii + story + hidden track for that piece)
//          p/<token>/story.txt   (deployed: write the story of the piece here; never overwritten)
//          print-codes/<ARC>.png (NOT deployed: the QR image to put on the print / certificate)
// Tokens are remembered in prints.private.json (NOT deployed) so re-running never changes a code.
// Drop the hidden track for a print at  p/<token>/track.m4a  and run this again for that id (the page then shows the player).
const fs = require("fs"), path = require("path"), crypto = require("crypto"), zlib = require("zlib");
const ROOT = path.resolve(__dirname, ".."), P = f => path.join(ROOT, f), SITE = process.env.SITE || "https://liveanddie.xyz";
const qrcode = require(P("vendor/qr/qrcode.js"));
const ids = process.argv.slice(2).map(s => s.toUpperCase()).filter(s => /^ARC-\d{4}$/.test(s));
if (!ids.length) { console.log("usage: node tools/make-print-codes.js ARC-0802 ARC-0800 ..."); process.exit(1); }
const idx = JSON.parse(fs.readFileSync(P("archive/index.json"), "utf8"));
const mapPath = P("prints.private.json"), map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : {};
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function png(mods, scale, quiet) {                       // 1-bit style greyscale PNG of a QR matrix
  const n = mods.length, W = (n + quiet * 2) * scale, raw = Buffer.alloc((W + 1) * W, 255);
  for (let y = 0; y < W; y++) { raw[y * (W + 1)] = 0; const my = Math.floor(y / scale) - quiet; for (let x = 0; x < W; x++) { const mx = Math.floor(x / scale) - quiet; if (my >= 0 && my < n && mx >= 0 && mx < n && mods[my][mx]) raw[y * (W + 1) + 1 + x] = 0; } }
  const crcT = []; for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[i] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const page = (piece, token, hasTrack) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(piece.no)} // print edition</title><link rel="stylesheet" href="/gate/font.css"><link rel="icon" type="image/png" href="/favicon.png">
<style>html,body{margin:0;background:#000;color:#ff3030;font:16px/1.3 "Web437 VGA","Courier New",monospace;-webkit-font-smoothing:none}body{padding:12px;max-width:720px;margin:0 auto}
pre{white-space:pre-wrap;margin:0 0 12px;font:inherit}a{color:#4070ff;text-decoration:none}.b{color:#4070ff}.d{color:#802020}#art{margin:0 0 12px;line-height:0}#art canvas{max-width:100%;image-rendering:pixelated}audio{width:100%;margin:6px 0 12px;filter:invert(1) hue-rotate(180deg)}</style></head>
<body>
<pre><span class="b">live.and.die // print edition</span>
${esc(piece.no)}  ${esc(piece.title)}
<span class="d">${esc(piece.medium || piece.year)}  -  this page exists only for the owner of this print.</span></pre>
<div id="art"></div>
<pre class="b">// the story</pre><pre id="story" class="d">...</pre>
<pre class="b">// hidden track</pre>${hasTrack ? '<audio id="trk" controls loop preload="none" src="./track.m4a"></audio>' : '<pre class="d">the hidden track for this print is still being cut. come back - this page is yours.</pre>'}
<pre><a href="/#open%20${esc(piece.no)}">&gt; open it in the terminal</a>   <a href="/">&gt; live.and.die</a></pre>
<script type="module">
import { createAscii } from "/mods/gl.mjs";
const PIECE = ${JSON.stringify(piece)};
const R = await createAscii({}); R.st.nocrop = false; R.st.contrast = 1.3; document.getElementById("art").appendChild(R.canvas);
const W = Math.min(696, innerWidth - 24); let src = null, H = W;
if (PIECE.loop) { const v = document.createElement("video"); v.src = PIECE.loop; v.muted = true; v.loop = true; v.playsInline = true; await v.play().catch(() => {}); src = v; H = Math.round(W * (v.videoHeight || 1) / (v.videoWidth || 1)); }
else { const im = new Image(); im.src = PIECE.img; await im.decode().catch(() => {}); src = im; H = Math.round(W * (im.naturalHeight || 1) / (im.naturalWidth || 1)); }
R.resize(W, Math.min(H, innerHeight * 0.7));
const cv = document.createElement("canvas"), cx = cv.getContext("2d"); cv.width = 320; cv.height = Math.round(320 * H / W);
let t0 = performance.now(), nextGlitch = 2000;
(function frame(t) {
  requestAnimationFrame(frame); if (!src || (src.readyState !== undefined && src.readyState < 2)) return;
  const e = (t - t0) / 1000, z = 1.06 + Math.sin(e * 0.23) * 0.06, dx = Math.sin(e * 0.17) * 8, dy = Math.cos(e * 0.13) * 6;      // slow breathing drift
  cx.setTransform(z, 0, 0, z, cv.width * (1 - z) / 2 + dx, cv.height * (1 - z) / 2 + dy); cx.drawImage(src, 0, 0, cv.width, cv.height);
  if (t > nextGlitch) { R.st.glitch = 0.8; if (Math.random() < 0.3) R.st.swap = !R.st.swap; nextGlitch = t + 2500 + Math.random() * 5000; } else R.st.glitch *= 0.9;
  R.draw(cv, cv.width, cv.height);
})(t0);
fetch("./story.txt").then(r => r.ok ? r.text() : "").then(s => { document.getElementById("story").textContent = s.trim() || "(the story of this piece has not been written down yet.)"; }).catch(() => {});
</script>
</body></html>
`;
fs.mkdirSync(P("print-codes"), { recursive: true });
const lines = [];
for (const id of ids) {
  const i = idx.length - parseInt(id.slice(4), 10), e = idx[i];
  if (!e || e.hide || !e.media || !e.media.length) { console.log("skip " + id + ": not a visible piece"); continue; }
  const cap = (e.caption || "").trim(), m = cap.match(/^[“"]([^”"]+)[”"]\s*(\(([^)]*)\))?/), title = m ? m[1].trim() : (cap.split("\n")[0] || "untitled").slice(0, 60);
  const token = map[id] || (map[id] = crypto.randomBytes(5).toString("hex")), md = e.media[0];
  const piece = { no: id, title, medium: m && m[3] ? m[3].trim() : "", year: (e.date || "").slice(0, 4), img: "/archive/" + (md.img || md.thumb), loop: md.loop ? "/archive/" + md.loop : null };
  fs.mkdirSync(P("p/" + token), { recursive: true });
  fs.writeFileSync(P("p/" + token + "/index.html"), page(piece, token, fs.existsSync(P("p/" + token + "/track.m4a"))));
  if (!fs.existsSync(P("p/" + token + "/story.txt"))) fs.writeFileSync(P("p/" + token + "/story.txt"), "");
  const url = SITE + "/p/" + token + "/", qr = qrcode(0, "M"); qr.addData(url); qr.make();
  const n = qr.getModuleCount(), mods = []; for (let r = 0; r < n; r++) { mods.push([]); for (let c = 0; c < n; c++) mods[r].push(qr.isDark(r, c)); }
  fs.writeFileSync(P("print-codes/" + id + ".png"), png(mods, 16, 4));
  lines.push(id + "  " + url + "  print-codes/" + id + ".png  (" + title + ")"); console.log(lines[lines.length - 1]);
}
fs.writeFileSync(mapPath, JSON.stringify(map, null, 2) + "\n");
fs.writeFileSync(P("print-codes/codes.txt"), Object.keys(map).sort().map(id => id + "  " + SITE + "/p/" + map[id] + "/").join("\n") + "\n");
console.log("\n" + lines.length + " print code(s) ready. QR images: print-codes/  (not deployed).  Write each story in p/<token>/story.txt, add p/<token>/track.m4a, then commit.");
