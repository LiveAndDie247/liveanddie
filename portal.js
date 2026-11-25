/* live.and.die portal — a working terminal shell (static, vanilla JS). Phases 0-1 core.
 * Registry-based: SH.cmd(name, fn, meta) adds commands; later phase files extend it. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var out = $("out"), term = $("term"), promptEl = $("prompt"), input = $("cmd"),
      bar = $("cmdbar"), viewer = $("viewer"), vimg = $("vimg"), vttl = $("vttl"), au = $("au");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var LAUNCH = Date.UTC(2026, 10, 7);                        // site launch: 7 Nov 2026
  var XDOORS = ["8168", "4364", "9539"];
  var IG = "https://instagram.com/live.and.die", KOFI = "https://ko-fi.com/liveanddie";

  // ===================================================================== East Asian width
  function wcw(cp) {
    if (cp === 0) return 0;
    if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0;
    if ((cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0x303e) ||
        (cp >= 0x3041 && cp <= 0x33ff) || (cp >= 0x3400 && cp <= 0x4dbf) ||
        (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0xa000 && cp <= 0xa4cf) ||
        (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
        (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) ||
        (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff) ||
        (cp >= 0x20000 && cp <= 0x3fffd)) return 2;
    return 1;
  }
  function strw(s) { s = String(s); var w = 0; for (var i = 0; i < s.length; i++) { var cp = s.codePointAt(i); if (cp > 0xffff) i++; w += wcw(cp); } return w; }
  function padw(s, n) { var w = strw(s); return w >= n ? s : s + new Array(n - w + 1).join(" "); }
  function trunc(s, n) { var r = "", w = 0; for (var i = 0; i < s.length; i++) { var cp = s.codePointAt(i), cw = wcw(cp), ch = String.fromCodePoint(cp); if (cp > 0xffff) i++; if (w + cw > n) break; r += ch; w += cw; } return r; }
  function cell(s, n) { return padw(trunc(s, n), n); }

  // ===================================================================== output / IO
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmt(s) {
    return esc(s)
      .replace(/\{\{([^|}]+)\|([^}]*)\}\}/g, function (m, c, l) { return '<a class="cmd" data-cmd="' + esc(c) + '">' + l + "</a>"; })
      .replace(/\[\[([^|\]]+)\|([^\]]*)\]\]/g, function (m, u, l) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + l + "</a>"; });
  }
  function line(txt, cls) { var d = document.createElement("div"); d.className = "ln" + (cls ? " " + cls : ""); d.innerHTML = fmt(txt == null ? "" : txt); out.appendChild(d); return d; }
  function pre(text, cls) { var p = document.createElement("pre"); p.className = "art" + (cls ? " " + cls : ""); p.textContent = text; var d = document.createElement("div"); d.className = "ln"; d.appendChild(p); out.appendChild(d); return p; }
  function raw(node) { var d = document.createElement("div"); d.className = "ln"; d.appendChild(node); out.appendChild(d); return d; }
  function scroll() { term.scrollTop = term.scrollHeight; }
  function echo(cmd) { var d = document.createElement("div"); d.className = "ln"; d.innerHTML = '<span class="pr">' + esc(prompt1()) + "</span>" + esc(cmd); out.appendChild(d); }
  var ps1 = null, reader = null;
  function prompt1() { return ps1 || "visitor@live.and.die:~$ "; }

  // ===================================================================== archive data
  var ARC = null, ARCP = null;
  function loadArc() {
    if (ARC) return Promise.resolve(ARC);
    if (ARCP) return ARCP;
    ARCP = fetch("/archive/index.json").then(function (r) { return r.json(); }).then(function (rw) {
      var n = rw.length;
      rw.forEach(function (p, i) { p.no = "ARC-" + String(n - i).padStart(4, "0"); p.vid = (p.media || []).some(function (m) { return m.video; }); });
      var all = rw.filter(function (p) { return !p.hide && p.media && p.media.length; });
      all.forEach(function (p) {
        var c = (p.caption || "").trim(), m = c.match(/^[\u201C"]([^\u201D"]+)[\u201D"]\s*(\(([^)]*)\))?/);
        if (m) { p.title = m[1].trim(); p.medium = (m[3] || "").trim(); }
        else { var f = c.split("\n")[0].trim(); p.title = (f && f.length < 70) ? f : (p.vid ? "untitled (video)" : "untitled"); p.medium = ""; }
      });
      ARC = { all: all, tracks: all.filter(function (p) { return p.song; }).slice().reverse() };
      return ARC;
    });
    return ARCP;
  }
  function findPiece(id) { id = (id || "").toUpperCase(); return ARC ? ARC.all.find(function (p) { return p.no === id; }) : null; }

  // ===================================================================== ascii renderer
  var RAMP = " .:-=+*#%@";
  function imgToAscii(img, opts) {
    opts = opts || {}; var mode = opts.mode || "ascii", cols = opts.cols || 42;
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    // sample to a work canvas, auto-crop dark border
    var sw = 120, sh = Math.max(8, Math.round(sw * ih / iw));
    var c0 = document.createElement("canvas"); c0.width = sw; c0.height = sh;
    var x0 = c0.getContext("2d"); x0.drawImage(img, 0, 0, sw, sh);
    var d0 = x0.getImageData(0, 0, sw, sh).data;
    var minx = sw, miny = sh, maxx = 0, maxy = 0, any = false;
    for (var y = 0; y < sh; y++) for (var x = 0; x < sw; x++) { var i = (y * sw + x) * 4; if (d0[i] + d0[i + 1] + d0[i + 2] > 42) { any = true; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; } }
    if (!any) { minx = 0; miny = 0; maxx = sw - 1; maxy = sh - 1; }
    if (opts.nocrop) { minx = 0; miny = 0; maxx = sw - 1; maxy = sh - 1; }
    var cw = maxx - minx + 1, ch = maxy - miny + 1;
    var rows, W = cols, H;
    var pre = document.createElement("pre"); pre.className = "art";
    var yf = (mode === "blocks") ? 1 : (mode === "braille") ? 0.5 : 0.5;
    if (mode === "braille") { W = cols * 2; H = Math.max(4, Math.round(W * ch / cw * 0.5)) ; }
    else { H = Math.max(6, Math.round(W * ch / cw * (mode === "blocks" ? 1 : 0.5))); }
    var bw = (mode === "braille") ? W : W, bh = (mode === "blocks") ? H * 2 : (mode === "braille") ? H * 4 : H;
    var cn = document.createElement("canvas"); cn.width = bw; cn.height = bh;
    var cx = cn.getContext("2d");
    cx.drawImage(c0, minx, miny, cw, ch, 0, 0, bw, bh);
    var d = cx.getImageData(0, 0, bw, bh).data;
    function lum(i) { return (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; }
    // contrast stretch
    var lo = 1, hi = 0; for (var k = 0; k < bw * bh; k++) { var L = lum(k * 4); if (L < lo) lo = L; if (L > hi) hi = L; }
    var rng = Math.max(0.05, hi - lo);
    function nL(i) { return Math.max(0, Math.min(1, (lum(i) - lo) / rng)); }
    var html = "";
    if (mode === "blocks") {
      for (var by = 0; by < H; by++) { for (var bx = 0; bx < W; bx++) {
        var ti = ((by * 2) * bw + bx) * 4, bi = ((by * 2 + 1) * bw + bx) * 4;
        html += '<span style="color:rgb(' + d[ti] + ',' + d[ti + 1] + ',' + d[ti + 2] + ');background:rgb(' + d[bi] + ',' + d[bi + 1] + ',' + d[bi + 2] + ')">\u2580</span>';
      } html += "\n"; }
    } else if (mode === "braille") {
      var MAP = [0x1, 0x8, 0x2, 0x10, 0x4, 0x20, 0x40, 0x80];
      for (var yb = 0; yb < H; yb++) { for (var xb = 0; xb < W / 2; xb++) {
        var bits = 0, rr = 0, bb = 0, cnt = 0;
        for (var dy = 0; dy < 4; dy++) for (var dx = 0; dx < 2; dx++) {
          var px = xb * 2 + dx, py = yb * 4 + dy, idx = (py * bw + px) * 4;
          if (nL(idx) > 0.45) bits |= MAP[dy * 2 + dx];
          rr += d[idx]; bb += d[idx + 2]; cnt++;
        }
        var chr = String.fromCharCode(0x2800 + bits);
        if (bits === 0) { html += " "; continue; }
        html += '<span style="color:' + (rr >= bb ? "var(--red)" : "var(--blue)") + '">' + chr + "</span>";
      } html += "\n"; }
    } else {
      for (var ay = 0; ay < H; ay++) { for (var ax = 0; ax < W; ax++) {
        var ii = (ay * bw + ax) * 4, L = nL(ii), rc = RAMP[Math.min(RAMP.length - 1, Math.round(L * (RAMP.length - 1)))];
        if (rc === " ") { html += " "; continue; }
        if (mode === "mono") html += rc;
        else html += '<span style="color:' + (d[ii] >= d[ii + 2] ? "var(--red)" : "var(--blue)") + '">' + rc + "</span>";
      } html += "\n"; }
    }
    pre.innerHTML = html; return pre;
  }

  // ===================================================================== command registry
  var CMDS = {}, ALIAS = {};
  function cmd(names, fn, meta) { names = names.split(" "); meta = meta || {}; var primary = names[0]; CMDS[primary] = { fn: fn, help: meta.help || "", man: meta.man || "", hidden: !!meta.hidden, usage: meta.usage || primary, name: primary }; for (var i = 1; i < names.length; i++) ALIAS[names[i]] = primary; }
  function resolve(name) { name = (name || "").toLowerCase(); if (CMDS[name]) return name; if (ALIAS[name]) return ALIAS[name]; return null; }

  // filters usable in pipes: fn(lines, args) -> lines
  var FILTERS = {
    grep: function (L, a) { var neg = a[0] === "-v"; if (neg) a = a.slice(1); var pat = (a.join(" ") || "").toLowerCase(); return L.filter(function (x) { var has = x.text.toLowerCase().indexOf(pat) >= 0; return neg ? !has : has; }); },
    sort: function (L) { return L.slice().sort(function (x, y) { return x.text.localeCompare(y.text); }); },
    shuf: function (L) { L = L.slice(); for (var i = L.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = L[i]; L[i] = L[j]; L[j] = t; } return L; },
    head: function (L, a) { return L.slice(0, parseInt(a[0], 10) || 10); },
    tail: function (L, a) { return L.slice(-(parseInt(a[0], 10) || 10)); },
    wc: function (L) { return [{ text: String(L.length) + " lines", html: null }]; },
    uniq: function (L) { var seen = {}, r = []; L.forEach(function (x) { if (!seen[x.text]) { seen[x.text] = 1; r.push(x); } }); return r; },
    cat: function (L) { return L; }
  };

  // ===================================================================== pipeline execution
  // capture mode: commands that support piping push into a buffer; most print directly.
  var cap = null;                                           // when non-null, printLine pushes {text,html}
  function capLine(text, html) { if (cap) cap.push({ text: text, html: html }); }
  function emit(lines) { lines.forEach(function (x) { if (x.html != null) { var d = document.createElement("div"); d.className = "ln"; d.innerHTML = x.html; out.appendChild(d); } else line(x.text); }); }

  function runPipeline(cmdline, cb) {
    var stages = cmdline.split("|").map(function (s) { return s.trim(); }).filter(Boolean);
    if (!stages.length) { cb && cb(false); return; }
    var first = stages[0], rest = stages.slice(1);
    var parts = first.split(/\s+/), name = resolve(parts[0]), args = parts.slice(1);
    var piped = rest.length > 0;
    function applyFilters(lines) {
      rest.forEach(function (st) { var fp = st.split(/\s+/), fn = FILTERS[fp[0]]; if (fn) lines = fn(lines, fp.slice(1)); else lines.push({ text: fp[0] + ": not a filter", html: null }); });
      emit(lines); cb && cb(false);
    }
    if (!name) { line((parts[0] || "") + ": command not found", "dim"); cb && cb(false); return; }
    var c = CMDS[name];
    if (piped && c.pipe) {                                   // capture this command's output
      cap = []; var r = c.fn(args, { piped: true });
      var done = function () { var lines = cap; cap = null; applyFilters(lines); };
      if (r && r.then) r.then(done, done); else done();
    } else {
      var async = c.fn(args, { piped: false });
      cb && cb(!!(async === true));
    }
  }

  // ===================================================================== prompt / input / history
  var history = []; var hist = 0; var typing = false;
  try { history = JSON.parse(localStorage.getItem("lad_hist") || "[]"); if (!Array.isArray(history)) history = []; } catch (e) { history = []; }
  hist = history.length;
  function saveHist() { try { localStorage.setItem("lad_hist", JSON.stringify(history.slice(-100))); } catch (e) {} }
  var ps1span = $("prompt").querySelector(".ps1");
  function newPrompt() { if (ps1span) ps1span.textContent = prompt1(); out.appendChild(promptEl); promptEl.style.display = "flex"; scroll(); if (!typing) input.focus(); }
  var lastShareable = "";
  function submit(cmdline, opts) {
    promptEl.style.display = "none"; echo(cmdline);
    var t = cmdline.trim();
    if (t) { if (!(opts && opts.silent)) { history.push(cmdline); saveHist(); } hist = history.length; lastShareable = t; }
    if (reader) { var r = reader; var keep = r(cmdline); if (!keep) { reader = null; ps1 = null; } newPrompt(); return; }
    if (!t) { newPrompt(); return; }
    // !n history recall
    if (/^!\d+$/.test(t)) { var n = parseInt(t.slice(1), 10); var h = history[n - 1]; if (h) { submit(h); } else { line("!" + n + ": event not found", "dim"); newPrompt(); } return; }
    runPipeline(t, function (async) { if (!async) newPrompt(); });
  }
  $("prompt").querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); if (typing) return; var v = input.value; input.value = ""; submit(v); });

  // tab completion
  function complete() {
    var v = input.value, parts = v.split(/\s+/); var frag = parts[parts.length - 1];
    var pool = [];
    if (parts.length <= 1) pool = Object.keys(CMDS).filter(function (k) { return !CMDS[k].hidden; });
    else { var base = resolve(parts[0]); if (base === "open" || base === "view" || base === "mosh" || base === "glitch" || base === "invert" || base === "zoom") { pool = ARC ? ARC.all.slice(0, 60).map(function (p) { return p.no; }) : []; } else pool = ["music/", "archive/", "commissions.txt", "about.txt", "links.txt", "tools.txt", "faq.txt", "policies.txt"]; }
    var hits = pool.filter(function (k) { return k.toLowerCase().indexOf(frag.toLowerCase()) === 0; });
    if (!hits.length) return;
    if (hits.length === 1) { parts[parts.length - 1] = hits[0]; input.value = parts.join(" ") + (resolve(hits[0]) && parts.length <= 1 ? " " : ""); }
    else { var cp = hits[0]; for (var i = 1; i < hits.length; i++) { while (cp && hits[i].toLowerCase().indexOf(cp.toLowerCase()) !== 0) cp = cp.slice(0, -1); } if (cp.length > frag.length) { parts[parts.length - 1] = cp; input.value = parts.join(" "); } promptEl.style.display = "none"; line(hits.join("   "), "dim"); newPrompt(); }
  }
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp") { if (hist > 0) { hist--; input.value = history[hist] || ""; } e.preventDefault(); }
    else if (e.key === "ArrowDown") { if (hist < history.length) { hist++; input.value = history[hist] || ""; } e.preventDefault(); }
    else if (e.key === "Tab") { e.preventDefault(); complete(); }
    else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); out.innerHTML = ""; newPrompt(); }
    else if (e.key === "c" && e.ctrlKey) { input.value = ""; }
    idlePoke();
  });
  // tap anywhere focuses the prompt; command-links run
  term.addEventListener("click", function (e) {
    var a = e.target.closest("a.cmd"); if (a) { e.preventDefault(); if (promptEl.style.display !== "none") submit(a.getAttribute("data-cmd")); return; }
    if (!e.target.closest("a") && promptEl.style.display !== "none" && !typing) input.focus();
  });
  document.body.addEventListener("click", function (e) { if (viewer.classList.contains("on")) return; if (!e.target.closest("a") && !e.target.closest("#cmdbar") && promptEl.style.display !== "none" && !typing) input.focus(); });

  // bottom command bar: type then run
  function typeCmd(c) {
    if (typing || promptEl.style.display === "none") { if (promptEl.style.display === "none") pendingType = c; return; }
    typing = true; input.value = ""; var i = 0;
    (function step() { if (i <= c.length) { input.value = c.slice(0, i++); scroll(); setTimeout(step, 28); } else { typing = false; submit(c); } })();
  }
  var pendingType = null;
  bar.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; var c = b.getAttribute("data-cmd"); if (c === "\t") { input.focus(); complete(); } else typeCmd(c); });
  function barH() { document.documentElement.style.setProperty("--barh", (bar.offsetHeight || 46) + "px"); }
  addEventListener("resize", function () { barH(); layoutLogo(); });

  // ===================================================================== themes + crt
  var THEMES = {
    red: { red: "#ff3030", blue: "#4070ff", dim: "#802020" },
    blue: { red: "#4070ff", blue: "#ff3030", dim: "#24407a" },
    amber: { red: "#ffb000", blue: "#48c0ff", dim: "#7a5200" },
    green: { red: "#33ff66", blue: "#39b0ff", dim: "#1a7a33" },
    paper: { red: "#1a1a1a", blue: "#0033cc", dim: "#888888", bg: "#d8d2c0" }
  };
  function applyTheme(name) {
    var t = THEMES[name]; if (!t) return false;
    var r = document.documentElement.style;
    r.setProperty("--red", t.red); r.setProperty("--blue", t.blue); r.setProperty("--dim", t.dim);
    document.documentElement.style.background = t.bg || "#000"; document.body.style.background = t.bg || "#000";
    try { localStorage.setItem("lad_theme", name); } catch (e) {}
    return true;
  }
  (function () { try { var s = localStorage.getItem("lad_theme"); if (s && THEMES[s]) applyTheme(s); } catch (e) {} })();
  function setCrt(on) { document.body.classList.toggle("nocrt", !on); try { localStorage.setItem("lad_crt", on ? "1" : "0"); } catch (e) {} }
  (function () { try { if (localStorage.getItem("lad_crt") === "0") setCrt(false); } catch (e) {} })();

  // ===================================================================== logo
  var LOGO_SM = [" _ _                        _      _ _     ", "| (_)_ _____   __ _ _ _  __| |  __| (_)___ ", "| | \\ V / -_)_/ _` | ' \\/ _` |_/ _` | / -_)", "|_|_|\\_/\\___(_)__,_|_||_\\__,_(_)__,_|_\\___|"];
  var LOGO_LG = [" _ _                            _      _ _      ", "| (_)_   _____   __ _ _ __   __| |  __| (_) ___ ", "| | \\ \\ / / _ \\ / _` | '_ \\ / _` | / _` | |/ _ \\", "| | |\\ V /  __/| (_| | | | | (_| || (_| | |  __/", "|_|_| \\_/ \\___(_)__,_|_| |_|\\__,_(_)__,_|_|\\___|"];
  function logoText() { var cols = Math.floor(innerWidth / 8); return (cols >= 52 ? LOGO_LG : LOGO_SM).join("\n"); }
  var logoEl = null;
  function layoutLogo() { if (logoEl) logoEl.textContent = logoText(); }

  // ===================================================================== built-in commands (phase 0/1)
  var FILES = {};
  FILES["about.txt"] = ["LIVE.AND.DIE PRODUCTIONS", "Music, video and visual art. Commissions open.", "", "High contrast, no midtones.", "Made from found tape, scans, magazines and television.", "Made by hand in editing software. Nothing is AI-generated.", "Music: noise, industrial, IDM, vapornoise.", "", "font: Web437 IBM VGA 8x16 - Ultimate Oldschool PC Font Pack", "by VileR, [[https://int10h.org/oldschool-pc-fonts/|int10h.org]] - CC BY-SA 4.0."].join("\n");
  FILES["commissions.txt"] = ["COMMISSIONS - now open.", "Visualizers, animated covers and music video moshes. From $25.", "Delivered in 3-5 days. Order by Instagram DM. Try {{order|order}} to build a request.", "", "STEP 1. DM [[" + IG + "|@live.and.die]]: what it's for, length/size, deadline.", "STEP 2. You get a quote. Prices start at $25. ({{price|price}} for an estimate.)", "STEP 3. Delivered in 3-5 days.", "", "All sales final. Not licensed for AI training."].join("\n");
  FILES["policies.txt"] = ["POLICIES", "All sales final.", "Commissions: turnaround 3-5 days.", "Prints ship within the US; international on request.", "Using existing work: ask by DM. Usually yes, with credit.", "Not licensed for AI training.", "This site sets no cookies and has no tracking."].join("\n");
  FILES["faq.txt"] = ["FAQ", "How do I order?   DM [[" + IG + "|@live.and.die]] on Instagram, or run {{order|order}}.", "How much?         From $25. {{price|price}} for a quick quote.", "How long?         3-5 days for most commissions.", "Can I use it?     Ask by DM. Usually yes, with credit.", "Why red?          House style. {{theme blue|theme blue}} if you must.", "How fast reply?   Usually {{finger live.and.die|shortly}}."].join("\n");
  FILES["news.txt"] = ["NEWS / .plan", "08 Nov 2026  the archive opens: 602 pieces, 2019 to now.", "07 Nov 2026  site rebuilt as a terminal. commissions open.", "06 Nov 2026  art catalogue and prints added.", "21 May 2026  SAM CARLY / CARLY SAM released on Bandcamp.", "2026         nine new pieces added."].join("\n");
  FILES["links.txt"] = ["LINKS", "instagram    [[" + IG + "|@live.and.die]]   orders + contact", "youtube      [[https://www.youtube.com/@live.and.die333|@live.and.die333]]", "youtube      [[https://www.youtube.com/@schneiderproductions2006|schneiderproductions2006]]", "bandcamp     [[https://ladproductions.bandcamp.com|ladproductions.bandcamp.com]]", "ko-fi        [[" + KOFI + "|ko-fi.com/liveanddie]]   tips + prints", "icarus       [[https://liveanddie247.github.io/icarus/|tilt flight game]]", "mosh         [[https://liveanddie247.github.io/mosh/|datamosh tool]]", "handsynth    [[https://liveanddie247.github.io/handsynth/|camera synth]]", "source       [[https://github.com/LiveAndDie247/liveanddie|github]]"].join("\n");
  FILES["tools.txt"] = ["TOOLS - free browser tools, nothing uploaded.", "mosh       [[https://liveanddie247.github.io/mosh/|datamosh two clips on your phone]]", "icarus     [[https://liveanddie247.github.io/icarus/|a tilt-controlled flight game]]", "handsynth  [[https://liveanddie247.github.io/handsynth/|a synth you play through the camera]]"].join("\n");

  cmd("help ? h", function () {
    line("live.and.die portal - command reference", "dim");
    var groups = [["art", "art  open  view  mosh  glitch  invert  zoom  vid  slideshow  cam  ascii"],
      ["music", "music  play  pause  stop  next  prev  radio  tape  viz  vol  beat  synth"],
      ["make", "order  price  prints  commissions  links  install"],
      ["play", "snake  tetris  rogue  adventure  startx"],
      ["info", "neofetch  top  ps  tree  uptime  cal  date  finger  share"],
      ["shell", "ls  cd  cat  find  grep  history  man  theme  crt  sound  clear"]];
    groups.forEach(function (g) { line("  " + cell(g[0], 8) + g[1].replace(/(\w[\w-]*)/g, function (w) { return CMDS[resolve(w)] ? "{{" + w + "|" + w + "}}" : w; })); });
    line("pipes work: {{art | grep 2026|art | grep 2026}}  -  'man <cmd>' for detail  -  tap blue words to run.", "dim");
  }, { help: "this command list", man: "help - list the public commands. Use 'man <cmd>' for details. Tap any blue word to run it." });

  cmd("man", function (a) {
    var n = resolve(a[0]); if (!n) { line("What manual page do you want? (try: man ls)", "dim"); return; }
    if (CMDS[n].lazy) { loadMod(CMDS[n].lazy).then(function () { run("man " + n); newPrompt(); }, function () { line("man: offline", "dim"); newPrompt(); }); return true; }
    var c = CMDS[n]; line("NAME", "dim"); line("    " + c.name + " - " + (c.help || "(no description)"));
    line("SYNOPSIS", "dim"); line("    " + (c.usage || c.name));
    line("DESCRIPTION", "dim"); (c.man || c.help || "No manual entry.").split("\n").forEach(function (l) { line("    " + l); });
  }, { help: "show a manual page", usage: "man <command>", man: "man <command> - print the manual page for a command." });

  cmd("ls dir l", function (a) {
    var aa = a.indexOf("-a") >= 0 || a.indexOf("-la") >= 0 || a.indexOf("-al") >= 0;
    var rows = [
      ["drwxr-xr-x", "{{music|music/}}", "music/"], ["drwxr-xr-x", "{{art|archive/}}", "archive/"],
      ["-rw-r--r--", "{{commissions|commissions.txt}}", "commissions.txt"], ["-rw-r--r--", "{{about|about.txt}}", "about.txt"],
      ["-rw-r--r--", "{{links|links.txt}}", "links.txt"], ["-rw-r--r--", "{{tools|tools.txt}}", "tools.txt"],
      ["-rw-r--r--", "{{cat faq.txt|faq.txt}}", "faq.txt"], ["-rw-r--r--", "{{cat policies.txt|policies.txt}}", "policies.txt"],
      ["-rw-r--r--", "{{finger live.and.die|.plan}}", ".plan"]
    ];
    if (aa) rows.push(["dr-x------", "{{ssh x|.x/}}", ".x/"]);
    capLine("total " + rows.length); if (!cap) line("total " + rows.length);
    rows.forEach(function (r) { var t = r[0] + "  " + r[2]; if (cap) capLine(t, fmt(r[0] + "  " + r[1])); else line(r[0] + "  " + r[1]); });
  }, { pipe: true, help: "list the current directory", usage: "ls [-a]", man: "ls [-a] - list files. -a also shows hidden entries." });

  cmd("cat less more", function (a) {
    var f = (a[0] || "").toLowerCase().replace(/^\.\//, "");
    var map = { "faq.txt": "faq.txt", faq: "faq.txt", "policies.txt": "policies.txt", policies: "policies.txt", "about.txt": "about.txt", about: "about.txt", "news.txt": "news.txt", news: "news.txt", ".plan": "news.txt", "commissions.txt": "commissions.txt", commissions: "commissions.txt", "links.txt": "links.txt", links: "links.txt", "tools.txt": "tools.txt", tools: "tools.txt" };
    if (map[f]) { FILES[map[f]].split("\n").forEach(function (l) { if (cap) capLine(l.replace(/\{\{[^|]*\|([^}]*)\}\}/g, "$1").replace(/\[\[[^|]*\|([^\]]*)\]\]/g, "$1"), fmt(l)); else line(l); }); return; }
    if (!f) { line("usage: cat <file>  (see: ls)", "dim"); return; }
    line("cat: " + a[0] + ": No such file or directory", "dim");
  }, { pipe: true, help: "print a file", usage: "cat <file>" });

  cmd("cd", function (a) {
    var d = (a[0] || "").toLowerCase().replace(/\/$/, "");
    if (!d || d === "~" || d === "." || d === "/" || d === "..") { line("~"); return; }
    if (d === "music") return run("music");
    if (d === "archive" || d === "art") return run("art");
    if (d === ".x" || d === "x" || d === "/x") return run("ssh x");
    line("cd: " + a[0] + ": Not a directory", "dim");
  }, { help: "change directory", usage: "cd <dir>" });

  cmd("about whoami-full", function () { FILES["about.txt"].split("\n").forEach(function (l) { line(l); }); }, { help: "about the work + credits" });
  cmd("links elsewhere", function () { FILES["links.txt"].split("\n").forEach(function (l) { if (cap) capLine(l.replace(/\[\[[^|]*\|([^\]]*)\]\]/g, "$1"), fmt(l)); else line(l); }); }, { pipe: true, help: "elsewhere" });
  cmd("commissions commission hire", function () { FILES["commissions.txt"].split("\n").forEach(function (l) { line(l); }); }, { help: "how to order" });
  cmd("tools apps", function () { FILES["tools.txt"].split("\n").forEach(function (l) { line(l); }); }, { help: "free browser tools" });
  cmd("clear cls", function () { out.innerHTML = ""; }, { help: "clear the screen" });
  cmd("pwd", function () { line("/home/visitor"); }, { help: "print working directory" });
  cmd("whoami", function () { line("visitor"); }, { help: "print the current user" });
  cmd("echo", function (a) { line(a.join(" ")); }, { pipe: true, help: "print a line of text" });
  cmd("date", function () { line(new Date().toString()); }, { help: "print the date" });
  cmd("which", function (a) { var n = resolve(a[0]); line(n ? "/bin/" + n : a[0] + " not found"); }, { help: "locate a command" });
  cmd("env printenv", function () { ["USER=visitor", "SHELL=/bin/ladsh", "HOME=/home/visitor", "TERM=vga-80x25", "THEME=" + (localStorage.getItem("lad_theme") || "red"), "SITE=liveanddie.xyz"].forEach(function (l) { line(l); }); }, { pipe: true, help: "print the environment" });
  cmd("alias", function (a) { if (!a.length) { Object.keys(ALIAS).slice(0, 12).forEach(function (k) { line("alias " + k + "='" + ALIAS[k] + "'"); }); } else line("alias: read-only shell"); }, { help: "list aliases" });
  cmd("export", function () { line("export: read-only environment", "dim"); }, { help: "set an env var (read-only here)" });
  cmd("history", function () { history.slice(-30).forEach(function (h, i) { line("  " + cell(String(history.length - Math.min(30, history.length) + i + 1), 4) + h); }); line("run a past command with !n", "dim"); }, { help: "command history" });
  cmd("uptime", function () { var d = Math.floor((Date.now() - LAUNCH) / 86400000); line(" up " + d + " days,  1 user,  load average: 6.66, 3.33, 0.99"); }, { help: "how long the site has been up" });
  cmd("cal", function () { var n = new Date(), y = n.getFullYear(), m = n.getMonth(); var first = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate(); var mn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m]; line("   " + mn + " " + y); line("Su Mo Tu We Th Fr Sa"); var row = new Array(first + 1).join("   "); for (var dd = 1; dd <= dim; dd++) { row += (dd < 10 ? " " : "") + dd + " "; if ((first + dd) % 7 === 0) { line(row.replace(/\s+$/, "")); row = ""; } } if (row.trim()) line(row.replace(/\s+$/, "")); }, { help: "this month's calendar" });

  cmd("tree", function () {
    line("."); line("|-- {{music|music/}}"); line("|   `-- 34 tracks  (play <n>)"); line("|-- {{art|archive/}}"); line("|   |-- 602 pieces  (open <id>)"); line("|   `-- stills + video loops"); line("|-- {{commissions|commissions.txt}}"); line("|-- {{about|about.txt}}"); line("|-- {{links|links.txt}}"); line("|-- {{tools|tools.txt}}"); line("`-- {{finger live.and.die|.plan}}");
  }, { help: "show the site tree" });
  cmd("find", function (a) { var q = (a.join(" ") || "").toLowerCase().replace(/^[-a-z]*\s*/, ""); var hits = ["music/", "archive/", "commissions.txt", "about.txt", "links.txt", "tools.txt", "faq.txt", "policies.txt", ".plan"].filter(function (f) { return !q || f.indexOf(q) >= 0; }); hits.forEach(function (f) { line("./" + f); }); }, { pipe: true, help: "find files" });
  cmd("grep", function (a) { line("usage: <cmd> | grep <word>   e.g. {{art | grep 2026|art | grep 2026}}", "dim"); }, { help: "filter piped output (use with |)" });

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function fmtTime(s) { if (!isFinite(s)) return "0:00"; return Math.floor(s / 60) + ":" + pad2(Math.floor(s % 60)); }

  cmd("art archive gallery", function (a) {
    line("reading ~/archive ...", "dim");
    loadArc().then(function (d) {
      var list = d.all;
      if (!(a.indexOf("all") >= 0)) list = list.slice(0, 30);
      if (!cap) line(d.all.length + " pieces." + (list.length < d.all.length ? " newest " + list.length + "." : "") + " {{open " + d.all[0].no + "|open <id>}} to view, '{{art all|art all}}' for everything.", "dim");
      list.forEach(function (p) { var t = p.no + "  " + cell(p.title, 28) + " " + (p.date || "").slice(0, 4); if (cap) capLine(t, fmt("{{open " + p.no + "|" + p.no + "}}  " + esc(cell(p.title, 28)) + " " + (p.date || "").slice(0, 4))); else line("{{open " + p.no + "|" + p.no + "}}  " + cell(p.title, 28) + " " + (p.date || "").slice(0, 4)); });
      if (!cap) newPrompt();
    }).catch(function () { line("archive offline.", "dim"); if (!cap) newPrompt(); });
    return cap ? loadArc() : true;
  }, { pipe: true, help: "list visual work", usage: "art [all]", man: "art - list archive pieces (newest 30). 'art all' lists all 602. 'open <id>' to render one. Pipe into grep/sort/shuf." });

  var openData = {};
  cmd("open view-ascii", function (a) {
    var id = (a[0] || "").toUpperCase(); var mode = "ascii";
    a.forEach(function (x) { if (x === "--blocks") mode = "blocks"; else if (x === "--braille") mode = "braille"; else if (x === "--mono") mode = "mono"; else if (x === "--ascii") mode = "ascii"; });
    if (!/^ARC-\d{4}$/.test(id)) { line("usage: open ARC-0802 [--blocks|--braille|--mono]", "dim"); return; }
    line("rendering " + id + " (" + mode + ") ...", "dim");
    loadArc().then(function (d) {
      var p = findPiece(id); if (!p) { line("open: " + id + ": no such piece", "dim"); newPrompt(); return; }
      var m = p.media[0], thumb = "/archive/" + (m.thumb || m.img), full = "/archive/" + (m.img || m.thumb);
      var im = new Image(); im.crossOrigin = "anonymous";
      im.onload = function () {
        try { raw(imgToAscii(im, { mode: mode, cols: Math.min(46, Math.floor(innerWidth / 8) - 2) })); } catch (e) { line("(preview unavailable)", "dim"); }
        line(p.no + "  " + p.title + "  " + (p.medium || (p.date || "").slice(0, 4)));
        line("{{view " + p.no + "|[ view full ]}}  {{mosh " + p.no + "|[ mosh ]}}  {{open " + p.no + " --braille|[ braille ]}}  {{share|[ share ]}}");
        openData[p.no] = { full: full, ttl: p.no + "  " + p.title }; lastShareable = "open " + p.no; newPrompt();
      };
      im.onerror = function () { line("open: could not load " + id, "dim"); newPrompt(); };
      im.src = thumb;
    }).catch(function () { line("archive offline.", "dim"); newPrompt(); });
    return true;
  }, { help: "render a piece as ascii", usage: "open <id> [--blocks|--braille|--mono]", man: "open <id> - draw an archive piece as ascii art.\nModes: --ascii (default), --mono, --blocks (true-colour half blocks), --braille (high detail).\n[ view full ] shows the real watermarked image." });

  function showViewer(full, ttl) { vimg.src = full; vttl.textContent = ttl; viewer.classList.add("on"); viewer.setAttribute("aria-hidden", "false"); }
  cmd("view full", function (a) {
    var id = (a[0] || "").toUpperCase(), o = openData[id];
    if (o) { showViewer(o.full, o.ttl); return false; }
    if (!/^ARC-\d{4}$/.test(id)) { line("usage: view ARC-0802 (or run 'open " + (a[0] || "<id>") + "' first)", "dim"); return false; }
    loadArc().then(function (d) { var p = findPiece(id); if (!p) { line("view: " + id + ": no such piece", "dim"); newPrompt(); return; } var m = p.media[0]; showViewer("/archive/" + (m.img || m.thumb), p.no + "  " + p.title); newPrompt(); }).catch(function () { line("archive offline.", "dim"); newPrompt(); });
    return true;
  }, { help: "show a piece full-screen (with watermark)", usage: "view <id>" });
  $("vclose").addEventListener("click", function (e) { e.preventDefault(); viewer.classList.remove("on"); viewer.setAttribute("aria-hidden", "true"); vimg.src = ""; input.focus(); });

  // ---- music / player
  var playLine = null, playIdx = -1, queue = [], qpos = 0, repeatMode = 0, shuffleOn = false, vol = 1;
  cmd("music songs", function (a) {
    line("reading ~/music ...", "dim");
    loadArc().then(function (d) {
      if (!d.tracks.length) { line("no tracks.", "dim"); if (!cap) newPrompt(); return; }
      if (!cap) line(d.tracks.length + " tracks. {{play 01|play <n>}} to listen, {{radio|radio}} for endless shuffle.", "dim");
      d.tracks.forEach(function (t, i) { var num = String(i + 1).padStart(2, "0"); var txt = num + "  " + cell(t.title, 30) + " " + (t.date || "").slice(0, 4); if (cap) capLine(txt, fmt("{{play " + num + "|" + num + "}}  " + esc(cell(t.title, 30)) + " " + (t.date || "").slice(0, 4))); else line("{{play " + num + "|" + num + "}}  " + cell(t.title, 30) + " " + (t.date || "").slice(0, 4)); });
      if (!cap) newPrompt();
    }).catch(function () { line("music offline.", "dim"); if (!cap) newPrompt(); });
    return cap ? loadArc() : true;
  }, { pipe: true, help: "list tracks", man: "music - list every track. 'play <n>' to listen. Pipe into shuf/grep. 'radio' = endless shuffle." });

  function renderPlayer() {
    if (!playLine || playIdx < 0 || !ARC) return;
    var t = ARC.tracks[playIdx], cur = au.currentTime, dur = au.duration || 0, w = 16, fill = dur ? Math.round(w * cur / dur) : 0;
    var barStr = "[" + new Array(fill + 1).join("#") + new Array(w - fill + 1).join("-") + "]";
    var icon = au.paused ? "||" : "\u25B6", flags = (shuffleOn ? " shuf" : "") + (repeatMode ? " rep" : "");
    playLine.innerHTML = fmt(icon + " " + String(playIdx + 1).padStart(2, "0") + "  " + trunc(t.title, 20) + "  ") + '<span class="bar" data-seek="1">' + barStr + "</span>" + fmt("  " + fmtTime(cur) + " / " + fmtTime(dur) + flags + "  ") + (au.paused ? fmt("{{resume|[play]}}") : fmt("{{pause|[pause]}}")) + " " + fmt("{{next|[>>]}} {{stop|[stop]}}");
  }
  function playTrack(i) {
    if (!ARC || i < 0 || i >= ARC.tracks.length) return;
    playIdx = i; var t = ARC.tracks[i], m = (t.media || []).find(function (x) { return x.audio; });
    if (!m) { line("play: track has no audio.", "dim"); return; }
    au.src = "/archive/" + m.audio; au.volume = vol; au.play().catch(function () {});
    playLine = line(""); renderPlayer(); lastShareable = "play " + String(i + 1).padStart(2, "0");
  }
  cmd("play", function (a) {
    line("loading track ...", "dim");
    loadArc().then(function (d) { var n = parseInt((a[0] || "1").replace(/^0+/, ""), 10) || 1; if (n < 1 || n > d.tracks.length) { line("play: no track " + (a[0] || ""), "dim"); newPrompt(); return; } queue = d.tracks.map(function (_, i) { return i; }); qpos = n - 1; playTrack(n - 1); newPrompt(); }).catch(function () { line("audio offline.", "dim"); newPrompt(); });
    return true;
  }, { help: "play a track", usage: "play <n>", man: "play <n> - play track n. [pause] [>>] [stop] in the player. Drag the [####] bar to seek. 'next'/'prev' move; 'radio' shuffles forever." });
  cmd("pause", function () { au.pause(); renderPlayer(); }, { help: "pause playback" });
  cmd("resume", function () { au.play().catch(function () {}); renderPlayer(); }, { help: "resume playback" });
  cmd("stop", function () { au.pause(); au.currentTime = 0; renderPlayer(); line("stopped.", "dim"); }, { help: "stop playback" });
  cmd("next skip", function () { if (!queue.length) return; qpos = (qpos + 1) % queue.length; playTrack(shuffleOn ? Math.floor(Math.random() * ARC.tracks.length) : queue[qpos]); }, { help: "next track" });
  cmd("prev", function () { if (!queue.length) return; if (au.currentTime > 3) { au.currentTime = 0; return; } qpos = (qpos - 1 + queue.length) % queue.length; playTrack(queue[qpos]); }, { help: "previous track" });
  cmd("radio", function () { line("** live.and.die radio - endless shuffle - 'stop' to kill **", "dim"); loadArc().then(function (d) { shuffleOn = true; repeatMode = 1; queue = d.tracks.map(function (_, i) { return i; }); playTrack(Math.floor(Math.random() * d.tracks.length)); newPrompt(); }); return true; }, { help: "endless shuffle radio" });
  au.addEventListener("timeupdate", renderPlayer);
  au.addEventListener("play", renderPlayer); au.addEventListener("pause", renderPlayer);
  au.addEventListener("ended", function () { if (shuffleOn) playTrack(Math.floor(Math.random() * ARC.tracks.length)); else if (repeatMode) playTrack(playIdx); else run("next"); });
  // drag-to-seek on the player bar
  out.addEventListener("pointerdown", function (e) { var b = e.target.closest(".bar[data-seek]"); if (!b || !au.duration) return; function seek(ev) { var r = b.getBoundingClientRect(); var f = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)); au.currentTime = f * au.duration; } seek(e); function mv(ev) { seek(ev); } function up() { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); } addEventListener("pointermove", mv); addEventListener("pointerup", up); });

  // ---- share / deep link
  cmd("share", function () { var url = location.origin + "/#" + encodeURIComponent(lastShareable || "help"); if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { line("copied: " + url, "blue"); }, function () { line(url, "blue"); }); else line(url, "blue"); }, { help: "copy a shareable link to the last thing shown" });

  // ---- neofetch
  cmd("neofetch", function () {
    loadArc().then(function (d) {
      var info = ["visitor@live.and.die", "---------------------", "OS: ladsh portal v7", "Host: liveanddie.xyz (GitHub Pages)", "Kernel: vanilla-js", "Uptime: " + Math.floor((Date.now() - LAUNCH) / 86400000) + " days", "Shell: /bin/ladsh", "Theme: " + (localStorage.getItem("lad_theme") || "red"), "Font: Web437 IBM VGA 8x16", "Pieces: " + d.all.length, "Tracks: " + d.tracks.length, "Apps: icarus, mosh, handsynth", "Colours: red on black"];
      var L = LOGO_SM; var max = L.reduce(function (a, b) { return Math.max(a, b.length); }, 0);
      var cols = Math.floor(innerWidth / 8);
      if (cols >= max + 22) {                               // side by side (desktop / wide)
        var n = Math.max(L.length, info.length);
        for (var i = 0; i < n; i++) line(cell(L[i] || "", max + 2) + (info[i] || ""));
      } else {                                              // stacked (phone)
        L.forEach(function (l) { line(l); });
        line(""); info.forEach(function (l) { line(l); });
      }
      newPrompt();
    }).catch(function () { line("neofetch: offline", "dim"); newPrompt(); });
    return true;
  }, { help: "system info (real site stats)" });

  // ---- top / ps / kill
  var procs = null;
  function ensureProcs() {
    return loadArc().then(function (d) {
      if (procs) return procs;
      procs = d.all.slice(0, 12).map(function (p, i) { return { pid: 666 + i * 3, name: p.no.toLowerCase().replace("arc-", "piece"), title: p.title, cpu: Math.random() * 40, mem: 1 + Math.random() * 8, dead: false }; });
      procs.unshift({ pid: 1, name: "ladsh", title: "the shell", cpu: 0.3, mem: 2, dead: false });
      return procs;
    });
  }
  var topTimer = 0;
  cmd("top htop", function () {
    ensureProcs().then(function (ps) {
      line("  PID  CPU%  MEM%  COMMAND", "dim"); var start = out.children.length;
      var rowEls = ps.map(function () { return line(""); });
      function tick() { ps.forEach(function (p, i) { if (p.dead) { rowEls[i].innerHTML = ""; return; } p.cpu = Math.max(0, Math.min(99, p.cpu + (Math.random() - 0.5) * 18)); rowEls[i].innerHTML = fmt(cell(String(p.pid), 5) + " " + cell(p.cpu.toFixed(1), 5) + " " + cell(p.mem.toFixed(1), 5) + " {{kill " + p.pid + "|" + p.name + "}}  " + trunc(p.title, 20)); }); }
      tick(); clearInterval(topTimer); topTimer = setInterval(function () { if (!document.body.contains(rowEls[0])) { clearInterval(topTimer); return; } tick(); }, 900);
      line("'kill <pid>' terminates a process. (it respawns.)", "dim"); newPrompt();
    });
    return true;
  }, { help: "live process list (every piece is a process)" });
  cmd("ps", function () { ensureProcs().then(function (ps) { line("  PID COMMAND"); ps.forEach(function (p) { if (!p.dead) line(cell(String(p.pid), 5) + " " + p.name + "  " + trunc(p.title, 22)); }); newPrompt(); }); return true; }, { help: "process snapshot" });
  cmd("kill", function (a) { var pid = parseInt(a[0], 10); ensureProcs().then(function (ps) { var p = ps.find(function (x) { return x.pid === pid; }); if (!p) { line("kill: (" + a[0] + ") - No such process", "dim"); return; } if (p.pid === 1) { line("kill: refusing to kill the shell.", "dim"); return; } p.dead = true; line("[" + "\u2593\u2592\u2591 glitch \u2591\u2592\u2593] terminated " + p.name, "dim"); setTimeout(function () { p.dead = false; p.cpu = Math.random() * 30; line(p.name + " respawned (pid " + (p.pid = 600 + Math.floor(Math.random() * 400)) + ")", "dim"); }, 1800); }); }, { help: "terminate a process (it respawns)" });

  // ---- themes / crt
  cmd("theme", function (a) { var n = (a[0] || "").toLowerCase(); if (!n) { line("themes: red blue amber green paper   (current: " + (localStorage.getItem("lad_theme") || "red") + ")"); return; } if (applyTheme(n)) line("theme set: " + n, "blue"); else line("theme: unknown '" + n + "'", "dim"); }, { help: "switch colour theme", usage: "theme <red|blue|amber|green|paper>" });
  cmd("crt", function (a) { var on = (a[0] || "on") !== "off"; setCrt(on); line("crt " + (on ? "on" : "off"), "dim"); }, { help: "scanlines on/off", usage: "crt <on|off>" });

  // ---- price / order / prints (phase 4 teasers, full in later file)
  cmd("price", function (a) {
    line("quick quote:"); line("  visualizer     from $25"); line("  animated cover from $25"); line("  music video mosh  $40+  (by length)"); line("final quote by DM. {{order|order}} to build a request, or DM {{commissions|@live.and.die}}.");
  }, { help: "quote calculator" });
  cmd("prints", function () { FILES["links.txt"]; line("PRINTS - 12x12 in, matte, signed. $25 + shipping."); line("Any still, incl. video frames. 18x18 / 24x24 on request."); line("Order: DM [[" + IG + "|@live.and.die]] with the SKU, or [[" + KOFI + "|ko-fi]]."); }, { help: "prints for sale" });

  // ---- hidden / easter-egg shells into /x/
  cmd("ssh", function (a) { if ((a[0] || "").toLowerCase().replace(/[@/]/g, "") === "x" || (a[0] || "") === "live.and.die") { line("accessing .x ...", "dim"); setTimeout(function () { location.href = "/x/" + XDOORS[Math.floor(Math.random() * XDOORS.length)] + ".html"; }, 300); return true; } line("ssh: could not resolve host", "dim"); }, { hidden: true });
  cmd("finger", function () { ["Login: live.and.die            Name: LIVE.AND.DIE PRODUCTIONS", "Directory: /portal            Shell: /bin/ladsh", "Never logged in.", "", "Plan:"].forEach(function (l) { line(l); }); FILES["news.txt"].split("\n").slice(1).forEach(function (l) { line("  " + l); }); }, { hidden: true });

  // ===================================================================== run helper (for internal calls)
  function run(cmdline) { var parts = cmdline.split(/\s+/), n = resolve(parts[0]); if (!n) { line(parts[0] + ": command not found", "dim"); return false; } return CMDS[n].fn(parts.slice(1), {}) === true; }
  // interactive line reader: SH.read(label, onLine) -> onLine(text) returns true to keep reading
  function read(label, onLine) { ps1 = label; reader = onLine; promptEl.style.display = "none"; newPrompt(); }
  // fullscreen app overlay for games/apps: returns {el, close}. onKey(key,e), onSwipe(dir)
  function app(onKey, onSwipe) {
    var el = document.createElement("pre"); el.className = "appscr"; el.tabIndex = 0;
    el.style.cssText = "position:fixed;inset:0;z-index:38;margin:0;background:#000;color:var(--red);white-space:pre;overflow:hidden;font:16px/1 'Web437 VGA',monospace;padding:8px;outline:0";
    document.body.appendChild(el); el.focus();
    function kd(e) { if (onKey) onKey(e.key, e); if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.key) >= 0) e.preventDefault(); }
    addEventListener("keydown", kd);
    var sx = 0, sy = 0;
    el.addEventListener("touchstart", function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    el.addEventListener("touchend", function (e) { var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { if (onKey) onKey("Tap"); return; } if (Math.abs(dx) > Math.abs(dy)) onSwipe && onSwipe(dx > 0 ? "right" : "left"); else onSwipe && onSwipe(dy > 0 ? "down" : "up"); }, { passive: true });
    return { el: el, close: function () { removeEventListener("keydown", kd); el.remove(); newPrompt(); } };
  }
  function cols() { return Math.max(20, Math.floor(innerWidth / 8)); }
  function rowsN() { return Math.max(10, Math.floor(innerHeight / 16)); }
  window.SH = { cmd: cmd, line: line, pre: pre, raw: raw, fmt: fmt, esc: esc, newPrompt: newPrompt, loadArc: loadArc, findPiece: findPiece, imgToAscii: imgToAscii, term: term, out: out, input: input, viewer: viewer, run: run, cell: cell, strw: strw, trunc: trunc, padw: padw, scroll: scroll, au: au, promptEl: promptEl, THEMES: THEMES, applyTheme: applyTheme, CMDS: CMDS, read: read, app: app, cols: cols, rowsN: rowsN, RAMP: RAMP, showViewer: showViewer, openData: openData, IG: IG, KOFI: KOFI, XDOORS: XDOORS, setShare: function (s) { lastShareable = s; }, LAUNCH: LAUNCH };

  // ===================================================================== lazy modules
  // Heavy features live in /mods and are fetched only when their command first runs.
  var MODS = {};
  function loadMod(url) {
    if (MODS[url]) return MODS[url];
    var p;
    if (/\.mjs$/.test(url)) p = import(url).then(function (m) { return m && m.default ? m.default(window.SH) : null; });
    else p = new Promise(function (res, rej) { var s = document.createElement("script"); s.src = url; s.onload = function () { res(); }; s.onerror = function () { rej(new Error("load")); }; document.head.appendChild(s); });
    MODS[url] = p; p.catch(function () { delete MODS[url]; });
    return p;
  }
  function lazy(names, url, meta) {
    var primary = names.split(" ")[0];
    cmd(names, function stub(a, o) {
      loadMod(url).then(function () {
        var c = CMDS[primary];
        if (!c || c.lazy) { line(primary + ": module did not register", "dim"); newPrompt(); return; }
        var r; try { r = c.fn(a, o || {}); } catch (e) { line(primary + ": " + (e && e.message || "failed"), "dim"); }
        if (r !== true) newPrompt();
      }, function () { line(primary + ": could not load (offline?)", "dim"); newPrompt(); });
      return true;
    }, meta);
    CMDS[primary].lazy = url;
  }
  window.SH.loadMod = loadMod; window.SH.lazy = lazy;
  var L = function (n, u, h, us, hid) { lazy(n, u, { help: h, usage: us, hidden: !!hid }); };
  // phase 2-7 (classic scripts)
  L("invert", "/mods/art.js", "render a piece inverted", "invert <id>");
  L("zoom", "/mods/art.js", "zoom into a piece", "zoom <id>");
  L("glitch", "/mods/art.js", "datamosh-style glitch of a piece", "glitch <id>");
  L("mosh", "/mods/art.js", "ascii datamosh: one piece melts into the next", "mosh <id>");
  L("slideshow slides", "/mods/art.js", "fullscreen ascii slideshow of the archive");
  L("ascii", "/mods/art.js", "turn your own image into live.and.die ascii");
  L("vol volume", "/mods/musicapps.js", "set volume 0-10", "vol <0-10>");
  L("repeat loop", "/mods/musicapps.js", "toggle repeat");
  L("queue q", "/mods/musicapps.js", "show the play queue");
  L("viz", "/mods/musicapps.js", "ascii spectrum under the player", "viz [on|off]");
  L("tape", "/mods/musicapps.js", "slow + pitch the song down like a dying cassette", "tape [off]");
  L("beat drums", "/mods/musicapps.js", "16-step drum sequencer", "beat [pattern] [--export]");
  L("synth piano", "/mods/musicapps.js", "play notes (keyboard or tappable keys)");
  L("order", "/mods/money.js", "build a commission request + copy it for the DM");
  L("ads", "/mods/money.js", "the sponsors");
  L("install pwa", "/mods/money.js", "install live.and.die as an app (works offline)");
  L("snake", "/mods/games.js", "snake (swipe/arrows, q to quit)");
  L("tetris", "/mods/games.js", "tetris (swipe/arrows, q to quit)");
  L("rogue dungeon", "/mods/games.js", "a tiny roguelike; loot is songs; clear it for a code");
  L("adventure zork", "/mods/games.js", "a text adventure that maps onto the /x/ layer");
  L("startx wm tmux", "/mods/wm.js", "tiling window manager: player, art, shell, processes");
  ["sudo", "rm delete", "exit logout quit", "vim vi nano emacs", "ping", "traceroute tracert", "moshsay"].forEach(function (n) { L(n, "/mods/eggs.js", "", "", true); });
  // phase 9+ (ES modules)
  L("cam webcam", "/mods/cam.mjs", "your camera as live gpu ascii (on-device)", "cam [--hands|--synth|--ghost|--slitscan|--into <id>|--text \"..\"|--dance|--record]");
  L("snap", "/mods/cam.mjs", "save a PNG of the current ascii camera frame");
  L("vid video-ascii", "/mods/cam.mjs", "play a video piece as live gpu ascii", "vid <id>");

  var SAC = null;
  function sndOn() { try { return localStorage.getItem("lad_sound") === "1"; } catch (e) { return false; } }
  function sctx() { if (!SAC) try { SAC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} if (SAC && SAC.state === "suspended") SAC.resume(); return SAC; }
  function blip(f0, f1, dur, type, vol) { if (!sndOn()) return; var c = sctx(); if (!c) return; var o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, c.currentTime); if (f1) o.frequency.linearRampToValueAtTime(f1, c.currentTime + dur); g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0005, c.currentTime + dur); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.01); }
  input.addEventListener("keydown", function (e) { if (e.key && e.key.length === 1) blip(1400 + Math.random() * 400, 0, 0.03, "square", 0.04); });
  cmd("sound", function (a) { var on = a[0] === "on"; try { localStorage.setItem("lad_sound", on ? "1" : "0"); } catch (e) {} line("sound " + (on ? "on - typing clicks + disk seek" : "off"), "dim"); if (on) blip(120, 900, 0.3, "sawtooth", 0.05); }, { help: "typing/boot sounds on/off", usage: "sound <on|off>" });
  addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); window.SH.deferredPrompt = e; });

  // ===================================================================== idle screensaver (donut)
  var idleT = 0, saver = null;
  function idlePoke() { clearTimeout(idleT); if (saver) stopSaver(); if (!reduce) idleT = setTimeout(startSaver, 60000); }
  function startSaver() {
    if (saver || viewer.classList.contains("on")) return;
    saver = document.createElement("pre"); saver.id = "saver"; saver.setAttribute("aria-hidden", "true");
    saver.style.cssText = "position:fixed;inset:0;z-index:35;margin:0;background:#000;color:var(--red);white-space:pre;overflow:hidden;font:16px/1 'Web437 VGA',monospace;padding:10px";
    document.body.appendChild(saver);
    var A = 0, B = 0, W = Math.floor(innerWidth / 8), H = Math.floor(innerHeight / 16), chars = ".,-~:;=!*#$@";
    var f = setInterval(function () {
      if (!saver) { clearInterval(f); return; }
      var b = [], z = []; for (var k = 0; k < W * H; k++) { b[k] = " "; z[k] = 0; }
      for (var j = 0; j < 6.28; j += 0.09) for (var i = 0; i < 6.28; i += 0.03) {
        var c = Math.sin(i), d = Math.cos(j), e = Math.sin(A), f2 = Math.sin(j), g = Math.cos(A), h = d + 2, D = 1 / (c * h * e + f2 * g + 5), l = Math.cos(i), m = Math.cos(B), nn = Math.sin(B), t = c * h * g - f2 * e;
        var x = Math.floor(W / 2 + 0.7 * W * D * (l * h * m - t * nn)), y = Math.floor(H / 2 + 0.35 * H * D * (l * h * nn + t * m)), o = x + W * y, N = Math.floor(8 * ((f2 * e - c * d * g) * m - c * d * e - f2 * g - l * d * nn));
        if (y >= 0 && y < H && x >= 0 && x < W && D > z[o]) { z[o] = D; b[o] = chars[N > 0 ? N : 0]; }
      }
      var s = ""; for (var r = 0; r < H; r++) s += b.slice(r * W, r * W + W).join("") + "\n"; saver.textContent = s; A += 0.07; B += 0.03;
    }, 60);
    saver._f = f;
    saver.addEventListener("pointerdown", function () { idlePoke(); });
  }
  function stopSaver() { if (saver) { clearInterval(saver._f); saver.remove(); saver = null; } }
  ["pointerdown", "keydown", "wheel"].forEach(function (ev) { addEventListener(ev, idlePoke, { passive: true }); });

  // ===================================================================== konami
  var ko = [], KK = "38 38 40 40 37 39 37 39 66 65";
  addEventListener("keydown", function (e) { ko.push(e.keyCode); ko = ko.slice(-10); if (ko.join(" ") === KK) { document.documentElement.style.setProperty("--red", "#4070ff"); document.documentElement.style.setProperty("--blue", "#ff3030"); line("** blue mode **", "blue"); } });

  // ===================================================================== boot + deep links
  var ADS = ["FEELINGS - BY THE UNIT - $0.99. all sales final.", "REVISIT KIT: ONE TUESDAY. memory not included.", "FREEDOM(tm), now available in red. zero down.", "HOT SIGNALS IN YOUR AREA. waiting since 2007."];
  var BOOT = ["LIVE.AND.DIE BIOS v7.0  (C) 2026 LIVE.AND.DIE PRODUCTIONS", "Main Processor : VAPOR-666 @ 6.66 GHz", "Memory Test    : 00655360K OK", "Detecting drives ... portal0 music0 archive0 x0", "MOTD: " + ADS[Math.floor(Math.random() * ADS.length)], "Loading live.and.die ..."];
  function deepLink() { var h = ""; try { h = decodeURIComponent((location.hash || "").replace(/^#/, "")).trim(); } catch (e) {} if (!h) { var m = (location.search || "").match(/[?&]cmd=([^&]+)/); if (m) try { h = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) {} } return h; }
  function welcome() {
    logoEl = pre(logoText(), "logo"); line("live.and.die portal v7");
    var h33 = new Date().getHours() === 3 && new Date().getMinutes() === 33;
    if (h33) line("** 3:33 **  stay noided.", "blue");
    line("type '{{help|help}}' or tap a command below.  new here? try {{neofetch|neofetch}}.");
    line(""); newPrompt(); barH();
    var dl = deepLink(); if (dl) { submit(dl, { silent: false }); }
    if (pendingType) { var p = pendingType; pendingType = null; typeCmd(p); }
    idlePoke();
  }
  function boot() {
    barH();
    if (reduce) { welcome(); return; }
    var i = 0, t = 0, skipped = false;
    function nextL() { if (skipped) return; if (i < BOOT.length) { line(BOOT[i++], i === 1 ? "dim" : ""); scroll(); t = setTimeout(nextL, 230); } else { line(""); welcome(); } }
    function skip() { if (skipped) return; skipped = true; clearTimeout(t); out.innerHTML = ""; welcome(); }
    term.addEventListener("pointerdown", function h(e) { if (promptEl.style.display === "none") { skip(); } term.removeEventListener("pointerdown", h); }, { once: true });
    nextL();
  }
  // PWA: register the service worker on the live host (not localhost, to keep dev fresh)
  if ("serviceWorker" in navigator && !/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) { try { navigator.serviceWorker.register("/sw.js"); } catch (e) {} }
  boot();
})();
