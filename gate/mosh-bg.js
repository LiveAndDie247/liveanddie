/* gate-kit · mosh-bg — an optional reactive datamosh background.
 *
 * The starfield tile plus one very dim still from the clips (the "keyframe") sits on a fixed
 * full-screen canvas behind the page. Scrolling, moving the pointer and tapping write motion
 * vectors into a low-res block grid (one vector per ~14 CSS px); every frame each block of the
 * picture is pulled along its vector from the previous picture, so blocks drag and feed back on
 * themselves like a P-frame with the I-frame removed (the block-motion smear from MOSH live.js).
 * Vectors decay over ~1.5 s and the picture heals toward the keyframe ~1% per frame. When
 * everything has settled the loop stops. After ~20 s of idle the next still arrives block by block.
 *
 * WebGL2 ping-pong at 1/4 device resolution, nearest-neighbour upscale (blocky on purpose).
 * Falls back to a 2D-canvas block copy; with no canvas or prefers-reduced-motion it does nothing
 * and the page keeps its plain tiled starfield. Never on /x/ pages.
 *
 * Turn it on with:
 *   <script src="/gate/mosh-bg.js" data-frames="/img/bg/" data-count="12" defer></script>
 * API: window.GateMosh.shock(xCss, yCss, strength)   (strength 1 = tap, 3 = big)
 */
