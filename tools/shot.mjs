// Eyes: screenshot a URL the way a phone sees it, and report what went wrong in the console.
//   node tools/shot.mjs <url> [out.png] [--landscape] [--full] [--wait=ms] [--scroll]
// Uses Chrome for Testing's headless shell (~/.cache/chrome-hs, no npm needed) over the DevTools protocol.
//   phone: 412x915 CSS px at deviceScaleFactor 2.6 (a Galaxy S-class phone), touch, Android Chrome UA
//   --landscape   915x412 instead
//   --full        also capture the whole page at 1x, cut into parts <name>-full-1.png, -2, ... (easier to read)
//   --scroll      scroll to the bottom first so lazy-loaded things load (implied by --full)
//   --wait=ms     extra settle time after the network goes quiet (default 1500)
//   --at=sel      scroll that element to the top before the viewport shot (e.g. --at=#art)
//   --js=expr     evaluate this in the page just before the shot and print the result (e.g. drive a scroll)
//   --gl          render WebGL with SwiftShader (needed to see WebGL canvases)
//   --after=ms    sleep this long after --js before the shot (default 0)
// Console errors, uncaught exceptions, failed requests and HTTP 4xx/5xx go to stdout and to <out>.log.
// Exit code 2 if there were any errors, so scripts can tell.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2), flags = new Set(args.filter(a => a.startsWith("--")).map(a => a.split("=")[0]));
const pos = args.filter(a => !a.startsWith("--"));
const url = pos[0];
if (!url) { console.error("usage: shot.mjs <url> [out.png] [--landscape] [--full] [--scroll] [--wait=ms]"); process.exit(1); }
const out = path.resolve(pos[1] || "/root/.cache/shots/shot.png");
const waitMs = +(args.find(a => a.startsWith("--wait="))?.split("=")[1] ?? 1500);
const land = flags.has("--landscape"), full = flags.has("--full"), scroll = full || flags.has("--scroll");
const W = land ? 915 : 412, H = land ? 412 : 915, DSF = 2.6;
const CHROME = process.env.CHROME || path.join(os.homedir(), ".cache/chrome-hs/chrome-headless-shell-linux-arm64/chrome-headless-shell");
const UA = "Mozilla/5.0 (Linux; Android 16; SM-S948B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36";
fs.mkdirSync(path.dirname(out), { recursive: true });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "shot-"));
// --gl: software WebGL that survives drawing to the screen (with --disable-gpu any WebGL present loses its context here)
const GPU = flags.has("--gl") ? (process.env.SHOT_GL ? process.env.SHOT_GL.split(" ") : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]) : ["--disable-gpu"];
const chrome = spawn(CHROME, ["--headless", "--no-sandbox", ...GPU, "--hide-scrollbars", "--mute-audio", "--no-first-run",
  "--autoplay-policy=no-user-gesture-required", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((res, rej) => {
  let buf = "";
  const t = setTimeout(() => rej(new Error("chrome didn't start: " + buf.slice(-400))), 20000);
  chrome.stderr.on("data", d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } });
  chrome.on("exit", c => rej(new Error("chrome exited " + c + ": " + buf.slice(-400))));
});

// --- a minimal DevTools-protocol client (Node 22 has WebSocket built in) ---
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nextId = 1;
const pending = new Map(), listeners = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  else if (m.method) for (const l of listeners) l(m);
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = nextId++; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId: S } = await send("Target.attachToTarget", { targetId, flatten: true });
const cmd = (m, p) => send(m, p, S);

const problems = [];
const say = s => { problems.push(s); };
let idleAt = 0, loaded = false;
listeners.push(m => {
  if (m.sessionId !== S) return;
  const p = m.params;
  if (m.method === "Runtime.consoleAPICalled" && (p.type === "error" || p.type === "assert"))
    say(`console.${p.type}: ` + p.args.map(a => a.value ?? a.description ?? a.type).join(" ").slice(0, 300));
  if (m.method === "Runtime.exceptionThrown") {
    const d = p.exceptionDetails;
    say(`uncaught: ${(d.exception?.description || d.text || "").split("\n")[0].slice(0, 300)} @ ${d.url || ""}:${d.lineNumber + 1}:${d.columnNumber + 1}`);
  }
  if (m.method === "Log.entryAdded" && p.entry.level === "error" && !/Failed to load resource/.test(p.entry.text)) say(`log: ${p.entry.text.slice(0, 300)} ${p.entry.url || ""}`);
  if (m.method === "Network.responseReceived" && p.response.status >= 400) say(`HTTP ${p.response.status}: ${p.response.url}`);
  if (m.method === "Network.loadingFailed" && !p.canceled && p.errorText !== "net::ERR_ABORTED") say(`failed: ${p.errorText} ${p.type || ""} ${reqUrls.get(p.requestId) || ""}`);
  if (m.method === "Network.requestWillBeSent") reqUrls.set(p.requestId, p.request.url);
  if (m.method === "Page.lifecycleEvent" && p.name === "networkIdle") idleAt = Date.now();
  if (m.method === "Page.loadEventFired") loaded = true;
});
const reqUrls = new Map();

