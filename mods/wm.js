/* ===================== phase 6: window mode (startx) ===================== */
(function () {
  "use strict";
  var SH = window.SH; if (!SH) return;
  var cmd = SH.cmd, line = SH.line, esc = SH.esc, au = SH.au;
  function mat(W, H) { var g = []; for (var y = 0; y < H; y++) { g[y] = []; for (var x = 0; x < W; x++) g[y][x] = " "; } return g; }
  function put(g, x, y, s) { for (var i = 0; i < s.length; i++) { if (g[y] && x + i < g[y].length && x + i >= 0) g[y][x + i] = s[i]; } }
  function box(g, x, y, w, h, title, focus) {
    var tl = "┌", tr = "┐", bl = "└", br = "┘", hz = "─", vt = "│";
    put(g, x, y, tl + new Array(w - 1).join(hz) + tr);
    put(g, x, y + h - 1, bl + new Array(w - 1).join(hz) + br);
    for (var r = 1; r < h - 1; r++) { put(g, x, y + r, vt); put(g, x + w - 1, y + r, vt); }
    put(g, x + 2, y, (focus ? "► " : "") + title);
  }
  function fill(g, x, y, w, h, lines) { for (var i = 0; i < h - 2 && i < lines.length; i++) put(g, x + 1, y + 1 + i, String(lines[i]).slice(0, w - 2)); }

  cmd("startx wm tmux", function () {
    var focus = 0, raf = 0, procs = [];
    SH.loadArc().then(function (d) { procs = d.all.slice(0, 6).map(function (p, i) { return { pid: 666 + i * 3, n: p.no.toLowerCase().replace("arc-", "p"), t: p.title, cpu: Math.random() * 40 }; }); });
    var ui = SH.app(function (k, e) { if ((k === "b" && e && e.ctrlKey) || k === "Tap") { focus = (focus + 1) % 4; } else if (k === "q" || k === "Escape" || k === "x") stop(); }, function (dd) { if (dd === "down") stop(); else focus = (focus + 1) % 4; });
    function draw() {
      raf = requestAnimationFrame(draw);
      var W = Math.max(40, Math.min(SH.cols(), 100)), H = Math.max(18, SH.rowsN() - 1);
      var g = mat(W, H); var cw = (W / 2) | 0, chh = ((H - 1) / 2) | 0;
      // shell pane: last output lines
      var shl = []; var kids = SH.out.children; for (var i = Math.max(0, kids.length - (chh - 2)); i < kids.length; i++) shl.push((kids[i].textContent || "").replace(/\s+/g, " "));
      box(g, 0, 0, cw, chh, "shell", focus === 0); fill(g, 0, 0, cw, chh, shl);
      // player pane
      var pl = ["idle - 'play 01'"]; if (au.src) { var cur = au.currentTime, dur = au.duration || 0, f = dur ? Math.round(10 * cur / dur) : 0; pl = [au.paused ? "paused" : "playing", "[" + new Array(f + 1).join("#") + new Array(11 - f).join("-") + "]", Math.floor(cur) + "s"]; }
      box(g, cw, 0, W - cw, chh, "player", focus === 1); fill(g, cw, 0, W - cw, chh, pl);
      // process pane
      procs.forEach(function (p) { p.cpu = Math.max(0, Math.min(99, p.cpu + (Math.random() - 0.5) * 20)); });
      var pr = procs.map(function (p) { return p.pid + " " + ("" + p.cpu.toFixed(0)).padStart(3) + "% " + p.n; });
      box(g, 0, chh, cw, H - chh, "top", focus === 2); fill(g, 0, chh, cw, H - chh, pr);
      // art pane: clock + logo-ish
      var art = ["live.and.die", new Date().toLocaleTimeString(), "", "Ctrl+b / tap = next pane", "swipe down / q = exit"];
      box(g, cw, chh, W - cw, H - chh, "info", focus === 3); fill(g, cw, chh, W - cw, H - chh, art);
      var txt = g.map(function (r) { return r.join(""); }).join("\n");
      ui.el.innerHTML = '<span style="color:var(--red)">' + esc(txt).replace(/(shell|player|top|info)/g, '<span style="color:var(--blue)">$1</span>') + "</span>";
    }
    draw();
    function stop() { cancelAnimationFrame(raf); ui.close(); line("[exited window mode]", "dim"); }
    SH._wmStop = stop;
    return true;
  }, { help: "tiling window manager: player, art, shell, processes", man: "startx - a text tiling window manager. four box-drawn panes (shell, player, top, info). Ctrl+b or tap cycles the focused pane; swipe down or 'q' exits." });
  SH.cmd("exit-wm", function () { if (SH._wmStop) SH._wmStop(); }, { hidden: true });
})();
