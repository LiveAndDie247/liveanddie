// git log / git show (the site's real history from the public GitHub API), fork (a second shell pane), hack (a minigame)
import { stage } from "./util.mjs";
const REPO = "LiveAndDie247/liveanddie", API = "https://api.github.com/repos/" + REPO;

function plain(SH, text, cls) { const d = document.createElement("div"); d.className = "ln" + (cls ? " " + cls : ""); d.textContent = text; SH.out.appendChild(d); return d; }
async function gh(path) { const r = await fetch(API + path, { headers: { Accept: "application/vnd.github+json" } }); if (r.status === 403 || r.status === 429) throw new Error("github is rate limiting this network right now. try again in a while."); if (r.status === 404) throw new Error("unknown revision."); if (!r.ok) throw new Error("github answered " + r.status + "."); return r.json(); }
// commit author names are deliberately never shown: only hash, date and message
function git(SH, a) {
  const sub = (a[0] || "").toLowerCase();
  if (sub === "log") {
    SH.line("fetching the real history from github ...", "dim");
    gh("/commits?per_page=" + (a.includes("--oneline") ? 25 : 12)).then(list => {
      list.forEach(c => {
        const msg = (c.commit && c.commit.message || "").split("\n"), sha = c.sha || "";
        if (a.includes("--oneline")) { const d = plain(SH, ""); d.innerHTML = '<a class="cmd" data-cmd="git show ' + sha.slice(0, 7) + '">' + sha.slice(0, 7) + "</a> "; d.appendChild(document.createTextNode(msg[0].slice(0, 100))); return; }
        const h = plain(SH, ""); h.innerHTML = '<span class="blue">commit <a class="cmd" data-cmd="git show ' + sha.slice(0, 7) + '">' + sha + "</a></span>";
        plain(SH, "Date:   " + new Date(c.commit.committer.date).toString().replace(/ \(.*\)$/, ""), "dim"); plain(SH, ""); plain(SH, "    " + msg[0]); plain(SH, "");
      });
      SH.line("this is the site's actual commit log, live from the public repository. ({{git log --oneline|--oneline}})", "dim"); SH.newPrompt();
    }).catch(e => { SH.line("git: " + e.message, "dim"); SH.newPrompt(); });
    return true;
  }
  if (sub === "show") {
    const ref = (a[1] || "HEAD").replace(/[^0-9a-zA-Z~^._-]/g, "").slice(0, 44); SH.line("fetching " + ref + " ...", "dim");
    gh("/commits/" + (ref === "HEAD" ? "main" : ref)).then(c => {
      const h = plain(SH, "commit " + c.sha, "blue"); plain(SH, "Date:   " + new Date(c.commit.committer.date).toString().replace(/ \(.*\)$/, ""), "dim"); plain(SH, "");
      c.commit.message.split("\n").filter(l => !/^co-authored-by:/i.test(l.trim())).forEach(l => plain(SH, "    " + l)); plain(SH, "");
      (c.files || []).slice(0, 14).forEach(f => plain(SH, " " + f.filename.slice(0, 44).padEnd(46) + "| +" + f.additions + " -" + f.deletions, "dim"));
      if (c.stats) plain(SH, " " + (c.files || []).length + " files changed, " + c.stats.additions + " insertions(+), " + c.stats.deletions + " deletions(-)");
      SH.newPrompt();
    }).catch(e => { SH.line("git: " + e.message, "dim"); SH.newPrompt(); });
    return true;
  }
  if (sub === "status") { SH.line("On branch main"); SH.line("Your branch is up to date with 'origin/main'."); SH.line("nothing to commit, working tree clean"); return; }
  if (sub === "push" || sub === "commit" || sub === "reset" || sub === "rebase") { SH.line("remote: Permission to " + REPO + ".git denied to visitor.", "dim"); SH.line("fatal: unable to access the repository: read-only shell"); return; }
  if (sub === "blame") { SH.line("^0000000 (you 2026-11-07 00:00:00) everything", "dim"); return; }
  if (sub === "clone") { SH.line("the source is public:  [[https://github.com/" + REPO + "|github.com/" + REPO + "]]"); return; }
  SH.line("usage: git log [--oneline] | git show <hash> | git status", "dim");
}

// ------------------------------------------------------------------ fork: a second shell, side by side
let pane = null;
function fork(SH, a) {
  if (window.top !== window) { SH.line("fork: this shell is already a pane.", "dim"); return; }
  const off = () => { if (!pane) return; pane.f.remove(); pane.x.remove(); pane = null; SH.term.style.right = SH.term.style.top = ""; const b = document.getElementById("cmdbar"); b.style.right = ""; SH.line("[pane closed]", "dim"); };
  if (pane || (a[0] || "") === "off" || a[0] === "--close") { if (pane) off(); else SH.line("fork: no pane open.", "dim"); return; }
  const wide = innerWidth >= 700, f = document.createElement("iframe"); f.src = "/?pane=1"; f.title = "second shell";
  f.style.cssText = "position:fixed;z-index:25;border:0;background:#000;" + (wide ? "top:0;right:0;width:50%;height:100%;border-left:1px solid var(--dim)" : "top:0;left:0;width:100%;height:46%;border-bottom:1px solid var(--dim)");
  const x = document.createElement("button"); x.textContent = "[ x pane ]"; x.style.cssText = "position:fixed;z-index:26;font:inherit;background:#000;color:var(--blue);border:1px solid var(--dim);padding:3px 6px;" + (wide ? "top:4px;right:6px" : "top:calc(46% - 30px);right:6px");
  x.addEventListener("click", off); document.body.append(f, x); pane = { f, x };
  if (wide) { SH.term.style.right = "50%"; document.getElementById("cmdbar").style.right = "50%"; } else SH.term.style.top = "46%";
  SH.line("forked: a second shell is running in its own pane. 'fork off' (or [ x pane ]) closes it.", "blue");
}

