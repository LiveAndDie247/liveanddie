/* gate-kit · terminal (v7) — turns every main page into one black terminal window.
 *
 *  - a fixed character window-frame (┌─ live.and.die@portal: ~ ─┐ … └─┘) sized to the viewport grid
 *  - a short BIOS boot sequence on the first view of a session (<=2s, tap to skip)
 *  - the "live.and.die" figlet logo injected into .mast (solid red)
 *  - section headers rendered as shell commands ($ ls ~/music …), nav as a file listing (via gate.css)
 *  - a blinking block cursor and a real input prompt (type: ls, help, music, art, archive … to navigate)
 *  - a very faint ASCII star dust behind the text
 *  - the self-hosted VGA font credit appended to the footer (CC BY-SA 4.0)
 * prefers-reduced-motion: no animation, no boot. Never runs the terminal chrome on /x/ pages.
 *
 *   <script src="/gate/stars-bg.js" defer></script>
 */
(function () {
  "use strict";
  window.GateStars = { burst: function () {}, state: function () { return { mode: "off" }; } };
  window.GateMosh = { shock: function () {} };
  if (/^\/x\//.test(location.pathname)) return;               // /x/ keeps its own raw look
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var RED = "#ff2a2a", RED_DEEP = "#7a1414", BLUE = "#3d6bff";
  var CHARW = 8, LINEH = 16 * 1.15;                           // Web437 IBM VGA 8x16 metrics
  var LOGO = [
    " _ _                        _      _ _     ",
    "| (_)_ _____   __ _ _ _  __| |  __| (_)___ ",
    "| | \\ V / -_)_/ _` | ' \\/ _` |_/ _` | / -_)",
    "|_|_|\\_/\\___(_)__,_|_||_\\__,_(_)__,_|_\\___|"
  ].join("\n");

  // ------------------------------------------------------------- faint ASCII star dust
  function starfield() {
    if (reduce) return;
    var cv = document.createElement("canvas");
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;background:#000";
    var ctx = cv.getContext("2d", { alpha: false });
    (document.body || document.documentElement).appendChild(cv);
    var W, H, dpr = Math.min(2, window.devicePixelRatio || 1), stars = [], seed = 333, step = 0, timer = 0;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    function size() {
      W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = "16px 'Web437 VGA',monospace"; ctx.textBaseline = "top";
      seed = 333; stars = [];
      var cols = Math.ceil(W / 22), rows = Math.ceil(H / 22);
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        if (rnd() > 0.5) continue;
        stars.push({ x: c * 22 + rnd() * 10, y: r * 22 + rnd() * 10, g: rnd() < .5 ? "." : rnd() < .5 ? "+" : "·",
          blue: rnd() < 0.3, ph: (rnd() * 7) | 0 });
      }
    }
    function draw() {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i], lit = ((step + s.ph) % 7) < 2;
        ctx.globalAlpha = lit ? 0.22 : 0.08;
        ctx.fillStyle = s.blue ? BLUE : RED;
        ctx.fillText(s.g, s.x, s.y);
      }
      ctx.globalAlpha = 1;
    }
    function tick() { step++; draw(); timer = setTimeout(tick, 220); }
    addEventListener("resize", function () { clearTimeout(starfield.rt); starfield.rt = setTimeout(function () { size(); draw(); }, 150); }, { passive: true });
    document.addEventListener("visibilitychange", function () { if (document.hidden) { clearTimeout(timer); timer = 0; } else if (!timer) tick(); });
    size(); tick();
  }

  // ------------------------------------------------------------- fixed character window frame
  function frame() {
    var el = document.getElementById("termframe");
    if (!el) { el = document.createElement("div"); el.id = "termframe"; el.setAttribute("aria-hidden", "true"); document.body.appendChild(el); }
    function rep(ch, n) { return n > 0 ? new Array(n + 1).join(ch) : ""; }
    function build() {
      var cols = Math.max(24, Math.floor(innerWidth / CHARW));
      var rows = Math.max(6, Math.floor(innerHeight / LINEH));
      var inner = cols - 2;                                   // chars between the two corner glyphs
      var label = "─ live.and.die@portal: ~ ";           // "─ live.and.die@portal: ~ "
      if (label.length > inner) label = label.slice(0, inner);
      var top = "┌" + label + rep("─", inner - label.length) + "┐";
      var mid = "│" + rep(" ", inner) + "│";
      var bot = "└" + rep("─", inner) + "┘";
      var lines = [top];
      for (var r = 1; r < rows - 1; r++) lines.push(mid);
      lines.push(bot);
      var esc = lines.join("\n").replace(/&/g, "&amp;").replace(/</g, "&lt;");
      esc = esc.replace("live.and.die@portal: ~", '<b class="u">live.and.die@portal: ~</b>');
      el.innerHTML = esc;
    }
    build();
    addEventListener("resize", function () { clearTimeout(frame.rt); frame.rt = setTimeout(build, 120); }, { passive: true });
  }

  // ------------------------------------------------------------- figlet logo into .mast
  function logo() {
    var masts = document.querySelectorAll(".mast");
    for (var i = 0; i < masts.length; i++) {
      if (masts[i].querySelector(".asciilogo")) continue;
      var pre = document.createElement("pre");
      pre.className = "asciilogo"; pre.setAttribute("aria-hidden", "true"); pre.textContent = LOGO;
      masts[i].insertBefore(pre, masts[i].firstChild);
    }
  }

  // ------------------------------------------------------------- section headers → shell commands
  function commands() {
    var MAP = {
      "THE ARCHIVE": "ls ~/archive", "ARCHIVE": "ls ~/archive", "MUSIC": "ls ~/music",
      "COMMISSIONS": "./commission --from 25", "VIDEO": "mpv ~/video/*", "ART": "ls ~/art",
      "PRINTS": "cat prints.txt", "TOOLS": "ls ~/bin", "ABOUT THE WORK": "cat about.txt",
      "ABOUT": "cat about.txt", "POLICIES": "cat policies.txt", "NEWS": "tail news.log",
      "FAQ": "cat faq.txt", "LINKS": "cat links.txt", "FIND US": "finger live.and.die",
      "EXAMPLES": "ls ~/examples", "HOW TO ORDER": "cat order.txt", "TRACKS": "cat tracklist.txt",
      "ON BANDCAMP": "cat bandcamp.url", "NOW SHOWING": "mpv ./now-showing", "INDEX": "cat index.txt"
    };
    var ths = document.querySelectorAll("table.sec > tbody > tr > th");
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i];
      var raw = (th.textContent || "").trim().replace(/\s+/g, " ").toUpperCase();
      var cmd = MAP[raw];
      if (!cmd) { var key = Object.keys(MAP).filter(function (k) { return raw.indexOf(k) === 0; })[0]; if (key) cmd = MAP[key]; }
      if (!cmd) cmd = "cat " + raw.toLowerCase().replace(/[^a-z0-9]+/g, "_") + ".txt";
      th.textContent = cmd;
    }
  }

  // ------------------------------------------------------------- footer font credit (CC BY-SA 4.0)
  function credit() {
    var foots = document.querySelectorAll(".foot");
    for (var i = 0; i < foots.length; i++) {
      if (foots[i].querySelector(".fontcredit")) continue;
      var span = document.createElement("span");
      span.className = "fontcredit";
      span.innerHTML = 'font: Web437 IBM VGA 8x16 · Ultimate Oldschool PC Font Pack by VileR, ' +
        '<a href="https://int10h.org/oldschool-pc-fonts/" target="_blank" rel="noopener">int10h.org</a> · CC BY-SA 4.0';
      foots[i].appendChild(span);
    }
  }

  // ------------------------------------------------------------- input prompt + block cursor
  function prompt() {
    var wrap = document.querySelector(".wrap"); if (!wrap) return;
    if (document.getElementById("termprompt")) return;
    var box = document.createElement("div"); box.id = "termprompt";
    box.innerHTML = '<span class="ps1">visitor@live.and.die:~$</span>' +
      '<input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="terminal input">' +
      '<span class="termcursor" aria-hidden="true"></span>';
    wrap.appendChild(box);
    var input = box.querySelector("input"), cursor = box.querySelector(".termcursor");
    input.addEventListener("input", function () { cursor.style.display = input.value ? "none" : ""; });
    var ROUTES = { music: "/music/", art: "/archive/", archive: "/archive/", commissions: "/commissions/",
      commission: "/commissions/", tools: "/tools/", bin: "/tools/", video: "/#video", prints: "/#hardcopy",
      home: "/", "cd ~": "/", "cd ..": "/", news: "/#recalls", faq: "/#service", about: "/#standards", links: "/#dealers" };
    function out(text, cls) {
      var line = document.createElement("div"); line.textContent = text;
      if (cls) line.style.color = cls; line.style.whiteSpace = "pre-wrap";
      wrap.insertBefore(line, box);
    }
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var cmd = input.value.trim(); input.value = ""; cursor.style.display = "";
      out("visitor@live.and.die:~$ " + cmd);
      var low = cmd.toLowerCase();
      if (!low) return;
      if (low === "help") { out("commands: ls  music  art  archive  commissions  tools  video  prints  home  clear  help", BLUE); return; }
      if (low === "clear") { Array.prototype.slice.call(wrap.children).forEach(function (c) { if (c !== box && !c.classList.contains("mast")) {} }); scrollTo(0, 0); return; }
      if (low === "ls" || low === "ls -l" || low === "dir") { out("archive/  music/  commissions/  tools/  video/  prints/", BLUE); return; }
      if (low === "whoami") { out("visitor", BLUE); return; }
      var r = ROUTES[low] || ROUTES[low.replace(/^(cat|cd|run|\.\/)\s*/, "").replace(/\/$/, "")];
      if (r) { out("loading " + low + " ...", BLUE); setTimeout(function () { location.href = r; }, 220); }
      else out("sh: " + cmd + ": command not found", RED);
    });
  }

  // ------------------------------------------------------------- BIOS boot sequence (once per session)
  function boot(done) {
    if (reduce || sessionStorage.getItem("lad_booted")) { done(); return; }
    sessionStorage.setItem("lad_booted", "1");
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:50;background:#000;color:" + RED +
      ";font:16px/1.3 'Web437 VGA',monospace;padding:14px 10px;white-space:pre-wrap;text-shadow:0 0 4px rgba(255,42,42,.45);overflow:hidden";
    ov.innerHTML = '<span style="color:' + BLUE + '">[ tap to skip ]</span>\n\n';
    document.body.appendChild(ov);
    var LINES = [
      "LIVE.AND.DIE BIOS v7.0  (C) 2026 LIVE.AND.DIE PRODUCTIONS",
      "",
      "Main Processor  : VAPOR-666 @ 6.66 GHz",
      "Memory Test     : 00655360K OK",
      "",
      "Detecting drives ...",
      "  portal0   live.and.die       [OK]",
      "  music0    sam.carly.album    [OK]",
      "  archive0  602 pieces         [OK]",
      "  x0        ...                [??]",
      "",
      "Loading live.and.die ..."
    ];
    var i = 0, t = 0;
    function line() {
      if (i >= LINES.length) { setTimeout(end, 260); return; }
      ov.insertAdjacentText("beforeend", LINES[i++] + "\n");
      t = setTimeout(line, 110);
    }
    function end() { if (!ov.parentNode) return; ov.parentNode.removeChild(ov); done(); }
    ov.addEventListener("pointerdown", function () { clearTimeout(t); end(); });
    line();
  }

  function run() {
    starfield(); logo(); commands(); credit(); frame(); prompt();
    boot(function () { document.body.classList.add("booted"); });
  }
  if (document.body) run(); else document.addEventListener("DOMContentLoaded", run);
})();
