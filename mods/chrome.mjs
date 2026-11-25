// ambient browser tricks: an ascii marquee in the tab title, a blinking-cursor favicon, and (desktop) windows that
// find each other over BroadcastChannel and share one scene in screen space - the logo flies from window to window
// and follows whichever window you drag. Tiny, loaded after the shell is up. Nothing leaves the browser.
export default function (SH) {
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // ---- tab title marquee
  const BASE = "live.and.die portal ░▒▓ type help ▓▒░ "; let ti = 0;
  if (!reduce) setInterval(() => { ti = (ti + 1) % BASE.length; document.title = BASE.slice(ti) + BASE.slice(0, ti); }, 420);
  // ---- favicon: a prompt with a blinking block cursor
  const fc = document.createElement("canvas"); fc.width = fc.height = 32; const fx = fc.getContext("2d"); let link = document.querySelector('link[rel="icon"]'), on = true;
  function fav() { fx.fillStyle = "#000"; fx.fillRect(0, 0, 32, 32); fx.fillStyle = "#ff3030"; fx.font = "bold 26px monospace"; fx.textBaseline = "top"; fx.fillText(">", 1, 1); if (on) { fx.fillStyle = "#4070ff"; fx.fillRect(17, 6, 12, 22); } try { if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); } link.type = "image/png"; link.href = fc.toDataURL("image/png"); } catch (e) {} on = !on; }
  fav(); if (!reduce) setInterval(fav, 600);

  // ---- windows that find each other
  if (!("BroadcastChannel" in window) || reduce || window.top !== window) return;
  const bc = new BroadcastChannel("lad-windows"), me = Math.random().toString(36).slice(2, 8), wins = new Map();
  const LOGO = ["live.and.die"], TRAIL = "live.and.die//portal//".split("");
  let lastMove = 0, last = { x: 0, y: 0 }, cv = null, cx = null, scene = null, sim = null, simT = 0, swapT = 0, toggle = 0;
  const rect = () => { const b = Math.max(0, (outerWidth - innerWidth) / 2), top = Math.max(0, outerHeight - innerHeight - b); return { x: screenX + b, y: screenY + top, w: innerWidth, h: innerHeight }; };
  function ensureCanvas() { if (cv) return; cv = document.createElement("canvas"); cv.setAttribute("aria-hidden", "true"); cv.style.cssText = "position:fixed;inset:0;z-index:20;pointer-events:none"; document.body.appendChild(cv); cx = cv.getContext("2d"); }
  function dropCanvas() { if (cv) { cv.remove(); cv = null; cx = null; } scene = null; clearInterval(simT); simT = 0; sim = null; }
  function draw() {
    if (!cv || !scene) return; const r = rect(); if (cv.width !== r.w || cv.height !== r.h) { cv.width = r.w; cv.height = r.h; }
    cx.clearRect(0, 0, cv.width, cv.height); cx.font = "16px 'Web437 VGA',monospace"; cx.textBaseline = "middle"; cx.textAlign = "center";
    cx.fillStyle = "#4070ff"; scene.tr.forEach((p, i) => { cx.globalAlpha = 1 - i / scene.tr.length; cx.fillText(TRAIL[i % TRAIL.length], p[0] - r.x, p[1] - r.y); });
    cx.globalAlpha = 1; cx.fillStyle = "#ff3030"; cx.font = "32px 'Web437 VGA',monospace"; cx.fillText(LOGO[0], scene.x - r.x, scene.y - r.y);
  }
  function step() {                                         // only the leader (lowest id) simulates; everyone draws
    const all = [[me, { r: rect(), mv: lastMove }], ...wins]; let tgt = null, best = 0, now = Date.now();
    all.forEach(([, w]) => { if (w.mv > best && now - w.mv < 4000) { best = w.mv; tgt = w.r; } });
    if (!tgt) { if (now - swapT > 5000) { swapT = now; toggle++; } tgt = all[toggle % all.length][1].r; }
    const tx = tgt.x + tgt.w / 2, ty = tgt.y + tgt.h / 2;
    if (!sim) sim = { x: tx, y: ty, tr: [] };
    sim.x += (tx - sim.x) * 0.045; sim.y += (ty - sim.y) * 0.045 + Math.sin(now / 400) * 0.8;
    sim.tr.unshift([sim.x - 60 + Math.sin(now / 230) * 18, sim.y + 34 + Math.cos(now / 310) * 10]); if (sim.tr.length > 26) sim.tr.pop();
    scene = { x: sim.x, y: sim.y, tr: sim.tr.map(p => [Math.round(p[0]), Math.round(p[1])]) };
    bc.postMessage({ t: "scene", s: scene }); draw();
  }
  bc.onmessage = e => { const d = e.data || {}; if (d.t === "hi" && d.id !== me) wins.set(d.id, { r: d.r, mv: d.mv, at: Date.now() }); else if (d.t === "scene" && !simT) { scene = d.s; draw(); } else if (d.t === "bye") wins.delete(d.id); };
  setInterval(() => {
    const r = rect(); if (r.x !== last.x || r.y !== last.y) { lastMove = Date.now(); last = r; }
    bc.postMessage({ t: "hi", id: me, r, mv: lastMove }); const now = Date.now(); wins.forEach((w, id) => { if (now - w.at > 2000) wins.delete(id); });
    if (!wins.size) { dropCanvas(); return; }
    ensureCanvas(); const leader = [me, ...wins.keys()].sort()[0] === me;
    if (leader && !simT) simT = setInterval(step, 33); else if (!leader && simT) { clearInterval(simT); simT = 0; sim = null; }
  }, 250);
  addEventListener("pagehide", () => { try { bc.postMessage({ t: "bye", id: me }); } catch (e) {} });
}
