// remix (live deck), spectro (scrolling ascii spectrogram), hum (mic pitch -> notes), voice, say
import { createAscii } from "./gl.mjs";
import { stage, fit, getMic, stopStream, download, audioTap, wavBlob } from "./util.mjs";

function trackOf(SH, arg) { const d = SH._arc; const n = parseInt(String(arg || "1").replace(/^0+(?=\d)/, ""), 10); if (!(n >= 1 && n <= d.tracks.length)) return null; const t = d.tracks[n - 1], m = (t.media || []).find(x => x.audio); return m ? { n, t, url: "/archive/" + m.audio } : null; }

// ------------------------------------------------------------------ remix
async function remix(SH, a) {
  SH._arc = await SH.loadArc(); const tr = trackOf(SH, a[0]);
  if (!tr) { SH.line("usage: remix <n>   (see: music)", "dim"); SH.newPrompt(); return; }
  let AC; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { SH.line("remix: this browser has no web audio.", "dim"); SH.newPrompt(); return; }
  SH.au.pause(); SH.line("remix: loading " + String(tr.n).padStart(2, "0") + " " + tr.t.title + " ...", "dim");
  let buf; try { buf = await AC.decodeAudioData(await (await fetch(tr.url)).arrayBuffer()); } catch (e) { AC.close(); SH.line("remix: could not load that track.", "dim"); SH.newPrompt(); return; }
  const S = stage(SH, { title: "remix " + String(tr.n).padStart(2, "0") + "  " + tr.t.title, bye: "deck off." });
  const info = document.createElement("div"); info.style.cssText = "padding:10px 8px;white-space:pre-wrap;line-height:1.4"; S.host.appendChild(info);
  const pad = document.createElement("div"); pad.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;padding:8px"; S.host.appendChild(pad);
  const gate = AC.createGain(), lp = AC.createBiquadFilter(), master = AC.createGain(); lp.type = "lowpass"; lp.frequency.value = 20000; lp.Q.value = 6; gate.connect(lp); lp.connect(master); master.connect(AC.destination);
  let src = null, t0 = AC.currentTime, playing = false, fx = "", ivs = [], extra = [], rec = null;
  const vpos = () => ((AC.currentTime - t0) % buf.duration + buf.duration) % buf.duration;      // where the song "really" is
  const stopSrc = () => { if (src) { try { src.stop(); } catch (e) {} src = null; } };
  const startAt = (o, loopLen) => { stopSrc(); src = AC.createBufferSource(); src.buffer = buf; src.loop = true; if (loopLen) { src.loopStart = o; src.loopEnd = Math.min(buf.duration, o + loopLen); } src.connect(gate); src.start(0, o % buf.duration); playing = true; };
  const resume = () => { ivs.forEach(clearInterval); ivs = []; extra.forEach(x => { try { x.stop(); } catch (e) {} }); extra = []; const now = AC.currentTime; gate.gain.cancelScheduledValues(now); gate.gain.setValueAtTime(1, now); lp.frequency.cancelScheduledValues(now); lp.frequency.setTargetAtTime(20000, now, 0.12); fx = ""; if (playing) startAt(vpos()); };
  const FX = {
    stutter() { const g = vpos(); startAt(g, 0.125); },
    chop() { let on = false; ivs.push(setInterval(() => { on = !on; gate.gain.setValueAtTime(on ? 1 : 0, AC.currentTime); }, 125)); },
    reverse() { const p = vpos(), len = Math.min(2.5, p), n = Math.floor(len * buf.sampleRate), s0 = Math.floor((p - len) * buf.sampleRate); if (n < 2000) return; const rb = AC.createBuffer(buf.numberOfChannels, n, buf.sampleRate); for (let c = 0; c < buf.numberOfChannels; c++) { const srcD = buf.getChannelData(c), d = rb.getChannelData(c); for (let i = 0; i < n; i++) d[i] = srcD[s0 + n - 1 - i]; } stopSrc(); const r = AC.createBufferSource(); r.buffer = rb; r.loop = true; r.connect(gate); r.start(); extra.push(r); },
    freeze() { const p = vpos(); stopSrc(); const grain = () => { const s = AC.createBufferSource(), g = AC.createGain(), now = AC.currentTime; s.buffer = buf; g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.8, now + 0.03); g.gain.linearRampToValueAtTime(0, now + 0.11); s.connect(g); g.connect(gate); s.start(now, Math.max(0, p + Math.random() * 0.06), 0.12); }; grain(); ivs.push(setInterval(grain, 45)); },
    sweep() { const now = AC.currentTime; lp.frequency.cancelScheduledValues(now); lp.frequency.setTargetAtTime(260, now, 0.3); },
    tapestop() { if (src) src.playbackRate.setTargetAtTime(0.0001, AC.currentTime, 0.3); }
  };
  function hold(label, key) {
    const b = document.createElement("button"); b.textContent = "[ " + label + " ]";
    b.style.cssText = "font:inherit;background:#000;color:var(--red);border:1px solid var(--dim);padding:14px 10px;min-width:44%;flex:1 1 44%;touch-action:none";
    const down = e => { e.preventDefault(); if (!playing || fx) return; fx = key; b.style.background = "var(--blue)"; b.style.color = "#000"; FX[key](); draw(); };
    const up = () => { if (fx !== key) return; b.style.background = "#000"; b.style.color = "var(--red)"; resume(); draw(); };
    b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointerleave", up); b.addEventListener("pointercancel", up); pad.appendChild(b);
  }
  hold("stutter", "stutter"); hold("chop 1/8", "chop"); hold("reverse", "reverse"); hold("freeze", "freeze"); hold("filter sweep", "sweep"); hold("tape stop", "tapestop");
  S.btn("[ play / pause ]", () => { if (AC.state === "suspended") AC.resume(); if (playing) { const p = vpos(); stopSrc(); playing = false; t0 = -p; } else { t0 = AC.currentTime - (t0 < 0 ? -t0 : 0); startAt(vpos()); } draw(); });
  S.btn("[ rec ]", b => {
    if (rec) { finish(); b.textContent = "[ rec ]"; return; }
    const sp = AC.createScriptProcessor(4096, 2, 2), sink = AC.createGain(); sink.gain.value = 0; rec = { sp, sink, L: [], R: [], n: 0 };
    sp.onaudioprocess = e => { if (!rec) return; const l = e.inputBuffer.getChannelData(0), r = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : l; rec.L.push(new Float32Array(l)); rec.R.push(new Float32Array(r)); rec.n += l.length; if (rec.n > AC.sampleRate * 90) { finish(); b.textContent = "[ rec ]"; } };
    master.connect(sp); sp.connect(sink); sink.connect(AC.destination); b.textContent = "[ stop + save ]"; draw();
  });
  function finish() {
    if (!rec) return; const r = rec; rec = null; try { master.disconnect(r.sp); r.sp.disconnect(); r.sink.disconnect(); } catch (e) {}
    if (!r.n) return; const L = new Float32Array(r.n), R = new Float32Array(r.n); let o = 0; r.L.forEach((c, i) => { L.set(c, o); R.set(r.R[i], o); o += c.length; });
    const credit = tr.t.title + " - LIVE.AND.DIE (remixed at liveanddie.xyz)";
    download(SH, URL.createObjectURL(wavBlob([L, R], AC.sampleRate, { INAM: credit, IART: "LIVE.AND.DIE", ICMT: "remix made at liveanddie.xyz" })), "liveanddie-remix-" + String(tr.n).padStart(2, "0") + ".wav", "[ download remix.wav ]");
    SH.line("remix saved. credit: " + credit, "blue"); draw();
  }
  function draw() { const p = playing ? vpos() : (t0 < 0 ? -t0 : 0), w = 24, f = Math.round(w * p / buf.duration); info.textContent = (playing ? "▶" : "||") + " [" + "#".repeat(f) + "-".repeat(w - f) + "] " + Math.floor(p / 60) + ":" + String(Math.floor(p % 60)).padStart(2, "0") + " / " + Math.floor(buf.duration / 60) + ":" + String(Math.floor(buf.duration % 60)).padStart(2, "0") + "\n" + (fx ? "fx: " + fx : "hold a pad. let go and the song drops back in on time.") + (rec ? "\nREC " + Math.round(rec.n / AC.sampleRate) + "s" : ""); }
  const tick = setInterval(draw, 250);
  S.onClose(() => { clearInterval(tick); ivs.forEach(clearInterval); finish(); stopSrc(); try { AC.close(); } catch (e) {} });
  t0 = AC.currentTime; startAt(0); draw();
}

