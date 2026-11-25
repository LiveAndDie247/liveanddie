// dream: an endless generative ascii film. Random archive pieces melt into each other while random slices of the
// songs are cut together on a beat grid. It never repeats. `dream --record` saves 30 seconds.
import { createAscii } from "./gl.mjs";
import { stage, fit, loadImg, pieceURL } from "./util.mjs";

async function dream(SH, wantRec) {
  const d = await SH.loadArc();
  const R = await createAscii({}); R.st.nocrop = true; R.st.contrast = 1.3; R.st.gain = 1.25;
  const S = stage(SH, { title: "dream", bye: "you wake up." }); fit(R.canvas, S.host);
  const px = document.createElement("canvas"), pcx = px.getContext("2d", { willReadFrequently: true }), tc = document.createElement("canvas"), tcx = tc.getContext("2d", { willReadFrequently: true });
  let W = 0, H = 0, img = null, A = null, B = null, next = null, t = 0, mode = 0, dur = 6, drip = null, noise = null, raf = 0, last = performance.now(), dead = false, flash = 0, cur = "";
  const pool = d.all.slice(0, 200);
  async function tex() {                                   // a random piece at grid resolution (cover-fit; cells are 1:2)
    for (let tries = 0; tries < 4; tries++) {
      const p = pool[Math.random() * pool.length | 0];
      try { const im = await loadImg(pieceURL(p)); tc.width = W; tc.height = H; const k = Math.max(W * 8 / im.naturalWidth, H * 16 / im.naturalHeight), w = im.naturalWidth * k / 8, h = im.naturalHeight * k / 16; tcx.fillStyle = "#000"; tcx.fillRect(0, 0, W, H); tcx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); return { d: tcx.getImageData(0, 0, W, H).data, p }; } catch (e) {}
    }
    return { d: new Uint8ClampedArray(W * H * 4), p: { no: "", title: "" } };
  }
  function shuffle() { mode = Math.random() * 3 | 0; dur = 4 + Math.random() * 5; drip = new Float32Array(W); let v = Math.random(); for (let x = 0; x < W; x++) { v += (Math.random() - 0.5) * 0.35; v = Math.max(0, Math.min(1, v)); drip[x] = v; } noise = new Float32Array(W * H); for (let i = 0; i < noise.length; i++) noise[i] = Math.random(); }
  async function lay() { const z = S.size(); R.resize(z.w, z.h); W = px.width = R.st.cols; H = px.height = R.st.rows; img = pcx.createImageData(W, H); A = await tex(); B = await tex(); next = null; t = 0; shuffle(); cur = A.p.no; }
  await lay(); const onr = () => { lay(); }; addEventListener("resize", onr);

  // ---- sound: two players, hard cuts on a 120 bpm grid
  SH.au.pause();
  let AC = null, master = null, tapOut = null; const els = [new Audio(), new Audio()], gains = []; let curEl = 0, cutT = 0, slice = "";
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination); els.forEach((el, i) => { el.preload = "auto"; const s = AC.createMediaElementSource(el), g = AC.createGain(); g.gain.value = 0; s.connect(g); g.connect(master); gains[i] = g; }); } catch (e) { AC = null; }
  function cut() {
    if (dead || !d.tracks.length) return;
    const tr = d.tracks[Math.random() * d.tracks.length | 0], m = (tr.media || []).find(x => x.audio); if (!m) return;
    const ni = 1 - curEl, el = els[ni], old = curEl;
    el.src = "/archive/" + m.audio;
    el.addEventListener("loadedmetadata", () => { try { el.currentTime = (0.08 + Math.random() * 0.8) * (el.duration || 60); } catch (e) {} el.play().then(() => {
      if (dead) { el.pause(); return; }
      if (AC) { const now = AC.currentTime; gains[ni].gain.setTargetAtTime(1, now, 0.02); gains[old].gain.setTargetAtTime(0, now, 0.02); } else { el.volume = 1; els[old].volume = 0; }
      setTimeout(() => { try { els[old].pause(); } catch (e) {} }, 200); curEl = ni; slice = tr.title; flash = 1; if (Math.random() < 0.4) R.st.swap = !R.st.swap;
    }).catch(() => {}); }, { once: true });
    cutT = setTimeout(cut, [2, 4, 4, 8, 8, 16][Math.random() * 6 | 0] * 500);
  }
  cut();

  let rec = null;
  async function startRec(b) {
    try { const m = await import("./rec.mjs"); let track = null; if (AC) { tapOut = AC.createMediaStreamDestination(); master.connect(tapOut); track = tapOut.stream.getAudioTracks()[0]; }
      rec = m.record(SH, () => R.canvas, null, { seconds: 30, audioTrack: track, onDone: () => { rec = null; if (b) b.textContent = "[ rec 30s ]"; } }); if (b) b.textContent = "[ stop rec ]"; }
    catch (e) { SH.line("dream: recording is not supported in this browser.", "dim"); }
  }
  const rb = S.btn("[ rec 30s ]", b => { if (rec) rec.stop(); else startRec(b); });
  if (wantRec) setTimeout(() => rb.click(), 800);
  S.onClose(() => { dead = true; cancelAnimationFrame(raf); clearTimeout(cutT); removeEventListener("resize", onr); if (rec) rec.stop(); els.forEach(el => { try { el.pause(); el.removeAttribute("src"); el.load(); } catch (e) {} }); try { if (AC) AC.close(); } catch (e) {} R.destroy(); });

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!A || !B || !img) return;
    t += dt / dur; flash *= 0.9; R.st.glitch = flash * 0.7;
    if (t > 0.5 && !next) { next = "loading"; tex().then(x => { next = x; }); }
    if (t >= 1 && next && next !== "loading") { A = B; B = next; next = null; t = 0; shuffle(); cur = A.p.no; }
    const tt = Math.min(1, t), a = A.d, b = B.d, o = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; let s = a, j = i;
      if (mode === 0) { const loc = tt * 1.7 - drip[x] * 0.7; if (loc > 0) { const yy = Math.floor(y - loc * H); if (yy >= 0) j = (yy * W + x) * 4; else { s = b; } } }                // melt down
      else if (mode === 1) { const loc = tt * 1.5 - (y / H) * 0.5; if (loc > 0) { const xx = Math.floor(x - loc * W * (0.4 + drip[(x + y) % W])); if (xx >= 0) j = (y * W + xx) * 4; else s = b; } }  // smear sideways
      else if (noise[y * W + x] < tt * 1.15 - 0.08) s = b;                                                                                                                         // dissolve
      o[i] = s[j]; o[i + 1] = s[j + 1]; o[i + 2] = s[j + 2]; o[i + 3] = 255;
    }
    pcx.putImageData(img, 0, 0); R.draw(px, W, H); if (rec) rec.frame();
    S.hud.textContent = "dream  " + cur + (slice ? "  ♪ " + slice.slice(0, 22) : "") + (rec ? "  REC" : "");
  }
  raf = requestAnimationFrame(frame);
}
export default function (SH) {
  SH.cmd("dream", a => { dream(SH, a.indexOf("--record") >= 0).catch(e => { SH.line("dream: " + (e && e.message || "failed"), "dim"); SH.newPrompt(); }); return true; },
    { help: "an endless generative ascii film cut to the music", usage: "dream [--record]", man: "dream - random archive pieces melt into each other while random slices of the songs are cut together on the beat. It never repeats and runs until you leave. dream --record (or [ rec 30s ]) saves 30 seconds as video + gif." });
}
