// signal / decode / stego / unlock. Answers are only ever compared as SHA-256 hashes; the next clue and the
// reward are AES-GCM ciphertext that the right answer decrypts. Nothing here can be read out of the source.
const SALT = "lad-arg-v1|", norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, ""), enc = new TextEncoder(), dec = new TextDecoder();
const hex = b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");
const sha = async (i, a) => hex(await crypto.subtle.digest("SHA-256", enc.encode(SALT + i + "|" + norm(a))));
async function unseal(i, answer, b64) {
  try {
    const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), base = await crypto.subtle.importKey("raw", enc.encode(norm(answer)), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: enc.encode(SALT + i), iterations: 60000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12))));
  } catch (e) { return null; }
}
let CFG = null; const cfg = async () => CFG || (CFG = await (await fetch("/arg.json")).json());
const load = () => { try { const s = JSON.parse(localStorage.getItem("lad_sig") || "{}"); return { n: s.n | 0, h: Array.isArray(s.h) ? s.h : [] }; } catch (e) { return { n: 0, h: [] }; } };
const save = s => { try { localStorage.setItem("lad_sig", JSON.stringify(s)); } catch (e) {} };
const printable = s => s.length > 0 && /^[\x09\x0a\x0d\x20-\x7e -￿]*$/.test(s) && (s.match(/[\x20-\x7e]/g) || []).length / s.length > 0.85;

function decodeAny(text, how) {
  const t = text.trim(), out = [];
  const tryB64 = () => { try { const s = decodeURIComponent(escape(atob(t.replace(/\s+/g, "")))); return printable(s) ? s : null; } catch (e) { return null; } };
  const tryHex = () => { const h = t.replace(/0x|[\s:,]/gi, ""); if (!/^[0-9a-f]+$/i.test(h) || h.length % 2) return null; const s = h.match(/../g).map(x => String.fromCharCode(parseInt(x, 16))).join(""); return printable(s) ? s : null; };
  const tryBin = () => { const b = t.replace(/\s+/g, ""); if (!/^[01]+$/.test(b) || b.length % 8) return null; const s = b.match(/.{8}/g).map(x => String.fromCharCode(parseInt(x, 2))).join(""); return printable(s) ? s : null; };
  const rot = () => t.replace(/[a-z]/gi, c => String.fromCharCode((c.charCodeAt(0) - (c < "a" ? 65 : 97) + 13) % 26 + (c < "a" ? 65 : 97)));
  const all = { binary: tryBin, hex: tryHex, base64: tryB64, rot13: rot };
  if (how && all[how]) { const r = all[how](); return r == null ? [] : [[how, r]]; }
  for (const k of ["binary", "hex", "base64"]) { const r = all[k](); if (r != null) out.push([k, r]); }
  if (!out.length) out.push(["rot13", rot()]);
  return out;
}

