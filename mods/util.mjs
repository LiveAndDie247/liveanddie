// shared helpers for the phase 9+ modules: a full-screen stage (no pop-up: an in-page layer with a visible
// [ x ]), permission helpers that print one plain line first, image loading, downloads.
export function stage(SH, o = {}) {
  const el = document.createElement("div");
  el.className = "stage";
  el.style.cssText = "position:fixed;inset:0;z-index:38;background:#000;color:var(--red);font:16px/1 'Web437 VGA',monospace;display:flex;flex-direction:column;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none";
  const hud = document.createElement("div"); hud.style.cssText = "padding:6px 8px;color:var(--blue);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto;line-height:1.2";
  const host = document.createElement("div"); host.style.cssText = "position:relative;flex:1 1 auto;overflow:hidden;min-height:0";
  const bar = document.createElement("div"); bar.style.cssText = "flex:0 0 auto;display:flex;gap:6px;padding:6px;overflow-x:auto;border-top:1px solid var(--dim);line-height:1.2";
  el.append(hud, host, bar); document.body.appendChild(el);
  let closed = false; const cleanups = [];
  function btn(label, fn) {
    const b = document.createElement("button"); b.textContent = label;
    b.style.cssText = "flex:0 0 auto;font:inherit;background:#000;color:var(--blue);border:1px solid var(--dim);padding:6px 9px;white-space:nowrap;cursor:pointer";
    b.addEventListener("click", e => { e.stopPropagation(); fn(b); }); bar.appendChild(b); return b;
  }
  function close(msg) {
    if (closed) return; closed = true;
    removeEventListener("keydown", kd, true);
    cleanups.splice(0).forEach(f => { try { f(); } catch (e) {} });
    el.remove(); if (msg) SH.line(msg, "dim"); SH.newPrompt();
  }
  function kd(e) {
    if (e.key === "Escape") { e.preventDefault(); close(o.bye); return; }
    if (o.onKey) { if (o.onKey(e.key, e) !== false && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault(); }
  }
  addEventListener("keydown", kd, true);
  btn("[ x ]", () => close(o.bye));
  hud.textContent = o.title || "";
  return { el, hud, host, bar, btn, close, onClose: f => cleanups.push(f), get closed() { return closed; }, size: () => ({ w: host.clientWidth, h: host.clientHeight }) };
}
export function fit(canvas, host) {            // centre a fixed-size canvas in the host
  canvas.style.position = "absolute"; canvas.style.left = "50%"; canvas.style.top = "50%"; canvas.style.transform = "translate(-50%,-50%)";
  canvas.style.imageRendering = "pixelated"; host.appendChild(canvas);
}
export function loadImg(url) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("image")); im.src = url; }); }
export function download(SH, href, name, label) {
  const a = document.createElement("a"); a.href = href; a.download = name; a.textContent = label || "[ download " + name + " ]";
  const d = document.createElement("div"); d.className = "ln"; d.appendChild(a); SH.out.appendChild(d); SH.scroll(); return a;
}
// one plain line, then the browser's own permission prompt. Resolves to a stream or null (never throws).
export async function getCam(SH, why, constraints) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { SH.line("camera: this browser has no camera access (needs https).", "dim"); return null; }
  SH.line("camera: " + why + " it is processed on this device and never uploaded.", "dim");
  try { return await navigator.mediaDevices.getUserMedia(constraints || { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }); }
  catch (e) { SH.line("camera: not available (permission denied or no camera). nothing was started.", "dim"); return null; }
}
export async function getMic(SH, why) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { SH.line("microphone: this browser has no mic access (needs https).", "dim"); return null; }
  SH.line("microphone: " + why + " it is processed on this device and never uploaded.", "dim");
  try { return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false }, video: false }); }
  catch (e) { SH.line("microphone: not available (permission denied or no mic). nothing was started.", "dim"); return null; }
}
export async function getMotion(SH, why) {       // iOS needs an explicit ask; Android just works
  try {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      SH.line("motion: " + why + " it stays on this device.", "dim");
      const r = await DeviceOrientationEvent.requestPermission(); return r === "granted";
    }
    return typeof DeviceOrientationEvent !== "undefined";
  } catch (e) { return false; }
}
export function stopStream(s) { if (s) s.getTracks().forEach(t => t.stop()); }
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function pieceURL(p, full) { const m = p.media[0]; return "/archive/" + (full ? (m.img || m.thumb) : (m.thumb || m.img)); }
// one shared analyser on the <audio> element (an element can only be tapped once, so every module uses this)
export function audioTap(SH) {
  if (SH._tap) { if (SH._tap.AC.state === "suspended") SH._tap.AC.resume().catch(() => {}); return SH._tap; }
  const AC = new (window.AudioContext || window.webkitAudioContext)(), src = AC.createMediaElementSource(SH.au), an = AC.createAnalyser();
  an.fftSize = 512; src.connect(an); an.connect(AC.destination); if (AC.state === "suspended") AC.resume().catch(() => {});
  return (SH._tap = { AC, src, an });
}
// 16-bit PCM WAV from Float32 channel arrays, with an optional INFO chunk (title / artist credit)
export function wavBlob(chans, sr, info) {
  const n = chans[0].length, C = chans.length; let infoBytes = null;
  if (info) { const parts = []; for (const k in info) { const s = String(info[k]); const b = new Uint8Array(8 + s.length + 1 + ((s.length + 1) % 2)); for (let i = 0; i < 4; i++) b[i] = k.charCodeAt(i); new DataView(b.buffer).setUint32(4, s.length + 1, true); for (let i = 0; i < s.length; i++) b[8 + i] = s.charCodeAt(i) & 127; parts.push(b); } const len = parts.reduce((a, b) => a + b.length, 4); infoBytes = new Uint8Array(8 + len); infoBytes.set([76, 73, 83, 84]); new DataView(infoBytes.buffer).setUint32(4, len, true); infoBytes.set([73, 78, 70, 79], 8); let o = 12; parts.forEach(b => { infoBytes.set(b, o); o += b.length; }); }
  const dataLen = n * C * 2, total = 44 + dataLen + (infoBytes ? infoBytes.length : 0), ab = new ArrayBuffer(total), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, total - 8, true); ws(8, "WAVE"); ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, C, true); v.setUint32(24, sr, true); v.setUint32(28, sr * C * 2, true); v.setUint16(32, C * 2, true); v.setUint16(34, 16, true); ws(36, "data"); v.setUint32(40, dataLen, true);
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < C; c++) { const x = Math.max(-1, Math.min(1, chans[c][i])); v.setInt16(o, x * 0x7fff, true); o += 2; }
  if (infoBytes) new Uint8Array(ab).set(infoBytes, o);
  return new Blob([ab], { type: "audio/wav" });
}
