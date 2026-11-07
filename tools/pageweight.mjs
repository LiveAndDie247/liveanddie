// Page weight: what a phone downloads from this repo when it opens a page.
//   node tools/pageweight.mjs index.html preview/index.html
// Buckets (local files only, each file counted once per page):
//   first load  stylesheets, scripts, <img> without loading="lazy", <video src> (autoplay loops),
//               <picture> counts its first <source> (the webp) instead of the <img> fallback,
//               and data-src on elements without data-th (the old portal loaded those at startup)
//   on scroll   <img loading="lazy">, <video data-src>, data-th thumbnails (loaded when they come into view)
//   on tap      data-src on elements that also have data-th (full-size image, only opened in the lightbox)
// External embeds (YouTube, Bandcamp) are listed but not weighed; they load lazily in the browser.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pages = process.argv.slice(2);
if (!pages.length) pages.push("index.html");
const kb = n => (n / 1024).toFixed(0).padStart(6) + " KB";

for (const page of pages) {
  const file = path.resolve(root, page), html = fs.readFileSync(file, "utf8");
  const resolve = u => { if (/^(https?:|data:|#|mailto:)/.test(u)) return null; const p = u.split(/[?#]/)[0]; return p.startsWith("/") ? path.join(root, p) : path.join(path.dirname(file), p); };
  const buckets = { "first load": new Map(), "on scroll": new Map(), "on tap": new Map() }, ext = new Set(), missing = new Set();
  const add = (b, u) => { const f = resolve(u); if (!f) { if (/^https?:/.test(u)) ext.add(u); return; } if (!fs.existsSync(f)) { missing.add(u); return; } for (const m of Object.values(buckets)) if (m.has(f) && b !== "first load") return; buckets[b].set(f, fs.statSync(f).size); };
  add("first load", path.relative(path.dirname(file), file));
  const noPicture = html.replace(/<picture[\s\S]*?<\/picture>/g, m => { const s = m.match(/<source[^>]*srcset="([^"\s,]+)/); const lazy = /loading="lazy"/.test(m); if (s) add(lazy ? "on scroll" : "first load", s[1]); return ""; });
  for (const m of noPicture.matchAll(/<link[^>]*rel="(?:stylesheet|icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)) add("first load", m[1]);
  for (const m of noPicture.matchAll(/<script[^>]*src="([^"]+)"/g)) add("first load", m[1]);
  for (const m of noPicture.matchAll(/<img\b[^>]*>/g)) { const src = m[0].match(/\ssrc="([^"]+)"/); if (src) add(/loading="lazy"/.test(m[0]) ? "on scroll" : "first load", src[1]); }
  for (const m of noPicture.matchAll(/<video\b[^>]*>/g)) { const src = m[0].match(/\ssrc="([^"]+)"/), ds = m[0].match(/data-src="([^"]+)"/); if (src) add("first load", src[1]); if (ds) add("on scroll", ds[1]); }
  // art tiles: <a data-src> with a thumbnail (data-th) or a video inside only fetch data-src when tapped
  for (const m of noPicture.matchAll(/<a\b[^>]*\sdata-src="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const th = m[0].match(/data-th="([^"]+)"/);
    if (th) { add("on scroll", th[1]); add("on tap", m[1]); } else if (/<video/.test(m[2])) add("on tap", m[1]); else add("first load", m[1]);
  }
  for (const m of noPicture.matchAll(/<(?!video|a\b)[a-z]+\b[^>]*\sdata-src="([^"]+)"[^>]*>/g)) add("first load", m[1]);
  for (const m of html.matchAll(/<iframe[^>]*src="([^"]+)"/g)) ext.add(m[1]);
  console.log(`\n== ${page}`);
  let total = 0;
  for (const [b, m] of Object.entries(buckets)) { const s = [...m.values()].reduce((a, c) => a + c, 0); total += s; console.log(`${b.padEnd(11)} ${kb(s)}  (${m.size} files)`); }
  console.log(`${"everything".padEnd(11)} ${kb(total)}`);
  if (ext.size) console.log("external    " + [...ext].map(u => u.replace(/^https?:\/\//, "").slice(0, 60)).join("\n            "));
  if (missing.size) console.log("MISSING     " + [...missing].join(", "));
}
