/* live.and.die portal - apps (phase 2: art as a toy). Registers onto window.SH. */
(function () {
  "use strict";
  var SH = window.SH; if (!SH) return;
  var cmd = SH.cmd, line = SH.line, raw = SH.raw, fmt = SH.fmt, esc = SH.esc;

  function loadImg(url) { return new Promise(function (res, rej) { var im = new Image(); im.crossOrigin = "anonymous"; im.onload = function () { res(im); }; im.onerror = rej; im.src = url; }); }
  function piece(id) { return SH.loadArc().then(function (d) { var p = SH.findPiece(id); return p; }); }
  function stillURL(p) { var m = p.media[0]; return "/archive/" + (m.img || m.thumb); }
  function thumbURL(p) { var m = p.media[0]; return "/archive/" + (m.thumb || m.img); }
  function reqId(a, usage) { var id = (a[0] || "").toUpperCase(); if (!/^ARC-\d{4}$/.test(id)) { line(usage, "dim"); return null; } return id; }

  // ---- grid helpers: turn a <pre> of coloured spans into a {ch,col}[rows][cols] grid
  function imgToGrid(src, mode, c) {
    var preEl = SH.imgToAscii(src, { mode: mode || "ascii", cols: c || Math.min(46, SH.cols() - 2) });
    var rows = preEl.innerHTML.split("\n").map(function (row) {
      var cells = [], re = /<span style="color:([^"]*)">(.)<\/span>|(.)/g, m;
      while ((m = re.exec(row))) { if (m[2] != null) cells.push({ ch: m[2], col: m[1] }); else if (m[3] != null && m[3] !== "<") cells.push({ ch: m[3], col: "" }); }
      return cells;
    });
    return rows;
  }
  function gridToHTML(rows) { return rows.map(function (r) { return r.map(function (c) { return c.ch === " " || !c.col ? esc(c.ch) : '<span style="color:' + c.col + '">' + esc(c.ch) + "</span>"; }).join(""); }).join("\n"); }

  // ================= live ascii video =================
  function asciiVideoApp(getSrc, title, onReady) {
    var paused = false, raf = 0, last = 0;
    var ui = SH.app(function (k) { if (k === "Tap" || k === " ") paused = !paused; else if (k === "Escape" || k === "q") stop(); }, function () { stop(); });
    var hint = "  tap = pause / play     swipe = exit";
    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (paused) return; if (t - last < 66) return; last = t;           // ~15 fps
      var src = getSrc(); if (!src) return;
      try { var pre = SH.imgToAscii(src, { mode: "ascii", cols: Math.min(60, SH.cols() - 2), nocrop: true }); ui.el.innerHTML = '<span style="color:var(--blue)">' + esc(title) + (paused ? "  [paused]" : "") + "</span>\n" + pre.innerHTML + "\n<span style=\"color:var(--dim)\">" + esc(hint) + "</span>"; } catch (e) {}
    }
    function stop() { cancelAnimationFrame(raf); if (ui._cleanup) ui._cleanup(); ui.close(); line(title + " - stopped.", "dim"); }
    ui._stop = stop; raf = requestAnimationFrame(frame); if (onReady) onReady(ui); return ui;
  }

  cmd("vid video-ascii", function (a) {
    var id = reqId(a, "usage: vid ARC-0802  (a video piece)"); if (!id) return;
    line("buffering ascii video ...", "dim");
    piece(id).then(function (p) {
      if (!p) { line("vid: no such piece", "dim"); SH.newPrompt(); return; }
      var m = p.media[0]; if (!m.loop) { line("vid: " + id + " is not a video. try 'open " + id + "'.", "dim"); SH.newPrompt(); return; }
      var v = document.createElement("video"); v.src = "/archive/" + m.loop; v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = "anonymous";
      v.play().then(function () { var ui = asciiVideoApp(function () { return v.readyState >= 2 ? v : null; }, id + "  " + p.title); ui._cleanup = function () { v.pause(); v.src = ""; }; }, function () { line("vid: autoplay blocked - tap and retry", "dim"); SH.newPrompt(); });
    }).catch(function () { line("archive offline.", "dim"); SH.newPrompt(); });
    return true;
  }, { help: "play a video piece as live ascii", usage: "vid <id>", man: "vid <id> - play an archive video piece as live ascii video (~15fps). tap=pause, swipe=exit." });

  // ================= single-image effects =================
  function effectCanvas(im, kind) {
    var w = 160, h = Math.max(10, Math.round(w * im.naturalHeight / im.naturalWidth));
    var cn = document.createElement("canvas"); cn.width = w; cn.height = h; var cx = cn.getContext("2d");
    if (kind === "invert") cx.filter = "invert(1)";
    if (kind === "zoom") { var z = 2.4; cx.drawImage(im, w / 2 - w / (2 * z), h / 2 - h / (2 * z), w / z, h / z, 0, 0, w, h); return cn; }
    cx.drawImage(im, 0, 0, w, h); return cn;
  }
  function printEffect(id, kind) {
    piece(id).then(function (p) {
      if (!p) { line(kind + ": no such piece", "dim"); SH.newPrompt(); return; }
      loadImg(thumbURL(p)).then(function (im) {
        raw(SH.imgToAscii(effectCanvas(im, kind), { cols: Math.min(46, SH.cols() - 2), nocrop: kind === "zoom" }));
        line(p.no + "  " + p.title + "  (" + kind + ")");
        line("{{view " + p.no + "|[ view full ]}}  {{open " + p.no + "|[ ascii ]}}  {{glitch " + p.no + "|[ glitch ]}}  {{share|[ share ]}}");
        SH.newPrompt();
      }).catch(function () { line(kind + ": could not load", "dim"); SH.newPrompt(); });
    });
    return true;
  }
  cmd("invert", function (a) { var id = reqId(a, "usage: invert ARC-0802"); if (!id) return; line("inverting ...", "dim"); return printEffect(id, "invert"); }, { help: "render a piece inverted" });
  cmd("zoom", function (a) { var id = reqId(a, "usage: zoom ARC-0802"); if (!id) return; line("zooming ...", "dim"); return printEffect(id, "zoom"); }, { help: "zoom into a piece" });

  cmd("glitch", function (a) {
    var id = reqId(a, "usage: glitch ARC-0802"); if (!id) return;
    line("corrupting " + id + " ...", "dim");
    piece(id).then(function (p) {
      if (!p) { line("glitch: no such piece", "dim"); SH.newPrompt(); return; }
      loadImg(thumbURL(p)).then(function (im) {
        var base = imgToGrid(im, "ascii", Math.min(46, SH.cols() - 2));
        var host = SH.pre(""), n = 0;
        var iv = setInterval(function () {
          n++; var g = base.map(function (r) { return r.slice(); });
          for (var k = 0; k < g.length; k++) { if (Math.random() < 0.4) { var sh = (Math.random() * 6 | 0) - 3; g[k] = g[k].slice(sh).concat(g[k].slice(0, sh)); } }
          for (var q = 0; q < 30; q++) { var y = Math.random() * g.length | 0, x = Math.random() * (g[y] ? g[y].length : 0) | 0; if (g[y] && g[y][x]) g[y][x] = { ch: "░▒▓#%@"[Math.random() * 6 | 0], col: Math.random() < .5 ? "var(--blue)" : "var(--red)" }; }
          host.innerHTML = gridToHTML(g); SH.scroll();
          if (n > 22) { clearInterval(iv); host.innerHTML = gridToHTML(base); line(p.no + "  " + p.title + "  (settled)"); line("{{view " + p.no + "|[ view full ]}}  {{open " + p.no + "|[ ascii ]}}  {{share|[ share ]}}"); SH.newPrompt(); }
        }, 70);
      }).catch(function () { line("glitch: could not load", "dim"); SH.newPrompt(); });
    });
    return true;
  }, { help: "datamosh-style glitch of a piece" });

  // ================= mosh: char melt A -> B =================
  cmd("mosh", function (a) {
    var id = reqId(a, "usage: mosh ARC-0802  (melts into the next piece)"); if (!id) return;
    line("moshing ...", "dim");
    SH.loadArc().then(function (d) {
      var i = d.all.findIndex(function (p) { return p.no === id; }); if (i < 0) { line("mosh: no such piece", "dim"); SH.newPrompt(); return; }
      var A = d.all[i], B = d.all[(i + 1) % d.all.length];
      Promise.all([loadImg(thumbURL(A)), loadImg(thumbURL(B))]).then(function (ims) {
        var c = Math.min(46, SH.cols() - 2);
        var ga = imgToGrid(ims[0], "ascii", c), gb = imgToGrid(ims[1], "ascii", c);
        var rows = Math.max(ga.length, gb.length);
        var g = ga.map(function (r) { return r.slice(); });
        var host = SH.pre(""), f = 0, FR = 34;
        var iv = setInterval(function () {
          f++;
          for (var y = g.length - 1; y >= 0; y--) for (var x = 0; x < (g[y] ? g[y].length : 0); x++) {
            if (Math.random() < 0.5 && y > 0 && g[y - 1][x]) g[y][x] = { ch: g[y - 1][x].ch, col: g[y - 1][x].col };   // smear down
            if (Math.random() < f / FR * 0.5 && gb[y] && gb[y][x]) g[y][x] = gb[y][x];                                  // bleed B
          }
          host.innerHTML = gridToHTML(g); SH.scroll();
          if (f >= FR) { clearInterval(iv); host.innerHTML = gridToHTML(gb); line(A.no + " → " + B.no + "  " + B.title); line("{{open " + B.no + "|[ ascii ]}}  {{mosh " + B.no + "|[ mosh on ]}}  {{view " + B.no + "|[ view full ]}}"); SH.newPrompt(); }
        }, 60);
      }).catch(function () { line("mosh: could not load", "dim"); SH.newPrompt(); });
    });
    return true;
  }, { help: "ascii datamosh: one piece melts into the next", usage: "mosh <id>", man: "mosh <id> - characters of one piece melt and smear into the next, like MOSH's vortex melt but in text." });

  // ================= slideshow =================
  cmd("slideshow slides", function () {
    line("loading slideshow ... tap/swipe to exit", "dim");
    SH.loadArc().then(function (d) {
      var order = d.all.slice(0, 60).map(function (_, i) { return i; }); for (var i = order.length - 1; i > 0; i--) { var j = Math.random() * (i + 1) | 0; var t = order[i]; order[i] = order[j]; order[j] = t; }
      var idx = 0, cur = null, raf = 0, dead = false;
      var ui = SH.app(function (k) { if (k === "Tap" || k === "Escape" || k === "q" || k === " ") stop(); else if (k === "ArrowRight") nextSlide(); }, function () { stop(); });
      function stop() { dead = true; cancelAnimationFrame(raf); ui.close(); line("slideshow ended.", "dim"); }
      function nextSlide() {
        if (dead) return; var p = d.all[order[idx % order.length]]; idx++;
        loadImg(thumbURL(p)).then(function (im) {
          if (dead) return; var target = imgToGrid(im, "ascii", Math.min(64, SH.cols() - 2));
          var tH = gridToHTML(target).split("\n");
          var reveal = 0, total = tH.length;
          function step() { if (dead) return; reveal += Math.max(1, total / 18); var shown = tH.slice(0, reveal | 0).join("\n"); ui.el.innerHTML = '<span style="color:var(--blue)">' + esc(p.no + "  " + p.title) + "</span>\n" + shown; if (reveal < total) raf = requestAnimationFrame(step); else raf = setTimeout(nextSlide, 1600); }
          step();
        }).catch(function () { if (!dead) nextSlide(); });
      }
      nextSlide();
    });
    return true;
  }, { help: "fullscreen ascii slideshow of the archive", man: "slideshow - fullscreen ascii slideshow, revealing each piece line by line. tap/swipe to exit." });

  // ================= cam (webcam -> ascii) =================
  var camStream = null, camSnap = null;
  cmd("cam webcam", function (a) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { line("cam: no camera API in this browser", "dim"); return; }
    var mosh = a.indexOf("--mosh") >= 0;
    line("requesting camera ... (processed on your device, nothing is uploaded)", "dim");
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }).then(function (stream) {
      camStream = stream; var v = document.createElement("video"); v.srcObject = stream; v.muted = true; v.playsInline = true; v.play();
      var moshImg = null;
      if (mosh) SH.loadArc().then(function (d) { var p = d.all[Math.random() * 20 | 0]; loadImg(thumbURL(p)).then(function (im) { moshImg = im; }); });
      var ui = asciiVideoApp(function () {
        if (v.readyState < 2) return null;
        var w = 160, h = Math.round(w * (v.videoHeight || 3) / (v.videoWidth || 4));
        var cn = document.createElement("canvas"); cn.width = w; cn.height = h; var cx = cn.getContext("2d");
        cx.save(); cx.scale(-1, 1); cx.drawImage(v, -w, 0, w, h); cx.restore();                 // mirror
        if (moshImg) { cx.globalAlpha = 0.45; cx.drawImage(moshImg, 0, 0, w, h); cx.globalAlpha = 1; }
        camSnap = cn; return cn;
      }, "cam" + (mosh ? " --mosh" : "") + "  (snap to save)");
      ui._cleanup = function () { stream.getTracks().forEach(function (t) { t.stop(); }); camStream = null; };
    }).catch(function () { line("cam: permission denied.", "dim"); SH.newPrompt(); });
    return true;
  }, { help: "your webcam as live red/blue ascii (on-device)", usage: "cam [--mosh]", man: "cam - render your camera as live ascii, on your device, nothing uploaded. cam --mosh blends you into a piece. 'snap' saves a PNG." });

  cmd("snap", function () {
    if (!camSnap) { line("snap: run 'cam' first.", "dim"); return; }
    var grid = imgToGrid(camSnap, "ascii", 100);
    var CW = 7, CH = 12, cols = grid.reduce(function (a, r) { return Math.max(a, r.length); }, 0), rows = grid.length;
    var cn = document.createElement("canvas"); cn.width = cols * CW; cn.height = rows * CH + 18; var cx = cn.getContext("2d");
    cx.fillStyle = "#000"; cx.fillRect(0, 0, cn.width, cn.height); cx.font = "12px monospace"; cx.textBaseline = "top";
    grid.forEach(function (r, y) { r.forEach(function (c, x) { if (c.ch === " ") return; cx.fillStyle = c.col.indexOf("blue") >= 0 ? "#4070ff" : "#ff3030"; cx.fillText(c.ch, x * CW, y * CH); }); });
    cx.fillStyle = "#4070ff"; cx.fillText("live.and.die.xyz", 4, rows * CH + 2);
    var url = cn.toDataURL("image/png"); var a = document.createElement("a"); a.href = url; a.download = "liveanddie-ascii.png"; a.textContent = "[ download your ascii self ]";
    var d = document.createElement("div"); d.className = "ln"; d.appendChild(a); SH.out.appendChild(d); SH.scroll();
  }, { help: "save a PNG of your ascii cam self" });

  // ================= ascii: your own image -> ascii =================
  cmd("ascii", function () {
    line("pick an image to ascii-fy (stays on your device):", "dim");
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.style.display = "none"; document.body.appendChild(inp);
    inp.addEventListener("change", function () { var f = inp.files[0]; if (!f) { SH.newPrompt(); return; } var u = URL.createObjectURL(f); loadImg(u).then(function (im) { raw(SH.imgToAscii(im, { cols: Math.min(60, SH.cols() - 2) })); var cn = document.createElement("canvas"); var g = imgToGrid(im, "ascii", 100); var CW = 7, CH = 12, cols = g.reduce(function (a, r) { return Math.max(a, r.length); }, 0); cn.width = cols * CW; cn.height = g.length * CH + 18; var cx = cn.getContext("2d"); cx.fillStyle = "#000"; cx.fillRect(0, 0, cn.width, cn.height); cx.font = "12px monospace"; cx.textBaseline = "top"; g.forEach(function (r, y) { r.forEach(function (c, x) { if (c.ch === " ") return; cx.fillStyle = c.col.indexOf("blue") >= 0 ? "#4070ff" : "#ff3030"; cx.fillText(c.ch, x * CW, y * CH); }); }); cx.fillStyle = "#4070ff"; cx.fillText("live.and.die.xyz", 4, g.length * CH + 2); var a = document.createElement("a"); a.href = cn.toDataURL("image/png"); a.download = "ascii.png"; a.textContent = "[ download ]"; var dv = document.createElement("div"); dv.className = "ln"; dv.appendChild(a); SH.out.appendChild(dv); URL.revokeObjectURL(u); SH.newPrompt(); }).catch(function () { line("ascii: bad image", "dim"); SH.newPrompt(); }); inp.remove(); });
    inp.click();
    return true;
  }, { help: "turn your own image into live.and.die ascii", man: "ascii - drop in an image and get it back as live.and.die-style ascii you can download." });
})();

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

