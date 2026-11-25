// records the ascii output (+ the song, if one is playing) to a story-sized video and a GIF, each with a small
// liveanddie.xyz stamp. Everything is encoded on this device.
import { download } from "./util.mjs";
const W = 540, H = 960, GW = 270, GH = 480, PAL = [[0, 0, 0], [255, 48, 48], [64, 112, 255], [255, 255, 255]];

export function gifEncode(w, h, frames, delayCs) {
  let buf = new Uint8Array(1 << 20), n = 0;
  const b = v => { if (n >= buf.length) { const nb = new Uint8Array(buf.length * 2); nb.set(buf); buf = nb; } buf[n++] = v & 255; };
  const w16 = v => { b(v); b(v >> 8); }, str = s => { for (let i = 0; i < s.length; i++) b(s.charCodeAt(i)); };
  str("GIF89a"); w16(w); w16(h); b(0xF1); b(0); b(0);
  PAL.forEach(c => { b(c[0]); b(c[1]); b(c[2]); });
  b(0x21); b(0xFF); b(11); str("NETSCAPE2.0"); b(3); b(1); w16(0); b(0);
  for (const pix of frames) {
    b(0x21); b(0xF9); b(4); b(0); w16(delayCs); b(0); b(0);
    b(0x2C); w16(0); w16(0); w16(w); w16(h); b(0);
    const MIN = 2; b(MIN);
    const clear = 1 << MIN, eoi = clear + 1; let size = MIN + 1, next = eoi + 1, dict = new Map(), cur = 0, bits = 0;
    const block = new Uint8Array(255); let bn = 0;
    const flush = () => { if (bn) { b(bn); for (let i = 0; i < bn; i++) b(block[i]); bn = 0; } };
    const emit = c => { cur |= c << bits; bits += size; while (bits >= 8) { block[bn++] = cur & 255; cur >>>= 8; bits -= 8; if (bn === 255) flush(); } };
    emit(clear);
    let prefix = pix[0];
    for (let i = 1; i < pix.length; i++) {
      const k = pix[i], key = (prefix << 8) | k, hit = dict.get(key);
      if (hit !== undefined) { prefix = hit; continue; }
      emit(prefix);
      if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
      else { emit(clear); dict = new Map(); next = eoi + 1; size = MIN + 1; }
      prefix = k;
    }
    emit(prefix); emit(eoi); if (bits > 0) { block[bn++] = cur & 255; if (bn === 255) flush(); } flush(); b(0);
  }
  b(0x3B);
  return buf.slice(0, n);
}

export function record(SH, getCanvas, getOverlay, opt = {}) {
  if (!window.MediaRecorder) throw new Error("no recorder");
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const gc = document.createElement("canvas"); gc.width = GW; gc.height = GH; const gx = gc.getContext("2d", { willReadFrequently: true });
  const stream = c.captureStream(30);
  try { const au = SH.au; if (au && au.src && !au.paused && au.captureStream) au.captureStream().getAudioTracks().forEach(t => stream.addTrack(t)); } catch (e) {}
  const mime = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } });
  if (!mime) throw new Error("no recorder");
  const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4e6 }), chunks = [], frames = [];
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  let done = false, lastGif = 0; const t0 = performance.now(), seconds = opt.seconds || 12;
  mr.onstop = () => {
    const ext = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";
    if (chunks.length) download(SH, URL.createObjectURL(new Blob(chunks, { type: mime.split(";")[0] })), "liveanddie-ascii." + ext, "[ download video (." + ext + ", story size) ]");
    if (frames.length) setTimeout(() => { try { const g = gifEncode(GW, GH, frames, 10); download(SH, URL.createObjectURL(new Blob([g], { type: "image/gif" })), "liveanddie-ascii.gif", "[ download gif (" + Math.round(g.length / 1024) + " KB) ]"); } catch (e) { SH.line("gif: could not encode.", "dim"); } }, 30);
    SH.line("recording saved. the links are above - post it, the stamp does the rest.", "blue");
    if (opt.onDone) opt.onDone();
  };
  mr.start(500);
  function stop() { if (done) return; done = true; try { mr.stop(); } catch (e) {} setTimeout(() => stream.getVideoTracks().forEach(t => t.stop()), 200); }
  function frame() {
    if (done) return;
    const src = getCanvas(), ov = getOverlay && getOverlay();
    x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
    const k = Math.min(W / src.width, H / src.height), dw = src.width * k, dh = src.height * k, dx = (W - dw) / 2, dy = (H - dh) / 2;
    x.imageSmoothingEnabled = false; x.drawImage(src, dx, dy, dw, dh); if (ov && ov.width) x.drawImage(ov, dx, dy, dw, dh);
    x.font = "24px 'Web437 VGA',monospace"; x.textBaseline = "bottom"; const label = "liveanddie.xyz", tw = x.measureText(label).width;
    x.fillStyle = "#000"; x.fillRect(W - tw - 22, H - 44, tw + 22, 44); x.fillStyle = "#4070ff"; x.fillText(label, W - tw - 11, H - 10);
    const t = performance.now();
    if (t - lastGif >= 100 && frames.length < 50) {
      lastGif = t; gx.drawImage(c, 0, 0, GW, GH); const d = gx.getImageData(0, 0, GW, GH).data, idx = new Uint8Array(GW * GH);
      for (let i = 0, j = 0; j < idx.length; i += 4, j++) { const r = d[i], g = d[i + 1], bl = d[i + 2]; idx[j] = (r < 70 && bl < 70) ? 0 : (r > 190 && g > 190 && bl > 190) ? 3 : r >= bl ? 1 : 2; }
      frames.push(idx);
    }
    if (t - t0 > seconds * 1000) stop();
  }
  return { frame, stop };
}