export default function (SH) {
  const fail = name => () => { SH.line(name + ": unavailable right now.", "dim"); SH.newPrompt(); };

  SH.cmd("decode", a => {
    let how = null; const m = (a[0] || "").match(/^--(base64|b64|hex|rot13|binary|bin)$/); if (m) { how = { b64: "base64", bin: "binary" }[m[1]] || m[1]; a = a.slice(1); }
    const text = a.join(" "); if (!text) { SH.line("usage: decode [--base64|--hex|--rot13|--binary] <text>", "dim"); return; }
    const r = decodeAny(text, how); if (!r.length) { SH.line("decode: that is not valid " + how + ".", "dim"); return; }
    r.forEach(x => { const d = document.createElement("div"); d.className = "ln"; d.textContent = x[0] + ": " + x[1]; SH.out.appendChild(d); });
  }, { help: "decode base64 / hex / rot13 / binary text", usage: "decode [--base64|--hex|--rot13|--binary] <text>", man: "decode <text> - decodes base64, hex, binary or rot13. It guesses the encoding; force one with a flag." });

  SH.cmd("signal", a => {
    const arg = a.join(" ").trim();
    (async () => {
      const C = await cfg(), st = load(), total = C.steps.length + 1;
      if (!arg) {
        SH.line("signals found: " + st.n + " of " + total + "   [" + "#".repeat(st.n) + "-".repeat(total - st.n) + "]", "blue");
        if (st.h.length) SH.line(st.h[st.h.length - 1]); else SH.line("nothing yet. some things on this site are not on the surface.", "dim");
        if (st.done) SH.line("all signals found. ({{unlock|unlock}} shows the reward again)", "dim");
        SH.newPrompt(); return;
      }
      if (arg === "reset") { save({ n: 0, h: [] }); try { localStorage.removeItem("lad_sig_m"); } catch (e) {} SH.line("signal log cleared.", "dim"); SH.newPrompt(); return; }
      for (let i = 0; i < C.steps.length; i++) {
        if (await sha(i, arg) !== C.steps[i].h) continue;
        if (i > st.n) { SH.line("that is a real key, but it is not its turn yet.", "dim"); SH.newPrompt(); return; }
        const hint = await unseal(i, arg, C.steps[i].n); if (!hint) break;
        if (i === st.n) { st.n = i + 1; st.h[i] = hint.t; save(st); }
        if (hint.m) try { localStorage.setItem("lad_sig_m", hint.m); } catch (e) {}
        SH.line("** key accepted **", "blue"); SH.line(hint.t); SH.newPrompt(); return;
      }
      SH.line("no signal on that word.", "dim"); SH.newPrompt();
    })().catch(fail("signal"));
    return true;
  }, { hidden: true });

  SH.cmd("stego", a => {
    const id = (a[0] || "").toUpperCase(); if (!/^ARC-\d{4}$/.test(id)) { SH.line("usage: stego ARC-0000", "dim"); return; }
    (async () => {
      SH.line("reading least significant bits of " + id + " ...", "dim");
      const C = await cfg();                               // only fetch when the id matches (compared by hash, so the id is not in the source)
      if (!(C.s || []).includes(await sha("s", id))) { SH.line("stego: nothing but noise in " + id + ".", "dim"); SH.newPrompt(); return; }
      const im = new Image(); im.src = "/arg/" + id.slice(4) + ".png";
      try { await im.decode(); } catch (e) { SH.line("stego: nothing but noise in " + id + ".", "dim"); SH.newPrompt(); return; }
      const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data, bit = k => { const px = Math.floor(k / 3), ch = k % 3; return d[px * 4 + ch] & 1; };
      const byte = k => { let v = 0; for (let b = 0; b < 8; b++) v = v << 1 | bit(k * 8 + b); return v; };
      if (byte(0) !== 0x4c || byte(1) !== 0x44) { SH.line("stego: nothing but noise in " + id + ".", "dim"); SH.newPrompt(); return; }
      const len = Math.min(400, byte(2) << 8 | byte(3)), bytes = new Uint8Array(len); for (let i = 0; i < len; i++) bytes[i] = byte(4 + i);
      const dv = document.createElement("div"); dv.className = "ln blue"; dv.textContent = dec.decode(bytes); SH.out.appendChild(dv); SH.newPrompt();
    })().catch(fail("stego"));
    return true;
  }, { hidden: true });

  SH.cmd("unlock", a => {
    const arg = a.join(" ").trim();
    (async () => {
      const C = await cfg(), st = load();
      if (!arg) { if (st.done && st.pass) a = [st.pass]; else { SH.line("unlock: locked. it wants a passphrase.", "dim"); SH.newPrompt(); return; } }
      const pass = arg || st.pass;
      if (await sha("f", pass) !== C.final.h) { SH.line("unlock: wrong passphrase.", "dim"); SH.newPrompt(); return; }
      const r = await unseal("f", pass, C.final.r); if (!r) { SH.line("unlock: wrong passphrase.", "dim"); SH.newPrompt(); return; }
      st.n = C.steps.length + 1; st.done = true; st.pass = pass; save(st);
      ["", "  ##################################", "  #   ALL SIX SIGNALS RECEIVED     #", "  ##################################", ""].forEach(l => SH.line(l, "blue"));
      SH.line("discount code:  " + r.code); SH.line(r.note, "dim"); SH.line("the hidden track:  [[" + r.track + "|open track 00]]"); SH.newPrompt();
    })().catch(fail("unlock"));
    return true;
  }, { hidden: true });
}
export { decodeAny };
