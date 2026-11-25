/* ===================== phase 5: games (snake, tetris) ===================== */
(function () {
  "use strict";
  var SH = window.SH; if (!SH) return;
  var cmd = SH.cmd, line = SH.line, esc = SH.esc;
  function hs(key, v) { try { if (v == null) return +(localStorage.getItem(key) || 0); localStorage.setItem(key, v); } catch (e) { return 0; } }

  // ---------------- snake ----------------
  cmd("snake", function () {
    var W = Math.min(34, SH.cols() - 2), H = Math.min(20, SH.rowsN() - 4);
    var snake, dir, nd, food, score, dead, iv, hi = hs("lad_snake");
    var ui = SH.app(onKey, onSwipe);
    function reset() { snake = [{ x: (W / 2) | 0, y: (H / 2) | 0 }]; dir = { x: 1, y: 0 }; nd = dir; food = newFood(); score = 0; dead = false; }
    function newFood() { var f; do { f = { x: Math.random() * W | 0, y: Math.random() * H | 0 }; } while (snake && snake.some(function (s) { return s.x === f.x && s.y === f.y; })); return f; }
    function onKey(k) { if (k === "ArrowUp") turn(0, -1); else if (k === "ArrowDown") turn(0, 1); else if (k === "ArrowLeft") turn(-1, 0); else if (k === "ArrowRight") turn(1, 0); else if (k === "q" || k === "Escape") stop(); else if (k === "Tap" && dead) { reset(); } }
    function onSwipe(d) { if (d === "up") turn(0, -1); else if (d === "down") turn(0, 1); else if (d === "left") turn(-1, 0); else if (d === "right") turn(1, 0); }
    function turn(x, y) { if (x === -dir.x && y === -dir.y) return; nd = { x: x, y: y }; }
    function step() {
      if (dead) return; dir = nd; var h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (h.x < 0 || h.x >= W || h.y < 0 || h.y >= H || snake.some(function (s) { return s.x === h.x && s.y === h.y; })) { dead = true; if (score > hi) { hi = score; hs("lad_snake", hi); } draw(); return; }
      snake.unshift(h); if (h.x === food.x && h.y === food.y) { score++; food = newFood(); } else snake.pop(); draw();
    }
    function draw() {
      var g = []; for (var y = 0; y < H; y++) { g[y] = []; for (var x = 0; x < W; x++) g[y][x] = " "; }
      g[food.y][food.x] = "*"; snake.forEach(function (s, i) { g[s.y][s.x] = i === 0 ? "@" : "#"; });
      var top = "+" + new Array(W + 1).join("-") + "+";
      var h = '<span style="color:var(--blue)"> snake   score ' + score + '   hi ' + hi + '</span>\n' + top + "\n";
      for (var y2 = 0; y2 < H; y2++) { h += "|"; for (var x2 = 0; x2 < W; x2++) { var c = g[y2][x2]; if (c === "*") h += '<span style="color:var(--blue)">*</span>'; else if (c !== " ") h += '<span style="color:var(--red)">' + c + "</span>"; else h += " "; } h += "|\n"; }
      h += top + "\n" + '<span style="color:var(--dim)">' + (dead ? "GAME OVER - tap to retry, q to quit" : "swipe or arrows   q=quit") + "</span>";
      ui.el.innerHTML = h;
    }
    reset(); draw(); iv = setInterval(step, 130);
    function stop() { clearInterval(iv); ui.close(); line("snake - score " + score + " (hi " + hi + ")", "dim"); }
    ui._int = iv;
    return true;
  }, { help: "snake (swipe/arrows, q to quit)", man: "snake - classic snake in ascii. swipe or arrow keys to turn, eat the blue *, don't hit the walls or yourself. high score saved." });

  // ---------------- tetris ----------------
  var PIECES = [
    [[[0, 0], [1, 0], [2, 0], [3, 0]]],                                   // I (one rot handled generic)
    [[[0, 0], [1, 0], [0, 1], [1, 1]]],                                   // O
    [[[1, 0], [0, 1], [1, 1], [2, 1]]],                                   // T
    [[[1, 0], [2, 0], [0, 1], [1, 1]]],                                   // S
    [[[0, 0], [1, 0], [1, 1], [2, 1]]],                                   // Z
    [[[0, 0], [0, 1], [1, 1], [2, 1]]],                                   // J
    [[[2, 0], [0, 1], [1, 1], [2, 1]]]                                    // L
  ];
  function rot(cells) { return cells.map(function (c) { return [c[1], -c[0]]; }); }   // rotate 90
  function norm(cells) { var mx = Math.min.apply(null, cells.map(function (c) { return c[0]; })), my = Math.min.apply(null, cells.map(function (c) { return c[1]; })); return cells.map(function (c) { return [c[0] - mx, c[1] - my]; }); }
  cmd("tetris", function () {
    var W = 10, H = Math.min(20, SH.rowsN() - 4);
    var board, piece, px, py, score, lines, dead, iv, hi = hs("lad_tetris");
    var ui = SH.app(onKey, onSwipe);
    function reset() { board = []; for (var y = 0; y < H; y++) { board[y] = []; for (var x = 0; x < W; x++) board[y][x] = 0; } score = 0; lines = 0; dead = false; spawn(); }
    function spawn() { var t = Math.random() * PIECES.length | 0; piece = { cells: norm(PIECES[t][0]), col: t % 2 ? "var(--blue)" : "var(--red)" }; px = 3; py = 0; if (collide(piece.cells, px, py)) { dead = true; if (score > hi) { hi = score; hs("lad_tetris", score); } } }
    function collide(cells, ox, oy) { return cells.some(function (c) { var x = c[0] + ox, y = c[1] + oy; return x < 0 || x >= W || y >= H || (y >= 0 && board[y][x]); }); }
    function lock() { piece.cells.forEach(function (c) { var x = c[0] + px, y = c[1] + py; if (y >= 0) board[y][x] = piece.col; }); var cleared = 0; for (var y = H - 1; y >= 0; y--) { if (board[y].every(function (v) { return v; })) { board.splice(y, 1); board.unshift(new Array(W).fill(0)); cleared++; y++; } } if (cleared) { lines += cleared; score += [0, 40, 100, 300, 1200][cleared]; } spawn(); }
    function down() { if (dead) return; if (!collide(piece.cells, px, py + 1)) py++; else lock(); draw(); }
    function move(dx) { if (!dead && !collide(piece.cells, px + dx, py)) px += dx; draw(); }
    function rotate() { if (dead) return; var r = norm(piece.cells.map(function (c) { return [c[1], -c[0]]; })); if (!collide(r, px, py)) piece.cells = r; draw(); }
    function drop() { if (dead) return; while (!collide(piece.cells, px, py + 1)) py++; lock(); draw(); }
    function onKey(k) { if (k === "ArrowLeft") move(-1); else if (k === "ArrowRight") move(1); else if (k === "ArrowDown") down(); else if (k === "ArrowUp") rotate(); else if (k === " ") drop(); else if (k === "q" || k === "Escape") stop(); else if (k === "Tap") { if (dead) reset(); else rotate(); } }
    function onSwipe(d) { if (d === "left") move(-1); else if (d === "right") move(1); else if (d === "down") drop(); else if (d === "up") rotate(); }
    function draw() {
      var g = board.map(function (r) { return r.slice(); });
      if (!dead) piece.cells.forEach(function (c) { var x = c[0] + px, y = c[1] + py; if (y >= 0 && y < H) g[y][x] = piece.col; });
      var top = "+" + new Array(W + 1).join("-") + "+";
      var h = '<span style="color:var(--blue)"> tetris  score ' + score + '  hi ' + hi + '</span>\n' + top + "\n";
      for (var y = 0; y < H; y++) { h += "|"; for (var x = 0; x < W; x++) { var v = g[y][x]; h += v ? '<span style="color:' + v + '">█</span>' : " "; } h += "|\n"; }
      h += top + "\n" + '<span style="color:var(--dim)">' + (dead ? "GAME OVER - tap to retry, q to quit" : "swipe: L/R move, up rotate, down drop  q=quit") + "</span>";
      ui.el.innerHTML = h;
    }
    reset(); draw(); iv = setInterval(down, 650);
    function stop() { clearInterval(iv); ui.close(); line("tetris - score " + score + " (hi " + hi + ")", "dim"); }
    return true;
  }, { help: "tetris (swipe/arrows, q to quit)", man: "tetris - ascii tetris. swipe L/R to move, swipe up to rotate, swipe down to hard-drop (arrows + space on desktop). high score saved." });
})();

