// scan (QR reader) and poster (printable ascii poster with a QR in the corner).
import { createAscii } from "./gl.mjs";
import { stage, fit, getCam, stopStream, loadImg, pieceURL, download } from "./util.mjs";
const RAMP = " .:-=+*#%@";

// ------------------------------------------------------------------ scan
async function scan(SH) {
  const stream = await getCam(SH, "reads QR codes, for example the one on a print.", { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  if (!stream) { SH.newPrompt(); return; }
  let detect = null;
  if ("BarcodeDetector" in window) { try { const bd = new BarcodeDetector({ formats: ["qr_code"] }); detect = async src => { const r = await bd.detect(src); return r && r[0] ? r[0].rawValue : null; }; } catch (e) { detect = null; } }
  if (!detect) { try { await SH.loadMod("/vendor/qr/jsQR.js"); const c = document.createElement("canvas"), x = c.getContext("2d", { willReadFrequently: true }); detect = async v => { const w = 480, h = Math.round(w * v.videoHeight / v.videoWidth) || 360; c.width = w; c.height = h; x.drawImage(v, 0, 0, w, h); const d = x.getImageData(0, 0, w, h), r = window.jsQR(d.data, w, h); return r ? r.data : null; }; } catch (e) { stopStream(stream); SH.line("scan: no QR reader available in this browser.", "dim"); SH.newPrompt(); return; } }
  const v = document.createElement("video"); v.srcObject = stream; v.muted = true; v.playsInline = true; try { await v.play(); } catch (e) {}
  const R = await createAscii({}), S = stage(SH, { title: "scan  -  point the camera at a live.and.die QR code", bye: "scanner off." }); fit(R.canvas, S.host);
  const lay = () => { const z = S.size(); R.resize(z.w, z.h); }; lay(); addEventListener("resize", lay);
  let raf = 0, busy = false, last = 0, found = false;
  S.onClose(() => { cancelAnimationFrame(raf); removeEventListener("resize", lay); stopStream(stream); R.destroy(); });
  function handle(text) {
    found = true; let u = null; try { u = new URL(text, location.href); } catch (e) {}
    const ours = u && (u.host === location.host || /(^|\.)liveanddie\.xyz$/.test(u.hostname));
    if (ours && /^\/p\/[a-z0-9]+\/?/.test(u.pathname)) { S.close("print recognised. opening its page ..."); setTimeout(() => { location.href = u.pathname; }, 500); return; }
    if (ours && u.hash.length > 1) { const c = decodeURIComponent(u.hash.slice(1)); S.close(); SH.submit(c); return; }
    S.close("scan: read a code.");
    const d = document.createElement("div"); d.className = "ln"; d.textContent = "it says: " + text.slice(0, 300); SH.out.insertBefore(d, SH.promptEl.parentNode === SH.out ? SH.promptEl : null);
    if (u && /^https?:$/.test(u.protocol) && !ours) SH.line("(not a live.and.die code - it was not opened.)", "dim");
    SH.scroll();
  }
  function loop(t) {
    raf = requestAnimationFrame(loop); if (v.readyState < 2) return; R.draw(v);
    if (!busy && !found && t - last > 220) { busy = true; last = t; detect(v).then(r => { busy = false; if (r && !S.closed) handle(String(r)); }, () => { busy = false; }); }
  }
  raf = requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ poster
const SIZES = { a4: { w: 2480, h: 3508, pw: 595.28, ph: 841.89, label: "A4" }, tabloid: { w: 2200, h: 3400, pw: 792, ph: 1224, label: "11x17" } };
function pdfFromJpeg(jpg, wpx, hpx, pw, ph) {                    // one page, the image scaled to the full sheet
  const enc = s => new TextEncoder().encode(s), parts = [], offs = []; let len = 0;
  const push = b => { parts.push(b); len += b.length; }, obj = (n, body) => { offs[n] = len; push(enc(n + " 0 obj\n" + body + "\nendobj\n")); };
  push(enc("%PDF-1.4\n%\xff\xff\xff\xff\n"));
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>"); obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pw + " " + ph + "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
  offs[4] = len; push(enc("4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + wpx + " /Height " + hpx + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpg.length + " >>\nstream\n")); push(jpg); push(enc("\nendstream\nendobj\n"));
  const content = "q " + pw + " 0 0 " + ph + " 0 0 cm /Im0 Do Q"; obj(5, "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream");
  const xref = len; let x = "xref\n0 6\n0000000000 65535 f \n"; for (let i = 1; i <= 5; i++) x += String(offs[i]).padStart(10, "0") + " 00000 n \n";
  push(enc(x + "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n"));
  return new Blob(parts, { type: "application/pdf" });
}
async function renderPoster(SH, p, size) {
  const Z = SIZES[size], im = await loadImg(pieceURL(p, true));
  await SH.loadMod("/vendor/qr/qrcode.js"); if (document.fonts && document.fonts.load) await document.fonts.load("16px 'Web437 VGA'").catch(() => {});
  const c = document.createElement("canvas"); c.width = Z.w; c.height = Z.h; const x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, Z.w, Z.h);
  const M = Math.round(Z.w * 0.05), headH = Math.round(Z.h * 0.045), footH = Math.round(Z.h * 0.11), aw = Z.w - 2 * M, ah = Z.h - 2 * M - headH - footH;
  const COLS = 132, cw = aw / COLS, chh = cw * 2; let rows = Math.floor(ah / chh), cols = COLS;
  const ia = im.naturalWidth / im.naturalHeight; if (cols * cw / (rows * chh) > ia) cols = Math.max(20, Math.round(rows * chh * ia / cw)); else rows = Math.max(10, Math.round(cols * cw / ia / chh));
  const s = document.createElement("canvas"); s.width = cols; s.height = rows; const sx = s.getContext("2d", { willReadFrequently: true }); sx.drawImage(im, 0, 0, cols, rows);
  const d = sx.getImageData(0, 0, cols, rows).data; let lo = 1, hi = 0; const L = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) { const l = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255; L[i] = l; if (l < lo) lo = l; if (l > hi) hi = l; }
  const rng = Math.max(0.05, hi - lo), ox = M + (aw - cols * cw) / 2, oy = M + headH + (ah - rows * chh) / 2;
  x.font = Math.round(chh) + "px 'Web437 VGA',monospace"; x.textBaseline = "top";
  for (let pass = 0; pass < 2; pass++) { x.fillStyle = pass ? "#4070ff" : "#ff3030"; for (let yy = 0; yy < rows; yy++) for (let xx = 0; xx < cols; xx++) { const i = yy * cols + xx; if ((d[i * 4] >= d[i * 4 + 2] ? 0 : 1) !== pass) continue; const ch = RAMP[Math.round((L[i] - lo) / rng * 9)]; if (ch !== " ") x.fillText(ch, ox + xx * cw, oy + yy * chh); } }
  const fs = Math.round(Z.w / 52); x.font = fs + "px 'Web437 VGA',monospace"; x.fillStyle = "#ff3030"; x.fillText("live.and.die", M, M); x.fillStyle = "#4070ff"; const idw = x.measureText(p.no).width; x.fillText(p.no, Z.w - M - idw, M);
  const fy = Z.h - M - footH + Math.round(footH * 0.18); x.fillStyle = "#ff3030"; x.fillText(p.title.slice(0, 40), M, fy); x.fillStyle = "#802020"; x.fillText((p.medium || (p.date || "").slice(0, 4)) + "  //  LIVE.AND.DIE PRODUCTIONS", M, fy + fs * 1.5); x.fillStyle = "#4070ff"; x.fillText("liveanddie.xyz", M, fy + fs * 3);
  const qr = window.qrcode(0, "M"); qr.addData("https://liveanddie.xyz/#" + encodeURIComponent("open " + p.no)); qr.make();
  const n = qr.getModuleCount(), qs = footH, mod = Math.floor(qs / (n + 4)), q0x = Z.w - M - mod * (n + 4), q0y = Z.h - M - mod * (n + 4);
  x.fillStyle = "#fff"; x.fillRect(q0x, q0y, mod * (n + 4), mod * (n + 4)); x.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) if (qr.isDark(r, cc)) x.fillRect(q0x + (cc + 2) * mod, q0y + (r + 2) * mod, mod, mod);
  return c;
}
const blobOf = (c, type, q) => new Promise(res => c.toBlob(res, type, q));

export default function (SH) {
  SH.cmd("scan qr", () => { scan(SH).catch(e => { SH.line("scan: " + (e && e.message || "failed"), "dim"); SH.newPrompt(); }); return true; },
    { help: "scan a QR code with the camera (prints unlock a page)", man: "scan - opens the camera and reads QR codes on this device. Every print carries a code that opens a page made only for that piece. Codes from other sites are shown, never opened." });
  SH.cmd("poster print", a => {
    const id = (a[0] || "").toUpperCase(); if (!/^ARC-\d{4}$/.test(id)) { SH.line("usage: poster ARC-0802", "dim"); return; }
    const size = a.includes("--tabloid") || a.includes("--11x17") ? "tabloid" : "a4", fmt = a.includes("--pdf") ? "pdf" : a.includes("--png") ? "png" : null;
    (async () => {
      await SH.loadArc(); const p = SH.findPiece(id); if (!p) { SH.line("poster: no such piece", "dim"); SH.newPrompt(); return; }
      if (!fmt) { SH.line("poster " + p.no + "  " + p.title + "  -  ascii, print-ready, with its QR in the corner:"); SH.line("  A4      {{poster " + id + " --a4 --png|[ png ]}}  {{poster " + id + " --a4 --pdf|[ pdf ]}}"); SH.line("  11x17   {{poster " + id + " --tabloid --png|[ png ]}}  {{poster " + id + " --tabloid --pdf|[ pdf ]}}"); SH.line("rendered on your device when you tap one (large image, give it a few seconds).", "dim"); SH.newPrompt(); return; }
      SH.line("rendering " + SIZES[size].label + " " + fmt + " ...", "dim");
      const c = await renderPoster(SH, p, size), name = "liveanddie-" + p.no + "-" + SIZES[size].label.toLowerCase();
      if (fmt === "png") download(SH, URL.createObjectURL(await blobOf(c, "image/png")), name + ".png", "[ download " + SIZES[size].label + " poster .png ]");
      else { const jpg = new Uint8Array(await (await blobOf(c, "image/jpeg", 0.93)).arrayBuffer()); download(SH, URL.createObjectURL(pdfFromJpeg(jpg, c.width, c.height, SIZES[size].pw, SIZES[size].ph)), name + ".pdf", "[ download " + SIZES[size].label + " poster .pdf ]"); }
      SH.newPrompt();
    })().catch(() => { SH.line("poster: could not render (not enough memory for a canvas this size?).", "dim"); SH.newPrompt(); });
    return true;
  }, { help: "printable hi-res ascii poster of a piece (png/pdf, A4 or 11x17)", usage: "poster <id> [--a4|--tabloid] [--png|--pdf]", man: "poster <id> - builds a print-ready ascii poster of a piece on your device: PNG or PDF, A4 or 11x17, with a QR code in the corner that opens the piece." });
}
export { pdfFromJpeg };
