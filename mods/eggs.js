/* ===================== phase 7: easter eggs (hidden from help) ===================== */
(function () {
  "use strict";
  var SH = window.SH; if (!SH) return;
  var cmd = SH.cmd, line = SH.line, esc = SH.esc;

  // sudo: the sudoers line (rarely actually runs)
  cmd("sudo", function (a) {
    if (a.length && Math.random() < 0.06) { line("(the machine hesitates, then obeys)", "dim"); return SH.run(a.join(" ")); }
    line("[sudo] password for visitor: ", "dim");
    line("visitor is not in the sudoers file. This incident will be reported.");
  }, { hidden: true });

  // rm -rf / : dramatic, reversible
  cmd("rm delete", function (a) {
    if (!(a.join(" ").indexOf("-rf /") >= 0 || a.join(" ").indexOf("-fr /") >= 0)) { line("rm: refusing. (this isn't that kind of shell)", "dim"); return; }
    var files = ["music/", "archive/", "commissions.txt", "about.txt", "links.txt", "tools.txt", ".plan", "/bin/ladsh", "/dev/feelings", "/"];
    var i = 0;
    var t = setInterval(function () { if (i < files.length) { line("removing '" + files[i++] + "'"); SH.scroll(); } else { clearInterval(t); tear(); } }, 110);
    function tear() {
      var ui = SH.app(function () {}, function () {});
      var W = SH.cols(), H = SH.rowsN(), n = 0, G = "█▓▒░#%@*=+-:. ";
      var f = setInterval(function () { n++; var s = ""; for (var y = 0; y < H; y++) { for (var x = 0; x < W; x++) s += G[Math.random() * G.length | 0]; s += "\n"; } ui.el.innerHTML = '<span style="color:' + (n % 2 ? "var(--red)" : "var(--blue)") + '">' + esc(s) + "</span>"; if (n > 8) { clearInterval(f); panic(ui); } }, 70);
    }
    function panic(ui) {
      ui.el.innerHTML = '<span style="color:var(--red)">\nKernel panic - not syncing: VFS: Unable to mount root fs\nCPU: 0 PID: 1 Comm: ladsh Tainted: feelings\n[  666.666] ---[ end Kernel panic ]---\n\nrebooting';
      var dots = 0, d = setInterval(function () { ui.el.innerHTML += "."; if (++dots > 5) { clearInterval(d); ui.close(); SH.out.innerHTML = ""; if (SH.reboot) SH.reboot(); } }, 300);
    }
    return true;
  }, { hidden: true });

  // exit: disconnect + reconnect
  cmd("exit logout quit", function () {
    var ui = SH.app(function () {}, function () {});
    ui.el.innerHTML = "\nconnection closed by remote host.";
    setTimeout(function () { ui.el.innerHTML = ""; }, 1100);
    setTimeout(function () { ui.el.innerHTML = "reconnecting"; }, 1600);
    var dots = setInterval(function () { ui.el.innerHTML += "."; }, 300);
    setTimeout(function () { clearInterval(dots); ui.el.innerHTML = '<span style="color:var(--blue)">you came back.</span>'; }, 2600);
    setTimeout(function () { ui.close(); SH.out.innerHTML = ""; if (SH.reboot) SH.reboot(); }, 3400);
    return true;
  }, { hidden: true });

  // vim: the trap
  cmd("vim vi nano emacs", function () {
    line('"portal.txt" [readonly]  1 line                 0,0-1', "dim");
    line("you are in vim. this was a mistake.", "dim");
    SH.read("", function (v) {
      v = v.trim();
      if (v === ":q" || v === ":q!" || v === ":wq" || v === ":x" || v === ":qa") { line("you escaped vim. few do.", "blue"); return false; }
      if (v === ":help") { line("there is no help. there is only :q", "dim"); return true; }
      line("E: you are still in vim. type  :q  to leave. (really.)", "dim"); return true;
    });
    return true;
  }, { hidden: true });

  // ping / traceroute with song hops
  cmd("ping", function (a) {
    var host = a[0] || "liveanddie.xyz"; line("PING " + host + " (6.6.6.6): 56 data bytes");
    var i = 0, t = setInterval(function () { if (i < 4) { line("64 bytes from 6.6.6.6: icmp_seq=" + i + " ttl=33 time=" + (3 + Math.random() * 6).toFixed(3) + " ms"); i++; SH.scroll(); } else { clearInterval(t); line("--- " + host + " ping statistics ---"); line("4 packets transmitted, 4 received, 0% packet loss"); SH.newPrompt(); } }, 400);
    return true;
  }, { hidden: true });
  cmd("traceroute tracert", function (a) {
    line("traceroute to " + (a[0] || "liveanddie.xyz") + ", 30 hops max");
    SH.loadArc().then(function (d) {
      var hops = d.tracks.slice(0, 7).map(function (t) { return t.title; }); var i = 0;
      var iv = setInterval(function () { if (i < hops.length) { line(" " + (i + 1) + "  " + SH.trunc(hops[i], 32) + "  " + (2 + Math.random() * 20).toFixed(1) + " ms"); i++; SH.scroll(); } else { clearInterval(iv); line(" " + (i + 1) + "  liveanddie.xyz  arrived."); SH.newPrompt(); } }, 350);
    });
    return true;
  }, { hidden: true });

  // moshsay: original creature (a little tv/vcr on legs, no eyes)
  cmd("moshsay", function (a) {
    var text = a.join(" ") || "stay noided"; var w = Math.max(text.length, 3);
    line(" " + new Array(w + 3).join("_"));
    line("< " + text + " >");
    line(" " + new Array(w + 3).join("-"));
    line("     \\");
    line("      \\   .======.");
    line("          |[::::]|");
    line("          |[::::]|   ");
    line("          '==++=='");
    line("           /    \\");
    line("          ''      ''");
  }, { hidden: true });

  // reboot hook used by rm/exit -> re-run the welcome banner
  SH.reboot = function () { var ev = document.createElement("div"); SH.line("LIVE.AND.DIE BIOS v7.0  reboot OK", "dim"); SH.run("neofetch"); };
})();
