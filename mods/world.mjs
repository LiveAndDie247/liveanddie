// walk (ascii raycaster gallery), fluid (stir an artwork), life (game of life seeded from an artwork).
// Each one draws a tiny pixel frame (one pixel per character cell) and hands it to the ascii engine.
import { createAscii } from "./gl.mjs";
import { stage, fit, loadImg, pieceURL, getMotion, audioTap } from "./util.mjs";

async function engine(SH, title, bye) {
  const R = await createAscii({}); R.st.nocrop = true; R.st.contrast = 1.25;
  const S = stage(SH, { title, bye }); fit(R.canvas, S.host);
  const px = document.createElement("canvas"), pcx = px.getContext("2d", { willReadFrequently: true });
  let img = null;
  function lay() { const z = S.size(); R.resize(z.w, z.h); px.width = R.st.cols; px.height = R.st.rows; img = pcx.createImageData(px.width, px.height); }
  lay(); const onr = () => lay(); addEventListener("resize", onr); S.onClose(() => { removeEventListener("resize", onr); R.destroy(); });
  return { R, S, get img() { return img; }, get w() { return px.width; }, get h() { return px.height; }, flush() { pcx.putImageData(img, 0, 0); R.draw(px, px.width, px.height); } };
}
function texOf(im, n) { const c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d", { willReadFrequently: true }); const k = Math.max(n / im.naturalWidth, n / im.naturalHeight); x.drawImage(im, (n - im.naturalWidth * k) / 2, (n - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k); return x.getImageData(0, 0, n, n).data; }
async function pickPiece(SH, id) { const d = await SH.loadArc(); let p = id ? SH.findPiece(id) : null; if (!p) { const o = Object.keys(SH.openData || {}); p = o.length ? SH.findPiece(o[o.length - 1]) : null; } if (!p) p = d.all[Math.random() * Math.min(60, d.all.length) | 0]; return p; }

// ------------------------------------------------------------------ walk
const MAP = [
  "####a####b####c###",
  "#................#",
  "#..##...##...##..#",
  "l..##...##...##..d",
  "#................#",
  "#..##...#X...##..#",
  "k..##...##...##..e",
  "#................#",
  "#..##...##...##..#",
  "j................f",
  "####i####h####g###"
];
async function walk(SH) {
  const d = await SH.loadArc();
  const slots = "abcdefghijkl".split(""), pieces = d.all.filter(p => !p.vid).slice(0, slots.length), tex = {};
  SH.line("walk: loading the gallery ...", "dim");
  await Promise.all(pieces.map((p, i) => loadImg(pieceURL(p)).then(im => { tex[slots[i]] = { d: texOf(im, 64), p }; }).catch(() => {})));
  const tilt = await getMotion(SH, "tilting the phone turns your view.");
  const E = await engine(SH, "walk", "you left the gallery.");
  E.R.st.gain = 1.7; E.R.st.contrast = 1.1;
  const S = E.S; let x = 9.5, y = 1.85, a = -Math.PI / 2, raf = 0, last = performance.now(), turn = 0, fwd = 0, gamma = 0, holdT = 0, holding = false, dragX = null, facing = null;
  const keys = {};
  const cell = (cx, cy) => (MAP[cy] && MAP[cy][cx]) || "#";
  const kd = e => { keys[e.key] = true; if (e.key === "Enter" || e.key === " ") act(); }, ku = e => { keys[e.key] = false; };
  addEventListener("keydown", kd); addEventListener("keyup", ku);
  const ori = e => { if (e.gamma != null) gamma = e.gamma; }; if (tilt) addEventListener("deviceorientation", ori);
  S.onClose(() => { cancelAnimationFrame(raf); removeEventListener("keydown", kd); removeEventListener("keyup", ku); removeEventListener("deviceorientation", ori); });
  S.host.addEventListener("pointerdown", e => { holding = true; holdT = performance.now(); dragX = e.clientX; });
  S.host.addEventListener("pointermove", e => { if (holding && dragX != null) { a += (e.clientX - dragX) * 0.008; dragX = e.clientX; } });
  const up = () => { if (holding && performance.now() - holdT < 220) act(); holding = false; dragX = null; };
  S.host.addEventListener("pointerup", up); S.host.addEventListener("pointercancel", () => { holding = false; });
  S.btn("[ < ]", () => { a -= 0.4; }); S.btn("[ walk ]", () => { step(0.6); }); S.btn("[ > ]", () => { a += 0.4; }); S.btn("[ open ]", () => act());
  function act() {
    if (!facing || facing.dist > 1.7) return;
    if (facing.c === "X") { S.close("the wall gives way ..."); setTimeout(() => { location.href = "/x/" + SH.XDOORS[Math.random() * SH.XDOORS.length | 0] + ".html"; }, 400); return; }
    const t = tex[facing.c]; if (t) { const id = t.p.no; S.close(); SH.promptEl.style.display = "none"; if (!SH.run("open " + id)) SH.newPrompt(); }
  }
  function step(dist) { const nx = x + Math.cos(a) * dist, ny = y + Math.sin(a) * dist; if (cell(Math.floor(nx), Math.floor(y)) === ".") x = nx; if (cell(Math.floor(x), Math.floor(ny)) === ".") y = ny; }
  function cast(ang) {
    const dx = Math.cos(ang), dy = Math.sin(ang); let mx = Math.floor(x), my = Math.floor(y);
    const ddx = Math.abs(1 / dx), ddy = Math.abs(1 / dy), sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    let sdx = (dx < 0 ? x - mx : mx + 1 - x) * ddx, sdy = (dy < 0 ? y - my : my + 1 - y) * ddy, side = 0, c = ".";
    for (let i = 0; i < 40; i++) { if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; } c = cell(mx, my); if (c !== ".") break; }
    const dist = side === 0 ? sdx - ddx : sdy - ddy; let u = side === 0 ? y + dist * dy : x + dist * dx; u -= Math.floor(u);
    if ((side === 0 && dx > 0) || (side === 1 && dy < 0)) u = 1 - u;
    return { dist, u, side, c };
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    turn = (keys.ArrowLeft || keys.a ? -1 : 0) + (keys.ArrowRight || keys.d ? 1 : 0); if (tilt && Math.abs(gamma) > 6) turn += Math.max(-1, Math.min(1, gamma / 28));
    fwd = (keys.ArrowUp || keys.w ? 1 : 0) - (keys.ArrowDown || keys.s ? 1 : 0); if (holding && t - holdT > 220) fwd = 1;
    a += turn * 2.1 * dt; if (fwd) step(fwd * 2.4 * dt);
    const W = E.w, H = E.h, o = E.img.data, FOV = 1.05, aspect = (W * 8) / (H * 16);
    facing = cast(a);
    for (let cx = 0; cx < W; cx++) {
      const ra = a + (cx / W - 0.5) * FOV, hit = cast(ra), dist = Math.max(0.05, hit.dist * Math.cos(ra - a));
      const lh = (H * aspect * 1.25) / dist, top = (H - lh) / 2, T = tex[hit.c], shade = Math.max(0.25, Math.min(1, 1.6 / dist)) * (hit.side ? 0.8 : 1);
      for (let cy = 0; cy < H; cy++) {
        const i = (cy * W + cx) * 4; let r = 0, g = 0, b = 0;
        if (cy < top) { const k = 1 - cy / (H / 2); r = 30 * k; b = 95 * k; }                          // ceiling: faint blue
        else if (cy >= top + lh) { const k = (cy - H / 2) / (H / 2); r = 110 * k; b = 16 * k; }          // floor: faint red
        else {
          const v = (cy - top) / lh;
          if (T) { const m = 0.08; if (hit.u < m || hit.u > 1 - m || v < m || v > 1 - m) { r = 60; g = 90; b = 255; } else { const tx = ((hit.u - m) / (1 - 2 * m) * 64) | 0, ty = ((v - m) / (1 - 2 * m) * 64) | 0, j = (ty * 64 + tx) * 4; r = T.d[j]; g = T.d[j + 1]; b = T.d[j + 2]; } }
          else { const brick = ((v * 6 | 0) + ((hit.u * 4 + ((v * 6 | 0) % 2) * 0.5) | 0)) % 2; r = brick ? 235 : 150; g = 30; b = hit.c === "X" && hit.u > 0.46 && hit.u < 0.54 ? 255 : 26; if (hit.c === "X" && hit.u > 0.46 && hit.u < 0.54) r = 40; }
          r *= shade; g *= shade; b *= shade;
        }
        o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = 255;
      }
    }
    E.flush();
    const ft = facing && facing.dist < 2.2 ? (facing.c === "X" ? "this wall sounds hollow  -  tap" : tex[facing.c] ? tex[facing.c].p.no + " " + tex[facing.c].p.title + (facing.dist < 1.7 ? "  -  tap to open" : "") : "") : "";
    S.hud.textContent = ft || "walk: " + (tilt ? "tilt or drag to look" : "drag / arrows to look") + ", hold to walk, tap a piece to open it";
  }
  raf = requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ fluid
async function fluid(SH, id) {
  const p = await pickPiece(SH, id), im = await loadImg(pieceURL(p));
  const E = await engine(SH, "fluid  " + p.no + " " + p.title + "  -  stir it with a finger", "the liquid settles.");
  E.R.st.gain = 1.5; E.R.st.contrast = 1.15;
  const S = E.S; let N = 0, M = 0, u, v, u0, v0, dr, db, r0, b0, raf = 0, ptr = null;
  function init() {
    N = E.w; M = E.h; const n = N * M; u = new Float32Array(n); v = new Float32Array(n); u0 = new Float32Array(n); v0 = new Float32Array(n); dr = new Float32Array(n); db = new Float32Array(n); r0 = new Float32Array(n); b0 = new Float32Array(n);
    const c = document.createElement("canvas"); c.width = N; c.height = M; const x = c.getContext("2d", { willReadFrequently: true }); const k = Math.max(N * 8 / im.naturalWidth, M * 16 / im.naturalHeight), w = im.naturalWidth * k / 8, h = im.naturalHeight * k / 16; x.drawImage(im, (N - w) / 2, (M - h) / 2, w, h);
    const d = x.getImageData(0, 0, N, M).data; for (let i = 0; i < n; i++) { const R = d[i * 4], G = d[i * 4 + 1], B = d[i * 4 + 2], l = (0.299 * R + 0.587 * G + 0.114 * B) / 255; if (R >= B) dr[i] = l; else db[i] = l; }
  }
  init();
  const at = (f, x, y) => { x = x < 0.5 ? 0.5 : x > N - 1.5 ? N - 1.5 : x; y = y < 0.5 ? 0.5 : y > M - 1.5 ? M - 1.5 : y; const i = x | 0, j = y | 0, s = x - i, t = y - j, k = j * N + i; return (1 - s) * ((1 - t) * f[k] + t * f[k + N]) + s * ((1 - t) * f[k + 1] + t * f[k + N + 1]); };
  function advect(dst, src, dt) { for (let j = 1; j < M - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; dst[k] = at(src, i - dt * u[k], j - dt * v[k]); } }
  function project() {
    const p = u0, div = v0; for (let j = 1; j < M - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; div[k] = -0.5 * (u[k + 1] - u[k - 1] + v[k + N] - v[k - N]); p[k] = 0; }
    for (let it = 0; it < 8; it++) for (let j = 1; j < M - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; p[k] = (div[k] + p[k - 1] + p[k + 1] + p[k - N] + p[k + N]) / 4; }
    for (let j = 1; j < M - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; u[k] -= 0.5 * (p[k + 1] - p[k - 1]); v[k] -= 0.5 * (p[k + N] - p[k - N]); }
  }
  const pos = e => { const r = E.R.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * N, y: (e.clientY - r.top) / r.height * M }; };
  S.host.addEventListener("pointerdown", e => { ptr = pos(e); });
  S.host.addEventListener("pointermove", e => { if (!ptr) return; const q = pos(e), dx = q.x - ptr.x, dy = q.y - ptr.y; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const X = (q.x | 0) + i, Y = (q.y | 0) + j; if (X > 0 && X < N - 1 && Y > 0 && Y < M - 1) { const k = Y * N + X; u[k] += dx * 1.6; v[k] += dy * 0.8; } } ptr = q; });
  const end = () => { ptr = null; }; S.host.addEventListener("pointerup", end); S.host.addEventListener("pointercancel", end);
  S.btn("[ reset ]", () => init());
  S.onClose(() => cancelAnimationFrame(raf));
  function frame() {
    raf = requestAnimationFrame(frame);
    if (E.w !== N || E.h !== M) init();
    u0.set(u); v0.set(v); const U = u, V = v; advect(u0, U, 0.9); advect(v0, V, 0.9); u.set(u0); v.set(v0);
    for (let k = 0; k < u.length; k++) { u[k] *= 0.985; v[k] *= 0.985; }
    project();
    advect(r0, dr, 0.9); advect(b0, db, 0.9); let t = dr; dr = r0; r0 = t; t = db; db = b0; b0 = t;
    const o = E.img.data; for (let k = 0; k < N * M; k++) { const R = dr[k], B = db[k], i = k * 4; if (R >= B) { o[i] = 255 * R; o[i + 1] = 40 * R; o[i + 2] = 40 * R; } else { o[i] = 50 * B; o[i + 1] = 90 * B; o[i + 2] = 255 * B; } o[i + 3] = 255; }
    E.flush();
  }
  raf = requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ life
