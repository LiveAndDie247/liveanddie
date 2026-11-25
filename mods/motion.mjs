// ambient motion for phones: slight tilt parallax in the shell, a hard shake = glitch storm + soft reboot,
// and (android) haptic pulses on kick drums while a song plays. Nothing is recorded or sent anywhere.
import { audioTap, getMotion } from "./util.mjs";
import { buzz } from "./drums.mjs";
export default function (SH) {
  const pref = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v === "1"; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v ? "1" : "0"); } catch (e) {} };
  const needsAsk = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
  let motionOn = false, tx = 0, ty = 0, raf = 0, peaks = [], storming = false;
  const busy = () => !!document.querySelector(".stage,.appscr") || SH.viewer.classList.contains("on");
  function ori(e) { if (e.gamma == null) return; tx = Math.max(-1, Math.min(1, e.gamma / 40)) * 7; ty = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 40)) * 5; if (!raf) raf = requestAnimationFrame(() => { raf = 0; SH.out.style.transform = busy() ? "" : "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px)"; }); }
  function mot(e) {
    const a = e.accelerationIncludingGravity; if (!a || storming || busy()) return;
    const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0), now = Date.now();
    if (m > 32) { peaks = peaks.filter(t => now - t < 900); peaks.push(now); if (peaks.length >= 4) { peaks = []; storm(); } }
  }
  function storm() {
    storming = true; buzz([40, 30, 40]);
    const el = document.createElement("pre"); el.className = "appscr"; el.style.cssText = "position:fixed;inset:0;z-index:39;margin:0;background:#000;white-space:pre;overflow:hidden;font:16px/1 'Web437 VGA',monospace";
    document.body.appendChild(el); const W = SH.cols(), H = SH.rowsN(), G = "█▓▒░#%@*=+-:. "; let n = 0;
    const iv = setInterval(() => { let s = ""; for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) s += G[Math.random() * G.length | 0]; s += "\n"; } el.style.color = n % 2 ? "var(--red)" : "var(--blue)"; el.textContent = s; if (++n > 12) { clearInterval(iv); el.remove(); storming = false; SH.softBoot(); } }, 70);
  }
  function setMotion(on) {
    if (on === motionOn) return; motionOn = on;
    if (on) { addEventListener("deviceorientation", ori); addEventListener("devicemotion", mot); }
    else { removeEventListener("deviceorientation", ori); removeEventListener("devicemotion", mot); SH.out.style.transform = ""; }
  }
  if (!needsAsk && pref("lad_motion", true)) setMotion(true);              // android: no prompt exists; iOS waits for 'motion on'

  SH.cmd("motion", a => {
    const v = (a[0] || "").toLowerCase();
    if (v === "off") { setMotion(false); save("lad_motion", false); SH.line("motion off.", "dim"); return; }
    if (v !== "on") { SH.line("motion: " + (motionOn ? "on" : "off") + "  (tilt = slight parallax, hard shake = glitch storm + reboot).  motion <on|off>", "dim"); return; }
    getMotion(SH, "tilting the phone moves the text slightly; a hard shake reboots the shell.").then(ok => { if (ok) { setMotion(true); save("lad_motion", true); SH.line("motion on.", "blue"); } else SH.line("motion: no motion sensor (or permission denied).", "dim"); SH.newPrompt(); });
    return true;
  }, { help: "tilt parallax + shake-to-reboot on/off", usage: "motion <on|off>", man: "motion <on|off> - on phones the text shifts slightly as you tilt, and a hard shake causes a glitch storm and a soft reboot. Sensor data never leaves the device." });

  // haptics on kicks
  let hapt = pref("lad_haptics", true), tap = null, hraf = 0, avg = 0, lastK = 0, freq = null;
  function hloop(t) {
    hraf = 0; if (!hapt || !tap || SH.au.paused) return; hraf = requestAnimationFrame(hloop);
    tap.an.getByteFrequencyData(freq); let low = 0; for (let i = 1; i < 5; i++) low += freq[i]; low /= 4;
    if (low > avg * 1.3 + 12 && low > 150 && t - lastK > 170) { lastK = t; buzz(14); } avg = avg * 0.92 + low * 0.08;
  }
  SH.au.addEventListener("play", () => {
    if (!hapt || !navigator.vibrate) return;
    if (!tap) { if (!SH._tap && !(navigator.userActivation && navigator.userActivation.isActive)) return; try { tap = audioTap(SH); freq = new Uint8Array(tap.an.frequencyBinCount); } catch (e) { tap = null; return; } }
    if (tap.AC.state === "suspended") tap.AC.resume().catch(() => {});
    if (!hraf) hraf = requestAnimationFrame(hloop);
  });
  SH.cmd("haptics", a => {
    const v = (a[0] || "").toLowerCase();
    if (v === "on" || v === "off") { hapt = v === "on"; save("lad_haptics", hapt); if (hapt) buzz(20); }
    SH.line("haptics " + (hapt ? "on" : "off") + (navigator.vibrate ? "" : "  (this device has no vibration)") + "  -  pulses on kick drums while music plays.", "dim");
  }, { help: "vibrate on kick drums (android) on/off", usage: "haptics <on|off>" });
}