// ------------------------------------------------------------------ spectro
async function spectro(SH, a) {
  SH._arc = await SH.loadArc(); const raw = String(a[0] || "").trim();
  let url, title, loop = false;
  if (/^0+$/.test(raw)) { url = "/arg/carrier.wav"; title = "00  (carrier)"; loop = true; }
  else { const tr = trackOf(SH, raw || "1"); if (!tr) { SH.line("usage: spectro <n>   (see: music)", "dim"); SH.newPrompt(); return; } url = tr.url; title = String(tr.n).padStart(2, "0") + "  " + tr.t.title; }
  const au = SH.au; let tap; try { tap = audioTap(SH); } catch (e) { SH.line("spectro: this browser has no web audio.", "dim"); SH.newPrompt(); return; }
  const R = await createAscii({}); R.st.nocrop = true; R.st.contrast = 1.2;
  const S = stage(SH, { title: "spectro " + title, bye: "spectrogram off." }); fit(R.canvas, S.host);
  const px = document.createElement("canvas"), pcx = px.getContext("2d", { willReadFrequently: true }); let img = null, W = 0, H = 0;
  const lay = () => { const z = S.size(); R.resize(z.w, z.h); W = px.width = R.st.cols; H = px.height = R.st.rows; img = pcx.createImageData(W, H); for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255; };
  lay(); addEventListener("resize", lay);
  const wasLoop = au.loop; au.loop = loop; au.src = url; au.play().catch(() => {});
  const an = tap.an, was = { f: an.fftSize, s: an.smoothingTimeConstant }; an.fftSize = 1024; an.smoothingTimeConstant = 0.05;      // crisp columns
  const freq = new Uint8Array(an.frequencyBinCount), FMAX = 6000; let raf = 0, acc = 0, last = performance.now();
  S.btn("[ pause ]", b => { if (au.paused) { au.play().catch(() => {}); b.textContent = "[ pause ]"; } else { au.pause(); b.textContent = "[ play ]"; } });
  S.onClose(() => { cancelAnimationFrame(raf); removeEventListener("resize", lay); au.pause(); au.loop = wasLoop; an.fftSize = was.f; an.smoothingTimeConstant = was.s; R.destroy(); });
  au.addEventListener("error", () => { if (!S.closed) S.close("spectro: no such track."); }, { once: true });
  function frame(t) {
    raf = requestAnimationFrame(frame); acc += t - last; last = t;
    if (!au.paused && acc >= 66) {                          // one new column every 66 ms, whatever the frame rate
      acc = acc > 400 ? 0 : acc - 66; tap.an.getByteFrequencyData(freq);
      const d = img.data, nyq = tap.AC.sampleRate / 2, bins = freq.length;
      for (let y = 0; y < H; y++) {
        const row = y * W * 4; d.copyWithin(row, row + 4, row + W * 4);
        const f1 = FMAX * (1 - (y + 1) / H), f2 = FMAX * (1 - y / H); let m = 0;
        for (let b = Math.max(1, Math.floor(f1 / nyq * bins)); b <= Math.min(bins - 1, Math.ceil(f2 / nyq * bins)); b++) if (freq[b] > m) m = freq[b];
        const v = Math.max(0, Math.min(1, (m - 105) / 140)), i = row + (W - 1) * 4;
        if (v > 0.72) { d[i] = 60 * v; d[i + 1] = 110 * v; d[i + 2] = 255 * v; } else { d[i] = 255 * v; d[i + 1] = 40 * v; d[i + 2] = 40 * v; }
      }
      pcx.putImageData(img, 0, 0); R.draw(px, W, H);
    }
    S.hud.textContent = "spectro " + title + "   0-6 kHz, time →";
  }
  raf = requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ hum
const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function pitchOf(buf, sr) {
  const n = buf.length; let rms = 0; for (let i = 0; i < n; i++) rms += buf[i] * buf[i]; if (Math.sqrt(rms / n) < 0.012) return 0;
  const minLag = Math.floor(sr / 900), maxLag = Math.floor(sr / 75), m = n - maxLag; let run = 0, best = 0, bestV = 1; const c = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) { let s = 0; for (let i = 0; i < m; i += 2) { const x = buf[i] - buf[i + lag]; s += x * x; } run += s; c[lag] = run ? s * lag / run : 1; }
  for (let lag = minLag; lag < maxLag; lag++) { if (c[lag] < 0.14 && c[lag] <= c[lag - 1] && c[lag] <= c[lag + 1]) { best = lag; break; } if (c[lag] < bestV) { bestV = c[lag]; best = lag; } }
  if (!best || c[best] > 0.3) return 0;
  const a = c[best - 1], b = c[best], d = c[best + 1], sh = (a - d) / (2 * (a - 2 * b + d) || 1);       // parabolic refine
  return sr / (best + (isFinite(sh) ? sh : 0));
}
async function hum(SH) {
  let AC; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { SH.line("hum: this browser has no web audio.", "dim"); SH.newPrompt(); return; }
  const stream = await getMic(SH, "listens to the pitch of your humming so the synth can play it back.");
  if (!stream) { AC.close(); SH.newPrompt(); return; }
  const S = stage(SH, { title: "hum", bye: "" });
  const view = document.createElement("div"); view.style.cssText = "padding:12px 8px;white-space:pre-wrap;line-height:1.5;overflow:auto;height:100%"; S.host.appendChild(view);
  const src = AC.createMediaStreamSource(stream), an = AC.createAnalyser(); an.fftSize = 2048; src.connect(an);
  const buf = new Float32Array(an.fftSize), notes = []; let cur = null, raf = 0, lastT = 0, done = false;
  const name = m => NOTE[m % 12] + (Math.floor(m / 12) - 1);
  function frame(t) {
    raf = requestAnimationFrame(frame); if (t - lastT < 45) return; lastT = t;
    an.getFloatTimeDomainData(buf); const f = pitchOf(buf, AC.sampleRate), midi = f ? Math.round(69 + 12 * Math.log2(f / 440)) : 0;
    if (midi && cur && cur.midi === midi) cur.end = t;
    else { if (cur && cur.end - cur.start >= 110) notes.push(cur); cur = midi ? { midi, start: t, end: t } : null; }
    const bar = f ? "▓".repeat(Math.max(1, Math.min(40, midi - 36))) : "";
    view.innerHTML = '<span style="color:var(--blue)">hum a melody. press [ done ] and the terminal plays it back.</span>\n\n' + (f ? name(midi) + "  " + Math.round(f) + " Hz" : "...") + "\n" + '<span style="color:var(--red)">' + bar + "</span>\n\n" + notes.map(n => name(n.midi)).join(" ");
  }
  function finish() {
    if (done) return; done = true; cancelAnimationFrame(raf); stopStream(stream); if (cur && cur.end - cur.start >= 110) notes.push(cur);
    if (!notes.length) { AC.close(); S.close("hum: no notes heard. (mic off.)"); return; }
    let t = AC.currentTime + 0.15; const first = notes[0].start;
    notes.forEach(n => { const o = AC.createOscillator(), g = AC.createGain(), st = t + (n.start - first) / 1000, dur = Math.max(0.12, (n.end - n.start) / 1000); o.type = "square"; o.frequency.value = 440 * Math.pow(2, (n.midi - 69) / 12); g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.2, st + 0.02); g.gain.setValueAtTime(0.2, st + dur - 0.03); g.gain.exponentialRampToValueAtTime(0.0001, st + dur); o.connect(g); g.connect(AC.destination); o.start(st); o.stop(st + dur + 0.02); });
    const total = (notes[notes.length - 1].end - first) / 1000 + 0.6;
    view.innerHTML = '<span style="color:var(--blue)">playing it back ...</span>\n\n' + notes.map(n => name(n.midi)).join(" ");
    setTimeout(() => { try { AC.close(); } catch (e) {} if (!S.closed) S.close(); SH.line("you hummed: " + notes.map(n => name(n.midi)).join(" "), "blue"); SH.line("(mic off. nothing was recorded or sent.)", "dim"); SH.newPrompt(); }, total * 1000);
  }
  S.btn("[ done ]", finish);
  S.onClose(() => { cancelAnimationFrame(raf); stopStream(stream); if (!done) { done = true; try { AC.close(); } catch (e) {} } });
  raf = requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ voice + say
