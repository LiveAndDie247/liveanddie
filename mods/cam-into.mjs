// cam --into <id>: selfie segmentation cuts you out and puts your (blue) ascii body inside a piece,
// with the edges smearing into the art. Everything happens on this device.
import { segmenter } from "./mp.mjs";
import { loadImg, pieceURL } from "./util.mjs";
export async function start(ctx, o) {
  const SH = ctx.SH, d = await SH.loadArc();
  let p = o.id ? SH.findPiece(o.id) : null;
  if (!p) { const pool = d.all.slice(0, 80); p = pool[Math.random() * pool.length | 0]; }
  ctx.note("loading segmenter ...");
  const [seg, art] = await Promise.all([segmenter(), loadImg(pieceURL(p))]);
  const comp = document.createElement("canvas"), cx = comp.getContext("2d", { willReadFrequently: true });
  const tmp = document.createElement("canvas"), tx = tmp.getContext("2d", { willReadFrequently: true });
  let W = 0, H = 0, artD = null, outD = null, invert = null, seen = false;
  function size(v) {
    const w = 176, h = Math.max(40, Math.round(w * (v.videoHeight || 3) / (v.videoWidth || 4)));
    if (w === W && h === H) return; W = w; H = h; comp.width = tmp.width = w; comp.height = tmp.height = h;
    // art, cover-fitted and pre-mirrored (the renderer mirrors the whole frame, so the piece reads the right way round)
    const k = Math.max(w / art.naturalWidth, h / art.naturalHeight), aw = art.naturalWidth * k, ah = art.naturalHeight * k;
    tx.save(); tx.translate(w, 0); tx.scale(-1, 1); tx.drawImage(art, (w - aw) / 2, (h - ah) / 2, aw, ah); tx.restore();
    artD = tx.getImageData(0, 0, w, h); outD = cx.createImageData(w, h);
  }
  ctx.note("you are inside " + p.no + " " + p.title);
  return {
    pre(v) {
      size(v); tx.drawImage(v, 0, 0, W, H);
      const f = tx.getImageData(0, 0, W, H).data, a = artD.data, out = outD.data;
      const res = seg.run(v);
      const m = res && res.confidenceMasks && res.confidenceMasks[0];
      if (!m) { if (seg.dead) ctx.note("body segmentation is not supported on this device - showing the piece only"); cx.putImageData(artD, 0, 0); return comp; }
      if (!seen) { seen = true; ctx.note("you are inside " + p.no + " " + p.title); }
      const mw = m.width, mh = m.height, md = m.getAsFloat32Array();
      if (invert === null) {                       // which way round is the mask? a person sits in the middle of a selfie
        let c = 0, cn = 0, b = 0, bn = 0;
        for (let y = 0; y < mh; y += 4) for (let x = 0; x < mw; x += 4) { const val = md[y * mw + x], mid = x > mw * .3 && x < mw * .7 && y > mh * .3 && y < mh * .8, edge = x < mw * .1 || x > mw * .9 || y < mh * .1; if (mid) { c += val; cn++; } else if (edge) { b += val; bn++; } }
        c /= cn || 1; b /= bn || 1; if (Math.abs(c - b) > 0.25) invert = c < b;
      }
      const inv = invert === true;
      for (let y = 0; y < H; y++) { const my = (y * mh / H | 0) * mw; for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4; let pm = md[my + (x * mw / W | 0)]; if (inv) pm = 1 - pm;
        if (pm > 0.6) { const l = Math.min(255, (0.299 * f[i] + 0.587 * f[i + 1] + 0.114 * f[i + 2]) * 1.2 + 24); out[i] = l * 0.25; out[i + 1] = l * 0.5; out[i + 2] = l; }
        else if (pm > 0.25) { let sx = x + ((Math.random() * 16) | 0) - 8; sx = sx < 0 ? 0 : sx >= W ? W - 1 : sx; const j = (y * W + sx) * 4; out[i] = Math.min(255, a[j] + 60); out[i + 1] = a[j + 1]; out[i + 2] = a[j + 2]; }
        else { out[i] = a[i]; out[i + 1] = a[i + 1]; out[i + 2] = a[i + 2]; }
        out[i + 3] = 255;
      } }
      try { m.close(); } catch (e) {}
      cx.putImageData(outD, 0, 0); return comp;
    },
    stop() { try { seg.close(); } catch (e) {} }
  };
}