// ------------------------------------------------------------------ hack: scrolling code + a timed typing challenge
function hack(SH) {
  const S = stage(SH, { title: "hack  -  type each code before the timer runs out", bye: "" });
  const scr = document.createElement("pre"); scr.style.cssText = "position:absolute;inset:0;margin:0;padding:6px 8px;overflow:hidden;color:var(--dim);font:inherit;line-height:1.1;white-space:pre"; S.host.appendChild(scr);
  const box = document.createElement("div"); box.style.cssText = "position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);background:#000;border:1px solid var(--red);padding:14px 16px;min-width:270px;text-align:center;line-height:1.5"; S.host.appendChild(box);
  const HEX = "0123456789ABCDEF", KW = ["mov", "xor", "jmp", "call", "push", "pop", "cmp", "lea", "ret", "int 0x80", "nop", "sub", "and", "shl"];
  const rnd = n => Array.from({ length: n }, () => HEX[Math.random() * 16 | 0]).join("");
  const codeLine = () => "0x" + rnd(8) + "  " + rnd(2) + " " + rnd(2) + " " + rnd(2) + " " + rnd(2) + "   " + KW[Math.random() * KW.length | 0] + "  " + ["eax", "ebx", "ecx", "esi", "[ebp-" + (Math.random() * 64 | 0) + "]"][Math.random() * 5 | 0] + ", 0x" + rnd(4);
  const lines = []; let scrollT = setInterval(() => { lines.push(codeLine()); if (lines.length > 70) lines.shift(); scr.textContent = lines.join("\n"); scr.scrollTop = 1e6; }, 45);
  let round = 0, target = "", left = 0, tickT = 0, over = false; const ROUNDS = 3, SECS = [9, 8, 7];
  box.innerHTML = '<div class="blue">ACCESSING live.and.die MAINFRAME</div><div id="hk_c" style="font-size:32px;color:var(--red);letter-spacing:2px;margin:8px 0"></div><div id="hk_t" class="dim"></div><input id="hk_i" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" style="font:inherit;background:#000;color:var(--blue);border:1px solid var(--dim);padding:8px;width:100%;text-align:center;text-transform:uppercase;outline:0" aria-label="type the code">';
  const C = box.querySelector("#hk_c"), T = box.querySelector("#hk_t"), I = box.querySelector("#hk_i");
  function next() { if (round >= ROUNDS) return win(); target = rnd(5 + round); C.textContent = target; left = SECS[round] * 10; I.value = ""; I.focus(); }
  function tick() { if (over) return; left--; T.textContent = "firewall " + (round + 1) + "/" + ROUNDS + "   " + "#".repeat(Math.max(0, Math.ceil(left / 5))) + " " + (left / 10).toFixed(1) + "s"; if (left <= 0) lose(); }
  function end() { over = true; clearInterval(tickT); clearInterval(scrollT); }
  function win() { end(); box.innerHTML = '<div style="font-size:32px;color:var(--blue)">ACCESS GRANTED</div>'; setTimeout(() => { if (!S.closed) S.close(); SH.line("ACCESS GRANTED.", "blue"); SH.line("a file was left open on the mainframe. it says:"); SH.line("  \"not every track is on the list. count from zero. look - don't listen.\""); SH.newPrompt(); }, 1300); }
  function lose() { end(); box.innerHTML = '<div style="font-size:32px;color:var(--red)">ACCESS DENIED</div><div class="dim">trace complete. connection dropped.</div>'; setTimeout(() => { if (!S.closed) S.close("ACCESS DENIED. ('hack' to try again)"); }, 1400); }
  I.addEventListener("input", () => { if (over) return; if (I.value.toUpperCase().replace(/[^0-9A-F]/g, "") === target) { round++; next(); } });
  S.onClose(() => { end(); });
  tickT = setInterval(tick, 100); next();
}

export default function (SH) {
  SH.cmd("git", a => git(SH, a), { help: "the site's real commit history, live from github", usage: "git log [--oneline] | git show <hash>", man: "git log - prints this site's real commit history, fetched live from the public GitHub repository.\ngit show <hash> - prints one commit's message and the files it changed." });
  SH.cmd("fork", a => fork(SH, a), { help: "open a second shell in its own pane", usage: "fork [off]", man: "fork - spawns a second terminal pane running its own shell, side by side (stacked on a phone). 'fork off' closes it." });
  SH.cmd("hack", () => { hack(SH); return true; }, { help: "a hollywood hacking minigame", man: "hack - code scrolls, firewalls rise. Type each code before its timer runs out, three times, and you are in." });
}
