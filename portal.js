/* live.and.die portal — a working terminal shell. Pure vanilla JS. Same content/links/watermark as
 * the site; the hidden /x/ layer is reached by a hidden file shown only with `ls -a`. No pop-ups. */
(function () {
  "use strict";
  var out = document.getElementById("out"), term = document.getElementById("term"),
      promptEl = document.getElementById("prompt"), input = document.getElementById("cmd"),
      bar = document.getElementById("cmdbar"), viewer = document.getElementById("viewer"),
      vimg = document.getElementById("vimg"), vttl = document.getElementById("vttl"),
      au = document.getElementById("au");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var history = [], hist = 0, typing = false;

  var XDOORS = ["8168", "4364", "9539"];                    // unmarked portal doors into /x/
  var LOGO = [
    " _ _                        _      _ _     ",
    "| (_)_ _____   __ _ _ _  __| |  __| (_)___ ",
    "| | \\ V / -_)_/ _` | ' \\/ _` |_/ _` | / -_)",
    "|_|_|\\_/\\___(_)__,_|_||_\\__,_(_)__,_|_\\___|"
  ];
  var IG = "https://instagram.com/live.and.die";

  // -------- printable file contents (markup: {{cmd|label}} = run cmd, [[url|label]] = external) --------
  var FILES = {
    "about.txt": [
      "LIVE.AND.DIE PRODUCTIONS",
      "Music, video and visual art. Commissions open.",
      "",
      "High contrast, no midtones.",
      "Made from found tape, scans, magazines and television.",
      "Made by hand in editing software. Nothing is AI-generated.",
      "Music: noise, industrial, IDM, vapornoise.",
      "",
      "font: Web437 IBM VGA 8x16 - Ultimate Oldschool PC Font Pack",
      "by VileR, [[https://int10h.org/oldschool-pc-fonts/|int10h.org]] - CC BY-SA 4.0."
    ].join("\n"),
    "commissions.txt": [
      "COMMISSIONS - now open.",
      "Visualizers, animated covers and music video moshes. From $25.",
      "Delivered in 3-5 days. Order by Instagram DM.",
      "",
      "STEP 1. DM [[" + IG + "|@live.and.die]]: what it's for, length/size, deadline.",
      "STEP 2. You get a quote. Prices start at $25.",
      "STEP 3. Delivered in 3-5 days.",
      "",
      "Also: flyers, mix covers and prints of existing work.",
      "All sales final. Not licensed for AI training."
    ].join("\n"),
    "policies.txt": [
      "POLICIES",
      "All sales final.",
      "Commissions: turnaround 3-5 days.",
      "Prints ship within the US; international on request.",
      "Using existing work: ask by DM. Usually yes, with credit.",
      "Not licensed for AI training.",
      "This site sets no cookies and has no tracking."
    ].join("\n"),
    "faq.txt": [
      "FAQ",
      "How do I order?   DM [[" + IG + "|@live.and.die]] on Instagram.",
      "How much?         From $25, depending on length and format.",
      "How long?         3-5 days for most commissions.",
      "Can I use it?     Ask by DM. Usually yes, with credit.",
      "Why red?          House style. Full-colour is on Instagram.",
      "How fast reply?   Usually {{sudo|shortly}}."
    ].join("\n"),
    "news.txt": [
      "NEWS",
      "08 Nov 2026  the archive opens: 602 pieces, 2019 to now.",
      "07 Nov 2026  site rebuilt as a terminal. commissions open.",
      "06 Nov 2026  art catalogue and prints added.",
      "21 May 2026  SAM CARLY / CARLY SAM released on Bandcamp.",
      "2026         nine new pieces added."
    ].join("\n"),
    "prints.txt": [
      "PRINTS",
      "12x12 in, matte, signed. $25 plus shipping.",
      "Any piece, including stills from the videos.",
      "18x18 and 24x24 on request. Ships rolled, in a tube.",
      "Order by DM [[" + IG + "|@live.and.die]] with the SKU (e.g. ARC-0802)."
    ].join("\n")
  };

  var LINKS = [
    "LINKS",
    "instagram    [[" + IG + "|@live.and.die]]   orders + contact",
    "youtube      [[https://www.youtube.com/@live.and.die333|@live.and.die333]]",
    "youtube      [[https://www.youtube.com/@schneiderproductions2006|schneiderproductions2006]]",
    "bandcamp     [[https://ladproductions.bandcamp.com|ladproductions.bandcamp.com]]",
    "icarus       [[https://liveanddie247.github.io/icarus/|tilt flight game]]",
    "mosh         [[https://liveanddie247.github.io/mosh/|datamosh tool]]",
    "handsynth    [[https://liveanddie247.github.io/handsynth/|camera synth]]",
    "source       [[https://github.com/LiveAndDie247/liveanddie|github]]"
  ].join("\n");

  var TOOLS = [
    "TOOLS - free browser tools, nothing uploaded.",
    "mosh       [[https://liveanddie247.github.io/mosh/|datamosh two clips on your phone]]",
    "icarus     [[https://liveanddie247.github.io/icarus/|a tilt-controlled flight game]]",
    "handsynth  [[https://liveanddie247.github.io/handsynth/|a synth you play through the camera]]"
  ].join("\n");

  // ---------------------------------------- output helpers ----------------------------------------
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmt(s) {
    return esc(s)
      .replace(/\{\{([^|}]+)\|([^}]*)\}\}/g, function (m, c, l) { return '<a class="cmd" data-cmd="' + esc(c) + '">' + l + "</a>"; })
      .replace(/\[\[([^|\]]+)\|([^\]]*)\]\]/g, function (m, u, l) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + l + "</a>"; });
  }
  function line(txt, cls) {
    var d = document.createElement("div"); d.className = "ln" + (cls ? " " + cls : "");
    d.innerHTML = fmt(txt == null ? "" : txt); out.appendChild(d); return d;
  }
  function raw(node) { var d = document.createElement("div"); d.className = "ln"; d.appendChild(node); out.appendChild(d); return d; }
  function scroll() { term.scrollTop = term.scrollHeight; }
  function echo(cmd) { var d = document.createElement("div"); d.className = "ln";
    d.innerHTML = '<span class="blue">visitor@live.and.die:~$ </span>' + esc(cmd); out.appendChild(d); }

  // ---------------------------------------- archive data ----------------------------------------
  var ARC = null;
  function loadArc() {
    if (ARC) return Promise.resolve(ARC);
    return fetch("/archive/index.json").then(function (r) { return r.json(); }).then(function (raw) {
      var n = raw.length;
      raw.forEach(function (p, i) { p.no = "ARC-" + String(n - i).padStart(4, "0"); p.vid = (p.media || []).some(function (m) { return m.video; }); });
      var all = raw.filter(function (p) { return !p.hide && p.media && p.media.length; });
      all.forEach(function (p) {
        var c = (p.caption || "").trim(), m = c.match(/^[“"]([^”"]+)[”"]\s*(\(([^)]*)\))?/);
        if (m) { p.title = m[1].trim(); p.medium = (m[3] || "").trim(); }
        else { var f = c.split("\n")[0].trim(); p.title = (f && f.length < 60) ? f : (p.vid ? "untitled (video)" : "untitled"); p.medium = ""; }
      });
      ARC = { all: all, tracks: all.filter(function (p) { return p.song; }).slice().reverse() };
      return ARC;
    });
  }

  // ---------------------------------------- commands ----------------------------------------
  function help() {
    line("available commands:", "dim");
    [["help", "this list"], ["ls [-a]", "list the current directory"], ["cd <dir>", "change directory"],
     ["cat <file>", "print a file"], ["music", "list tracks"], ["play <n>", "play a track"],
     ["art", "list visual work"], ["open <id>", "view a piece as ascii (e.g. open ARC-0802)"],
     ["commissions", "how to order"], ["links", "elsewhere"], ["about", "about the work + credits"],
     ["tools", "free browser tools"], ["clear", "clear the screen"]
    ].forEach(function (c) { line("  {{" + c[0].split(" ")[0] + "|" + c[0] + "}}" + Array(Math.max(2, 14 - c[0].length)).join(" ") + c[1]); });
    line("tip: tap a blue word to run it.", "dim");
  }
  function ls(args) {
    var aa = args.indexOf("-a") >= 0;
    line("total 6");
    line("drwxr-xr-x  {{music|music/}}");
    line("drwxr-xr-x  {{art|archive/}}");
    line("-rw-r--r--  {{commissions|commissions.txt}}");
    line("-rw-r--r--  {{about|about.txt}}");
    line("-rw-r--r--  {{links|links.txt}}");
    line("-rw-r--r--  {{tools|tools.txt}}");
    line("-rw-r--r--  {{cat faq.txt|faq.txt}}");
    line("-rw-r--r--  {{cat policies.txt|policies.txt}}");
    if (aa) line("dr-x------  {{sudo|.x/}}", "dim");
  }
  function cat(args) {
    var f = (args[0] || "").toLowerCase();
    var map = { "faq.txt": "faq.txt", "faq": "faq.txt", "policies.txt": "policies.txt", "policies": "policies.txt",
      "about.txt": "about.txt", "news.txt": "news.txt", "news": "news.txt", "prints.txt": "prints.txt", "prints": "prints.txt",
      "commissions.txt": "commissions.txt", "links.txt": null, "tools.txt": null };
    if (f in map && map[f]) { line(FILES[map[f]]); return; }
    if (f === "links.txt" || f === "links") { line(LINKS); return; }
    if (f === "tools.txt" || f === "tools") { line(TOOLS); return; }
    if (!f) { line("usage: cat <file>  (try: ls)", "dim"); return; }
    line("cat: " + args[0] + ": No such file or directory", "dim");
  }
  function cd(args) {
    var d = (args[0] || "").toLowerCase().replace(/\/$/, "");
    if (!d || d === "~" || d === "." || d === "/" || d === "..") { line("~"); return; }
    if (d === "music") return music();
    if (d === "archive" || d === "art") return art();
    if (d === ".x" || d === "x") return gox();
    line("cd: " + args[0] + ": Not a directory", "dim");
  }
  function about() { line(FILES["about.txt"]); }
  function links() { line(LINKS); }
  function commissions() { line(FILES["commissions.txt"]); }
  function tools() { line(TOOLS); }

  function pad(s, n) { s = String(s); return s.length >= n ? s : s + Array(n - s.length + 1).join(" "); }

  function art() {
    line("reading ~/archive ...", "dim");
    loadArc().then(function (d) {
      var list = d.all.slice(0, 28);
      line(d.all.length + " pieces. showing newest 28. {{open ARC-" + d.all[0].no.slice(4) + "|open <id>}} to view.", "dim");
      list.forEach(function (p) {
        line("{{open " + p.no + "|" + p.no + "}}  " + pad(p.title.slice(0, 26), 28) + (p.date || "").slice(0, 4));
      });
      newPrompt();
    }).catch(function () { line("archive offline.", "dim"); newPrompt(); });
    return true;                                          // async: handles its own prompt
  }

  function music() {
    line("reading ~/music ...", "dim");
    loadArc().then(function (d) {
      if (!d.tracks.length) { line("no tracks.", "dim"); newPrompt(); return; }
      line(d.tracks.length + " tracks. {{play 01|play <n>}} to listen. plays via a hidden audio element.", "dim");
      d.tracks.forEach(function (t, i) {
        var num = String(i + 1).padStart(2, "0");
        line("{{play " + num + "|" + num + "}}  " + pad(t.title.slice(0, 30), 32) + (t.date || "").slice(0, 4));
      });
      newPrompt();
    }).catch(function () { line("music offline.", "dim"); newPrompt(); });
    return true;
  }

  // inline audio player ----------------------------------------------------------
  var playLine = null, playIdx = -1;
  function fmtTime(s) { if (!isFinite(s)) return "0:00"; return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"); }
  function renderPlayer() {
    if (!playLine || playIdx < 0) return;
    var t = ARC.tracks[playIdx], cur = au.currentTime, dur = au.duration || 0;
    var w = 16, fill = dur ? Math.round(w * cur / dur) : 0;
    var barStr = "[" + Array(fill + 1).join("#") + Array(w - fill + 1).join("-") + "]";
    var icon = au.paused ? "||" : "▶";
    playLine.innerHTML = fmt(icon + " " + String(playIdx + 1).padStart(2, "0") + "  " + t.title.slice(0, 22) + "  ")
      + '<span class="bar">' + barStr + "</span>" + fmt("  " + fmtTime(cur) + " / " + fmtTime(dur) + "  ")
      + (au.paused ? fmt("{{resume|[ play ]}}") : fmt("{{pause|[ pause ]}}")) + " " + fmt("{{stop|[ stop ]}}");
  }
  function play(args) {
    line("loading track ...", "dim");
    loadArc().then(function (d) {
      var n = parseInt((args[0] || "1").replace(/^0+/, ""), 10) || 1;
      if (n < 1 || n > d.tracks.length) { line("play: no track " + (args[0] || ""), "dim"); newPrompt(); return; }
      playIdx = n - 1; var t = d.tracks[playIdx];
      var m = (t.media || []).find(function (x) { return x.audio; });
      if (!m) { line("play: track has no audio.", "dim"); newPrompt(); return; }
      au.src = "/archive/" + m.audio; au.play().catch(function () {});
      playLine = line(""); renderPlayer(); newPrompt();
    }).catch(function () { line("audio offline.", "dim"); newPrompt(); });
    return true;
  }
  au.addEventListener("timeupdate", renderPlayer);
  au.addEventListener("play", renderPlayer); au.addEventListener("pause", renderPlayer);
  au.addEventListener("ended", function () { renderPlayer(); });

  // ascii-art viewer -------------------------------------------------------------
  var RAMP = " .:-=+*o0#@";
  function open(args) {
    var id = (args[0] || "").toUpperCase();
    if (!/^ARC-\d{4}$/.test(id)) { line("usage: open ARC-0802", "dim"); return; }
    line("rendering " + id + " ...", "dim");
    loadArc().then(function (d) {
      var p = d.all.find(function (x) { return x.no === id; });
      if (!p) { line("open: " + id + ": no such piece", "dim"); newPrompt(); return; }
      var m = p.media[0], thumb = "/archive/" + (m.thumb || m.img), full = "/archive/" + (m.img || m.thumb);
      var im = new Image(); im.crossOrigin = "anonymous";
      im.onload = function () {
        try {
          var W = 42, H = Math.max(8, Math.round(W * im.naturalHeight / im.naturalWidth * 0.5));
          var cn = document.createElement("canvas"); cn.width = W; cn.height = H;
          var cx = cn.getContext("2d"); cx.drawImage(im, 0, 0, W, H);
          var data = cx.getImageData(0, 0, W, H).data, pre = document.createElement("pre"); pre.className = "art";
          var html = "";
          for (var y = 0; y < H; y++) { for (var x = 0; x < W; x++) {
            var i = (y * W + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
            var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            var ch = RAMP[Math.min(RAMP.length - 1, Math.round(lum * (RAMP.length - 1)))];
            if (ch === " ") { html += " "; continue; }
            html += '<span style="color:' + (r >= b ? "#ff3030" : "#4070ff") + '">' + ch + "</span>";
          } html += "\n"; }
          pre.innerHTML = html; raw(pre);
        } catch (e) { line("(preview unavailable)", "dim"); }
        line(p.no + "  " + p.title + "  " + (p.medium || (p.date || "").slice(0, 4)));
        line("{{view " + p.no + "|[ view full ]}}  " + (p.vid ? "(video on " : "(print $25 - DM ") + "{{commissions|instagram}})");
        openData[p.no] = { full: full, ttl: p.no + "  " + p.title };
        newPrompt();
      };
      im.onerror = function () { line("open: could not load " + id, "dim"); newPrompt(); };
      im.src = thumb;
    }).catch(function () { line("archive offline.", "dim"); newPrompt(); });
    return true;
  }
  var openData = {};
  function showViewer(full, ttl) { vimg.src = full; vttl.textContent = ttl; viewer.classList.add("on"); viewer.setAttribute("aria-hidden", "false"); }
  function view(args) {
    var id = (args[0] || "").toUpperCase(), o = openData[id];
    if (o) { showViewer(o.full, o.ttl); return false; }
    if (!/^ARC-\d{4}$/.test(id)) { line("usage: view ARC-0802  (or run 'open " + (args[0] || "<id>") + "' first)", "dim"); return false; }
    loadArc().then(function (d) {
      var p = d.all.find(function (x) { return x.no === id; });
      if (!p) { line("view: " + id + ": no such piece", "dim"); newPrompt(); return; }
      var m = p.media[0]; showViewer("/archive/" + (m.img || m.thumb), p.no + "  " + p.title); newPrompt();
    }).catch(function () { line("archive offline.", "dim"); newPrompt(); });
    return true;
  }
  function closeViewer(e) { if (e) e.preventDefault(); viewer.classList.remove("on"); viewer.setAttribute("aria-hidden", "true"); vimg.src = ""; input.focus(); }
  document.getElementById("vclose").addEventListener("click", closeViewer);

  function gox() { line("accessing .x ...", "dim"); setTimeout(function () { location.href = "/x/" + XDOORS[Math.floor(Math.random() * XDOORS.length)] + ".html"; }, 300); return true; }
  function clear() { out.innerHTML = ""; }

  // ---------------------------------------- dispatch ----------------------------------------
  function run(cmdline) {
    var parts = cmdline.trim().split(/\s+/), c = (parts.shift() || "").toLowerCase(), a = parts;
    switch (c) {
      case "": return false;
      case "help": case "?": case "man": help(); return false;
      case "ls": case "dir": ls(a); return false;
      case "cd": cd(a); return false;
      case "cat": case "less": case "more": cat(a); return false;
      case "about": case "whoami": about(); return false;
      case "links": case "elsewhere": links(); return false;
      case "commissions": case "commission": case "hire": commissions(); return false;
      case "tools": case "apps": tools(); return false;
      case "music": case "songs": return music();
      case "play": return play(a);
      case "pause": au.pause(); renderPlayer(); return false;
      case "resume": au.play().catch(function () {}); renderPlayer(); return false;
      case "stop": au.pause(); au.currentTime = 0; renderPlayer(); line("stopped.", "dim"); return false;
      case "art": case "archive": case "gallery": return art();
      case "open": case "view-ascii": return open(a);
      case "view": case "full": return view(a);
      case "clear": case "cls": clear(); return false;
      case "pwd": line("/home/visitor"); return false;
      case "date": line(new Date().toString()); return false;
      case "echo": line(a.join(" ")); return false;
      case "sudo": case "x": case ".x": case "portal": return gox();
      default: line(c + ": command not found", "dim"); return false;
    }
  }

  // ---------------------------------------- prompt / input ----------------------------------------
  function newPrompt() { out.appendChild(promptEl); promptEl.style.display = "flex"; scroll(); if (!typing) input.focus(); }
  function submit(cmdline) {
    promptEl.style.display = "none"; echo(cmdline);
    if (cmdline.trim()) { history.push(cmdline); hist = history.length; }
    var async = run(cmdline);
    if (!async) newPrompt();                              // sync commands: show prompt now; async call newPrompt() themselves
  }
  document.querySelector("#prompt form").addEventListener("submit", function (e) {
    e.preventDefault(); if (typing) return; var v = input.value; input.value = ""; submit(v);
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp") { if (hist > 0) { hist--; input.value = history[hist] || ""; } e.preventDefault(); }
    else if (e.key === "ArrowDown") { if (hist < history.length) { hist++; input.value = history[hist] || ""; } e.preventDefault(); }
    else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); clear(); }
  });
  term.addEventListener("click", function (e) {
    var a = e.target.closest("a.cmd"); if (a) { e.preventDefault(); var c = a.getAttribute("data-cmd"); if (promptEl.style.display !== "none") { submit(c); } return; }
    if (!e.target.closest("a") && promptEl.style.display !== "none" && !typing) input.focus();
  });

  // command bar: TYPE the command then run it
  function typeCmd(cmd) {
    if (typing || promptEl.style.display === "none") return;
    typing = true; input.value = ""; var i = 0;
    (function step() {
      if (i <= cmd.length) { input.value = cmd.slice(0, i++); scroll(); setTimeout(step, 32); }
      else { typing = false; submit(cmd); }
    })();
  }
  bar.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) typeCmd(b.getAttribute("data-cmd")); });

  // keep the bottom bar height in sync
  function barH() { document.documentElement.style.setProperty("--barh", (bar.offsetHeight || 44) + "px"); }
  addEventListener("resize", barH);

  // ---------------------------------------- boot ----------------------------------------
  var BOOT = [
    "LIVE.AND.DIE BIOS v7.0  (C) 2026 LIVE.AND.DIE PRODUCTIONS",
    "Main Processor : VAPOR-666 @ 6.66 GHz",
    "Memory Test    : 00655360K OK",
    "Detecting drives ... portal0 music0 archive0 x0",
    "Loading live.and.die ..."
  ];
  function welcome() {
    var pre = document.createElement("pre"); pre.className = "logo"; pre.textContent = LOGO.join("\n"); raw(pre);
    line("live.and.die portal v7");
    line("type '{{help|help}}' or tap a command below.");
    line("");
    newPrompt();
    var h = "";
    try { h = decodeURIComponent((location.hash || "").replace(/^#/, "")).trim(); } catch (e) {}
    if (h) { promptEl.style.display = "none"; echo(h); if (h.trim()) { history.push(h); hist = history.length; } if (!run(h)) newPrompt(); }
  }
  function boot() {
    barH();
    if (reduce) { welcome(); return; }
    var i = 0, t = 0, skipped = false;
    function next() {
      if (skipped) return;
      if (i < BOOT.length) { line(BOOT[i++], i === 1 ? "dim" : ""); scroll(); t = setTimeout(next, 260); }
      else { line(""); welcome(); }
    }
    function skip() { if (skipped) return; skipped = true; clearTimeout(t); out.innerHTML = ""; welcome(); }
    term.addEventListener("pointerdown", function h(e) { term.removeEventListener("pointerdown", h); if (!document.getElementById("prompt").offsetParent) skip(); }, { once: true });
    next();
  }
  boot();
})();