/* ===================== phase 5b: rogue + adventure ===================== */
(function () {
  "use strict";
  var SH = window.SH; if (!SH) return;
  var cmd = SH.cmd, line = SH.line, esc = SH.esc;

  // ---------------- rogue ----------------
  var RMAP = [
    "##############################",
    "#*....#......#....*#.....#...*#",
    "#.....#..##..#.....#..#..#....#",
    "#..#..+..#...+.....+..#..+....#",
    "#..#..#..#...#..#..#..#..#..#.#",
    "#*.#..#..#*..#..#..#*.#..#..#*#",
    "#..#..####...#..####..####..#.#",
    "#..+.........+..........+....+#",
    "#..####..##..####..##..####...#",
    "#.....#..#*..#.....#....#*....#",
    "#.....#..#...+.....+....#.....#",
    "##############################"
  ];
  cmd("rogue dungeon", function () {
    var grid = RMAP.map(function (r) { return r.split(""); });
    var total = 0; grid.forEach(function (r) { r.forEach(function (c) { if (c === "*") total++; }); });
    var px = 2, py = 1, got = 0, dead = false; grid[py][px] = ".";
    var ui = SH.app(onKey, onSwipe);
    SH.loadArc().then(function (d) { window._rogueTracks = d.tracks; });
    function onKey(k) { if (k === "ArrowUp") mv(0, -1); else if (k === "ArrowDown") mv(0, 1); else if (k === "ArrowLeft") mv(-1, 0); else if (k === "ArrowRight") mv(1, 0); else if (k === "q" || k === "Escape") stop(); }
    function onSwipe(dd) { if (dd === "up") mv(0, -1); else if (dd === "down") mv(0, 1); else if (dd === "left") mv(-1, 0); else if (dd === "right") mv(1, 0); }
    var msg = "find all " + total + " loot (*). collect songs. doors (+) open.";
    function mv(dx, dy) { if (dead) return; var nx = px + dx, ny = py + dy; var t = grid[ny] && grid[ny][nx]; if (t == null || t === "#") return; if (t === "*") { got++; var tr = (window._rogueTracks || [])[(got - 1) % ((window._rogueTracks || []).length || 1)]; msg = "loot! got the song: " + (tr ? tr.title : "???") + "  (" + got + "/" + total + ")"; grid[ny][nx] = "."; } px = nx; py = ny; if (got >= total) win(); draw(); }
    function win() { dead = true; msg = "ALL LOOT FOUND. unlock code: NOIDED25  (10% off a commission - DM it)"; }
    function draw() {
      var h = '<span style="color:var(--blue)"> rogue   loot ' + got + '/' + total + '</span>\n';
      for (var y = 0; y < grid.length; y++) { h += " "; for (var x = 0; x < grid[y].length; x++) { if (x === px && y === py) { h += '<span style="color:#fff">@</span>'; continue; } var c = grid[y][x]; if (c === "#") h += '<span style="color:var(--dim)">#</span>'; else if (c === "*") h += '<span style="color:var(--blue)">*</span>'; else if (c === "+") h += '<span style="color:var(--red)">+</span>'; else h += " "; } h += "\n"; }
      h += '<span style="color:var(--red)">' + esc(msg) + "</span>\n" + '<span style="color:var(--dim)">swipe/arrows to move, q to quit</span>';
      ui.el.innerHTML = h;
    }
    draw();
    function stop() { ui.close(); line("rogue - " + got + "/" + total + " loot" + (got >= total ? " - code NOIDED25" : ""), "dim"); }
    return true;
  }, { help: "a tiny roguelike; loot is songs; clear it for a code", man: "rogue - walk @ through the rooms (swipe/arrows). each * is a song; collect all 8 to unlock a commission discount code." });

  // ---------------- adventure (parser; maps onto /x/) ----------------
  var WORLD = {
    portal: { d: "You stand in the portal. A black terminal hums. Exits: north (music), east (archive), down (a door with no label).", n: "music", e: "archive", down: "_x", items: [] },
    music: { d: "The music room. 34 tapes spin on their own. A red cassette rests here. Exits: south (portal).", s: "portal", items: ["cassette"] },
    archive: { d: "The archive. 602 pictures breathe on the walls. Exits: west (portal), north (darkroom).", w: "portal", n: "darkroom", items: [] },
    darkroom: { d: "A darkroom. Something is developing. A key-shaped shadow. Exits: south (archive).", s: "archive", items: ["shadow key"] }
  };
  cmd("adventure zork play-adventure", function () {
    var here = "portal", inv = [];
    line("** live.and.die: an adventure **  (verbs: go <dir>, look, take <x>, inventory, help, quit)", "blue");
    look();
    function look() { var r = WORLD[here]; r.d.split(". ").forEach(function (s) { line(s.replace(/\.$/, "") + "."); }); if (r.items.length) line("you see: " + r.items.join(", "), "dim"); }
    SH.read("adventure> ", function (v) {
      var t = v.trim().toLowerCase(), p = t.split(/\s+/), verb = p[0], obj = p.slice(1).join(" ");
      if (verb === "quit" || verb === "q" || verb === "exit") { line("you blink back to the shell.", "dim"); return false; }
      if (verb === "help") { line("go <north/south/east/west/down>, look, take <item>, inventory, quit", "dim"); return true; }
      if (verb === "look" || verb === "l") { look(); return true; }
      if (verb === "inventory" || verb === "inv" || verb === "i") { line(inv.length ? "you carry: " + inv.join(", ") : "your hands are empty.", "dim"); return true; }
      if (verb === "take" || verb === "get") { var r = WORLD[here], idx = r.items.indexOf(obj); if (idx >= 0) { inv.push(obj); r.items.splice(idx, 1); line("taken: " + obj, "blue"); } else line("there is no " + obj + " here.", "dim"); return true; }
      if (verb === "go" || verb === "move" || ["n", "s", "e", "w", "north", "south", "east", "west", "down"].indexOf(verb) >= 0) {
        var dir = ({ n: "n", north: "n", s: "s", south: "s", e: "e", east: "e", w: "w", west: "w", down: "down" })[obj || verb] || obj;
        var r2 = WORLD[here], dest = r2[dir];
        if (dest === "_x") { line("you step through the unmarked door ...", "blue"); setTimeout(function () { location.href = "/x/" + SH.XDOORS[Math.floor(Math.random() * SH.XDOORS.length)] + ".html"; }, 500); return false; }
        if (dest && WORLD[dest]) { here = dest; look(); } else line("you can't go that way.", "dim");
        return true;
      }
      line("you can't do that. (try: go north, look, take, quit)", "dim"); return true;
    });
    return true;
  }, { help: "a text adventure that maps onto the /x/ layer", man: "adventure - a Zork-style text adventure. 'go <dir>', 'look', 'take <item>', 'inventory'. The unmarked door drops you into the /x/ layer." });
})();
