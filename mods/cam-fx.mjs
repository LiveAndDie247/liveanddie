// cam --ghost (past frames linger) and cam --slitscan (time smears sideways). Pure canvas pre-passes.
export async function start(ctx, o) {
  const acc = document.createElement("canvas"), ax = acc.getContext("2d");
  let ready = false;
  function size(v) { const w = 240, h = Math.max(60, Math.round(w * (v.videoHeight || 3) / (v.videoWidth || 4))); if (acc.width !== w || acc.height !== h) { acc.width = w; acc.height = h; ax.fillStyle = "#000"; ax.fillRect(0, 0, w, h); } ready = true; }
  if (o.mode === "ghost") {
    ctx.note("echoes linger. move slowly.");
    return { pre(v) { size(v); ax.globalAlpha = 0.11; ax.drawImage(v, 0, 0, acc.width, acc.height); ax.globalAlpha = 1; return acc; } };
  }
  // slitscan: every frame the picture slides left and a thin centre slice of "now" is added on the right
  ctx.note("time runs sideways.");
  const STEP = 2;
  return { pre(v) {
    size(v); const w = acc.width, h = acc.height, vw = v.videoWidth || w, vh = v.videoHeight || h;
    ax.drawImage(acc, -STEP, 0);
    ax.drawImage(v, vw / 2 - 2, 0, 4, vh, w - STEP, 0, STEP, h);
    return acc;
  } };
}
