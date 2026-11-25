// cam --hands : the terminal's own text becomes particles your hands push, pinch and throw.
// cam --synth : a hand synth. height = pitch, spread = filter, fist = mute. dots + tracers only.
import { hands } from "./mp.mjs";
const TIPS = [4, 8, 12, 16, 20];
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export async function start(ctx, o) {
  // synth: open the audio context first, while the tap/enter that ran the command still counts as a gesture
  let AC = null;
  if (o.mode === "synth") { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } if (!AC) throw new Error("no web audio"); }
  ctx.note("loading hand tracker (first time ~17 MB) ...");
  let det; try { det = await hands(2); } catch (e) { if (AC) try { AC.close(); } catch (x) {} throw e; }
  return o.mode === "synth" ? synth(ctx, det, AC) : particles(ctx, det);
}

function drawDots(ctx, list, glyph) {            // landmarks as ascii dots (blue = first hand, red = second)
  const x = ctx.ox; x.font = "16px 'Web437 VGA',monospace"; x.textBaseline = "middle"; x.textAlign = "center";
  list.forEach((lm, h) => { x.fillStyle = h ? "#ff3030" : "#4070ff"; lm.forEach((p, i) => { const q = ctx.map(p.x, p.y); x.fillText(TIPS.includes(i) ? "o" : glyph, q[0], q[1]); }); });
}

function particles(ctx, det) {
  const SH = ctx.SH, x = ctx.ox, P = [], words = [];
  ctx.R.st.gain = 0.3;                              // dim the camera so the text reads
  function seed() {
    P.length = 0; words.length = 0;
    const kids = SH.out.children, lines = [];
    for (let i = Math.max(0, kids.length - 16); i < kids.length; i++) { const t = (kids[i].textContent || "").replace(/\s+/g, " ").trim(); if (t) lines.push(t.slice(0, Math.floor(ctx.overlay.width / 8) - 2)); }
    if (!lines.length) lines.push("live.and.die", "push the words", "pinch to grab one", "throw it");
    const top = Math.max(16, (ctx.overlay.height - lines.length * 18) / 2);
    lines.forEach((ln, r) => { let col = 1; ln.split(" ").forEach(w => { const wi = words.length, ids = []; for (const ch of w) { ids.push(P.length); P.push({ ch, x: col * 8, y: top + r * 18, hx: col * 8, hy: top + r * 18, vx: 0, vy: 0, w: wi, free: 0 }); col++; } words.push({ ids, held: false }); col++; }); });
  }
  seed();
  let held = null, pinchPrev = null, lastSeed = performance.now();
  ctx.note("push the words. pinch one to grab it, let go to throw.");
  return {
    frame(t) {
      const res = det.run(ctx.v);
      const L = res && res.landmarks || [];
      const pts = [], W = ctx.overlay.width, H = ctx.overlay.height;
      let pinch = null;
      L.forEach(lm => {
        [0, 4, 8, 9, 12, 16, 20].forEach(i => { const q = ctx.map(lm[i].x, lm[i].y); pts.push(q); });
        const size = d2(lm[0], lm[9]) || 0.1;
        if (!pinch && d2(lm[4], lm[8]) / size < 0.32) { const q = ctx.map((lm[4].x + lm[8].x) / 2, (lm[4].y + lm[8].y) / 2); pinch = { x: q[0], y: q[1] }; }
      });
      // grab / carry / throw
      if (pinch && !held) { let best = -1, bd = 70; words.forEach((w, i) => { const a = P[w.ids[0]], b = P[w.ids[w.ids.length - 1]]; const d = Math.hypot((a.x + b.x) / 2 - pinch.x, a.y - pinch.y); if (d < bd) { bd = d; best = i; } }); if (best >= 0) { held = best; words[best].held = true; } }
      if (held != null) {
        const w = words[held];
        if (pinch) { const n = w.ids.length; w.ids.forEach((id, k) => { const p = P[id]; p.x = pinch.x + (k - n / 2) * 8; p.y = pinch.y - 14; p.vx = p.vy = 0; }); }
        else { const vx = pinchPrev ? pinchPrev.vx : 0, vy = pinchPrev ? pinchPrev.vy : 0; w.ids.forEach(id => { const p = P[id]; p.vx = vx * 1.6 + (Math.random() - .5) * 2; p.vy = vy * 1.6 + (Math.random() - .5) * 2; p.free = 140; }); w.held = false; held = null; }
      }
      if (pinch) pinchPrev = { x: pinch.x, y: pinch.y, vx: pinchPrev ? pinch.x - pinchPrev.x : 0, vy: pinchPrev ? pinch.y - pinchPrev.y : 0 }; else if (held == null) pinchPrev = null;
      // physics
      for (const p of P) {
        if (held != null && p.w === held) continue;
        for (const q of pts) { const dx = p.x - q[0], dy = p.y - q[1], d = Math.hypot(dx, dy); if (d < 46 && d > 0.01) { const f = (46 - d) / 46 * 2.6; p.vx += dx / d * f; p.vy += dy / d * f; p.free = Math.max(p.free, 50); } }
        if (p.free > 0) p.free--; else { p.vx += (p.hx - p.x) * 0.03; p.vy += (p.hy - p.y) * 0.03; }
        p.vx *= 0.93; p.vy *= 0.93; p.x += p.vx; p.y += p.vy;
        if (p.x < 0) { p.x = 0; p.vx *= -0.7; } if (p.x > W - 8) { p.x = W - 8; p.vx *= -0.7; }
        if (p.y < 8) { p.y = 8; p.vy *= -0.7; } if (p.y > H - 8) { p.y = H - 8; p.vy *= -0.7; }
      }
      // draw
      x.clearRect(0, 0, W, H); x.font = "16px 'Web437 VGA',monospace"; x.textBaseline = "middle"; x.textAlign = "left";
      for (const p of P) { x.fillStyle = (held != null && p.w === held) ? "#4070ff" : "#ff3030"; x.fillText(p.ch, p.x, p.y); }
      drawDots(ctx, L, ".");
      if (!L.length && t - lastSeed > 9000) { lastSeed = t; }
    },
    stop() { try { det.close(); } catch (e) {} ctx.R.st.gain = 1; }
  };
}

