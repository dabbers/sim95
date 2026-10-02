// vapor-bridge.js - stocks a Vapor store on your SIM95 machine straight from
// GitHub: every app, game and Vapor itself, at the newest build in the
// repository. Run it in the browser tab where SIM95 is running (F12 >
// Console), with the machine booted to its desktop:
//
//   fetch("https://raw.githubusercontent.com/dabbers/sim95/main/tools/vapor-bridge.js").then(r => r.text()).then(eval)
//
// It reads vapor/SHELF/SHELF.TXT (made by tools/build-installer.mjs), fetches
// what it lists, and publishes it into C:\WEB\VAPOR exactly as Vapor's
// Publish Apps would: each item cut into parts that fit a network message,
// and its line in CATALOG.TXT. Items already there at the same build are left
// alone; anything the store has that the repository doesn't is kept. The
// store's own pages (C:\WEB\VAPOR\*.ASP) are brought up to date too. A
// machine that wasn't a store becomes one (Vapor is put in
// C:\PROGRAMS\VAPOR.SPK and started).
//
// Every Vapor shopping at this machine then offers the updates: Library >
// Update, or Vapor > Update All. (Vapor checks the store every few minutes,
// or now with Vapor > Check for Updates.)
//
// Another branch or commit: set VAPOR_BRIDGE first, in the same paste:
//   VAPOR_BRIDGE = { ref: "some-branch" }; fetch(".../some-branch/tools/vapor-bridge.js")...
// Nothing leaves your browser except the requests to GitHub.
(async (o) => {
  o = o || {};
  const OWNER = o.owner || "dabbers";
  const REPO = o.repo || "sim95";
  const REF = o.ref || "main";
  const STORE = "C:\\WEB\\VAPOR";
  const ME = "C:\\PROGRAMS\\VAPOR.SPK";
  const PART = 15000; // as Vapor's Publish Apps cuts them
  const log = o.log || ((...a) => console.log("%cVapor bridge%c " + a.join(" "), "color:#fff;background:#1b2838;padding:1px 4px", ""));

  // The running SIM95: the page hands its machine (disk, kernel, network) to
  // the desktop as a React prop, so find it on the way up from any element.
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
  if (!machine) throw new Error("Vapor bridge: no running SIM95 here. Run this in the SIM95 tab once the machine is at its desktop.");
  const disk = machine.fs;

  // GitHub: the branch's newest commit, so every file comes from the same one
  // (and none from a cache that's a few minutes behind).
  let sha = REF;
  if (!o.get) {
    try {
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/commits/${encodeURIComponent(REF)}`, { headers: { Accept: "application/vnd.github+json" } });
      if (r.ok) sha = (await r.json()).sha;
    } catch {}
    if (sha === REF) log(`(GitHub didn't say which commit ${REF} is - its limit is 60 asks an hour - so the files come by branch name)`);
  }
  const get = o.get || (async (p) => {
    const r = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}/${p}`);
    if (!r.ok) throw new Error(`${p}: ${r.status} ${r.statusText}`);
    return r.text();
  });
  log(`stocking ${machine.hostname ? machine.hostname() : "this machine"}'s store from github.com/${OWNER}/${REPO} (${REF}${sha !== REF ? " " + sha.slice(0, 7) : ""})`);

  const shelf = (await get("vapor/SHELF/SHELF.TXT")).split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
  const items = shelf.filter((l) => l.startsWith("item ")).map((l) => l.split(" ")).map(([, p, version]) => ({ path: p, version }));

  // the files, four at a time
  const texts = new Map();
  for (let i = 0; i < items.length; i += 4) {
    await Promise.all(items.slice(i, i + 4).map(async (it) => texts.set(it.path, await get(it.path))));
    log(`fetched ${Math.min(i + 4, items.length)} of ${items.length}`);
  }

  const read = (p) => (disk.exists(p) ? disk.read(p) : "");
  const field = (line, i) => line.split("|")[i] ?? "";
  const meta = (header, key) => { for (const part of header.split("|")) if (part.startsWith(key + "=")) return part.slice(key.length + 1); return ""; };
  const wasStore = disk.exists(STORE + "\\CATALOG.TXT");
  if (!disk.exists(STORE)) disk.mkdirAll(STORE);
  let catalog = read(STORE + "\\CATALOG.TXT").split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l);
  const report = [];

  // Publish Apps, line for line (vapor/PROGRAMS/VAPOR.SPK, PublishOne)
  function publish(text) {
    const header = text.split("\n")[0];
    const id = meta(header, "id").toUpperCase();
    if (!id || id.length > 8 || id.includes("\\") || id.includes(".")) throw new Error("not a Vapor item: " + header.slice(0, 60));
    const version = meta(header, "version");
    const dir = STORE + "\\" + id;
    const had = catalog.find((l) => field(l, 0) === id);
    if (had && field(had, 8) === version && disk.exists(dir + "\\" + field(had, 2) + ".TXT")) return { id, name: meta(header, "name"), build: version, was: version };
    if (disk.exists(dir)) { for (const f of disk.list(dir)) if (!f.isDir) disk.remove(f.path); }
    else disk.mkdirAll(dir);
    const lines = text.replace(/\r/g, "").split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    let chunk = "";
    let n = 0;
    for (const line of lines) {
      if (chunk.length + line.length + 1 > PART && chunk) { disk.write(`${dir}\\${++n}.TXT`, chunk); chunk = ""; }
      chunk += line + "\n";
    }
    if (chunk) disk.write(`${dir}\\${++n}.TXT`, chunk);
    const entry = [id, meta(header, "name"), n, text.length, "ok", meta(header, "category"), meta(header, "about"), meta(header, "kind"), version, meta(header, "run"), meta(header, "files"), meta(header, "tasks"), meta(header, "startup"), meta(header, "folder").toUpperCase()].join("|");
    catalog = had ? catalog.map((l) => (field(l, 0) === id ? entry : l)) : [...catalog, entry];
    return { id, name: meta(header, "name"), build: version, was: had ? field(had, 8) || "-" : "" };
  }

  let client = "";
  for (const it of items) {
    const text = texts.get(it.path);
    if (!text.startsWith("' VAPOR|")) throw new Error(it.path + " has no Vapor header");
    if (meta(text.split("\n")[0], "version") !== it.version) throw new Error(`${it.path} is build ${meta(text.split("\n")[0], "version")}, the shelf says ${it.version}: try again in a minute`);
    if (meta(text.split("\n")[0], "kind") === "client") client = text;
    const r = publish(text);
    report.push({ item: r.name, id: r.id, build: r.build, result: r.was === r.build ? "up to date" : r.was ? "updated from " + r.was : "new" });
  }
  // coming soon: on the shelf until it's out
  for (const l of shelf.filter((l) => l.startsWith("soon "))) {
    const line = l.slice(5);
    if (!catalog.some((c) => field(c, 0) === field(line, 0))) catalog.push(line);
  }
  disk.write(STORE + "\\CATALOG.TXT", catalog.join("\n") + "\n");

  // the store's web site
  for (const [, from, to] of shelf.filter((l) => l.startsWith("site ")).map((l) => l.split(" "))) {
    const text = await get(from);
    if (read(to) !== text) disk.write(to, text);
  }
  disk.write(STORE + "\\BRIDGE.TXT", [`github.com/${OWNER}/${REPO}`, REF, sha, new Date().toISOString().slice(0, 16).replace("T", " ")].join("|") + "\n");

  // A machine with no Vapor gets one, shopping here
  let started = false;
  if (!disk.exists(ME) && client) {
    disk.write(ME, client);
    try { machine.kernel.spawn(ME, []); started = true; } catch {}
  }
  if (disk.flush) await disk.flush();

  const changed = report.filter((r) => r.result !== "up to date");
  if (typeof console.table === "function" && !o.log) console.table(report);
  log(`${changed.length ? changed.length + " new or updated, " : ""}${report.length - changed.length} already up to date.${wasStore ? "" : " This machine is a Vapor store now."}${started ? " Vapor is starting." : ""} Vapors that shop here will offer the updates (Vapor > Check for Updates).`);
  return { ref: REF, sha, report };
})(globalThis.VAPOR_BRIDGE);
