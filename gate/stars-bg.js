/* gate-kit · stars-bg (v7, ASCII) — the reactive 90s starfield, redrawn as ASCII characters.
 *
 * A fixed full-screen canvas behind the page draws a sparse field of star glyphs (. · + * ✦) in
 * blood red and electric blue on black. They twinkle in hard steps; they react: stars near the
 * pointer/finger sparkle, a tap throws a burst, scrolling drifts the field (parallax) and stirs the
 * twinkle. prefers-reduced-motion: a single still frame, no animation. Never on /x/ pages.
 *
 * Also folds in two page enhancers (same file so no page needs a new <script>):
 *   - injects the big "live.and.die" ASCII-art logo into .mast (red with a blue shadow)
 *   - on hover/tap, renders an art thumbnail as live red/blue ASCII over itself (the link still opens)
 *
 *   <script src="/gate/stars-bg.js" defer></script>
 * API: window.GateStars.burst(xCss, yCss, strength)   (1 = tap, 3 = big)
 */
(function () {
  "use strict";
  if (/^\/x\//.test(location.pathname)) return;
  window.GateStars = { burst: function () {}, state: function () { return { mode: "off" }; } };
  window.GateMosh = { shock: function (x, y, k) { window.GateStars.burst(x, y, k); } };

  // ----------------------------------------------------------------- starfield
  (function starfield() {
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var RED = "#ff1a1a", RED2 = "#b31414", BLUE = "#1a4dff", BLUE2 = "#6b86ff", WHITE = "#dfe6ff";
    var GLYPH = [".", "·", "+", "*", "✦"];          // . · + * ✦
    var CELL = 15, TICK = 110;
    var cv = document.createElement("canvas");
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;background:#000;display:block";
    var ctx = cv.getContext("2d", { alpha: false });
    var W = 0, H = 0, cols = 0, rows = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var stars = [], step = 0, pointer = { x: -1, y: -1, on: false }, bursts = [], turb = 0, drift = 0;

    var seed = 333;                                       // same sky every visit
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

    function build() {
      stars = [];
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var v = rnd();
        if (v > 0.16) continue;                           // density
        var depth = v < 0.03 ? 2 : v < 0.08 ? 1 : 0;      // 0 dust … 2 bright
        stars.push({
          c: c, r: r,
          g: GLYPH[depth === 2 ? (rnd() < .5 ? 3 : 4) : depth === 1 ? 2 : (rnd() < .5 ? 0 : 1)],
          blue: rnd() < 0.34,
          phase: (rnd() * 9) | 0, speed: 1 + (rnd() * 3 | 0),
          depth: depth
        });
      }
    }
    function size() {
      W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = "13px 'Courier New',monospace"; ctx.textBaseline = "top";
      cols = Math.ceil(W / CELL) + 1; rows = Math.ceil(H / CELL) + 1;
      seed = 333; build();
    }
    function draw() {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      var off = (drift % CELL);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var tw = ((step * s.speed + s.phase) % 9);
        var lit = tw < 2;                                 // hard-step twinkle
        var dim = s.depth === 0 && !lit && turb < 0.2;
        if (dim && rnd() < 0.55) continue;
        var px = s.c * CELL;
        var py = s.r * CELL - (s.depth + 1) * off * 0.6;  // parallax by depth
        py = ((py % (H + CELL)) + (H + CELL)) % (H + CELL) - CELL;
        var near = false;
        if (pointer.on) {
          var dx = px - pointer.x, dy = py - pointer.y;
          if (dx * dx + dy * dy < 5200) near = true;
        }
        var g = s.g, col;
        if (near) { g = rnd() < .5 ? "*" : "✦"; col = rnd() < .5 ? WHITE : (s.blue ? BLUE2 : RED); }
        else if (lit || turb > 0.4) col = s.blue ? BLUE2 : RED;
        else col = s.blue ? BLUE : RED2;
        ctx.globalAlpha = s.depth === 0 ? (lit ? .8 : .4) : lit ? 1 : .7;
        ctx.fillStyle = col;
        ctx.fillText(g, px, py);
      }
      // tap bursts
      ctx.globalAlpha = 1;
      for (var b = bursts.length - 1; b >= 0; b--) {
        var bu = bursts[b]; bu.age++;
        var rad = bu.age * CELL * 0.9, n = 10;
        for (var k = 0; k < n; k++) {
          var a = (k / n) * Math.PI * 2 + bu.age * 0.3;
          var x = bu.x + Math.cos(a) * rad, y = bu.y + Math.sin(a) * rad;
          if (x < 0 || x > W || y < 0 || y > H) continue;
          ctx.globalAlpha = Math.max(0, 1 - bu.age / 9);
          ctx.fillStyle = k % 2 ? BLUE2 : RED;
          ctx.fillText(bu.age > 4 ? "." : "+", x, y);
        }
        if (bu.age > 9) bursts.splice(b, 1);
      }
      ctx.globalAlpha = 1;
    }

    var timer = 0;
    function tick() {
      step++; if (turb > 0) turb *= 0.82; if (Math.abs(drift) > 0.1) drift *= 0.86; else drift = 0;
      draw();
      timer = setTimeout(tick, TICK);
    }
    function burst(x, y, k) { bursts.push({ x: x, y: y, age: 0 }); turb = Math.min(1.4, turb + 0.6 * (k || 1)); if (!reduce && !timer) tick(); }
    window.GateStars.burst = burst;
    window.GateStars.state = function () { return { mode: "ascii", W: W, H: H, stars: stars.length, running: !!timer }; };

    function start() {
      document.documentElement.style.background = "#000";
      document.body.style.background = "transparent";
      (document.body || document.documentElement).appendChild(cv);
      size(); draw();
      if (reduce) return;
      var o = { passive: true };
      addEventListener("resize", function () { clearTimeout(start.rt); start.rt = setTimeout(function () { size(); draw(); }, 120); }, o);
      addEventListener("pointermove", function (e) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true; }, o);
      addEventListener("pointerleave", function () { pointer.on = false; }, o);
      addEventListener("pointerdown", function (e) { burst(e.clientX, e.clientY, 1); }, o);
      var lastY = scrollY;
      addEventListener("scroll", function () { var d = scrollY - lastY; lastY = scrollY; drift += d; turb = Math.min(1.4, turb + Math.min(0.5, Math.abs(d) / 40)); }, o);
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) { clearTimeout(timer); timer = 0; }
        else if (!timer) tick();
      });
      tick();
    }
    if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  })();

  // ----------------------------------------------------------------- .mast ASCII logo
  (function logo() {
    var LOGO = [
      " _ _                        _      _ _     ",
      "| (_)_ _____   __ _ _ _  __| |  __| (_)___ ",
      "| | \\ V / -_)_/ _` | ' \\/ _` |_/ _` | / -_)",
      "|_|_|\\_/\\___(_)__,_|_||_\\__,_(_)__,_|_\\___|"
    ].join("\n");
    function run() {
      var masts = document.querySelectorAll(".mast");
      for (var i = 0; i < masts.length; i++) {
        var m = masts[i];
        if (m.querySelector(".asciilogo")) continue;
        var pre = document.createElement("pre");
        pre.className = "asciilogo"; pre.setAttribute("aria-hidden", "true"); pre.textContent = LOGO;
        m.insertBefore(pre, m.firstChild);
      }
    }
    if (document.body) run(); else document.addEventListener("DOMContentLoaded", run);
  })();

  // ----------------------------------------------------------------- hover/tap → live ASCII thumbnail (bonus)
  (function asciiArt() {
    var RAMP = " .:-=+*o0#";                              // dark → light density
    function render(img) {
      try {
        if (!img.complete || !img.naturalWidth || img.dataset.asciiOn) return;
        var W = 46, H = Math.max(10, Math.round(W * img.naturalHeight / img.naturalWidth * 0.5));
        var cn = document.createElement("canvas"); cn.width = W; cn.height = H;
        var cx = cn.getContext("2d"); cx.drawImage(img, 0, 0, W, H);
        var d = cx.getImageData(0, 0, W, H).data, out = "", html = "";
        for (var y = 0; y < H; y++) { var line = "";
          for (var x = 0; x < W; x++) {
            var i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
            var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            var ch = RAMP[Math.min(RAMP.length - 1, Math.round(lum * (RAMP.length - 1)))];
            var col = (r >= b) ? "#ff1a1a" : "#6b86ff";
            line += ch === " " ? " " : '<span style="color:' + col + '">' + ch + "</span>";
          }
          html += line + "\n";
        }
        var pre = document.createElement("pre");
        pre.className = "ascii-ovl";
        pre.style.cssText = "position:absolute;inset:0;margin:0;z-index:3;pointer-events:none;overflow:hidden;" +
          "background:#000;white-space:pre;line-height:0.92;font-family:'Courier New',monospace;font-weight:700;color:#ff1a1a";
        pre.innerHTML = html;
        var box = img.parentNode;
        if (getComputedStyle(box).position === "static") box.style.position = "relative";
        box.appendChild(pre);
        pre.style.fontSize = (box.clientWidth / (W * 0.6)) + "px";   // fit W columns to the image width
        img.dataset.asciiOn = "1"; img._asciiPre = pre;
      } catch (e) { /* cross-origin or no data: skip silently */ }
    }
    function clear(img) {
      if (img._asciiPre && img._asciiPre.parentNode) img._asciiPre.parentNode.removeChild(img._asciiPre);
      img._asciiPre = null; delete img.dataset.asciiOn;
    }
    function wire() {
      var imgs = document.querySelectorAll("table.art img, table.art4 img, .grid .th img");
      for (var i = 0; i < imgs.length; i++) (function (img) {
        img.addEventListener("pointerenter", function () { render(img); });
        img.addEventListener("pointerleave", function () { clear(img); });
      })(imgs[i]);
    }
    if (document.body) wire(); else document.addEventListener("DOMContentLoaded", wire);
  })();
})();
