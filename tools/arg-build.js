#!/usr/bin/env node
// Builds the hidden puzzle hunt from ONE private config (arg.private.json, never committed):
//   arg.json            public, contains only hashes + AES-GCM ciphertext (nothing readable)
//   arg/carrier.wav     a short sound whose spectrogram spells a word (step 3)
//   arg/<id>.png        an artwork copy with a message in its least significant bits (step 5)
//   arg/<token>.html    the hidden track page (reward)
//   archive/index.json  one entry gets a base64 "x" note (step 2)
//   ARG_SOLUTION.md     the full walkthrough, for the owner only (never committed)
// Change the discount code / keys in arg.private.json, then run:  node tools/arg-build.js
const fs = require("fs"), path = require("path"), crypto = require("crypto"), { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), P = f => path.join(ROOT, f);
const PRIV = P("arg.private.json");
if (!fs.existsSync(PRIV)) {
  // a neutral template: the real keys, clue texts and code live ONLY in arg.private.json (git-ignored), never in this file
  fs.writeFileSync(PRIV, JSON.stringify({
    code: "CHANGE-ME", codeNote: "what the code is good for",
    trackToken: crypto.randomBytes(6).toString("hex"),
    keys: ["one", "two", "three", "four", "five"],
    noteArc: "ARC-0001", stegoArc: "ARC-0002", spectroWord: "THREE", morseWord: "FOUR",
    hints: ["shown after key 1 ({noteArc})", "shown after key 2", "shown after key 3", "shown after key 4 ({stegoArc})", "shown after key 5"]
  }, null, 2) + "\n");
  console.log("created a template arg.private.json - fill it in, then run this again"); process.exit(0);
}
const C = JSON.parse(fs.readFileSync(PRIV, "utf8"));
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const SALT = "lad-arg-v1|";
const hash = (i, a) => crypto.createHash("sha256").update(SALT + i + "|" + norm(a)).digest("hex");
function seal(i, answer, obj) {
  const key = crypto.pbkdf2Sync(norm(answer), SALT + i, 60000, 32, "sha256"), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv), ct = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]).toString("base64");
}
const MORSE = { A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--.." };
const K = C.keys, pass = K.join(" ");
if (norm(C.spectroWord) !== norm(K[2]) || norm(C.morseWord) !== norm(K[3])) throw new Error("keys[2] must equal spectroWord and keys[3] must equal morseWord");

// what each solved step reveals (encrypted with that step's key); the texts come from the private config
if (!Array.isArray(C.hints) || C.hints.length !== K.length) throw new Error("arg.private.json needs one hint per key");
const fill = t => String(t).replace(/\{noteArc\}/g, C.noteArc).replace(/\{stegoArc\}/g, C.stegoArc);
const hints = C.hints.map((t, i) => i === 2 ? { t: fill(t), m: C.morseWord.toUpperCase().split("").map(ch => MORSE[ch]).join(" ") } : { t: fill(t) });
const pub = { v: 1, s: [hash("s", C.stegoArc)], steps: K.map((k, i) => ({ h: hash(i, k), n: seal(i, k, hints[i]) })), final: { h: hash("f", pass), r: seal("f", pass, { code: C.code, note: C.codeNote, track: "/arg/" + C.trackToken + ".html" }) } };
fs.writeFileSync(P("arg.json"), JSON.stringify(pub) + "\n");

// ---- step 2: base64 note on one archive entry
const idxPath = P("archive/index.json"), idx = JSON.parse(fs.readFileSync(idxPath, "utf8"));
const noteText = fill(C.noteText || "key: {k}").replace(/\{k\}/g, K[1].toUpperCase()).replace(/\{kl\}/g, K[1]);
idx.forEach(e => { delete e.x; });
const ni = idx.length - parseInt(C.noteArc.slice(4), 10); if (!idx[ni] || idx[ni].hide) throw new Error("noteArc is not a visible piece");
idx[ni].x = Buffer.from(noteText).toString("base64");
fs.writeFileSync(idxPath, JSON.stringify(idx));

// ---- step 3: a sound whose spectrogram spells the word (0-6 kHz view, one column = 66 ms)
const FONT = { A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"], C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"], D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"], E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"], F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"], G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"], H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"], I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"], K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"], L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"], M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"], N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"], O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"], P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"], R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"], S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"], T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"], U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"], V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"], W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"], X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"], Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"], Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"], B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"], J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"], Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"] };
(function wav() {
  const SR = 22050, COL = 0.132, word = C.spectroWord.toUpperCase(), cols = [];
  for (const ch of word) { const g = FONT[ch]; if (!g) throw new Error("no glyph for " + ch); for (let x = 0; x < 5; x++) cols.push(g.map(r => r[x] === "1")); cols.push(new Array(7).fill(false)); }
  const lead = 0.9, total = lead + cols.length * COL + 0.9, n = Math.floor(total * SR), out = new Float32Array(n);
  cols.forEach((col, ci) => { const s0 = Math.floor((lead + ci * COL) * SR), len = Math.floor(COL * SR);
    col.forEach((on, r) => { if (!on) return; const fc = 4400 - r * 450; for (let k = -1; k <= 1; k++) { const f = fc + k * 70, ph = Math.random() * 6.28; for (let i = 0; i < len; i++) { const env = Math.min(1, i / 200, (len - i) / 200); out[s0 + i] += Math.sin(2 * Math.PI * f * i / SR + ph) * env; } } }); });
  let peak = 0; for (let i = 0; i < n; i++) { out[i] += (Math.random() - 0.5) * 0.02; peak = Math.max(peak, Math.abs(out[i])); }
  const buf = Buffer.alloc(44 + n * 2); buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(out[i] / peak * 0.8 * 32767), 44 + i * 2);
  fs.mkdirSync(P("arg"), { recursive: true }); fs.writeFileSync(P("arg/carrier.wav"), buf);
})();

