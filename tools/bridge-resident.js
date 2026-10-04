// bridge-resident.js - keeps a SIM95 machine (STARTHERE) up to date from
// GitHub by itself, and does it on request from inside SIM95: over ssh, say.
// It runs in the real browser tab where the machine runs, loaded there by
// tools/sim95-bridge.user.js (a userscript), and stays.
//
// Every 15 minutes, and whenever asked, it:
//   1. finds the newest commit on the branch it follows (main);
//   2. if that's new, stocks the machine's Vapor store from it, as
//      tools/vapor-bridge.js does (it runs that very script, from the commit);
//   3. runs the newer installer of each central-host app the machine has
//      (the Pixel Wall, the npm registry, SimNIC, the Welcome Wagon), which
//      aren't in the stores;
//   4. upgrades what's installed here from the store: Sim Shell's
//      "sim-get upgrade -y", in a Sim Shell window that closes when it's done.
//
// It talks to SIM95 through files in C:\SYSTEM\BRIDGE, which Sim Shell's
// bridge command reads and writes (bridge status, bridge update, bridge log):
//   ALIVE.TXT    when it last said it's here (seconds since 1970)
//   BRIDGE.INI   ref=main, every=15 (minutes, 0 for never), upgrade=1
//   REQUEST.TXT  "update" (or "update force"), left by "bridge update"
//   STATUS.TXT   what it's doing, or did last
//   LOG.TXT      the last 300 lines of everything it did
//   DONE.TXT     ref|commit last brought here, and each central app's hash
//
// Nothing leaves the browser except requests to GitHub, for this repository
// only. What anyone who can write C:\SYSTEM\BRIDGE (anyone with the machine's
// password: SIM95 has no real security) can do is ask for this repository's
// own branches to be installed.
(async (o) => {
  o = o || {};
  const OWNER = "dabbers", REPO = "sim95";
  const DIR = "C:\\SYSTEM\\BRIDGE";
  const SHELL = "C:\\PROGRAMS\\SIMSH.SPK";
  const VERSION = "1";
  const clock = o.clock || { now: () => Date.now(), every: (ms, f) => setInterval(f, ms), after: (ms, f) => setTimeout(f, ms) };
  const sleep = (ms) => new Promise((r) => clock.after(ms, r));
  const say = o.say || ((...a) => console.log("%cSIM95 bridge%c " + a.join(" "), "color:#fff;background:#008080;padding:1px 4px", ""));

  function findMachine() {
    for (const el of document.querySelectorAll("body *")) {
      const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
      if (!key) continue;
      for (let f = el[key]; f; f = f.return) {
        const m = f.memoizedProps && f.memoizedProps.machine;
        if (m && m.fs && typeof m.fs.write === "function" && m.kernel) return m;
      }
    }
    return null;
  }
  const machine = o.machine || findMachine();
  if (!machine) throw new Error("SIM95 bridge: no running SIM95 in this tab");
  const disk = machine.fs;
  const read = (p) => (disk.exists(p) ? disk.read(p) : "");
  const write = (p, t) => disk.write(p, t);
  if (!disk.exists(DIR)) disk.mkdirAll(DIR);

  // GitHub: by default, fetch(); a test hands its own
  const github = o.github || {
    async commit(ref) {
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/commits/${encodeURIComponent(ref)}`, { headers: { Accept: "application/vnd.github+json" } });
      if (r.status === 404 || r.status === 422) throw new Error(`there's no branch or commit called ${ref}`);
      if (!r.ok) throw new Error(`GitHub said ${r.status} (it allows 60 asks an hour)`);
      return (await r.json()).sha;
    },
    async file(sha, p) {
      const r = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}/${p}`);
      if (!r.ok) throw new Error(`${p}: ${r.status} ${r.statusText}`);
      return r.text();
    },
  };

  // ---- settings, and what's been done
  function settings() {
    const s = { ref: "main", every: 15, upgrade: true };
    for (const line of read(DIR + "\\BRIDGE.INI").split(/\r?\n/)) {
      const m = /^\s*(\w+)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m) continue;
      if (m[1].toLowerCase() === "ref" && /^[A-Za-z0-9._\/-]{1,80}$/.test(m[2])) s.ref = m[2];
      if (m[1].toLowerCase() === "every") s.every = Math.max(0, parseInt(m[2]) || 0);
      if (m[1].toLowerCase() === "upgrade") s.upgrade = m[2] !== "0";
    }
    return s;
  }
  if (!disk.exists(DIR + "\\BRIDGE.INI")) write(DIR + "\\BRIDGE.INI", "ref=main\nevery=15\nupgrade=1\n");
  function done() {
    const d = { ref: "", sha: "", central: {} };
    for (const line of read(DIR + "\\DONE.TXT").split(/\r?\n/)) {
      const p = line.split("|");
      if (p[0] === "commit") { d.ref = p[1] || ""; d.sha = p[2] || ""; }
      if (p[0] === "central" && p[1]) d.central[p[1]] = p[2] || "";
    }
    return d;
  }
  function saveDone(d) {
    write(DIR + "\\DONE.TXT", [`commit|${d.ref}|${d.sha}`, ...Object.entries(d.central).map(([k, v]) => `central|${k}|${v}`)].join("\n") + "\n");
  }

  // ---- the log: LOG.TXT, and the console
  const stamp = () => { const d = new Date(clock.now()); return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`; };
  function log(text) {
    say(text);
    const lines = (read(DIR + "\\LOG.TXT") + stamp() + "  " + text + "\n").split("\n").filter((l) => l !== "");
    write(DIR + "\\LOG.TXT", lines.slice(-300).join("\n") + "\n");
  }
  const status = (text) => write(DIR + "\\STATUS.TXT", stamp() + "  " + text + "\n");
  const alive = () => write(DIR + "\\ALIVE.TXT", Math.floor(clock.now() / 1000) + "|" + VERSION + "\n");

  // ---- running a SPARK program here, and waiting for it to end. What it
  // prints is kept (with no output window of its own, it ends when it's done).
  const running = (pid) => machine.kernel.ps().some((p) => p.pid === pid);
  async function runAndWait(pathName, args, what, ms) {
    const out = { text: "", destroyed: false, call(method, t) { if (method === "Write") out.text += String(t); } };
    const pid = machine.kernel.spawn(pathName, args, { stdout: out });
    const until = clock.now() + ms;
    while (running(pid)) {
      if (clock.now() > until) { log(`  ${what} is still running after ${Math.round(ms / 60000)} minutes; left to it (a dialog waiting for an answer?)`); return null; }
      await sleep(1000);
    }
    return out.text;
  }
  const lastWords = (text) => (text || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l).slice(-1)[0] || "done";

  // ---- one round: GitHub to this machine
  let busy = false;
  async function round(why, force) {
    if (busy) return "busy";
    busy = true;
    const s = settings();
    try {
      alive();
      status(`checking ${s.ref} (${why})`);
      const sha = await github.commit(s.ref);
      const d = done();
      if (!force && d.sha === sha && d.ref === s.ref) {
        status(`up to date with ${s.ref} ${sha.slice(0, 7)} (checked ${why === "every" ? "on the clock" : why})`);
        return "same";
      }
      log(`${s.ref} is at ${sha.slice(0, 7)}${d.sha && d.sha !== sha ? ` (was ${d.sha.slice(0, 7)})` : ""}: bringing it here (${why})`);

      // 1. the store's shelves, by the commit's own vapor-bridge.js
      status(`stocking the store from ${s.ref} ${sha.slice(0, 7)}`);
      const shelfText = await github.file(sha, "vapor/SHELF/SHELF.TXT");
      const bridgeCode = await github.file(sha, "tools/vapor-bridge.js");
      const quiet = [];
      globalThis.VAPOR_BRIDGE = { machine, ref: sha, get: (p) => github.file(sha, p), log: (...a) => quiet.push(a.join(" ")) };
      let report = [];
      try { report = ((await (0, eval)(bridgeCode)) || {}).report || []; }
      finally { delete globalThis.VAPOR_BRIDGE; }
      const changed = report.filter((r) => r.result !== "up to date");
      if (changed.length) for (const r of changed) log(`  store: ${r.item} ${r.result === "new" ? "is new" : r.result} (build ${r.build})`);
      else log(`  store: all ${report.length} up to date`);

      // 2. the central host's own apps, the ones this machine has
      for (const line of shelfText.split(/\r?\n/).filter((l) => l.startsWith("central "))) {
        const [, file, hash, marker] = line.split(" ");
        if (!disk.exists(marker)) continue;
        if (d.central[file] === hash) continue;
        status(`installing ${file}`);
        const text = await github.file(sha, file);
        const at = DIR + "\\" + file.split("/")[0].toUpperCase().slice(0, 8) + ".SPK";
        write(at, text);
        log(`  ${file.split("/")[0]}: running its installer`);
        const said = await runAndWait(at, [], file.split("/")[0] + "'s installer", 5 * 60000);
        if (said !== null) {
          log(`  ${file.split("/")[0]}: ${lastWords(said)}`);
          d.central[file] = hash;
        }
      }

      // 3. what's installed here, from the store
      if (s.upgrade) {
        if (!disk.exists(SHELL)) log("  upgrade: skipped (install Sim Shell for sim-get: sim-get install simsh, or its INSTALL.SPK)");
        else {
          status("upgrading what's installed (sim-get upgrade -y)");
          write(DIR + "\\UPGRADE.TXT", "");
          await runAndWait(SHELL, ["-c", "sim-get", "upgrade", "-y", "--log=" + DIR + "\\UPGRADE.TXT", "--exit"], "sim-get upgrade", 15 * 60000);
          const out = read(DIR + "\\UPGRADE.TXT").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/\$ /.test(l) && !/^Sim Shell /.test(l));
          log("  upgrade: " + (out.join(" / ") || "done"));
        }
      }
      d.ref = s.ref;
      d.sha = sha;
      saveDone(d);
      status(`up to date with ${s.ref} ${sha.slice(0, 7)} (brought here ${why === "every" ? "on the clock" : why})`);
      return "updated";
    } catch (e) {
      log(`failed: ${e && e.message ? e.message : e}`);
      status(`failed: ${e && e.message ? e.message : e}`);
      return "failed";
    } finally {
      busy = false;
    }
  }

  // ---- the mailbox: "bridge update" in Sim Shell leaves REQUEST.TXT
  async function mailbox() {
    alive();
    const req = read(DIR + "\\REQUEST.TXT").trim();
    if (!req) return;
    disk.remove(DIR + "\\REQUEST.TXT");
    if (/^update/i.test(req)) {
      log(`asked: ${req}`);
      await round("asked", /force/i.test(req));
    } else log(`asked something the bridge doesn't do: ${req}`);
  }

  let lastRound = clock.now();
  alive();
  const timers = [
    clock.every(10000, alive),
    clock.every(3000, () => { mailbox().catch((e) => log("mailbox: " + e.message)); }),
    clock.every(60000, () => {
      const s = settings();
      if (s.every > 0 && clock.now() - lastRound >= s.every * 60000) { lastRound = clock.now(); round("every"); }
    }),
  ];
  log(`the bridge is here (following ${settings().ref}, every ${settings().every} minutes)`);
  status("starting");
  const api = { round, mailbox, stop: () => timers.forEach((t) => clearInterval(t)) };
  globalThis.SIM95_BRIDGE = api;
  if (!o.noFirstRound) clock.after(5000, () => { lastRound = clock.now(); round("start"); });
  return api;
})(globalThis.SIM95_RESIDENT);
