// Draws the site's favicon, apple-touch-icon and share-preview image in its own look: black, red, blue,
// the perspective grid, a wireframe cube, the outlined title with its blue offset, scanlines, a double
// red border. Pure Node (a tiny rasteriser + PNG writer), no dependencies.
//   node tools/icons.mjs        → favicon.png (48), apple-touch-icon.png (180), img/og.png (1200x630)
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RED = [255, 0, 0], BLUE = [58, 58, 255], LBLUE = [107, 107, 255], R3 = [74, 0, 0], BLK = [0, 0, 0];

function canvas(W, H) {
  const px = new Uint8Array(W * H * 3);
  const put = (x, y, [r, g, b], a = 1) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; px[i] += (r - px[i]) * a; px[i + 1] += (g - px[i + 1]) * a; px[i + 2] += (b - px[i + 2]) * a; };
  const rect = (x, y, w, h, c, a = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c, a); };
  const line = (x0, y0, x1, y1, c, a = 1, w = 1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) + 1; for (let k = 0; k <= n; k++) { const t = k / n; for (let dx = -(w >> 1); dx <= w >> 1; dx++) for (let dy = -(w >> 1); dy <= w >> 1; dy++) put(x0 + (x1 - x0) * t + dx, y0 + (y1 - y0) * t + dy, c, a); } };
  const png = file => {
    const raw = Buffer.alloc((W * 3 + 1) * H);
    for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
    fs.writeFileSync(path.join(root, file), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
    console.log(`wrote ${file}: ${W}x${H}, ${fs.statSync(path.join(root, file)).size} bytes`);
  };
  return { W, H, put, rect, line, png };
}

// 5x7 pixel type
const F = {
  A: ".###.|#...#|#...#|#####|#...#|#...#|#...#", B: "####.|#...#|#...#|####.|#...#|#...#|####.", C: ".####|#....|#....|#....|#....|#....|.####",
  D: "####.|#...#|#...#|#...#|#...#|#...#|####.", E: "#####|#....|#....|####.|#....|#....|#####", F: "#####|#....|#....|####.|#....|#....|#....",
  G: ".####|#....|#....|#.###|#...#|#...#|.####", H: "#...#|#...#|#...#|#####|#...#|#...#|#...#", I: ".###.|..#..|..#..|..#..|..#..|..#..|.###.",
  K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#", L: "#....|#....|#....|#....|#....|#....|#####", M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#",
  N: "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#", O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.", P: "####.|#...#|#...#|####.|#....|#....|#....",
  R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#", S: ".####|#....|#....|.###.|....#|....#|####.", T: "#####|..#..|..#..|..#..|..#..|..#..|..#..",
  U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.", V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..", W: "#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#",
  X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#", Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..", Z: "#####|....#|...#.|..#..|.#...|#....|#####",
  "2": ".###.|#...#|....#|...#.|..#..|.#...|#####", "0": ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.", "3": "####.|....#|....#|.###.|....#|....#|####.",
  "8": ".###.|#...#|#...#|.###.|#...#|#...#|.###.", ".": ".....|.....|.....|.....|.....|.##..|.##..", "·": ".....|.....|.....|..#..|.....|.....|.....",
  " ": ".....|.....|.....|.....|.....|.....|.....",
};
const tw = (s, sc) => [...s].length * 6 * sc - sc;
function text(c, s, x, y, sc, col, italic = 0) {
  [...s].forEach((ch, k) => (F[ch] || F[" "]).split("|").forEach((row, j) => [...row].forEach((bit, i) => {
    if (bit === "#") c.rect(x + k * 6 * sc + i * sc + Math.round((6 - j) * italic * sc), y + j * sc, sc, sc, col);
  })));
}
// the site's title look: blue offset, hard black outline, red face, italic slant
function title(c, s, x, y, sc, off = Math.max(1, Math.round(sc * 0.7)), ol = Math.max(1, Math.round(sc * 0.35))) {
  text(c, s, x + off, y + off, sc, BLUE, 0.25);
  for (const [dx, dy] of [[-ol, 0], [ol, 0], [0, -ol], [0, ol], [ol, ol], [-ol, -ol], [ol, -ol], [-ol, ol]]) text(c, s, x + dx, y + dy, sc, BLK, 0.25);
  text(c, s, x, y, sc, RED, 0.25);
}

// ---- favicon + touch icon: "L.D" ----
for (const [size, file] of [[48, "favicon.png"], [180, "apple-touch-icon.png"]]) {
  const c = canvas(size, size), sc = Math.max(2, Math.floor((size * 0.82) / 17));
  c.rect(0, 0, size, size, BLK);
  if (size > 60) { c.rect(4, 4, size - 8, 3, RED); c.rect(4, size - 7, size - 8, 3, RED); c.rect(4, 4, 3, size - 8, RED); c.rect(size - 7, 4, 3, size - 8, RED); }
  title(c, "L.D", Math.round((size - tw("L.D", sc)) / 2) - sc, Math.round((size - 7 * sc) / 2), sc);
  c.png(file);
}

// ---- share preview ----
{
  const c = canvas(1200, 630), { W, H } = c, hz = H * 0.58, vx = W / 2;
  for (let i = -12; i <= 12; i++) { const x0 = vx + i * W * 0.09; c.line(vx, hz, x0 + (x0 - vx) * 3, H, RED, 0.22); c.line(vx, hz, x0 + (x0 - vx) * 3, 0, RED, 0.12); }
  for (let n = 0; n < 14; n++) c.line(0, hz + Math.pow(n / 14, 2.2) * (H - hz), W, hz + Math.pow(n / 14, 2.2) * (H - hz), RED, 0.22);
  c.line(0, hz, W, hz, RED, 0.4);
  const a = 0.6, b = 0.4, s = 62, cx = W / 2, cy = 110, P = [];
  for (let i = 0; i < 8; i++) { const x = i & 1 ? 1 : -1, y = i & 2 ? 1 : -1, z = i & 4 ? 1 : -1; const x1 = x * Math.cos(a) - z * Math.sin(a); let z1 = x * Math.sin(a) + z * Math.cos(a); const y1 = y * Math.cos(b) - z1 * Math.sin(b); z1 = y * Math.sin(b) + z1 * Math.cos(b); const f = 2.6 / (3.6 + z1); P.push([cx + x1 * s * f, cy + y1 * s * f]); }
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const d = i ^ j; if (d === 1 || d === 2 || d === 4) c.line(P[i][0], P[i][1], P[j][0], P[j][1], BLUE, 0.7, 2); }
  const t = "LIVE.AND.DIE", sc = 14;
  title(c, t, Math.round((W - tw(t, sc)) / 2) - 14, 230, sc, 10, 4);
  const sub = "FEELINGS · MEMORIES · RELATED CONSUMABLES", s2 = 4;
  c.rect(Math.round((W - tw(sub, s2)) / 2) - 12, 372, tw(sub, s2) + 24, 7 * s2 + 14, BLK);
  text(c, sub, Math.round((W - tw(sub, s2)) / 2), 379, s2, LBLUE);
  const url = "LIVEANDDIE.XYZ", s3 = 4;
  text(c, url, Math.round((W - tw(url, s3)) / 2), 520, s3, RED);
  for (const o of [6, 14]) { c.rect(o, o, W - 2 * o, 3, RED); c.rect(o, H - o - 3, W - 2 * o, 3, RED); c.rect(o, o, 3, H - 2 * o, RED); c.rect(W - o - 3, o, 3, H - 2 * o, RED); }
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x++) c.put(x, y, BLK, 0.18);
  c.png("img/og.png");
}
