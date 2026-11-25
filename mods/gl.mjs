// GPU ascii renderer: any video/canvas/image source -> characters from a glyph atlas of the bitmap font.
// WebGL2 fragment shader, one texture fetch per cell; falls back to a 2D-canvas renderer with the same API.
//   const r = await createAscii({ chars, text, mirror }); r.resize(wCss, hCss); r.draw(source, sw, sh); r.canvas
export const RAMP = " .:-=+*#%@";
const CW = 8, CH = 16;
let fontReady = null;
function ensureFont() {
  if (!fontReady) fontReady = (document.fonts && document.fonts.load ? document.fonts.load("16px 'Web437 VGA'") : Promise.resolve()).catch(() => {});
  return fontReady;
}
export function makeAtlas(chars) {
  const c = document.createElement("canvas"); c.width = chars.length * CW; c.height = CH;
  const x = c.getContext("2d", { willReadFrequently: true }); x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height);   // software canvas: uploads reliably everywhere
  x.fillStyle = "#fff"; x.font = "16px 'Web437 VGA',monospace"; x.textBaseline = "top";
  for (let i = 0; i < chars.length; i++) x.fillText(chars[i], i * CW, 0);
  return c;
}
function cssColor(name, fb) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
  const m = /^#?([0-9a-f]{6})$/i.exec(v); const h = m ? m[1] : fb.slice(1);
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
export function crop(sw, sh, cw, ch) {                       // cover-fit: returns [sx, sy, ox, oy] in uv space
  const sa = sw / sh, ca = cw / ch;
  if (sa > ca) { const k = ca / sa; return [k, 1, (1 - k) / 2, 0]; }
  const k = sa / ca; return [1, k, 0, (1 - k) / 2];
}

const VS = `#version 300 es
in vec2 p; out vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#version 300 es
precision mediump float;
uniform sampler2D uSrc, uAtlas;
uniform vec2 uGrid; uniform vec4 uCrop; uniform vec3 uA, uB;
uniform float uN, uText, uMirror, uContrast, uGlitch, uSwap, uTime, uGain, uInvert;
in vec2 v; out vec4 o;
float rnd(vec2 q){ return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vec2(v.x, 1.0 - v.y);
  vec2 cell = floor(uv * uGrid);
  float tk = floor(uTime * 14.0);
  float hit = step(1.0 - uGlitch * 0.6, rnd(vec2(cell.y, tk)));
  cell.x = mod(cell.x + hit * floor(rnd(vec2(cell.y + 3.0, tk)) * 16.0 - 8.0), uGrid.x);
  vec2 s = (cell + 0.5) / uGrid;
  if (uMirror > 0.5) s.x = 1.0 - s.x;
  s = s * uCrop.xy + uCrop.zw;
  vec3 c = texture(uSrc, s).rgb;
  if (uInvert > 0.5) c = 1.0 - c;
  float l = dot(c, vec3(0.299, 0.587, 0.114)) * uGain;
  l = clamp((l - 0.5) * uContrast + 0.5, 0.0, 1.0);
  vec2 f = fract(uv * uGrid);
  float a;
  if (uText > 0.5) {
    float idx = mod(cell.x + cell.y * uGrid.x, uN);
    a = texture(uAtlas, vec2((idx + f.x) / uN, f.y)).r * smoothstep(0.10, 0.55, l);
  } else {
    float idx = floor(l * (uN - 1.0) + 0.5);
    a = texture(uAtlas, vec2((idx + f.x) / uN, f.y)).r;
  }
  bool red = c.r >= c.b;
  if (uSwap > 0.5) red = !red;
  if (uGlitch > 0.0 && rnd(cell + tk) < uGlitch * 0.08) { a = 1.0; red = !red; }
  o = vec4((red ? uA : uB) * a, 1.0);
}`;