(function () {
  "use strict";
  var me = document.currentScript;
  if (!me || /^\/x\//.test(location.pathname)) return;
  var FR = me.getAttribute("data-frames") || "/img/bg/";
  var COUNT = parseInt(me.getAttribute("data-count"), 10) || 12;
  var STARS = me.getAttribute("data-stars") || "/img/stars.png";
  var DIM = parseFloat(me.getAttribute("data-dim")) || 0.09;   // still brightness (≤ 0.25); 9% keeps pure-red text ≥ 4.5:1 even over white in the still
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.GateMosh = { shock: function () {} };
  if (reduce) return;                                           // static starfield only

  // ?moshbg=2d forces the fallback; ?moshbg=read renders WebGL offscreen and copies it to a 2D canvas
  // (only for headless screenshots, where presenting a WebGL canvas loses the context)
  var MODE = (location.search.match(/[?&]moshbg=(\w+)/) || [])[1] || "";
  var BLOCK_CSS = 14, DECAY_S = 1.5, HEAL = 0.01, SWAP_MS = 500, IDLE_MS = 20000;
  var KEEP = Math.pow(0.05, 1 / (60 * DECAY_S));                // per-frame vector decay: 5% left after 1.5 s

  var dpr = Math.min(window.devicePixelRatio || 1, 3);
  var S = Math.max(0.5, Math.min(1, dpr / 4));                  // low-res pixels per CSS px
  var cv = document.createElement("canvas"), tw = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true"); tw.setAttribute("aria-hidden", "true");
  var base = "position:fixed;left:0;top:0;width:100vw;height:100vh;height:100lvh;z-index:-1;pointer-events:none;";
  cv.style.cssText = base + "image-rendering:pixelated;image-rendering:crisp-edges;background:#000";
  tw.style.cssText = base;

  var W, H, B, cols, rows, vx, vy, ord, waves = [], cssW, cssH;
  var glc = null, rb = null, rbc = null, gl = null, ctx2 = null, P = {}, comp, compX, frameImgs = [], cur = -1;
  var running = false, raf = 0, last = 0, calm = 0, lastInput = 0, lastSwap = 0;
  var swap = null;     // {t0, from, to}
  var seed = Math.random();

  function size() {
    var r = cv.getBoundingClientRect();
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
    W = Math.ceil(cssW * S); H = Math.ceil(cssH * S);
    B = Math.max(4, Math.round(BLOCK_CSS * S));
    cols = Math.ceil(W / B); rows = Math.ceil(H / B);
    vx = new Float32Array(cols * rows); vy = new Float32Array(cols * rows);
    ord = new Float32Array(cols * rows); reorder();
    cv.width = W; cv.height = H; if (glc && glc !== cv) { glc.width = W; glc.height = H; }
  }
  function reorder() { for (var i = 0; i < ord.length; i++) ord[i] = Math.random(); }

  // ---------- the keyframe: starfield + one dim, slightly desaturated still ----------
  var starImg = new Image(); starImg.src = STARS;
  function keyframe(img) {
    if (!comp) { comp = document.createElement("canvas"); compX = document.createElement("canvas"); }
    comp.width = compX.width = W; comp.height = compX.height = H;
    var c = comp.getContext("2d"), x = compX.getContext("2d");
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
    if (starImg.complete && starImg.naturalWidth) {
      var pat = c.createPattern(starImg, "repeat");
      c.save(); c.scale(S, S); c.fillStyle = pat; c.fillRect(0, 0, W / S, H / S); c.restore();
    }
    if (img && img.naturalWidth) {
      var k = Math.max(W / img.naturalWidth, H / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k;
      x.globalCompositeOperation = "source-over"; x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
      x.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
      x.fillStyle = "rgba(0,0,0," + (1 - DIM) + ")"; x.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "lighter"; c.drawImage(compX, 0, 0); c.globalCompositeOperation = "source-over";
    }
    return comp;
  }
  function loadFrame(i) {
    if (frameImgs[i]) return frameImgs[i];
    var im = new Image(); im.decoding = "async";
    var p = new Promise(function (res) { im.onload = function () { res(im); }; im.onerror = function () { res(null); }; });
    im.src = FR + (i + 1 < 10 ? "0" : "") + (i + 1) + ".jpg";
    return (frameImgs[i] = p);
  }

  // ---------- WebGL2 ----------
  var VS = "#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a*2.0-1.0,0.0,1.0);}";
  var MOSH = "#version 300 es\nprecision highp float;\n" +
    "uniform sampler2D uPic,uKA,uKB,uVec,uOrd;uniform vec2 uRes;uniform float uB,uHeal,uS0,uS1,uChroma,uFloor;out vec4 o;\n" +
    "float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}\n" +
    "void main(){vec2 p=gl_FragCoord.xy;vec2 q=vec2(p.x,uRes.y-p.y);ivec2 cell=ivec2(floor(q/uB));\n" +
    " vec2 v=texelFetch(uVec,cell,0).xy;float r=texelFetch(uOrd,cell,0).x;\n" +
    " vec3 c=texture(uPic,vec2(p.x-v.x,p.y+v.y)/uRes).rgb;\n" +
    " vec3 ka=texture(uKA,p/uRes).rgb,kb=texture(uKB,p/uRes).rgb;vec3 k=r<uS1?kb:ka;\n" +
    " if(r>=uS0&&r<uS1)c=kb;\n" +
    " float m=clamp(length(v)/(uB*0.6),0.0,1.0);float side=h(vec2(cell)+0.37)>0.5?1.0:-1.0;\n" +
    " c+=side*m*uChroma*vec3(0.55,-0.75,0.55);\n" +
    " vec3 d=k-c;c+=sign(d)*min(abs(d),max(abs(d)*uHeal,uFloor));\n" +
    " o=vec4(clamp(c,0.0,1.0),1.0);}";
  var SHOW = "#version 300 es\nprecision mediump float;uniform sampler2D uPic;uniform vec2 uRes;out vec4 o;void main(){o=texture(uPic,gl_FragCoord.xy/uRes);}";

  function glInit() {
    glc = MODE === "read" ? document.createElement("canvas") : cv; glc.width = W; glc.height = H;
    gl = glc.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power", preserveDrawingBuffer: false });
    if (!gl) return false;
    function sh(t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; }
    function prog(fs) { var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, "a"); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (var i = 0; i < n; i++) { var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); } return { p: p, u: u }; }
    try { P.mosh = prog(MOSH); P.show = prog(SHOW); } catch (e) { gl = null; return false; }
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    P.half = MODE !== "read" && (!!gl.getExtension("EXT_color_buffer_float") || !!gl.getExtension("EXT_color_buffer_half_float"));
    glAlloc();
    return true;
  }
  function tex(fmt, w, h, type, data, ifmt) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data || null);
    return t;
  }
  function glAlloc() {
    ["pa", "pb", "ka", "kb", "vec", "ord"].forEach(function (k) { if (P[k]) gl.deleteTexture(P[k]); });
    if (P.fa) { gl.deleteFramebuffer(P.fa); gl.deleteFramebuffer(P.fb); }
    var f16 = P.half;
    P.pa = tex(gl.RGBA, W, H, f16 ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null, f16 ? gl.RGBA16F : gl.RGBA8);
    P.pb = tex(gl.RGBA, W, H, f16 ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null, f16 ? gl.RGBA16F : gl.RGBA8);
    P.fa = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, P.fa); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, P.pa, 0);
    if (f16 && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { P.half = false; return glAlloc(); }
    P.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, P.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, P.pb, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    P.ka = tex(gl.RGBA, 1, 1, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]), gl.RGBA8);
    P.kb = tex(gl.RGBA, 1, 1, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]), gl.RGBA8);
    P.vec = tex(gl.RG, cols, rows, gl.FLOAT, null, gl.RG32F);
    P.ord = tex(gl.RED, cols, rows, gl.FLOAT, ord, gl.R32F);
    P.vbuf = new Float32Array(cols * rows * 2);
  }
  function glKey(which, canvas) {
    gl.bindTexture(gl.TEXTURE_2D, P[which]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  function bindT(unit, t, loc) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); }
  function glStep(s0, s1, heal) {
    for (var i = 0; i < vx.length; i++) { P.vbuf[2 * i] = vx[i]; P.vbuf[2 * i + 1] = vy[i]; }
    gl.bindTexture(gl.TEXTURE_2D, P.vec); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RG, gl.FLOAT, P.vbuf);
    var M = P.mosh;
    gl.useProgram(M.p); gl.bindFramebuffer(gl.FRAMEBUFFER, P.fb); gl.viewport(0, 0, W, H);
    bindT(0, P.pa, M.u.uPic); bindT(1, P.ka, M.u.uKA); bindT(2, P.kb, M.u.uKB); bindT(3, P.vec, M.u.uVec); bindT(4, P.ord, M.u.uOrd);
    gl.uniform2f(M.u.uRes, W, H); gl.uniform1f(M.u.uB, B); gl.uniform1f(M.u.uHeal, heal);
    gl.uniform1f(M.u.uS0, s0); gl.uniform1f(M.u.uS1, s1); gl.uniform1f(M.u.uChroma, 0.0009);   // per frame; it feeds back, so it builds up along the trails
    gl.uniform1f(M.u.uFloor, P.half ? 0.0004 : 1 / 255);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    var t = P.pa; P.pa = P.pb; P.pb = t; t = P.fa; P.fa = P.fb; P.fb = t;
    if (MODE === "read") return readback();
    gl.useProgram(P.show.p); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    bindT(0, P.pa, P.show.u.uPic); gl.uniform2f(P.show.u.uRes, W, H);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function readback() {
    if (!rb || rb.width !== W || rb.height !== H) { rb = new ImageData(W, H); rbc = cv.getContext("2d"); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, P.fa); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, rb.data);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    var d = rb.data, row = W * 4, tmp = new Uint8ClampedArray(row);
    for (var y = 0; y < H >> 1; y++) { var a = y * row, b = (H - 1 - y) * row; tmp.set(d.subarray(a, a + row)); d.copyWithin(a, b, b + row); d.set(tmp, b); }
    rbc.putImageData(rb, 0, 0);
  }
  function glSwapDone() { var t = P.ka; P.ka = P.kb; P.kb = t; }

  // ---------- 2D fallback: block copy ----------
  var back, keyA, keyB;
  function c2Init() {
    ctx2 = cv.getContext("2d", { alpha: false }); if (!ctx2) return false;
    back = document.createElement("canvas"); keyA = document.createElement("canvas"); keyB = document.createElement("canvas");
    c2Alloc(); return true;
  }
  function c2Alloc() { [back, keyA, keyB].forEach(function (c) { c.width = W; c.height = H; }); ctx2.imageSmoothingEnabled = false; }
  function c2Key(which, canvas) { (which === "ka" ? keyA : keyB).getContext("2d").drawImage(canvas, 0, 0); }
  function c2Step(s0, s1, heal) {
    var b = back.getContext("2d"); b.drawImage(cv, 0, 0);
    var x = ctx2, i, r, c, bx, by, m;
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      i = r * cols + c; m = Math.abs(vx[i]) + Math.abs(vy[i]); bx = c * B; by = r * B;
      if (ord[i] >= s0 && ord[i] < s1) { x.drawImage(keyB, bx, by, B, B, bx, by, B, B); keyA.getContext("2d").drawImage(keyB, bx, by, B, B, bx, by, B, B); continue; }
      if (m < 0.3) continue;
      x.drawImage(back, bx - vx[i], by - vy[i], B, B, bx, by, B, B);
      if (m > B * 0.3) { x.globalCompositeOperation = "lighter"; x.globalAlpha = Math.min(1, m / (B * 0.6)) * 0.005; x.fillStyle = ((c * 7 + r * 13) & 1) ? "#8c00ff" : "#00ff40"; x.fillRect(bx, by, B, B); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; }
    }
    x.globalAlpha = heal; x.drawImage(keyA, 0, 0); x.globalAlpha = 1;
  }
  function c2SwapDone() {}

  var step, swapDone, setKey;

  // ---------- inputs → vectors (low-res px per frame, y down) ----------
  var MAXV;
  function clampAll() { for (var i = 0; i < vx.length; i++) { if (vx[i] > MAXV) vx[i] = MAXV; else if (vx[i] < -MAXV) vx[i] = -MAXV; if (vy[i] > MAXV) vy[i] = MAXV; else if (vy[i] < -MAXV) vy[i] = -MAXV; } }
  function wake() { lastInput = performance.now(); calm = 0; if (!running && !document.hidden) { running = true; last = 0; raf = requestAnimationFrame(loop); } }

  var sy = window.scrollY, pend = 0;
  function onScroll() { var y = window.scrollY, d = y - sy; sy = y; pend += d; wake(); }
  function applyScroll() {
    if (!pend) return;
    var d = pend * S; pend = 0;                       // content moved up by d when scrolling down
    var a = Math.abs(d), g = 0.35 * Math.min(1.6, 0.4 + a / 30); // slow → light wobble, flick → long drag
    for (var i = 0; i < vx.length; i++) { vy[i] += -d * g; vx[i] += (Math.random() - 0.5) * a * 0.25; }
  }
  var px = null, pyy = null;
  function onMove(e) {
    var x = e.clientX, y = e.clientY;
    if (px !== null) {
      var dx = (x - px) * S, dy = (y - pyy) * S, R = 120 * S, cx = x * S, cy = y * S;
      var c0 = Math.max(0, Math.floor((cx - R) / B)), c1 = Math.min(cols - 1, Math.floor((cx + R) / B));
      var r0 = Math.max(0, Math.floor((cy - R) / B)), r1 = Math.min(rows - 1, Math.floor((cy + R) / B));
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
        var ddx = (c + 0.5) * B - cx, ddy = (r + 0.5) * B - cy, dd = Math.sqrt(ddx * ddx + ddy * ddy) / R;
        if (dd >= 1) continue; var w = (1 - dd) * (1 - dd) * 0.6, i = r * cols + c;
        vx[i] += dx * w; vy[i] += dy * w;
      }
      wake();
    }
    px = x; pyy = y;
  }
  function onLeave() { px = pyy = null; }
  function shock(x, y, k) { waves.push({ x: x * S, y: y * S, t: 0, k: k || 1 }); wake(); }
  var down = null;                                  // a tap, not the start of a scroll
  function onDown(e) { down = { x: e.clientX, y: e.clientY, t: performance.now() }; px = e.clientX; pyy = e.clientY; }
  function onUp(e) {
    if (down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) < 14 && performance.now() - down.t < 450) shock(e.clientX, e.clientY, 1);
    down = null; if (e.pointerType !== "mouse") onLeave();
  }
  function applyWaves(dt) {
    for (var n = waves.length - 1; n >= 0; n--) {
      var wv = waves[n], life = 0.35 + 0.2 * wv.k; wv.t += dt;
      if (wv.t > life) { waves.splice(n, 1); continue; }
      var R = (500 + 400 * wv.k) * S * wv.t, band = B * (2 + wv.k), amp = B * 0.35 * wv.k * (1 - wv.t / life);
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var ddx = (c + 0.5) * B - wv.x, ddy = (r + 0.5) * B - wv.y, d = Math.sqrt(ddx * ddx + ddy * ddy) || 1, e = (d - R) / band;
        if (e < -2.5 || e > 2.5) continue; var w = Math.exp(-e * e) * amp, i = r * cols + c;
        vx[i] += ddx / d * w; vy[i] += ddy / d * w;
      }
    }
  }

  // ---------- keyframe cycling ----------
  function nextFrame() {
    var to = (cur + 1) % COUNT;
    loadFrame(to).then(function (img) {
      if (!img) return;
      setKey("kb", keyframe(img)); cur = to; reorder();
      if (gl) { gl.bindTexture(gl.TEXTURE_2D, P.ord); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RED, gl.FLOAT, ord); }
      swap = { t0: performance.now(), p: 0 }; lastSwap = swap.t0; wake();
      loadFrame((to + 1) % COUNT);                        // preload the one after
    });
  }

  // ---------- the loop ----------
  function loop(now) {
    raf = 0; if (!running) return;
    if (last && now - last < 1000 / 62) { raf = requestAnimationFrame(loop); return; }   // cap at 60 fps
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
    applyScroll(); applyWaves(dt); clampAll();
    var s0 = 0, s1 = 0;
    if (swap) {
      var p = Math.min(1, (now - swap.t0) / SWAP_MS); s0 = swap.p; s1 = p === 1 ? 1.01 : p; swap.p = s1;
    }
    var k = Math.pow(KEEP, dt * 60), mx = 0;
    step(s0, s1, gl ? HEAL : 0.04);
    for (var i = 0; i < vx.length; i++) { vx[i] *= k; vy[i] *= k; var a = Math.abs(vx[i]) + Math.abs(vy[i]); if (a > mx) mx = a; if (a < 0.02) vx[i] = vy[i] = 0; }
    if (swap && swap.p > 1) { swapDone(); if (!gl) keyA.getContext("2d").drawImage(keyB, 0, 0); swap = null; }
    if (mx < 0.05 && !waves.length && !swap) calm++; else calm = 0;
    if (calm > (gl && P.half ? 330 : 120)) {          // healed: snap exactly onto the keyframe and stop
      step(0, 0, 1); running = false; return;
    }
    raf = requestAnimationFrame(loop);
  }

  // ---------- twinkle: a few blinking stars on top, never smeared ----------
  var tws = [], twt = 0;
  function twinkleInit() {
    tws = []; var n = Math.round(cssW * cssH / 9000);
    for (var i = 0; i < n; i++) tws.push({ x: Math.random() * cssW, y: Math.random() * cssH, s: Math.random() < 0.15 ? 2 : 1, p: Math.random(), f: 0.4 + Math.random() * 1.4, c: Math.random() < 0.3 ? "#b4b4ff" : "#ffffff" });
    tw.width = Math.ceil(cssW * dpr); tw.height = Math.ceil(cssH * dpr);
  }
  function twinkle() {
    if (document.hidden) return;
    var x = tw.getContext("2d"), t = performance.now() / 1000;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, cssW, cssH);
    for (var i = 0; i < tws.length; i++) {
      var s = tws[i], on = ((t * s.f + s.p) % 1) < 0.5; if (!on) continue;
      x.fillStyle = s.c; x.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
      if (s.s === 2) { x.globalAlpha = 0.5; x.fillRect(Math.round(s.x) - 2, Math.round(s.y) + 0.5, 6, 1); x.fillRect(Math.round(s.x) + 0.5, Math.round(s.y) - 2, 1, 6); x.globalAlpha = 1; }
    }
  }

  // ---------- start ----------
  function start() {
    document.body.insertBefore(tw, document.body.firstChild);
    document.body.insertBefore(cv, document.body.firstChild);
    size(); MAXV = B * 1.4;
    var ok = MODE !== "2d" && glInit();
    if (ok) { step = glStep; swapDone = glSwapDone; setKey = glKey; }
    else if (c2Init()) { step = c2Step; swapDone = c2SwapDone; setKey = c2Key; }
    else { cv.remove(); tw.remove(); return; }
    twinkleInit(); twinkle(); setInterval(twinkle, 150);
    cur = Math.floor(Math.random() * COUNT) - 1; if (cur < 0) cur = COUNT - 1;
    var first = function () {
      var to = (cur + 1) % COUNT;
      loadFrame(to).then(function (img) {
        cur = to; var kc = keyframe(img);
        setKey("ka", kc); setKey("kb", kc);
        if (gl) { // seed the picture with the keyframe
          gl.bindFramebuffer(gl.FRAMEBUFFER, P.fa); gl.viewport(0, 0, W, H);
          gl.useProgram(P.show.p); bindT(0, P.ka, P.show.u.uPic); gl.uniform2f(P.show.u.uRes, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null); step(0, 0, 1);
        } else { ctx2.drawImage(kc, 0, 0); }
        loadFrame((to + 1) % COUNT);
      });
    };
    if (starImg.complete) first(); else { starImg.onload = first; starImg.onerror = first; }

    var o = { passive: true };
    addEventListener("scroll", onScroll, o);
    addEventListener("pointermove", onMove, o);
    addEventListener("pointerdown", onDown, o);
    addEventListener("pointerup", onUp, o);
    addEventListener("pointercancel", function () { down = null; onLeave(); }, o);
    document.addEventListener("pointerleave", onLeave, o);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; running = false; }
      else { lastInput = performance.now(); calm = 0; running = true; last = 0; raf = requestAnimationFrame(loop); }
    });
    var lw = innerWidth;
    addEventListener("resize", function () {
      if (Math.abs(innerWidth - lw) < 2) return; lw = innerWidth;   // ignore URL-bar height changes
      clearTimeout(start.rt); start.rt = setTimeout(function () {
        size(); MAXV = B * 1.4; if (gl) glAlloc(); else c2Alloc(); twinkleInit();
        loadFrame(cur).then(function (img) { var kc = keyframe(img); setKey("ka", kc); setKey("kb", kc); if (gl) { gl.bindFramebuffer(gl.FRAMEBUFFER, P.fa); gl.viewport(0, 0, W, H); gl.useProgram(P.show.p); bindT(0, P.ka, P.show.u.uPic); gl.uniform2f(P.show.u.uRes, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); step(0, 0, 1); } else ctx2.drawImage(kc, 0, 0); });
      }, 200);
    }, o);
    if (gl) glc.addEventListener("webglcontextlost", function (e) { e.preventDefault(); running = false; cv.remove(); }, false);
    lastInput = lastSwap = performance.now();
    setInterval(function () {
      var n = performance.now();
      if (!document.hidden && n - lastInput > IDLE_MS && n - lastSwap > IDLE_MS && !swap) nextFrame();
    }, 1000);
    window.GateMosh.shock = shock;
    window.GateMosh.state = function () { return { mode: gl ? (MODE === "read" ? "webgl2-readback" : P.half ? "webgl2-f16" : "webgl2-8bit") : "2d", W: W, H: H, block: B, running: running, frame: cur + 1 }; };
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