async function life(SH, id) {
  const p = await pickPiece(SH, id), im = await loadImg(pieceURL(p));
  const E = await engine(SH, "life  " + p.no + " " + p.title, "the colony stops.");
  const S = E.S; let N = 0, M = 0, cells, age, hue, next, raf = 0, lastStep = 0, gen = 0, tap = null, lowAvg = 0, paused = false;
  function seed() {
    N = E.w; M = E.h; cells = new Uint8Array(N * M); next = new Uint8Array(N * M); age = new Uint8Array(N * M); hue = new Uint8Array(N * M);
    const c = document.createElement("canvas"); c.width = N; c.height = M; const x = c.getContext("2d", { willReadFrequently: true }); const k = Math.max(N * 8 / im.naturalWidth, M * 16 / im.naturalHeight), w = im.naturalWidth * k / 8, h = im.naturalHeight * k / 16; x.drawImage(im, (N - w) / 2, (M - h) / 2, w, h);
    const d = x.getImageData(0, 0, N, M).data; let sum = 0; for (let i = 0; i < N * M; i++) sum += 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    const thr = sum / (N * M) * 1.05; for (let i = 0; i < N * M; i++) { const l = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; cells[i] = l > thr ? 1 : 0; hue[i] = d[i * 4] >= d[i * 4 + 2] ? 0 : 1; age[i] = 0; } gen = 0;
  }
  seed();
  function stepLife() {
    for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
      let n = 0, hb = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { if (!i && !j) continue; const k = ((y + j + M) % M) * N + (x + i + N) % N; if (cells[k]) { n++; hb += hue[k]; } }
      const k = y * N + x, alive = cells[k]; next[k] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      if (next[k] && !alive) { hue[k] = hb >= 2 ? 1 : 0; age[k] = 0; } else if (next[k]) age[k] = Math.min(250, age[k] + 1);
    }
    const t = cells; cells = next; next = t; gen++;
  }
  S.btn("[ pause ]", b => { paused = !paused; b.textContent = paused ? "[ run ]" : "[ pause ]"; });
  S.btn("[ reseed ]", () => seed());
  S.host.addEventListener("pointerdown", e => { const r = E.R.canvas.getBoundingClientRect(), cx = (e.clientX - r.left) / r.width * N | 0, cy = (e.clientY - r.top) / r.height * M | 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = (cx + i + N) % N, Y = (cy + j + M) % M; if (Math.random() < 0.7) { cells[Y * N + X] = 1; age[Y * N + X] = 0; } } });
  S.onClose(() => cancelAnimationFrame(raf));
  const au = SH.au; let freq = null;
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (E.w !== N || E.h !== M) seed();
    const playing = !!au.src && !au.paused; let go = false;
    if (playing) {                                         // evolve on the beat: a jump in the low band
      if (!tap) { try { tap = audioTap(SH); freq = new Uint8Array(tap.an.frequencyBinCount); } catch (e) { tap = null; } }
      if (tap) { tap.an.getByteFrequencyData(freq); let low = 0; for (let i = 1; i < 7; i++) low += freq[i]; low /= 6; if (low > lowAvg * 1.25 + 8 && t - lastStep > 110) go = true; lowAvg = lowAvg * 0.9 + low * 0.1; if (t - lastStep > 900) go = true; }
      else if (t - lastStep > 180) go = true;
    } else if (t - lastStep > 170) go = true;
    if (go && !paused) { lastStep = t; stepLife(); }
    const o = E.img.data; let pop = 0;
    for (let k = 0; k < N * M; k++) { const i = k * 4; if (cells[k]) { pop++; const b = Math.max(0.35, 1 - age[k] / 14); if (hue[k]) { o[i] = 50 * b; o[i + 1] = 90 * b; o[i + 2] = 255 * b; } else { o[i] = 255 * b; o[i + 1] = 40 * b; o[i + 2] = 40 * b; } } else { o[i] = o[i + 1] = o[i + 2] = 0; } o[i + 3] = 255; }
    E.flush();
    S.hud.textContent = "life  " + p.no + "  gen " + gen + "  pop " + pop + (playing ? "  (on the beat)" : "  (play a song and it evolves on the beat)") + "  tap = seed";
  }
  raf = requestAnimationFrame(frame);
}

export default function (SH) {
  const wrap = (name, fn) => a => { fn(SH, (a[0] || "").toUpperCase()).catch(e => { SH.line(name + ": " + (e && e.message || "failed"), "dim"); SH.newPrompt(); }); return true; };
  SH.cmd("walk gallery3d", wrap("walk", s => walk(s)), { help: "walk a first-person ascii gallery of the archive", man: "walk - a first-person raycaster drawn in characters. Every framed wall is a piece from the archive: walk up to it and tap to open it. Phone: tilt or drag to look, hold to walk. Desktop: arrows / WASD, Enter to open. Not every wall is solid." });
  SH.cmd("fluid", wrap("fluid", fluid), { help: "stir an artwork like liquid", usage: "fluid [id]", man: "fluid [id] - an ascii fluid simulation whose colour comes from the current artwork (or the one you name). Drag a finger through it." });
  SH.cmd("life", wrap("life", life), { help: "game of life seeded from an artwork", usage: "life [id]", man: "life [id] - Conway's Game of Life seeded from a piece's brightness. If a song is playing it evolves on the beat. Tap to add cells." });
}