await Promise.all([cmd("Page.enable"), cmd("Runtime.enable"), cmd("Log.enable"), cmd("Network.enable"), cmd("Page.setLifecycleEventsEnabled", { enabled: true })]);
await cmd("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: DSF, mobile: true, screenOrientation: land ? { type: "landscapePrimary", angle: 90 } : { type: "portraitPrimary", angle: 0 } });
await cmd("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await cmd("Emulation.setUserAgentOverride", { userAgent: UA, platform: "Linux armv8l" });
await cmd("Network.setCacheDisabled", { cacheDisabled: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
await cmd("Page.navigate", { url });
async function settle(maxMs = 15000) {          // wait for load + the network to go quiet, then a little more
  const start = Date.now();
  while (Date.now() - start < maxMs && !(loaded && idleAt)) await sleep(100);
  await sleep(waitMs);
}
await settle();
const evalJS = async expr => (await cmd("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;
if (scroll) {
  const h = await evalJS("document.documentElement.scrollHeight");
  for (let y = 0; y < h; y += H * 0.8) { await evalJS(`scrollTo(0, ${y})`); await sleep(120); }
  await evalJS("scrollTo(0, 0)"); idleAt = 0; await settle(6000);
}

const at = args.find(a => a.startsWith("--at="))?.slice(5);   // --at=<css selector>: scroll it to the top before the shot
if (at) { await evalJS(`document.querySelector(${JSON.stringify(at)})?.scrollIntoView({block:"start"})`); await sleep(1200); }
const js = args.find(a => a.startsWith("--js="))?.slice(5);
if (js) { const r = await (async () => { try { return (await cmd("Runtime.evaluate", { expression: js, returnByValue: true, awaitPromise: true })).result.value; } catch (e) { return "js error: " + e.message; } })(); console.log("js:", JSON.stringify(r)); await sleep(+(args.find(a => a.startsWith("--after="))?.split("=")[1] ?? 0)); }
const shot = async (file, params) => fs.writeFileSync(file, Buffer.from((await cmd("Page.captureScreenshot", { format: "png", ...params })).data, "base64"));
await shot(out, {});
const files = [out];
if (full) {
  const { cssContentSize: c } = await cmd("Page.getLayoutMetrics");
  const total = Math.ceil(c.height), part = 2400;
  for (let i = 0, y = 0; y < total; i++, y += part) {
    const f = out.replace(/\.png$/, `-full-${i + 1}.png`);
    await shot(f, { captureBeyondViewport: true, clip: { x: 0, y, width: W, height: Math.min(part, total - y), scale: 1 / DSF } });
    files.push(f);
  }
}
const info = await evalJS(`JSON.stringify({ title: document.title, w: innerWidth, h: document.documentElement.scrollHeight,
  overflowX: document.documentElement.scrollWidth > innerWidth ? document.documentElement.scrollWidth : 0 })`);

const report = [`url: ${url}`, `viewport: ${W}x${H} @${DSF}x${land ? " landscape" : ""}  ·  load ${((Date.now() - t0) / 1000).toFixed(1)}s`, `page: ${info}`,
  `shots: ${files.join(" ")}`, problems.length ? `PROBLEMS (${problems.length}):\n  ` + [...new Set(problems)].join("\n  ") : "console: clean"].join("\n");
fs.writeFileSync(out.replace(/\.png$/, ".log"), report + "\n");
console.log(report);

ws.close(); chrome.kill("SIGKILL");
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* tmp */ }
process.exit(problems.length ? 2 : 0);