// ---- step 5: message in the least significant bits of a lossless copy of one artwork
(function stego() {
  const si = idx.length - parseInt(C.stegoArc.slice(4), 10), e = idx[si]; if (!e || e.hide) throw new Error("stegoArc is not a visible piece");
  const src = P("archive/" + (e.media[0].thumb || e.media[0].img)), W = 256, H = 256;
  const raw = execFileSync("magick", [src, "-resize", W + "x" + H + "!", "-depth", "8", "rgb:-"], { maxBuffer: 1 << 26 });
  const msg = Buffer.from(fill(C.stegoText || "key: {k}").replace(/\{k\}/g, K[4].toUpperCase()).replace(/\{kl\}/g, K[4]), "utf8");
  const payload = Buffer.concat([Buffer.from([0x4c, 0x44, msg.length >> 8, msg.length & 255]), msg]);      // "LD" + length + text
  for (let i = 0; i < payload.length * 8; i++) raw[i] = (raw[i] & 0xfe) | ((payload[i >> 3] >> (7 - (i & 7))) & 1);
  fs.writeFileSync("/tmp/arg-stego.rgb", raw);
  execFileSync("magick", ["-size", W + "x" + H, "-depth", "8", "rgb:/tmp/arg-stego.rgb", "-strip", "-define", "png:compression-level=9", P("arg/" + C.stegoArc.slice(4) + ".png")]);
})();

// ---- reward: the hidden track page (placeholder audio until the real file is dropped in)
fs.readdirSync(P("arg")).filter(f => /^[0-9a-f]{12}\.html$/.test(f)).forEach(f => fs.unlinkSync(P("arg/" + f)));
fs.writeFileSync(P("arg/" + C.trackToken + ".html"), `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>00</title><link rel="stylesheet" href="/gate/font.css"><link rel="icon" type="image/png" href="/favicon.png">
<style>html,body{margin:0;background:#000;color:#ff3030;font:16px/1.3 "Web437 VGA","Courier New",monospace}body{padding:14px}pre{font:inherit;white-space:pre-wrap}a{color:#4070ff}audio{width:100%;margin:14px 0;filter:invert(1) hue-rotate(180deg)}.d{color:#802020}</style></head>
<body><pre>track 00 // unlisted

you found all six signals.
this is the hidden track.</pre>
<audio controls loop src="/arg/hidden-track.m4a"></audio>
<pre class="d">(if nothing plays yet: the transmission is still being cut. come back.)</pre>
<pre class="d">your code was shown in the terminal when you unlocked this. run 'unlock' there to see it again.</pre>
<pre><a href="/">&lt; back to the terminal</a></pre></body></html>
`);

// ---- the owner's notes
fs.writeFileSync(P("ARG_SOLUTION.md"), `# live.and.die hidden puzzle hunt - SOLUTION (private, not deployed)

This file and \`arg.private.json\` are in .gitignore. Nothing here is on the site.
To change the discount code, the keys or the pieces: edit \`arg.private.json\`, run \`node tools/arg-build.js\`, commit the generated files.
To add the real hidden track: save it as \`arg/hidden-track.m4a\` and commit.

Progress is stored in the visitor's browser (localStorage). \`signal\` shows it, \`signal reset\` clears it.

| step | where the clue is | what the visitor does | key |
|---|---|---|---|
| 1 | the browser devtools console prints a message on every load | \`signal ${K[0]}\` | **${K[0]}** |
| 2 | \`open ${C.noteArc}\` shows a base64 note under the piece | \`decode <note>\` then \`signal ${K[1]}\` | **${K[1]}** |
| 3 | \`spectro 00\` (an unlisted track): the spectrogram spells a word | \`signal ${K[2]}\` | **${K[2]}** |
| 4 | once step 3 is solved the prompt cursor blinks morse for 20s at the top of every 3rd minute (:00 :03 :06 ...) | read the morse, \`signal ${K[3]}\` | **${K[3]}** |
| 5 | \`stego ${C.stegoArc}\` reads a message hidden in the picture's least significant bits | \`signal ${K[4]}\` | **${K[4]}** |
| 6 | all five keys in order | \`unlock ${pass}\` | passphrase |

Reward: discount code **${C.code}** (${C.codeNote}) and the hidden track page **/arg/${C.trackToken}.html**.

Other ways in: winning the \`hack\` minigame prints the step-3 nudge ("spectro 00").

How it is protected: the site only ships SHA-256 hashes of the keys and AES-256-GCM ciphertext (key = PBKDF2 of the answer),
so the next clue and the reward cannot be read from the source - only decrypted by typing the right answer.
The step 1 key is intentionally public (it is the console message).
`);
console.log("arg built: arg.json, arg/carrier.wav, arg/" + C.stegoArc.slice(4) + ".png, arg/" + C.trackToken + ".html, note on " + C.noteArc + ", ARG_SOLUTION.md");
