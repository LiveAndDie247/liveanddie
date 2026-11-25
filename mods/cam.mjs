// cam / vid / snap on the GPU ascii engine. Extra cam modes are separate modules, imported only when asked for.
import { createAscii, crop } from "./gl.mjs";
import { stage, fit, getCam, stopStream, loadImg, download, pieceURL } from "./util.mjs";

const MODE_FILES = { hands: "./cam-hands.mjs", synth: "./cam-hands.mjs", ghost: "./cam-fx.mjs", slitscan: "./cam-fx.mjs", into: "./cam-into.mjs", dance: "./cam-dance.mjs" };
let lastFrame = null;                                  // 2D copy of the most recent ascii frame (for `snap`)

function parse(a) {
  const o = { mode: null, record: false, text: null, id: null };
  for (let i = 0; i < a.length; i++) {
    const t = a[i];
    if (t === "--record") o.record = true;
    else if (t === "--mosh") { o.mode = "into"; }
    else if (t === "--into") { o.mode = "into"; if (a[i + 1] && !a[i + 1].startsWith("--")) o.id = a[++i].toUpperCase(); }
    else if (t === "--text") { const w = []; while (a[i + 1] && !a[i + 1].startsWith("--")) w.push(a[++i]); o.text = (w.join(" ").replace(/^["'\u201C]+|["'\u201D]+$/g, "") || "live.and.die").slice(0, 120) + " "; }
    else if (t.startsWith("--") && MODE_FILES[t.slice(2)]) o.mode = t.slice(2);
    else if (t.startsWith("--")) o.bad = t;
  }
  return o;
}
function stamp(src, label) {                           // copy a frame onto a 2D canvas with the small site stamp
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const x = c.getContext("2d"); x.drawImage(src, 0, 0);
  const s = Math.max(1, Math.round(c.width / 412)); x.font = 16 * s + "px 'Web437 VGA',monospace"; x.textBaseline = "bottom";
  const tw = x.measureText(label).width; x.fillStyle = "#000"; x.fillRect(c.width - tw - 10 * s, c.height - 20 * s, tw + 10 * s, 20 * s);
  x.fillStyle = "#4070ff"; x.fillText(label, c.width - tw - 5 * s, c.height - 2 * s);
  return c;
}

async function session(SH, o, source) {
  // source: { el: <video>, mirror, title, stop() }
  let R = await createAscii({ mirror: source.mirror, chars: o.text || undefined, text: !!o.text });
  const S = stage(SH, { title: source.title, bye: source.title.split(" ")[0] + " off." });
  fit(R.canvas, S.host);
  const overlay = document.createElement("canvas"); const ox = overlay.getContext("2d"); fit(overlay, S.host); overlay.style.pointerEvents = "none"; overlay.style.imageRendering = "auto";
  function lay() { const z = S.size(); R.resize(z.w, z.h); overlay.width = R.st.cols * 8; overlay.height = R.st.rows * 16; overlay.style.width = overlay.width + "px"; overlay.style.height = overlay.height + "px"; }
  lay(); addEventListener("resize", lay);
  let raf = 0, frames = 0, t0 = performance.now(), fps = 0, paused = false, wantSnap = false, mode = null, rec = null, tick = 0, hudNote = "";
  const ctx = { SH, S, get R() { return R; }, v: source.el, overlay, ox, o, note: t => { hudNote = t; },
    // tracker coords (0..1 in the video frame) -> overlay pixels, honouring the cover-crop and the mirror
    map(u, v) { const el = source.el, c = crop(el.videoWidth || 4, el.videoHeight || 3, R.st.cols * 8, R.st.rows * 16); let fx = (u - c[2]) / c[0]; const fy = (v - c[3]) / c[1]; if (source.mirror) fx = 1 - fx; return [fx * overlay.width, fy * overlay.height]; } };
  if (o.mode) {
    try { const m = await import(MODE_FILES[o.mode]); mode = await m.start(ctx, o); }
    catch (e) { SH.line("cam --" + o.mode + ": could not start (" + (e && e.message || "error") + "). showing plain cam.", "dim"); mode = null; }
    if (S.closed) { source.stop(); return; }
  }
  S.onClose(() => { cancelAnimationFrame(raf); removeEventListener("resize", lay); if (rec) rec.stop(true); if (mode && mode.stop) try { mode.stop(); } catch (e) {} source.stop(); R.destroy(); });
  S.btn("[ pause ]", b => { paused = !paused; b.textContent = paused ? "[ play ]" : "[ pause ]"; if (source.el.pause) paused ? source.el.pause() : source.el.play().catch(() => {}); });
  S.btn("[ snap ]", () => { wantSnap = true; });
  S.btn("[ swap ]", () => { R.st.swap = !R.st.swap; });
  const recBtn = S.btn("[ rec ]", async b => {
    if (rec) { rec.stop(); return; }
    try { const m = await import("./rec.mjs"); rec = m.record(SH, () => R.canvas, () => overlay, { onDone: () => { rec = null; b.textContent = "[ rec ]"; }, seconds: 12 }); b.textContent = "[ stop rec ]"; }
    catch (e) { hudNote = "recording is not supported here"; }
  });
  if (o.record) setTimeout(() => recBtn.click(), 600);
  async function toCanvasFallback() {                 // WebGL context lost -> carry on with the 2D renderer
    const old = R; R = await createAscii({ forceCanvas: true, mirror: source.mirror, chars: o.text || undefined, text: !!o.text });
    Object.assign(R.st, { swap: old.st.swap, glitch: old.st.glitch }); old.canvas.replaceWith(R.canvas); fit(R.canvas, S.host); S.host.appendChild(overlay); lay();
  }
  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (R.lost) { cancelAnimationFrame(raf); toCanvasFallback().then(() => { raf = requestAnimationFrame(loop); }); return; }
    const v = source.el; if (paused || v.readyState < 2) return;
    tick++;
    let src = v; if (mode && mode.pre) { const p = mode.pre(v, t); if (p) src = p; }
    R.draw(src);
    if (mode && mode.frame) mode.frame(t);
    if (rec) rec.frame();
    if (wantSnap || tick % 45 === 0) {
      const c = document.createElement("canvas"); c.width = R.canvas.width; c.height = R.canvas.height; const x = c.getContext("2d"); x.drawImage(R.canvas, 0, 0); x.drawImage(overlay, 0, 0, c.width, c.height); lastFrame = c;
      if (wantSnap) { wantSnap = false; const s = stamp(c, "liveanddie.xyz"); download(SH, s.toDataURL("image/png"), "liveanddie-ascii.png", "[ download snap ]"); hudNote = "snap saved (link is in the shell)"; setTimeout(() => { hudNote = ""; }, 1800); }
    }
    frames++; if (t - t0 > 500) { fps = Math.round(frames * 1000 / (t - t0)); frames = 0; t0 = t; S.hud.textContent = source.title + "  " + R.st.cols + "x" + R.st.rows + "  " + fps + "fps " + (R.gpu ? "gpu" : "cpu") + (rec ? "  REC" : "") + (hudNote ? "  " + hudNote : ""); }
  }
  raf = requestAnimationFrame(loop);
}

export default function (SH) {
  SH.cmd("cam webcam", a => {
    const o = parse(a);
    if (o.bad) { SH.line("cam: unknown flag " + o.bad + "  (see: man cam)", "dim"); return; }
    (async () => {
      const stream = await getCam(SH, "draws you as live ascii" + (o.mode ? " (" + o.mode + ")" : "") + ".");
      if (!stream) { SH.newPrompt(); return; }
      const v = document.createElement("video"); v.srcObject = stream; v.muted = true; v.playsInline = true;
      try { await v.play(); } catch (e) {}
      const title = "cam" + (o.mode ? " --" + o.mode : "") + (o.text ? " --text" : "");
      await session(SH, o, { el: v, mirror: true, title, stop: () => stopStream(stream) });
    })().catch(e => { SH.line("cam: " + (e && e.message || "failed"), "dim"); SH.newPrompt(); });
    return true;
  }, { help: "your camera as live gpu ascii (on-device)", usage: "cam [--hands|--synth|--ghost|--slitscan|--into <id>|--text \"..\"|--dance] [--record]",
       man: "cam - your camera drawn as live red/blue ascii on the GPU (60fps). Everything is processed on your device; nothing is uploaded.\n--hands    hand tracking: the text becomes particles you push, pinch and throw\n--synth    hand height = pitch, spread = filter, fist = mute\n--ghost    past frames linger as fading echoes\n--slitscan time smears sideways\n--into <id>  cuts you out and puts your ascii body inside a piece\n--text \"..\" draws the image only with the letters you type\n--dance    pose tracking; your movement glitches the picture and the music\n--record   saves a webm + gif with a small liveanddie.xyz stamp\n[ snap ] saves a PNG, [ rec ] records, [ x ] exits." });

  SH.cmd("snap", () => {
    if (!lastFrame) { SH.line("snap: run 'cam' first.", "dim"); return; }
    download(SH, stamp(lastFrame, "liveanddie.xyz").toDataURL("image/png"), "liveanddie-ascii.png", "[ download your ascii self ]");
  }, { help: "save a PNG of the current ascii camera frame" });

  SH.cmd("vid video-ascii", a => {
    const id = (a[0] || "").toUpperCase();
    if (!/^ARC-\d{4}$/.test(id)) { SH.line("usage: vid ARC-0802  (a video piece)", "dim"); return; }
    SH.loadArc().then(async () => {
      const p = SH.findPiece(id); if (!p) { SH.line("vid: no such piece", "dim"); SH.newPrompt(); return; }
      const m = p.media[0]; if (!m.loop) { SH.line("vid: " + id + " is a still. try 'open " + id + "'.", "dim"); SH.newPrompt(); return; }
      const v = document.createElement("video"); v.src = "/archive/" + m.loop; v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = "anonymous";
      try { await v.play(); } catch (e) { SH.line("vid: playback was blocked. tap and try again.", "dim"); SH.newPrompt(); return; }
      SH.setShare("vid " + id);
      await session(SH, parse(a.slice(1)), { el: v, mirror: false, title: "vid " + id + "  " + p.title, stop: () => { v.pause(); v.removeAttribute("src"); v.load(); } });
    }).catch(() => { SH.line("vid: archive offline.", "dim"); SH.newPrompt(); });
    return true;
  }, { help: "play a video piece as live gpu ascii", usage: "vid <id>", man: "vid <id> - play an archive video piece as live ascii video on the GPU. [ pause ] [ snap ] [ rec ] [ x ]." });
}
export { session, parse, stamp };
