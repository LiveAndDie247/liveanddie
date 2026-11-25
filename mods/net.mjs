// multiplayer with no server: Trystero (vendored) joins visitors browser-to-browser over WebRTC.
//   who   - who else is here      talk - text chat      party - ascii-only cam room (max 4)      jam - shared drum pattern
// Safety: text only, rate limited, 200 chars, local word filter, /ignore. Remote text is never parsed as markup.
// party sends ONLY a small grid of character indexes - never video.
import { stage, fit, getCam, stopStream, sleep } from "./util.mjs";
import { hit, buzz } from "./drums.mjs";

const APP = { appId: "liveanddie.xyz/portal-v8", relayUrls: ["wss://tracker.webtorrent.dev", "wss://tracker.openwebtorrent.com", "wss://tracker.files.fm:7073/announce"], relayRedundancy: 3 };
const peers = new Map(), ignored = new Set();
let T = null, lobby = null;
function handleOf(id) { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return "visitor_" + (h & 0xffff).toString(16).padStart(4, "0"); }
async function lib() { if (!T) T = await import("/vendor/trystero/torrent.js"); return T; }
const rot13 = s => s.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 84) % 26 + 97));
// a short local list (stored rot13 so the words themselves are not sitting in the page source)
const BAD = "avttre avttn snttbg snt xvxr puvax fcvp ergneq genaal phag juber fyhg encr xvyy lbhefrys xlf".split(" ").map(rot13);
function clean(s) {
  s = String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, "").slice(0, 200);
  const low = s.toLowerCase().replace(/[0@]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/[4]/g, "a").replace(/[5$]/g, "s");
  let out = s; BAD.forEach(w => { let i = low.indexOf(w); while (i >= 0) { out = out.slice(0, i) + "*".repeat(w.length) + out.slice(i + w.length); i = low.indexOf(w, i + w.length); } });
  return out.replace(/https?:\/\/\S+/gi, "[link removed]");
}
function plain(SH, text, color) {                  // remote text: a text node, never markup; keeps the prompt last
  const d = document.createElement("div"); d.className = "ln"; d.textContent = text; if (color) d.style.color = color; SH.out.appendChild(d);
  if (SH.promptEl.style.display !== "none" && SH.promptEl.parentNode === SH.out) SH.out.appendChild(SH.promptEl);
  SH.scroll();
}
async function joinLobby(SH) {
  if (lobby) return lobby;
  const t = await lib();
  SH.line("net: this connects your browser directly to other visitors (peer to peer, no server, no account). only what you choose to send is shared. 'net off' disconnects.", "dim");
  const room = t.joinRoom(APP, "lobby");
  lobby = { room, me: handleOf(t.selfId), id: t.selfId, on: new Set() };
  const chat = room.makeAction("chat"); lobby.sendChat = chat[0];
  room.onPeerJoin(id => { peers.set(id, handleOf(id)); lobby.on.forEach(f => f("join", id)); });
  room.onPeerLeave(id => { lobby.on.forEach(f => f("leave", id)); peers.delete(id); });
  chat[1]((data, id) => lobby.on.forEach(f => f("chat", id, data)));
  return lobby;
}
const NOBODY = "no other signals detected.";
async function waitFor(cond, ms) { const t0 = Date.now(); while (!cond() && Date.now() - t0 < ms) await sleep(400); return cond(); }

