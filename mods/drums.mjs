// tiny Web Audio drum kit shared by jam / remix / dream. type: 0 kick, 1 snare, 2 hat, 3 clap
function noise(ctx, dur) { const n = Math.max(1, ctx.sampleRate * dur | 0), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
export function hit(ctx, type, t, dest) {
  dest = dest || ctx.destination; const g = ctx.createGain(); g.connect(dest);
  if (type === 0) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12); g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); o.start(t); o.stop(t + 0.2); }
  else if (type === 1) { const s = ctx.createBufferSource(); s.buffer = noise(ctx, 0.2); const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; s.connect(f); f.connect(g); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); s.start(t); s.stop(t + 0.16); }
  else if (type === 2) { const s = ctx.createBufferSource(); s.buffer = noise(ctx, 0.05); const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000; s.connect(f); f.connect(g); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); s.start(t); s.stop(t + 0.05); }
  else { for (let k = 0; k < 2; k++) { const s = ctx.createBufferSource(); s.buffer = noise(ctx, 0.1); const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1200; s.connect(f); f.connect(g); g.gain.setValueAtTime(0.5, t + k * 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + k * 0.02 + 0.08); s.start(t + k * 0.02); s.stop(t + k * 0.02 + 0.09); } }
}
export function buzz(ms) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) {} }      // android haptics; silently nothing elsewhere