function glRenderer(canvas, gl, st) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader"); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error("link");
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ["uSrc", "uAtlas", "uGrid", "uCrop", "uA", "uB", "uN", "uText", "uMirror", "uContrast", "uGlitch", "uSwap", "uTime", "uGain", "uInvert"].forEach(n => U[n] = gl.getUniformLocation(pr, n));
  const tex = (unit, filter) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  const tSrc = tex(0, gl.LINEAR), tAtlas = tex(1, gl.NEAREST);
  let lost = false;
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); lost = true; });
  function setChars(chars, text) {
    st.chars = Array.from(chars); st.text = !!text;
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tAtlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeAtlas(st.chars));
  }
  setChars(st.chars, st.text);
  const api = {
    canvas, gpu: true, st, setChars,
    get lost() { return lost; },
    resize(w, h) {
      st.cols = Math.max(8, Math.floor(w / CW)); st.rows = Math.max(4, Math.floor(h / CH));
      const S = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
      canvas.width = st.cols * CW * S; canvas.height = st.rows * CH * S;
      canvas.style.width = st.cols * CW + "px"; canvas.style.height = st.rows * CH + "px";
      gl.viewport(0, 0, canvas.width, canvas.height);
      st.A = cssColor("--red", "#ff3030"); st.B = cssColor("--blue", "#4070ff");
    },
    draw(src, sw, shh) {
      if (lost) return false;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tSrc);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) { return false; }
      gl.uniform1i(U.uSrc, 0); gl.uniform1i(U.uAtlas, 1);
      gl.uniform2f(U.uGrid, st.cols, st.rows);
      const c = st.nocrop ? [1, 1, 0, 0] : crop(sw || src.videoWidth || src.width, shh || src.videoHeight || src.height, st.cols * CW, st.rows * CH);
      gl.uniform4f(U.uCrop, c[0], c[1], c[2], c[3]);
      gl.uniform3fv(U.uA, st.A); gl.uniform3fv(U.uB, st.B);
      gl.uniform1f(U.uN, st.chars.length); gl.uniform1f(U.uText, st.text ? 1 : 0); gl.uniform1f(U.uMirror, st.mirror ? 1 : 0);
      gl.uniform1f(U.uContrast, st.contrast); gl.uniform1f(U.uGlitch, st.glitch); gl.uniform1f(U.uSwap, st.swap ? 1 : 0);
      gl.uniform1f(U.uTime, performance.now() / 1000 % 1000); gl.uniform1f(U.uGain, st.gain); gl.uniform1f(U.uInvert, st.invert ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    },
    destroy() { try { const e = gl.getExtension("WEBGL_lose_context"); if (e) e.loseContext(); } catch (e) {} }
  };
  return api;
}

// same API on a 2D canvas (used when WebGL2 is missing or its context is lost)
function cpuRenderer(canvas, st) {
  const cx = canvas.getContext("2d"), small = document.createElement("canvas"), sx = small.getContext("2d", { willReadFrequently: true });
  let hexA = "#ff3030", hexB = "#4070ff";
  const api = {
    canvas, gpu: false, st, lost: false,
    setChars(chars, text) { st.chars = Array.from(chars); st.text = !!text; },
    resize(w, h) {
      st.cols = Math.max(8, Math.floor(w / CW)); st.rows = Math.max(4, Math.floor(h / CH));
      canvas.width = st.cols * CW; canvas.height = st.rows * CH; canvas.style.width = canvas.width + "px"; canvas.style.height = canvas.height + "px";
      small.width = st.cols; small.height = st.rows;
      const g = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      hexA = g("--red") || hexA; hexB = g("--blue") || hexB;
    },
    draw(src, sw, shh) {
      sw = sw || src.videoWidth || src.width; shh = shh || src.videoHeight || src.height; if (!sw || !shh) return false;
      const c = st.nocrop ? [1, 1, 0, 0] : crop(sw, shh, st.cols * CW, st.rows * CH);
      sx.save(); if (st.mirror) { sx.translate(st.cols, 0); sx.scale(-1, 1); }
      try { sx.drawImage(src, c[2] * sw, c[3] * shh, c[0] * sw, c[1] * shh, 0, 0, st.cols, st.rows); } catch (e) { sx.restore(); return false; }
      sx.restore();
      let d; try { d = sx.getImageData(0, 0, st.cols, st.rows).data; } catch (e) { return false; }
      cx.fillStyle = "#000"; cx.fillRect(0, 0, canvas.width, canvas.height);
      cx.font = "16px 'Web437 VGA',monospace"; cx.textBaseline = "top";
      const N = st.chars.length;
      for (let pass = 0; pass < 2; pass++) {
        cx.fillStyle = pass ? hexB : hexA;
        for (let y = 0; y < st.rows; y++) for (let x = 0; x < st.cols; x++) {
          const i = (y * st.cols + x) * 4; let r = d[i], g = d[i + 1], b = d[i + 2];
          if (st.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
          let red = r >= b; if (st.swap) red = !red; if ((red ? 0 : 1) !== pass) continue;
          let l = (0.299 * r + 0.587 * g + 0.114 * b) / 255 * st.gain; l = Math.max(0, Math.min(1, (l - 0.5) * st.contrast + 0.5));
          let ch;
          if (st.text) { if (l < 0.16) continue; ch = st.chars[(x + y * st.cols) % N]; cx.globalAlpha = l < 0.4 ? 0.35 : l < 0.65 ? 0.65 : 1; }
          else { ch = st.chars[Math.round(l * (N - 1))]; if (ch === " ") continue; }
          cx.fillText(ch, x * CW, y * CH);
        }
      }
      cx.globalAlpha = 1;
      return true;
    },
    destroy() {}
  };
  return api;
}

export async function createAscii(opts = {}) {
  await ensureFont();
  const st = { cols: 40, rows: 30, chars: Array.from(opts.chars || RAMP), text: !!opts.text, mirror: !!opts.mirror, glitch: 0, swap: false, invert: false, contrast: 1.4, gain: 1, nocrop: false, A: [1, .19, .19], B: [.25, .44, 1] };
  if (!opts.forceCanvas) {
    const canvas = document.createElement("canvas");
    let gl = null; try { gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" }); } catch (e) {}
    if (gl) { try { return glRenderer(canvas, gl, st); } catch (e) { /* fall through to canvas */ } }
  }
  return cpuRenderer(document.createElement("canvas"), st);
}
