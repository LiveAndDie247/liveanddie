// Draws a tiling starfield like the old space sites' backgrounds: near-black, sparse white stars,
// a few blue/red ones, a couple of brighter crosses. Seamless (stars wrap around the edges).
//   node tools/stars.mjs   → preview/stars.png (200x200)
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const N = 200, px = new Uint8Array(N * N * 3);
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < N * N; i++) { px[i * 3] = 0; px[i * 3 + 1] = 0; px[i * 3 + 2] = 8; }
const put = (x, y, [r, g, b], a = 1) => { x = ((x % N) + N) % N; y = ((y % N) + N) % N; const i = (y * N + x) * 3; px[i] += (r - px[i]) * a; px[i + 1] += (g - px[i + 1]) * a; px[i + 2] += (b - px[i + 2]) * a; };
for (let k = 0; k < 140; k++) {                       // faint dust
  const v = 60 + rnd() * 120; put(rnd() * N | 0, rnd() * N | 0, [v, v, v + 20]);
}
for (let k = 0; k < 26; k++) {                        // stars
  const x = rnd() * N | 0, y = rnd() * N | 0, t = rnd();
  const c = t < 0.12 ? [140, 140, 255] : t < 0.2 ? [255, 90, 90] : [255, 255, 255];
  put(x, y, c); if (rnd() < 0.35) put(x + 1, y, c, 0.5);
}
for (let k = 0; k < 3; k++) {                         // a few bright crosses
  const x = rnd() * N | 0, y = rnd() * N | 0;
  put(x, y, [255, 255, 255]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + dx, y + dy, [200, 200, 255], 0.7);
  for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) put(x + dx, y + dy, [120, 120, 255], 0.4);
}
const raw = Buffer.alloc((N * 3 + 1) * N);
for (let y = 0; y < N; y++) { raw[y * (N * 3 + 1)] = 0; Buffer.from(px.buffer, y * N * 3, N * 3).copy(raw, y * (N * 3 + 1) + 1); }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 2;
const out = path.join(root, "preview/stars.png");
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
console.log(`wrote preview/stars.png: ${N}x${N}, ${fs.statSync(out).size} bytes`);