/* ===================== phase 4: making money ===================== */
(function () {
  "use strict";
  var SH = window.SH; if (!SH) return;
  var cmd = SH.cmd, line = SH.line, fmt = SH.fmt, IG = SH.IG, KOFI = SH.KOFI;

  // ---- order: interactive request wizard
  cmd("order", function () {
    var ans = {}, i = 0;
    var steps = [
      { q: "what do you need?  (visualizer / animated cover / music video mosh)", k: "type" },
      { q: "link to the song or audio?  (paste a url, or 'none')", k: "song" },
      { q: "vibe / references?  (a few words)", k: "vibe" },
      { q: "deadline?  (e.g. '2 weeks', or 'flexible')", k: "deadline" },
      { q: "budget in $?  (minimum 25)", k: "budget" }
    ];
    line("** commission request wizard **  (type your answers; 'q' to cancel)", "blue");
    function ask() { line(steps[i].q); }
    ask();
    SH.read("order[" + (i + 1) + "/5]> ", function (v) {
      v = v.trim(); if (v.toLowerCase() === "q") { line("cancelled.", "dim"); return false; }
      ans[steps[i].k] = v || "-"; i++;
      if (i < steps.length) { ask(); return "order[" + (i + 1) + "/5]> " !== null ? true : true; }
      finish(); return false;
    });
    function finish() {
      var msg = "hi @live.and.die - commission request:\n" +
        "* type: " + ans.type + "\n* song: " + ans.song + "\n* vibe: " + ans.vibe +
        "\n* deadline: " + ans.deadline + "\n* budget: $" + (ans.budget || "25") + "\nsent via liveanddie.xyz";
      line("");
      line("--- your request ---------------------------", "dim");
      msg.split("\n").forEach(function (l) { line("  " + l); });
      line("--------------------------------------------", "dim");
      if (navigator.clipboard) navigator.clipboard.writeText(msg).then(function () { line("request copied to clipboard.", "blue"); }, function () {});
      line("request ready - paste it in the DM:  [[" + IG + "|open instagram DM]]  or tip via [[" + KOFI + "|ko-fi]].", "blue");
    }
    return true;
  }, { help: "build a commission request + copy it for the DM", man: "order - an interactive wizard (type, song, vibe, deadline, budget). Builds a finished DM message, copies it to your clipboard and links the Instagram DM / Ko-fi." });

  // ---- ads: fake ascii banners (one already prints in the boot MOTD)
  var ADS = [
    ["+------------------------------------------+", "|  FEELINGS - BY THE UNIT - $0.99          |", "|  i love feeling. not you.   [ BUY NOW ]  |", "+------------------------------------------+"],
    ["+------------------------------------------+", "|  REVISIT KIT: ONE TUESDAY                |", "|  memory not included.       [ ORDER ]    |", "+------------------------------------------+"],
    ["+------------------------------------------+", "|  FREEDOM(tm) now available in RED        |", "|  zero down. zero apr.       [ CLAIM ]    |", "+------------------------------------------+"],
    ["+------------------------------------------+", "|  HOT SIGNALS IN YOUR AREA                |", "|  waiting since 2007.        [ CONNECT ]   |", "+------------------------------------------+"]
  ];
  cmd("ads", function () {
    line("ADVERTISEMENT", "dim");
    ADS.forEach(function (ad, i) { ad.forEach(function (l, j) { line(l, j === 1 || j === 2 ? (i % 2 ? "blue" : "") : "dim"); }); line(""); });
    line("(all sales final. terms apply.)", "dim");
  }, { help: "the sponsors" });

  // ---- install: PWA
  var deferredPrompt = null;
  addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredPrompt = e; });
  cmd("install pwa", function () {
    if ("serviceWorker" in navigator) { navigator.serviceWorker.register("/sw.js").then(function () { line("service worker registered - works offline now.", "blue"); }, function () { line("install: service worker failed (needs https).", "dim"); }); }
    if (deferredPrompt) { line("opening install prompt ...", "dim"); deferredPrompt.prompt(); deferredPrompt = null; }
    else { line("to install: use your browser menu -> 'Add to Home screen' / 'Install app'.", "blue"); line("live.and.die then opens full-screen with its own icon, and works offline.", "dim"); }
  }, { help: "install live.and.die as an app (works offline)", man: "install - add live.and.die to your home screen as a standalone PWA with its own icon; it then works offline via a service worker." });
})();