function synth(ctx, det, AC) {
  const out = AC.createGain(); out.gain.value = 0; const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 8; lp.connect(out); out.connect(AC.destination);
  const osc = [AC.createOscillator(), AC.createOscillator()]; osc[0].type = "sawtooth"; osc[1].type = "square";
  const og = [AC.createGain(), AC.createGain()]; osc.forEach((o, i) => { og[i].gain.value = 0; o.connect(og[i]); og[i].connect(lp); o.start(); });
  const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29];           // minor pentatonic over ~2.5 octaves
  const NAMES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
  const trails = [], lastV = new Map();
  // audio params: only on real change, replacing earlier automation (never an ever-growing event list)
  const setp = (param, v, tc) => { const l = lastV.get(param); if (l !== undefined && Math.abs(l - v) <= Math.abs(v) * 0.01 + 1e-4) return; lastV.set(param, v); const now = AC.currentTime; try { param.cancelScheduledValues(now); param.setTargetAtTime(v, now, tc); } catch (e) {} };
  let n = 0;
  ctx.R.st.gain = 0.6;
  ctx.note("raise a hand = pitch, open/close = filter, fist = mute");
  return {
    frame() {
      if ((n++ % 3) === 0 && AC.state === "suspended") AC.resume().catch(() => {});
      const res = det.run(ctx.v);
      const L = res && res.landmarks || [], x = ctx.ox, W = ctx.overlay.width, H = ctx.overlay.height;
      let any = false, label = "";
      for (let h = 0; h < 2; h++) {
        const lm = L[h];
        if (!lm) { setp(og[h].gain, 0, 0.05); continue; }
        const size = d2(lm[0], lm[9]) || 0.1;
        const openness = TIPS.reduce((a, i) => a + d2(lm[i], lm[0]), 0) / 5 / size;      // ~1.0 fist .. ~2.2 open
        const fist = openness < 1.25;
        const spread = Math.min(1, Math.max(0, (d2(lm[4], lm[20]) / size - 0.5) / 1.6));
        const yy = 1 - Math.min(1, Math.max(0, lm[9].y));
        const step = SCALE[Math.min(SCALE.length - 1, Math.floor(yy * SCALE.length))];
        const f = 110 * Math.pow(2, step / 12) * (h ? 1.5 : 1);
        setp(osc[h].frequency, f, 0.03);
        setp(og[h].gain, fist ? 0 : 0.5, 0.04);
        if (!h) setp(lp.frequency, Math.round((250 + spread * spread * 6000) / 50) * 50, 0.05);
        if (!fist) { any = true; label += (label ? " + " : "") + NAMES[(step + (h ? 7 : 0)) % 12]; }
        TIPS.forEach(i => { const q = ctx.map(lm[i].x, lm[i].y); trails.push({ x: q[0], y: q[1], a: 1, h }); });
      }
      setp(out.gain, any ? 0.22 : 0, 0.05);
      x.clearRect(0, 0, W, H); x.font = "16px 'Web437 VGA',monospace"; x.textBaseline = "middle"; x.textAlign = "center";
      for (let i = trails.length - 1; i >= 0; i--) { const tr = trails[i]; tr.a -= 0.04; if (tr.a <= 0) { trails.splice(i, 1); continue; } x.globalAlpha = tr.a; x.fillStyle = tr.h ? "#ff3030" : "#4070ff"; x.fillText(tr.a > 0.6 ? "*" : tr.a > 0.3 ? "+" : ".", tr.x, tr.y); }
      x.globalAlpha = 1; drawDots(ctx, L, ".");
      ctx.note(any ? "note " + label : (L.length ? "fist = mute" : "show a hand to play"));
    },
    stop() { try { det.close(); } catch (e) {} try { osc.forEach(o => o.stop()); AC.close(); } catch (e) {} ctx.R.st.gain = 1; }
  };
}
