/* ===================== phase 3: music apps ===================== */
(function () {
  "use strict";
  var SH = window.SH; if (!SH) return;
  var cmd = SH.cmd, line = SH.line, fmt = SH.fmt, esc = SH.esc, au = SH.au;
  var AC = null, srcNode = null, analyser = null;
  function audio() {
    if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); }
    if (AC.state === "suspended") AC.resume();
    return AC;
  }
  function tapSource() {
    audio(); if (srcNode) return;
    try { srcNode = AC.createMediaElementSource(au); analyser = AC.createAnalyser(); analyser.fftSize = 256; srcNode.connect(analyser); analyser.connect(AC.destination); } catch (e) {}
  }

  // ---- volume / repeat / queue
  cmd("vol volume", function (a) { if (!a.length) { line("volume: " + Math.round(au.volume * 10) + "/10", "dim"); return; } var v = Math.max(0, Math.min(10, parseInt(a[0], 10) || 0)); au.volume = v / 10; var bar = "[" + new Array(v + 1).join("#") + new Array(11 - v).join("-") + "]"; line("vol " + bar + " " + v + "/10", "blue"); }, { help: "set volume 0-10", usage: "vol <0-10>" });
  cmd("repeat loop", function () { au.loop = !au.loop; line("repeat " + (au.loop ? "on" : "off"), "blue"); }, { help: "toggle repeat" });
  cmd("queue q", function () { SH.loadArc().then(function (d) { line("queue (" + d.tracks.length + "):", "dim"); d.tracks.slice(0, 12).forEach(function (t, i) { line("  " + SH.cell(String(i + 1).padStart(2, "0"), 4) + SH.trunc(t.title, 30)); }); line("  ...", "dim"); SH.newPrompt(); }); return true; }, { help: "show the play queue" });

  // ---- viz: ascii waveform under the player
  var vizRaf = 0, vizEl = null;
  cmd("viz", function (a) {
    var on = (a[0] || "on") !== "off";
    if (!on) { cancelAnimationFrame(vizRaf); if (vizEl) { vizEl.remove(); vizEl = null; } line("viz off", "dim"); return; }
    tapSource(); if (!analyser) { line("viz: audio not ready - start a track first (play 01)", "dim"); return; }
    if (!vizEl) vizEl = SH.pre("");
    var data = new Uint8Array(analyser.frequencyBinCount), W = Math.min(56, SH.cols() - 2), BL = " .:-=+*#%@";
    function step() { vizRaf = requestAnimationFrame(step); analyser.getByteFrequencyData(data); var s = ""; for (var x = 0; x < W; x++) { var v = data[Math.floor(x / W * data.length)] / 255; var ch = BL[Math.min(BL.length - 1, Math.round(v * (BL.length - 1)))]; s += ch; } vizEl.innerHTML = '<span style="color:var(--blue)">' + esc(s) + "</span>"; }
    step(); line("viz on (spectrum). 'viz off' to stop.", "dim");
  }, { help: "ascii spectrum under the player", usage: "viz [on|off]" });

  // ---- tape: slow + pitch down with wow/flutter
  var tapeIv = 0;
  cmd("tape", function (a) {
    if ((a[0] || "") === "off") { clearInterval(tapeIv); tapeIv = 0; au.preservesPitch = au.mozPreservesPitch = au.webkitPreservesPitch = true; au.playbackRate = 1; line("tape off - back to normal speed", "dim"); return; }
    au.preservesPitch = au.mozPreservesPitch = au.webkitPreservesPitch = false;
    var base = 0.76; au.playbackRate = base;
    clearInterval(tapeIv); tapeIv = setInterval(function () { au.playbackRate = base + (Math.sin(Date.now() / 600) * 0.03) + (Math.random() - 0.5) * 0.015; }, 120);  // wow + flutter
    line("** tape mode ** the song slows and sags like a dying cassette. 'tape off' to stop.", "blue");
  }, { help: "slow + pitch the song down like a dying cassette", usage: "tape [off]" });

  // ---- drum synthesis
  function noiseBuf(ctx, dur) { var n = ctx.sampleRate * dur, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
  function hit(ctx, type, t, dest) {
    dest = dest || ctx.destination; var g = ctx.createGain(); g.connect(dest);
    if (type === 0) { var o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12); g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); o.start(t); o.stop(t + 0.2); }
    else if (type === 1) { var ns = ctx.createBufferSource(); ns.buffer = noiseBuf(ctx, 0.2); var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; ns.connect(bp); bp.connect(g); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); ns.start(t); ns.stop(t + 0.16); }
    else if (type === 2) { var h = ctx.createBufferSource(); h.buffer = noiseBuf(ctx, 0.05); var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000; h.connect(hp); hp.connect(g); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); h.start(t); h.stop(t + 0.05); }
    else { for (var k = 0; k < 2; k++) { var c = ctx.createBufferSource(); c.buffer = noiseBuf(ctx, 0.1); var cp = ctx.createBiquadFilter(); cp.type = "bandpass"; cp.frequency.value = 1200; c.connect(cp); cp.connect(g); g.gain.setValueAtTime(0.5, t + k * 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + k * 0.02 + 0.08); c.start(t + k * 0.02); c.stop(t + k * 0.02 + 0.09); } }
  }
  var TRK = ["KCK", "SNR", "HAT", "CLP"];
  function decodePat(s) { var g = [[], [], [], []]; for (var r = 0; r < 4; r++) for (var c = 0; c < 16; c++) { g[r][c] = (s && s[r * 16 + c] === "1") ? 1 : 0; } return g; }
  function encodePat(g) { var s = ""; for (var r = 0; r < 4; r++) for (var c = 0; c < 16; c++) s += g[r][c] ? "1" : "0"; return s; }
  function renderBeat(host, g, step, bpm) {
    var h = '<span style="color:var(--blue)">  beat // 16-step // ' + bpm + ' bpm</span>\n';
    for (var r = 0; r < 4; r++) { h += TRK[r] + " "; for (var c = 0; c < 16; c++) { var on = g[r][c], cur = c === step; var ch = on ? "▓" : (c % 4 === 0 ? ":" : "."); h += '<a class="cmd" data-cmd="beatcell ' + r + ' ' + c + '" style="color:' + (cur ? "#fff" : on ? "var(--red)" : "var(--dim)") + '">' + ch + "</a>"; } h += "\n"; }
    h += fmt('{{beatplay|[ play/stop ]}}  {{beatclear|[ clear ]}}  {{beat --export|[ export wav ]}}  {{share|[ share ]}}') + "\n";
    h += '<span style="color:var(--dim)">tap a cell to toggle. full drum kits soon.</span>';
    host.innerHTML = h;
    if (SH.setShare) SH.setShare("beat " + encodePat(g));
  }
  var beatG = null, beatHost = null, beatStep = 0, beatIv = 0, beatBpm = 110, beatPlaying = false;
  SH.beat = {};
  cmd("beat drums", function (a) {
    if (a.indexOf("--export") >= 0) { exportBeat(); return; }
    var pat = a.find(function (x) { return /^[01]{64}$/.test(x); });
    beatG = decodePat(pat || "0".repeat(64)); if (!pat) { beatG[0][0] = beatG[0][8] = 1; beatG[2][2] = beatG[2][6] = beatG[2][10] = beatG[2][14] = 1; beatG[1][4] = beatG[1][12] = 1; }
    beatHost = SH.pre(""); renderBeat(beatHost, beatG, -1, beatBpm); SH.beat.g = beatG;
    SH.lastBeat = "beat " + encodePat(beatG); SH.setShare(SH.lastBeat);
  }, { help: "16-step drum sequencer", man: "beat - a FastTracker-style 16-step drum machine. tap cells to toggle. [play], [clear], [export wav]. patterns save in the share link." });
  cmd("beatcell", function (a) { if (!beatG) return; var r = +a[0], c = +a[1]; beatG[r][c] ^= 1; renderBeat(beatHost, beatG, beatPlaying ? beatStep : -1, beatBpm); SH.lastBeat = "beat " + encodePat(beatG); }, { hidden: true });
  cmd("beatclear", function () { if (!beatG) return; beatG = decodePat("0".repeat(64)); renderBeat(beatHost, beatG, -1, beatBpm); }, { hidden: true });
  cmd("beatplay", function () {
    if (!beatG) return; var ctx = audio();
    if (beatPlaying) { clearInterval(beatIv); beatPlaying = false; renderBeat(beatHost, beatG, -1, beatBpm); return; }
    beatPlaying = true; beatStep = 0; var spb = 60 / beatBpm / 4;
    beatIv = setInterval(function () { if (!document.body.contains(beatHost)) { clearInterval(beatIv); beatPlaying = false; return; } var t = ctx.currentTime + 0.02; for (var r = 0; r < 4; r++) if (beatG[r][beatStep]) hit(ctx, r, t); renderBeat(beatHost, beatG, beatStep, beatBpm); beatStep = (beatStep + 1) % 16; }, spb * 1000);
  }, { hidden: true });
  function exportBeat() {
    if (!beatG) { line("beat: start the sequencer first", "dim"); return; }
    var sr = 44100, spb = 60 / beatBpm / 4, len = Math.ceil(sr * spb * 16) + sr * 0.3;
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; var oc = new OAC(1, len, sr);
    for (var s = 0; s < 16; s++) for (var r = 0; r < 4; r++) if (beatG[r][s]) hit(oc, r, s * spb, oc.destination);
    oc.startRendering().then(function (buf) { var url = wavURL(buf); var a = document.createElement("a"); a.href = url; a.download = "liveanddie-beat.wav"; a.textContent = "[ download beat.wav ]"; var d = document.createElement("div"); d.className = "ln"; d.appendChild(a); SH.out.appendChild(d); SH.scroll(); });
  }
  function wavURL(buf) {
    var ch = buf.getChannelData(0), n = ch.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
    function ws(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    ws(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); ws(8, "WAVE"); ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); ws(36, "data"); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) { var x = Math.max(-1, Math.min(1, ch[i])); v.setInt16(44 + i * 2, x * 0x7fff, true); }
    return URL.createObjectURL(new Blob([ab], { type: "audio/wav" }));
  }

  // ---- synth: tappable / keyboard keys
  cmd("synth piano", function () {
    var ctx = audio(); var notes = [["C", 261.63], ["D", 293.66], ["E", 329.63], ["F", 349.23], ["G", 392], ["A", 440], ["B", 493.88], ["C2", 523.25]];
    var keys = "asdfghjk";
    var host = SH.pre("");
    function draw(litIdx) { var h = '<span style="color:var(--blue)">synth // keys: a s d f g h j k // tap below</span>\n'; for (var i = 0; i < notes.length; i++) { h += '<a class="cmd" data-cmd="note ' + i + '" style="color:' + (i === litIdx ? "#fff" : i % 2 ? "var(--blue)" : "var(--red)") + '">[' + notes[i][0] + ']</a> '; } host.innerHTML = h; }
    draw(-1);
    function play(i) { if (i < 0 || i >= notes.length) return; var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "square"; o.frequency.value = notes[i][1]; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.42); draw(i); setTimeout(function () { draw(-1); }, 180); }
    SH._synthPlay = play;
    if (!SH.CMDS.note) cmd("note", function (a) { if (SH._synthPlay) SH._synthPlay(+a[0]); }, { hidden: true });
    function kh(e) { var i = keys.indexOf(e.key); if (i >= 0 && !document.body.contains(host) === false) play(i); }
    addEventListener("keydown", kh);
    line("synth ready. press a s d f g h j k, or tap the keys.", "dim");
  }, { help: "play notes (keyboard or tappable keys)" });
})();
