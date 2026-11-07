/* gate-kit · FORM 7-A · DEVICE APPRAISAL — the one pop-up.
 * Lists what the browser will say about the device without asking, prices each finding and makes
 * an offer good for 60 seconds. Never triggers a permission prompt. Nothing leaves the device except
 * the public-address lookup the browser makes itself to ipwho.is. Two small things are kept on this
 * device only: a session flag (shown once per browser session) and a visit count (for VISITOR NUMBER).
 * Shown once per session on first page load; never on /x/ pages.
 *   <link rel="stylesheet" href="/gate/appraisal.css"><script src="/gate/appraisal.js" defer></script>
 */
(function () {
  "use strict";
  if (/^\/x\//.test(location.pathname)) return;
  var SS = "gate.appraisal", LS = "gate.visits";
  if (/[?&]appraisal=0\b/.test(location.search)) return;        // for screenshots of the page itself
  var force = /[?&]appraisal\b/.test(location.search);
  try { if (sessionStorage.getItem(SS) && !force) return; sessionStorage.setItem(SS, "1"); } catch (e) { if (!force) return; }
  var visits = 0; try { visits = parseInt(localStorage.getItem(LS), 10) || 0; localStorage.setItem(LS, String(visits + 1)); } catch (e) {}

  var ua = navigator.userAgent, rows = [], total = 0, mq = function (q) { try { return matchMedia(q).matches; } catch (e) { return false; } };
  var money = function (n) { return (n < 0 ? "−$" : "$") + Math.abs(n).toFixed(2); };
  function add(k, v, val, note) { if (v == null || v === "" || v === "undefined") return; rows.push([k, String(v) + (note ? " " + note : ""), val]); }

  // ---------- the quick rows ----------
  var os = (function () { var m; if ((m = ua.match(/Android ([\d.]+)/))) return "ANDROID " + m[1]; if ((m = ua.match(/iPhone OS ([\d_]+)/))) return "iOS " + m[1].replace(/_/g, "."); if ((m = ua.match(/iPad; CPU OS ([\d_]+)/))) return "iPadOS " + m[1].replace(/_/g, "."); if (/Windows NT/.test(ua)) return "WINDOWS"; if ((m = ua.match(/Mac OS X ([\d_]+)/))) return "macOS " + m[1].replace(/_/g, "."); if (/CrOS/.test(ua)) return "CHROME OS"; if (/Linux/.test(ua)) return "LINUX"; return "UNKNOWN"; })();
  var br = (function () { var m; if ((m = ua.match(/Edg\/([\d.]+)/))) return "EDGE " + m[1]; if ((m = ua.match(/OPR\/([\d.]+)/))) return "OPERA " + m[1]; if ((m = ua.match(/SamsungBrowser\/([\d.]+)/))) return "SAMSUNG INTERNET " + m[1]; if ((m = ua.match(/Firefox\/([\d.]+)/))) return "FIREFOX " + m[1]; if ((m = ua.match(/CriOS\/([\d.]+)/))) return "CHROME (iOS) " + m[1]; if ((m = ua.match(/HeadlessChrome\/([\d.]+)/))) return "HEADLESS CHROME " + m[1]; if ((m = ua.match(/Chrome\/([\d.]+)/))) return "CHROME " + m[1]; if ((m = ua.match(/Version\/([\d.]+).*Safari/))) return "SAFARI " + m[1]; return "UNKNOWN"; })();
  var model = (ua.match(/Android [\d.]+; ([^;)]+)/) || [])[1]; if (model) model = model.replace(/ Build.*/, "").trim(); if (model === "K") model = ""; if (/iPhone/.test(ua)) model = "iPHONE"; if (/iPad/.test(ua)) model = "iPAD";
  var mob = /Mobi|Android|iPhone/.test(ua);
  add("MODEL", model || (mob ? "HANDHELD UNIT" : "DESKTOP UNIT"), model ? 0.60 : 0.25, mob ? "(HANDHELD)" : "");
  add("OS", os, 0.20);
  add("BROWSER", br, 0.10);
  add("SCREEN", screen.width + "×" + screen.height + " · " + (Math.round((devicePixelRatio || 1) * 100) / 100) + "x PIXEL RATIO · " + screen.colorDepth + "-BIT COLOUR", 0.30, screen.width * screen.height * (devicePixelRatio || 1) > 2e6 ? "(LARGE. WASTED ON THIS.)" : "");
  add("VIEWPORT", innerWidth + "×" + innerHeight, 0.03);
  if (navigator.hardwareConcurrency) add("CPU CORES", navigator.hardwareConcurrency, Math.min(0.40, 0.04 * navigator.hardwareConcurrency), navigator.hardwareConcurrency >= 8 ? "(OVERQUALIFIED)" : "");
  if (navigator.deviceMemory) add("RAM", navigator.deviceMemory + " GB (AS REPORTED. IT ROUNDS DOWN.)", 0.15);
  try { var c0 = document.createElement("canvas"), g0 = c0.getContext("webgl"); if (g0) { var e0 = g0.getExtension("WEBGL_debug_renderer_info"); add("GPU", e0 ? g0.getParameter(e0.UNMASKED_RENDERER_WEBGL) : g0.getParameter(g0.RENDERER), 0.35); var lc = g0.getExtension("WEBGL_lose_context"); if (lc) lc.loseContext(); } } catch (e) {}
  add("TOUCH POINTS", navigator.maxTouchPoints > 0 ? navigator.maxTouchPoints : "NONE", 0.03);
  add("POINTER", (mq("(pointer: coarse)") ? "COARSE (A FINGER)" : mq("(pointer: fine)") ? "FINE (A MOUSE)" : "NONE") + " · " + (mq("(hover: hover)") ? "CAN HOVER" : "CANNOT HOVER"), 0.02);
  var ori = screen.orientation; add("ORIENTATION", ori ? ori.type.replace("-primary", "").replace("-secondary", " (UPSIDE DOWN)").toUpperCase() + " · " + ori.angle + "°" : (innerWidth > innerHeight ? "LANDSCAPE" : "PORTRAIT"), 0.01);
  add("COLOUR GAMUT", (mq("(color-gamut: rec2020)") ? "REC. 2020" : mq("(color-gamut: p3)") ? "DISPLAY P3" : "sRGB") + " · " + (mq("(dynamic-range: high)") ? "HDR" : "NO HDR"), mq("(dynamic-range: high)") ? 0.12 : 0.04);
  add("VIBRATION", "vibrate" in navigator ? "SUPPORTED" : "NOT SUPPORTED", 0.02, "vibrate" in navigator ? "(NOT USED. YET.)" : "");
  add("LANGUAGES", (navigator.languages || [navigator.language]).join(", "), 0.02);
  try { add("TIME ZONE", Intl.DateTimeFormat().resolvedOptions().timeZone, 0.08); } catch (e) {}
  var hr = new Date().getHours();
  add("LOCAL TIME", new Date().toLocaleString(), 0.01, hr < 5 ? "(AWAKE AT THIS HOUR. NOTED.)" : "");
  var con = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (con) add("CONNECTION", [con.type && con.type !== "unknown" ? con.type : "", con.effectiveType, con.downlink ? con.downlink + " Mbps" : "", con.rtt ? con.rtt + " ms" : "", con.saveData ? "DATA SAVER ON" : ""].filter(Boolean).join(" · ").toUpperCase(), 0.06);
  add("ONLINE", navigator.onLine ? "YES" : "NO (THEN HOW)", 0.01);
  add("COOKIES", navigator.cookieEnabled ? "ENABLED" : "DISABLED", 0.02, "(THIS SITE SETS NONE)");
  add("DO NOT TRACK", navigator.doNotTrack === "1" || window.doNotTrack === "1" ? "REQUESTED" : "NOT REQUESTED", 0.00, navigator.doNotTrack === "1" ? "(NOTED.)" : "");
  add("DARK MODE", mq("(prefers-color-scheme: dark)") ? "ON" : "OFF", 0.01);
  add("REDUCED MOTION", mq("(prefers-reduced-motion: reduce)") ? "REQUESTED" : "NOT REQUESTED", 0.00, mq("(prefers-reduced-motion: reduce)") ? "(GRANTED)" : "");
  var inst = mq("(display-mode: standalone)") || mq("(display-mode: fullscreen)") || navigator.standalone === true;
  add("INSTALLED AS APP", inst ? "YES" : "NO", inst ? 0.25 : 0.00, inst ? "(LOYAL)" : "");
  add("REFERRER", document.referrer ? document.referrer.replace(/^https?:\/\//, "").slice(0, 60) : "NONE", 0.04, document.referrer ? "" : "(TYPED IT. OR BOOKMARKED IT.)");
  add("HISTORY DEPTH", history.length + (history.length === 1 ? " PAGE" : " PAGES") + " IN THIS TAB", 0.02);
  add("VISITOR NUMBER", String(visits + 1).padStart(6, "0"), 0.04, visits ? "(WE REMEMBER YOU)" : "(FIRST TIME)");
  var wear = Math.min(255, visits * 9 + (mob ? 6 : 0));
  add("WEAR", "0x" + wear.toString(16).padStart(2, "0").toUpperCase(), -Math.min(0.75, wear / 255), wear > 40 ? "(USED)" : "(LIGHTLY USED)");
  if ("bluetooth" in navigator) add("BLUETOOTH", "AVAILABLE", 0.03, "(NOT ASKED. YET.)");
  // canvas fingerprint, computed here and shown only here
  try {
    var fc = document.createElement("canvas"); fc.width = 240; fc.height = 40; var fx = fc.getContext("2d");
    fx.textBaseline = "top"; fx.font = "16px 'Times New Roman'"; fx.fillStyle = "#f60"; fx.fillRect(100, 1, 62, 20);
    fx.fillStyle = "#069"; fx.fillText("FORM 7-A ¤ all sales final 😐", 2, 4); fx.fillStyle = "rgba(102,204,0,0.7)"; fx.fillText("FORM 7-A ¤ all sales final 😐", 4, 8);
    fx.globalCompositeOperation = "multiply"; fx.fillStyle = "#f0f"; fx.beginPath(); fx.arc(200, 20, 16, 0, 6.283); fx.fill();
    var du = fc.toDataURL(), h1 = 0x811c9dc5, h2 = 0x1505;
    for (var i = 0; i < du.length; i++) { var ch = du.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 16777619); h2 = Math.imul(h2, 33) ^ ch; }
    add("FINGERPRINT", "0x" + (h1 >>> 0).toString(16).toUpperCase().padStart(8, "0") + (h2 >>> 0).toString(16).toUpperCase().padStart(8, "0"), 0.50, "(COMPUTED ON YOUR DEVICE. STAYS THERE.)");
  } catch (e) {}
  add("USER AGENT", ua, 0.00);

  // ---------- the slow rows (none of these can prompt) ----------
  var extra = [], to = function (p, ms) { return Promise.race([p, new Promise(function (r) { setTimeout(r, ms); })]); }, ok = function () {};
  var jobs = [];
  if (navigator.getBattery) jobs.push(navigator.getBattery().then(function (b) { extra.push(["BATTERY", Math.round(b.level * 100) + "% · " + (b.charging ? "CHARGING" : "NOT CHARGING"), b.level * 0.3, b.level < 0.2 ? "(DISTRESSED)" : ""]); }).catch(ok));
  if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) jobs.push(navigator.userAgentData.getHighEntropyValues(["model", "platformVersion"]).then(function (d) { if (d.model) extra.push(["MODEL (CONFIRMED)", d.model, 0.30]); if (d.platformVersion) extra.push(["PLATFORM VERSION", d.platformVersion, 0.02]); }).catch(ok));
  if (navigator.storage && navigator.storage.estimate) jobs.push(navigator.storage.estimate().then(function (s) { var gb = (s.quota || 0) / 1073741824; extra.push(["STORAGE QUOTA", (gb >= 1 ? gb.toFixed(1) + " GB" : Math.round(gb * 1024) + " MB") + " OFFERED TO THIS SITE · " + ((s.usage || 0) / 1048576).toFixed(1) + " MB USED", Math.min(0.40, gb / 250), ""]); }).catch(ok));
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) jobs.push(navigator.mediaDevices.enumerateDevices().then(function (l) {
    var cam = l.filter(function (d) { return d.kind === "videoinput"; }).length, mic = l.filter(function (d) { return d.kind === "audioinput"; }).length;
    extra.push(["CAMERAS / MICS", cam + (cam === 1 ? " CAMERA" : " CAMERAS") + " · " + mic + (mic === 1 ? " MICROPHONE" : " MICROPHONES"), 0.10 * cam + 0.05 * mic, "(NOT ASKED. YET.)"]);
  }).catch(ok));
  if (navigator.permissions && navigator.permissions.query) {
    var names = [["camera", "CAMERA"], ["microphone", "MIC"], ["geolocation", "LOCATION"], ["notifications", "NOTIFICATIONS"]];
    jobs.push(Promise.all(names.map(function (n) { return navigator.permissions.query({ name: n[0] }).then(function (s) { return n[1] + " " + s.state.toUpperCase(); }, function () { return n[1] + " N/A"; }); })).then(function (l) {
      var g = l.filter(function (x) { return / GRANTED$/.test(x); }).length; extra.push(["PERMISSIONS", l.join(" · "), 0.05 + 0.20 * g, g ? "(GENEROUS)" : ""]);
    }).catch(ok));
  }
  // audio sample rate: Chrome complains about any AudioContext made before a touch, so the row waits for one.
  // The context is created, read and closed at once; it never starts and makes no sound.
  var AC = window.AudioContext || window.webkitAudioContext, srRow = null;
  function sampleRate() { try { var ac = new AC(); var r = ac.sampleRate; ac.close(); return r + " Hz"; } catch (e) { return null; } }
  if (AC) {
    if (navigator.userActivation && navigator.userActivation.hasBeenActive) { var sr = sampleRate(); if (sr) extra.push(["AUDIO SAMPLE RATE", sr, 0.03]); }
    else {
      extra.push(["AUDIO SAMPLE RATE", "AWAITING YOUR TOUCH", 0.03]);
      var once = function () { removeEventListener("pointerup", once, true); removeEventListener("keydown", once, true); var r = sampleRate(); if (r && srRow) srRow.textContent = r + " (THANK YOU)"; };
      addEventListener("pointerup", once, true); addEventListener("keydown", once, true);
    }
  }
  jobs.push(to(fetch("https://ipwho.is/", { credentials: "omit", referrerPolicy: "no-referrer" }).then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.success !== false && d.ip) {
      extra.push(["PUBLIC IP", d.ip, 0.90]);
      extra.push(["LOCATION (APPROX.)", [d.city, d.region, d.country].filter(Boolean).join(", "), 0.75, "(FROM THE ADDRESS. NOT FROM YOU.)"]);
      if (d.connection && (d.connection.isp || d.connection.org)) extra.push(["CARRIER", d.connection.isp || d.connection.org, 0.20]);
    }
  }).catch(ok), 3500).then(function () { if (!extra.some(function (e) { return e[0] === "PUBLIC IP"; })) extra.push(["PUBLIC IP", "WITHHELD BY YOUR BROWSER", 0.00, "(FOR NOW)"]); }));

  // ---------- the panel ----------
  var root, panel, tb, hv, ex, tot, btns, wait, opener, closed = false, timer = 0, pushed = false;
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function build() {
    root = el("div"); root.id = "appraisal";
    panel = el("div", "ap"); panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-labelledby", "ap-h"); panel.setAttribute("aria-describedby", "ap-sub"); panel.tabIndex = -1;
    panel.appendChild(el("div", "co", "LIVE.AND.DIE PRODUCTIONS · CUSTOMER INTAKE"));
    var h = el("h2", null, "FORM 7-A · DEVICE APPRAISAL"); h.id = "ap-h"; panel.appendChild(h);
    hv = el("div", "hv"); hv.innerHTML = "VALUE SO FAR <b>$0.00</b>"; hv.setAttribute("aria-hidden", "true"); panel.appendChild(hv);
    ex = el("div", "ex", "APPRAISING…"); ex.setAttribute("aria-live", "off"); panel.appendChild(ex);
    var sub = el("p", "sub", "We have inspected the device you are holding. Findings are listed below. Each finding has been priced."); sub.id = "ap-sub"; panel.appendChild(sub);
    var t = el("table"); t.setAttribute("aria-label", "Findings"); tb = el("tbody"); t.appendChild(tb); panel.appendChild(t);
    wait = el("div", "wait", "INSPECTING…"); panel.appendChild(wait);
    tot = el("div", "tot"); tot.setAttribute("role", "status"); panel.appendChild(tot);
    btns = el("div", "btns"); btns.hidden = true;
    ["ACCEPT", "ACCEPT"].forEach(function (l, i) { var b = el("button", null, l); b.type = "button"; b.setAttribute("aria-label", i ? "Accept the offer" : "Accept"); b.onclick = accept; btns.appendChild(b); });
    panel.appendChild(btns);
    panel.appendChild(el("p", "fine", "Everything above was read by this page from your own browser and is shown only to you. Nothing is stored or sent anywhere, except the public address lookup, which your browser makes itself, directly to ipwho.is. No permission was asked for; none was needed. This device keeps two things for us: that you have seen this form this session, and how many times you have visited. By accepting you agree that the above is accurate. By accepting you also agree that the above is accurate. All sales final."));
    root.appendChild(panel); document.body.appendChild(root);
    opener = document.activeElement;
    document.documentElement.style.overflow = "hidden";
    panel.focus({ preventScroll: true });
    document.addEventListener("keydown", onKey, true);
    try { history.pushState({ appraisal: 1 }, ""); pushed = true; addEventListener("popstate", onPop); } catch (e) {}
  }
  function row(r) {
    var tr = el("tr"); tr.appendChild(el("td", "k", r[0])); var v = el("td", "v", r[1] + (r[3] ? " " + r[3] : "")); tr.appendChild(v); if (r[0] === "AUDIO SAMPLE RATE") srRow = v; tr.appendChild(el("td", "p", money(r[2]))); tb.appendChild(tr);
    total += r[2]; hv.querySelector("b").textContent = money(Math.max(0, total));
  }
  function focusables() { return Array.prototype.filter.call(panel.querySelectorAll("button"), function (b) { return !b.disabled && !btns.hidden; }); }
  function onKey(e) {
    if (closed) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "Tab") {
      var f = focusables(); if (!f.length) { e.preventDefault(); panel.focus(); return; }
      var a = document.activeElement, i = f.indexOf(a);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
    }
  }
  function onPop() { if (!closed) { pushed = false; close(); } }
  function close() {
    if (closed) return; closed = true; clearInterval(timer);
    document.removeEventListener("keydown", onKey, true); removeEventListener("popstate", onPop);
    root.remove(); document.documentElement.style.overflow = "";
    if (pushed && history.state && history.state.appraisal) { pushed = false; history.back(); }
    if (opener && opener.focus && opener !== document.body) try { opener.focus({ preventScroll: true }); } catch (e) {}
  }
  function accept() {
    close();
    if (window.GateStars) window.GateStars.burst(innerWidth / 2, innerHeight / 2, 3);   // a burst of stars behind the closing form
    else if (window.GateMosh) window.GateMosh.shock(innerWidth / 2, innerHeight / 2, 3);
  }
  function finish() {
    wait.remove();
    var t = Math.max(0, total);
    hv.innerHTML = "VALUE <b></b>"; hv.querySelector("b").textContent = money(t);
    tot.innerHTML = ""; tot.appendChild(document.createTextNode("TRADE-IN VALUE OF YOUR DEVICE:")); tot.appendChild(el("b", null, money(t)));
    btns.hidden = false;
    var secs = 60; ex.className = "ex on"; ex.textContent = "OFFER EXPIRES 1:00";
    timer = setInterval(function () {
      secs--; ex.textContent = "OFFER EXPIRES 0:" + String(Math.max(0, secs)).padStart(2, "0");
      if (secs === 10) tot.setAttribute("aria-live", "polite");
      if (secs <= 0) {
        clearInterval(timer); ex.className = "ex"; ex.textContent = "OFFER WITHDRAWN";
        tot.innerHTML = ""; tot.appendChild(document.createTextNode("OFFER WITHDRAWN. DEVICE VALUE:")); tot.appendChild(el("b", null, "$0.00"));
        hv.querySelector("b").textContent = "$0.00";
        Array.prototype.forEach.call(btns.children, function (b) { b.disabled = true; });
        panel.focus({ preventScroll: true });
        setTimeout(close, 2200);
      }
    }, 1000);
  }
  function run() {
    build();
    var i = 0, iv = setInterval(function () {
      if (closed) return clearInterval(iv);
      if (i < rows.length) { row(rows[i++]); return; }
      clearInterval(iv);
      Promise.all(jobs).then(function () {
        extra.sort(function (a, b) { return b[2] - a[2]; });
        var j = 0, iv2 = setInterval(function () {
          if (closed) return clearInterval(iv2);
          if (j < extra.length) { row(extra[j++]); return; }
          clearInterval(iv2); finish();
        }, 140);
      });
    }, 90);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(run, 500); });
  else setTimeout(run, 500);
})();