export default function (SH) {
  SH.cmd("who w", () => {
    (async () => {
      const L = await joinLobby(SH); SH.line("you are " + L.me + ". scanning ...", "dim");
      await waitFor(() => peers.size > 0, 15000); if (peers.size) await sleep(1200);
      if (!peers.size) SH.line(NOBODY + " you are the only one here right now. (you stay visible to anyone who arrives.)");
      else { SH.line(peers.size + 1 + " signals:"); SH.line("  " + L.me + "  (you)", "blue"); peers.forEach(h => SH.line("  " + h + (ignored.has(h) ? "  (ignored)" : ""))); SH.line("{{talk|talk}} to chat  -  {{party|party}} for an ascii cam room  -  {{jam|jam}} to share a beat", "dim"); }
      SH.newPrompt();
    })().catch(() => { SH.line("who: could not reach the network.", "dim"); SH.newPrompt(); });
    return true;
  }, { help: "list other visitors online right now (peer to peer)", man: "who - lists other visitors connected right now, as random handles like visitor_4f2a. Browser to browser (WebRTC); there is no server." });

  SH.cmd("net", a => {
    if ((a[0] || "") === "off") { if (lobby) { try { lobby.room.leave(); } catch (e) {} lobby = null; peers.clear(); } SH.line("net: disconnected.", "dim"); return; }
    SH.line("net: " + (lobby ? "connected as " + lobby.me + ", " + peers.size + " other signal(s)" : "not connected") + ".  'who' connects, 'net off' disconnects.", "dim");
  }, { help: "network status / 'net off' to disconnect", usage: "net [off]" });

  SH.cmd("talk chat irc", () => {
    (async () => {
      const L = await joinLobby(SH), sent = [], seen = new Map();
      SH.line("** #live.and.die ** you are " + L.me + ". text only, 200 chars. /who  /ignore <handle>  /unignore <handle>  /quit", "blue");
      if (!peers.size) { SH.line("looking for others ...", "dim"); await waitFor(() => peers.size > 0, 12000); if (!peers.size) SH.line(NOBODY + " the room is open; anyone who types 'talk' will see you.", "dim"); else SH.line(peers.size + " other signal(s) here.", "dim"); }
      const on = (ev, id, data) => {
        const h = peers.get(id) || handleOf(id);
        if (ev === "join") plain(SH, "* " + h + " joined", "var(--dim)");
        else if (ev === "leave") plain(SH, "* " + h + " left", "var(--dim)");
        else if (ev === "chat") {
          if (ignored.has(h) || !data || typeof data.t !== "string") return;
          const now = Date.now(), q = (seen.get(id) || []).filter(x => now - x < 6000); q.push(now); seen.set(id, q); if (q.length > 6) return;   // flood guard
          plain(SH, "<" + h + "> " + clean(data.t), "var(--blue)");
        }
      };
      L.on.add(on);
      SH.read("<" + L.me + "> ", v => {
        v = v.trim(); if (!v) return true;
        if (v === "/quit" || v === "/q" || v === "/exit") { L.on.delete(on); SH.line("left #live.and.die. ('net off' to disconnect fully)", "dim"); return false; }
        if (v === "/who") { plain(SH, peers.size ? [...peers.values()].join("  ") : NOBODY, "var(--dim)"); return true; }
        const ig = v.match(/^\/(un)?ignore\s+(\S+)/); if (ig) { if (ig[1]) ignored.delete(ig[2]); else ignored.add(ig[2]); plain(SH, (ig[1] ? "unignored " : "ignoring ") + ig[2], "var(--dim)"); return true; }
        if (v[0] === "/") { plain(SH, "commands: /who /ignore <handle> /unignore <handle> /quit", "var(--dim)"); return true; }
        const now = Date.now(); while (sent.length && now - sent[0] > 30000) sent.shift();
        if ((sent.length && now - sent[sent.length - 1] < 1200) || sent.length >= 8) { plain(SH, "(slow down - rate limited)", "var(--dim)"); return true; }
        sent.push(now); const msg = clean(v);
        try { L.sendChat({ t: msg }); } catch (e) {}
        return true;
      });
    })().catch(() => { SH.line("talk: could not reach the network.", "dim"); SH.newPrompt(); });
    return true;
  }, { help: "live text chat with everyone on the site", man: "talk - an IRC-style room for everyone on the site right now. Text only, 200 characters, rate limited, with a local word filter. /who lists people, /ignore <handle> hides someone, /quit leaves." });

  // ---------------------------------------------------------------- party: ascii-only cam room
  const GW = 32, GH = 24, RAMP = " .:-=+*#%@";
  SH.cmd("party", () => {
    SH.line("party: an ascii cam room for up to 4. your camera is turned into characters ON THIS DEVICE and only that grid of " + GW + "x" + GH + " characters is sent to the others, peer to peer. no video or photo ever leaves your phone. tap a tile to mute someone; [ x ] leaves.");
    SH.line("join?  (y / n)", "blue");
    SH.read("party? ", v => {
      if (!/^y/i.test(v.trim())) { SH.line("ok. nothing was started. ({{cam|cam}} is the solo version.)", "dim"); return false; }
      setTimeout(() => startParty().catch(() => { SH.line("party: could not start.", "dim"); SH.newPrompt(); }), 0);
      return false;
    });
    return true;
  }, { help: "opt-in ascii cam room for up to 4 (only characters are sent)", man: "party - an opt-in room where up to 4 visitors see each other as ascii. Only a 32x24 grid of characters is ever sent - never video - so nobody's real picture leaves their phone. Tap a tile to mute that person. [ x ] leaves." });

  async function startParty() {
    SH.promptEl.style.display = "none";
    const stream = await getCam(SH, "turns you into the character grid for the party room.", { video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } }, audio: false });
    if (!stream) { SH.newPrompt(); return; }
    const t = await lib(), room = t.joinRoom(APP, "party"), me = t.selfId;
    const grids = new Map(), muted = new Set(), [send, recv] = room.makeAction("grid");
    recv((data, id) => { const u = data instanceof Uint8Array ? data : (data && data.byteLength ? new Uint8Array(data) : null); if (!u || u.length !== GW * GH) return; if (grids.size >= 3 && !grids.has(id)) return; grids.set(id, { g: u, at: performance.now() }); });
    room.onPeerLeave(id => grids.delete(id));
    await waitFor(() => Object.keys(room.getPeers()).length > 0, 7000); await sleep(800);
    if (Object.keys(room.getPeers()).length >= 4) { room.leave(); stopStream(stream); SH.line("party: the room is full (4/4). try again in a bit, or run {{cam|cam}} solo.", "dim"); SH.newPrompt(); return; }
    const v = document.createElement("video"); v.srcObject = stream; v.muted = true; v.playsInline = true; try { await v.play(); } catch (e) {}
    const S = stage(SH, { title: "party", bye: "left the party. camera off." });
    const cv = document.createElement("canvas"), cx = cv.getContext("2d"); fit(cv, S.host); cv.style.imageRendering = "auto";
    const sm = document.createElement("canvas"); sm.width = GW; sm.height = GH; const sx = sm.getContext("2d", { willReadFrequently: true });
    const mine = new Uint8Array(GW * GH); let raf = 0, last = 0, tiles = [];
    S.onClose(() => { cancelAnimationFrame(raf); try { room.leave(); } catch (e) {} stopStream(stream); });
    cv.style.pointerEvents = "auto";
    cv.addEventListener("click", e => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height; const tl = tiles.find(q => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h); if (tl && tl.id !== me) { muted.has(tl.id) ? muted.delete(tl.id) : muted.add(tl.id); } });
    function loop(tm) {
      raf = requestAnimationFrame(loop);
      if (tm - last < 125) return; last = tm;                       // 8 fps
      if (v.readyState >= 2) {
        const vw = v.videoWidth || 4, vh = v.videoHeight || 3, k = Math.max(GW / vw, GH / vh);
        sx.save(); sx.translate(GW, 0); sx.scale(-1, 1); sx.drawImage(v, (GW - vw * k) / 2, (GH - vh * k) / 2, vw * k, vh * k); sx.restore();
        const d = sx.getImageData(0, 0, GW, GH).data;
        for (let i = 0, j = 0; j < mine.length; i += 4, j++) { let l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; l = Math.max(0, Math.min(1, (l - 0.5) * 1.5 + 0.5)); mine[j] = Math.round(l * 9); }
        try { send(mine); } catch (e) {}
      }
      const z = S.size(); if (cv.width !== z.w || cv.height !== z.h) { cv.width = z.w; cv.height = z.h; cv.style.width = z.w + "px"; cv.style.height = z.h + "px"; }
      const ids = [me, ...[...grids.keys()].filter(id => performance.now() - grids.get(id).at < 4000).sort()].slice(0, 4);
      const n = ids.length, colsT = n > 1 ? 2 : 1, rowsT = n > 2 ? 2 : 1, tw = cv.width / colsT, th = cv.height / rowsT;
      const cell = Math.max(5, Math.floor(Math.min(tw / GW, th / GH)));
      cx.fillStyle = "#000"; cx.fillRect(0, 0, cv.width, cv.height); cx.font = cell * 1.6 + "px 'Web437 VGA',monospace"; cx.textBaseline = "top"; tiles = [];
      ids.forEach((id, i) => {
        const ox = (i % colsT) * tw + (tw - GW * cell) / 2, oy = Math.floor(i / colsT) * th + (th - GH * cell) / 2 + 8, g = id === me ? mine : grids.get(id).g;
        tiles.push({ id, x: (i % colsT) * tw, y: Math.floor(i / colsT) * th, w: tw, h: th });
        cx.fillStyle = i % 2 ? "#4070ff" : "#ff3030";
        cx.fillText((id === me ? "you" : handleOf(id)) + (muted.has(id) ? " (muted)" : ""), ox, oy - 14 < 0 ? 0 : oy - 14);
        if (muted.has(id)) return;
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const c = RAMP[Math.min(9, g[y * GW + x])]; if (c !== " ") cx.fillText(c, ox + x * cell, oy + y * cell); }
      });
      S.hud.textContent = "party " + n + "/4  -  only characters are sent, never video" + (n === 1 ? "  -  " + NOBODY + " waiting ..." : "");
    }
    raf = requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- jam: one shared 16-step pattern
  SH.cmd("jam", () => {
    (async () => {
      let AC = null; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
      if (!AC) { SH.line("jam: this browser has no web audio.", "dim"); SH.newPrompt(); return; }
      const t = await lib();
      SH.line("jam: one drum pattern shared live with everyone who runs 'jam' (peer to peer). each person edits their own row.", "dim");
      const room = t.joinRoom(APP, "jam"), me = t.selfId, rows = [0x1111, 0x1010, 0x4444, 0], others = new Set();
      const [sendRow, recvRow] = room.makeAction("row");
      recvRow(d => { if (!d || typeof d.r !== "number" || typeof d.b !== "number") return; const r = d.r | 0; if (r < 0 || r > 3) return; rows[r] = d.b & 0xffff; });
      room.onPeerJoin(id => { others.add(id); try { sendRow({ r: myRow(), b: rows[myRow()] }, id); } catch (e) {} });
      room.onPeerLeave(id => others.delete(id));
      const myRow = () => [me, ...others].sort().indexOf(me) % 4;
      await waitFor(() => others.size > 0, 9000);
      if (!others.size) SH.line(NOBODY + " opening the solo version - anyone who runs 'jam' joins this loop. ({{beat|beat}} is the offline sequencer.)", "dim");
      const NAMES = ["KCK", "SNR", "HAT", "CLP"], BPM = 110, STEP = 60000 / BPM / 4;
      const S = stage(SH, { title: "jam", bye: "left the jam." });
      const pre = document.createElement("div"); pre.style.cssText = "padding:10px 8px;white-space:pre;line-height:1.5;font:16px/1.5 'Web437 VGA',monospace"; S.host.appendChild(pre);
      let raf = 0, lastStep = -1, on = true;
      S.onClose(() => { cancelAnimationFrame(raf); try { room.leave(); } catch (e) {} try { AC.close(); } catch (e) {} });
      S.btn("[ mute ]", b => { on = !on; b.textContent = on ? "[ mute ]" : "[ unmute ]"; });
      S.btn("[ clear my row ]", () => { const r = myRow(); rows[r] = 0; try { sendRow({ r, b: 0 }); } catch (e) {} });
      pre.addEventListener("click", e => { const c = e.target.closest("[data-s]"); if (!c) return; const r = +c.dataset.r, s = +c.dataset.s; if (r !== myRow()) return; rows[r] ^= (1 << s); try { sendRow({ r, b: rows[r] }); } catch (e) {} draw(lastStep); if (AC.state === "suspended") AC.resume(); });
      function draw(step) {
        const mr = myRow(); let h = "";
        for (let r = 0; r < 4; r++) { h += '<span style="color:' + (r === mr ? "var(--blue)" : "var(--dim)") + '">' + NAMES[r] + (r === mr ? "►" : " ") + "</span>"; for (let s = 0; s < 16; s++) { const lit = rows[r] >> s & 1, cur = s === step; h += '<span data-r="' + r + '" data-s="' + s + '" style="cursor:pointer;color:' + (cur ? "#fff" : lit ? (r === mr ? "var(--blue)" : "var(--red)") : "var(--dim)") + '">' + (lit ? "▓▓" : s % 4 === 0 ? "::" : "..") + "</span>"; } h += "\n"; }
        pre.innerHTML = h + '\n<span style="color:var(--dim)">your row is the blue one. tap its cells.\n' + (others.size ? others.size + 1 + " people in the jam." : NOBODY + " (solo)") + "\nfull drum kits soon.</span>";
      }
      function loop() {
        raf = requestAnimationFrame(loop);
        const step = Math.floor(Date.now() / STEP) % 16;           // wall clock = the same step on every phone
        if (step === lastStep) return; lastStep = step;
        if (on && AC.state === "running") { const tt = AC.currentTime + 0.02; for (let r = 0; r < 4; r++) if (rows[r] >> step & 1) { hit(AC, r, tt); if (r === 0) buzz(18); } }
        draw(step); S.hud.textContent = "jam  " + BPM + " bpm  " + (others.size + 1) + " online" + (AC.state !== "running" ? "  (tap a cell to start sound)" : "");
      }
      draw(-1); raf = requestAnimationFrame(loop);
    })().catch(() => { SH.line("jam: could not reach the network.", "dim"); SH.newPrompt(); });
    return true;
  }, { help: "everyone shares one live drum pattern", man: "jam - a 16-step drum pattern shared live between everyone in the room. Each person edits their own row; all phones play the same loop, locked to the clock. If nobody is around it runs solo." });
}
