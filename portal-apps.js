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
