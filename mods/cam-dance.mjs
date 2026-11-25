// cam --dance: pose tracking. Your movement drives glitch + colour swap, and standing still stops the tape
// of whatever song is playing. Body joints only (no face points).
import { pose } from "./mp.mjs";
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
export async function start(ctx) {
  ctx.note("loading pose tracker ...");
  const det = await pose(), au = ctx.SH.au, R0 = ctx.R;
  let prev = null, energy = 0, still = 0, lastSwap = 0, rate = 1;
  return {
    frame(t) {
      const res = det.run(ctx.v);
      const lm = res && res.landmarks && res.landmarks[0], x = ctx.ox, W = ctx.overlay.width, H = ctx.overlay.height, R = ctx.R;
      x.clearRect(0, 0, W, H);
      const playing = !!au.src && !au.paused;
      if (!lm) { R.st.glitch *= 0.9; ctx.note("step back so the camera sees your body"); prev = null; return; }
      x.font = "16px 'Web437 VGA',monospace"; x.textBaseline = "middle"; x.textAlign = "center";
      x.fillStyle = "#4070ff";
      BONES.forEach(b => { const A = ctx.map(lm[b[0]].x, lm[b[0]].y), B = ctx.map(lm[b[1]].x, lm[b[1]].y); for (let k = 1; k < 6; k++) x.fillText(".", A[0] + (B[0] - A[0]) * k / 6, A[1] + (B[1] - A[1]) * k / 6); });
      x.fillStyle = "#ff3030";
      for (let i = 11; i <= 28; i++) { const q = ctx.map(lm[i].x, lm[i].y); x.fillText("o", q[0], q[1]); }
      const head = ctx.map(lm[0].x, lm[0].y); x.fillText("O", head[0], head[1]);
      if (prev) {
        const torso = Math.hypot(lm[11].x - lm[23].x, lm[11].y - lm[23].y) || 0.2; let e = 0;
        for (let i = 11; i <= 28; i++) e += Math.hypot(lm[i].x - prev[i].x, lm[i].y - prev[i].y);
        energy = energy * 0.8 + (e / 18 / torso) * 0.2;
      }
      prev = lm.map(p => ({ x: p.x, y: p.y }));
      R.st.glitch = Math.min(1, energy * 9);
      if (energy > 0.085 && t - lastSwap > 350) { R.st.swap = !R.st.swap; lastSwap = t; }
      if (playing) {
        still = energy < 0.012 ? still + 1 : 0;
        const target = still > 40 ? 0.3 : 1; rate += (target - rate) * 0.07;
        try { au.preservesPitch = false; au.playbackRate = Math.max(0.25, Math.min(1, rate)); } catch (e) {}
        ctx.note(still > 40 ? "tape stop. move to bring the song back" : "move = glitch + swap");
      } else ctx.note("move = glitch + swap. play a song first (play 01) and your body runs the tape");
    },
    stop() { try { det.close(); } catch (e) {} try { au.playbackRate = 1; au.preservesPitch = true; } catch (e) {} R0.st.glitch = 0; R0.st.swap = false; }
  };
}