const NUM = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30 };
function toCommand(text) {
  const t = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(), w = t.split(" ");
  const num = s => { if (/^\d+$/.test(s || "")) return +s; let n = 0, any = false; (s || "").split(" ").forEach(x => { if (x in NUM) { n += NUM[x]; any = true; } }); return any ? n : null; };
  let m;
  if ((m = t.match(/^(?:play|track|song)(?: number| track| song)? (.+)$/))) { const n = num(m[1]); if (n) return "play " + String(n).padStart(2, "0"); }
  if (/\b(archive|art|gallery|pictures)\b/.test(t)) return "art";
  if (/\b(music|songs|tracks)\b/.test(t)) return "music";
  if (/\b(commission|order|hire)\b/.test(t)) return "commissions";
  const direct = ["help", "stop", "pause", "resume", "next", "radio", "clear", "links", "about", "who", "walk", "dream", "neofetch", "slideshow", "snake", "tetris"];
  for (const d of direct) if (w.includes(d)) return d;
  if (/\bprevious\b|\bback\b/.test(t)) return "prev";
  return null;
}
export default function (SH) {
  const wrap = (name, fn) => a => { fn(SH, a).catch(e => { SH.line(name + ": " + (e && e.message || "failed"), "dim"); SH.newPrompt(); }); return true; };
  SH.cmd("remix", wrap("remix", remix), { help: "live remix deck for any track (stutter, chop, reverse, freeze, sweep, tape stop)", usage: "remix <n>", man: "remix <n> - a live remix deck. Hold a pad: stutter, chop 1/8, reverse, granular freeze, filter sweep, tape stop. Let go and the song drops back in on time. [ rec ] records what you play and saves a WAV with the track credit." });
  SH.cmd("spectro spectrogram", wrap("spectro", spectro), { help: "scrolling ascii spectrogram of a track", usage: "spectro <n>", man: "spectro <n> - plays track n and draws its real spectrogram in characters, scrolling right to left. 0-6 kHz bottom to top." });
  SH.cmd("hum", wrap("hum", s => hum(s)), { help: "hum a melody; the terminal plays it back and prints the notes", man: "hum - uses the microphone to detect the pitch of your humming (on this device, nothing is recorded or sent). Press [ done ] and the synth plays your melody back and prints the notes." });

  let recog = null;
  SH.cmd("voice", a => {
    const v = (a[0] || "").toLowerCase(), SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (v === "off") { if (recog) { const r = recog; recog = null; try { r.stop(); } catch (e) {} } SH.line("voice off.", "dim"); return; }
    if (v !== "on") { SH.line("voice " + (recog ? "on" : "off") + ".  voice on - then say: \"play one\", \"open the archive\", \"music\", \"next\", \"stop\", \"help\"", "dim"); return; }
    if (!SR) { SH.line("voice: this browser has no speech recognition.", "dim"); return; }
    if (recog) { SH.line("voice is already on.", "dim"); return; }
    SH.line("voice: uses the microphone and your browser's own speech service to turn speech into text. on most phones that service runs on the browser maker's servers, not on this site. 'voice off' stops it.", "dim");
    const r = new SR(); r.continuous = true; r.interimResults = false; r.lang = "en-US"; recog = r;
    r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) { if (!e.results[i].isFinal) continue; const said = e.results[i][0].transcript.trim(), c = toCommand(said); if (c && SH.promptEl.style.display !== "none" && !document.querySelector(".stage,.appscr")) SH.submit(c); else if (!c) { const d = document.createElement("div"); d.className = "ln dim"; d.textContent = "voice: heard \"" + said.slice(0, 80) + "\" (no command)"; SH.out.insertBefore(d, SH.promptEl.parentNode === SH.out ? SH.promptEl : null); SH.scroll(); } } };
    r.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { recog = null; SH.line("voice: microphone permission denied. nothing is listening.", "dim"); } };
    r.onend = () => { if (recog === r) { try { r.start(); } catch (e) { recog = null; } } };
    try { r.start(); SH.line("voice on. listening ...", "blue"); } catch (e) { recog = null; SH.line("voice: could not start.", "dim"); }
  }, { help: "speak commands (\"play one\", \"open the archive\")", usage: "voice <on|off>", man: "voice on - speech recognition for commands: \"play one\", \"open the archive\", \"music\", \"next\", \"stop\", \"help\". Uses your browser's speech service. 'voice off' stops listening." });

  SH.cmd("say speak", a => {
    if (!("speechSynthesis" in window)) { SH.line("say: this browser has no speech synthesis.", "dim"); return; }
    let text = a.join(" ").trim();
    if (!text) { const k = SH.out.children, t = []; for (let i = Math.max(0, k.length - 6); i < k.length; i++) if (k[i] !== SH.promptEl) t.push(k[i].textContent); text = t.join(". "); }
    if (text === "stop") { speechSynthesis.cancel(); return; }
    const u = new SpeechSynthesisUtterance(text.slice(0, 600)); u.pitch = 0.1; u.rate = 0.82; u.volume = 1; speechSynthesis.cancel(); speechSynthesis.speak(u);
    SH.line("[ speaking ]  'say stop' to cut it off", "dim");
  }, { help: "read text aloud in a robot voice", usage: "say <text>", man: "say <text> - speaks the text in a low robotic synth voice. With no text it reads the last few lines of output. 'say stop' cuts it off." });
}
export { pitchOf, toCommand };
