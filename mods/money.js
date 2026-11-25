/* ===================== phase 4: making money ===================== */
(function () {
  "use strict";
  var SH = window.SH; if (!SH) return;
  var cmd = SH.cmd, line = SH.line, fmt = SH.fmt, IG = SH.IG, KOFI = SH.KOFI;

  // ---- order: interactive request wizard
  cmd("order", function () {
    var ans = {}, i = 0;
    var steps = [
      { q: "what do you need?  (visualizer / animated cover / music video mosh)", k: "type" },
      { q: "link to the song or audio?  (paste a url, or 'none')", k: "song" },
      { q: "vibe / references?  (a few words)", k: "vibe" },
      { q: "deadline?  (e.g. '2 weeks', or 'flexible')", k: "deadline" },
      { q: "budget in $?  (minimum 25)", k: "budget" }
    ];
    line("** commission request wizard **  (type your answers; 'q' to cancel)", "blue");
    function ask() { line(steps[i].q); }
    ask();
    SH.read("order[" + (i + 1) + "/5]> ", function (v) {
      v = v.trim(); if (v.toLowerCase() === "q") { line("cancelled.", "dim"); return false; }
      ans[steps[i].k] = v || "-"; i++;
      if (i < steps.length) { ask(); return "order[" + (i + 1) + "/5]> " !== null ? true : true; }
      finish(); return false;
    });
    function finish() {
      var msg = "hi @live.and.die - commission request:\n" +
        "* type: " + ans.type + "\n* song: " + ans.song + "\n* vibe: " + ans.vibe +
        "\n* deadline: " + ans.deadline + "\n* budget: $" + (ans.budget || "25") + "\nsent via liveanddie.xyz";
      line("");
      line("--- your request ---------------------------", "dim");
      msg.split("\n").forEach(function (l) { line("  " + l); });
      line("--------------------------------------------", "dim");
      if (navigator.clipboard) navigator.clipboard.writeText(msg).then(function () { line("request copied to clipboard.", "blue"); }, function () {});
      line("request ready - paste it in the DM:  [[" + IG + "|open instagram DM]]  or tip via [[" + KOFI + "|ko-fi]].", "blue");
    }
    return true;
  }, { help: "build a commission request + copy it for the DM", man: "order - an interactive wizard (type, song, vibe, deadline, budget). Builds a finished DM message, copies it to your clipboard and links the Instagram DM / Ko-fi." });

  // ---- ads: fake ascii banners (one already prints in the boot MOTD)
  var ADS = [
    ["+------------------------------------------+", "|  FEELINGS - BY THE UNIT - $0.99          |", "|  i love feeling. not you.   [ BUY NOW ]  |", "+------------------------------------------+"],
    ["+------------------------------------------+", "|  REVISIT KIT: ONE TUESDAY                |", "|  memory not included.       [ ORDER ]    |", "+------------------------------------------+"],
    ["+------------------------------------------+", "|  FREEDOM(tm) now available in RED        |", "|  zero down. zero apr.       [ CLAIM ]    |", "+------------------------------------------+"],
    ["+------------------------------------------+", "|  HOT SIGNALS IN YOUR AREA                |", "|  waiting since 2007.        [ CONNECT ]   |", "+------------------------------------------+"]
  ];
  cmd("ads", function () {
    line("ADVERTISEMENT", "dim");
    ADS.forEach(function (ad, i) { ad.forEach(function (l, j) { line(l, j === 1 || j === 2 ? (i % 2 ? "blue" : "") : "dim"); }); line(""); });
    line("(all sales final. terms apply.)", "dim");
  }, { help: "the sponsors" });

  // ---- install: PWA
  cmd("install pwa", function () {
    if ("serviceWorker" in navigator) { navigator.serviceWorker.register("/sw.js").then(function () { line("service worker registered - works offline now.", "blue"); }, function () { line("install: service worker failed (needs https).", "dim"); }); }
    if (SH.deferredPrompt) { line("opening install prompt ...", "dim"); SH.deferredPrompt.prompt(); SH.deferredPrompt = null; }
    else { line("to install: use your browser menu -> 'Add to Home screen' / 'Install app'.", "blue"); line("live.and.die then opens full-screen with its own icon, and works offline.", "dim"); }
  }, { help: "install live.and.die as an app (works offline)", man: "install - add live.and.die to your home screen as a standalone PWA with its own icon; it then works offline via a service worker." });
})();
