// npm - packages for Node on SIM95, from the network's registry (an npm
// registry is a web app: http://starthere/npm/ unless C:\NODE\NPMRC.TXT says
// another). C:\PROGRAMS\NPM.SPK runs this in Node:
//   npm init [-y]                  npm install [pkg[@range]...] [-g] [-D] [--no-save]
//   npm uninstall pkg [-g]         npm update [pkg]      npm ls [-g]     npm outdated
//   npm search words               npm view pkg [field]
//   npm adduser / login / logout / whoami
//   npm publish                    npm unpublish pkg@version
//   npm version patch|minor|major  npm run script / start / test
//   npm config get|set|list        npm help
//
// File names are 8.3, so node_modules is NODE_MOD, package.json is
// PACKAGE.JSN, and package names are 1 to 8 of a-z, 0-9, - and _ (each is a
// folder). A package travels as a bundle: one text file holding all its files
// (NPMPACK below), cut into parts of whole lines that each fit in one network
// message, as Vapor cuts its installers.
const fs = require("fs");
const path = require("path");
const http = require("http");
const readline = require("readline");
const semver = require("./SEMVER.JS");

const RCFILE = "C:\\NODE\\NPMRC.TXT";
const GLOBALDIR = "C:\\NODE\\MODULES";
const BINDIR = "C:\\PROGRAMS";
const DEFAULT_REGISTRY = "http://starthere/npm/";
const PART = 30000;
const VERSION = "1.0.0";

// ---------------------------------------------------------------- settings

function readRc() {
  const rc = {};
  if (!fs.existsSync(RCFILE)) return rc;
  for (const line of fs.readFileSync(RCFILE).split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && line.charAt(0) !== ";" && line.charAt(0) !== "#") rc[line.substring(0, i).trim()] = line.substring(i + 1).trim();
  }
  return rc;
}
function writeRc(rc) {
  fs.writeFileSync(RCFILE, Object.keys(rc).map((k) => k + "=" + rc[k]).join("\n") + "\n");
}
const rc = readRc();
let registry = rc.registry || DEFAULT_REGISTRY;
if (registry.substring(registry.length - 1) !== "/") registry += "/";

// ---------------------------------------------------------------- talking to the registry

function regParts() {
  let u = registry;
  if (u.substring(0, 7) === "http://") u = u.substring(7);
  const slash = u.indexOf("/");
  return { host: slash < 0 ? u : u.substring(0, slash), base: slash < 0 ? "/" : u.substring(slash) };
}

function enc(s) { return encodeURIComponent(String(s)); }
function query(q) { return Object.keys(q).map((k) => k + "=" + enc(q[k])).join("&"); }

// The registry's API: resolves with {status, text}; a network failure rejects.
function api(method, q, body, contentType) {
  const r = regParts();
  return new Promise((ok, fail) => {
    const req = http.request({ host: r.host, path: r.base + "api.asp?" + query(q), method, headers: { "Content-Type": contentType || "text/plain" } }, (res) => {
      let text = "";
      res.on("data", (d) => (text += d));
      res.on("end", () => ok({ status: res.statusCode, text }));
    });
    req.on("error", (e) => fail(new Error("The registry at " + registry + " didn't answer (" + (e.message || e) + ")")));
    req.end(body === undefined ? "" : body);
  });
}
// a few tries, for things that only read
function apiGet(q) {
  const go = (left) => api("GET", q).catch((e) => (left > 0 ? go(left - 1) : Promise.reject(e)));
  return go(2);
}
// "OK rest" -> rest; "ERR why" -> an error
function okText(res) {
  const t = res.text;
  if (t.substring(0, 3) === "OK" + " " || t === "OK" || t.substring(0, 3) === "OK\n") return t.substring(3);
  if (t.substring(0, 4) === "ERR ") throw new Error(t.substring(4).split("\n")[0]);
  throw new Error("The registry gave an answer npm doesn't understand (" + res.status + "): " + t.substring(0, 80));
}

const infoCache = {};
function info(name) {
  if (infoCache[name]) return Promise.resolve(infoCache[name]);
  return apiGet({ do: "info", p: name }).then((res) => {
    if (res.status === 404) { const e = new Error("404 Not Found - '" + name + "' is not in the registry."); e.code = "E404"; throw e; }
    let data;
    try { data = JSON.parse(res.text); } catch (e) { throw new Error("The registry's answer about " + name + " was garbled: " + res.text.substring(0, 60)); }
    infoCache[name] = data;
    return data;
  });
}

// ---------------------------------------------------------------- bundles

// "NPMPACK 1", then for each file "@@F <path> <ends with a line break: 1/0> <lines>"
// and its lines, each after a "|".
function pack(dir) {
  const out = ["NPMPACK 1"];
  const files = [];
  const walk = (d, rel) => {
    for (const n of fs.readdirSync(d)) {
      const full = d + "\\" + n;
      const r = rel ? rel + "/" + n : n;
      if (n === "NODE_MOD" || n.charAt(0) === ".") continue;
      if (fs.statSync(full).isDirectory()) { walk(full, r); continue; }
      let text = fs.readFileSync(full);
      const nl = text.substring(text.length - 1) === "\n";
      if (nl) text = text.substring(0, text.length - 1);
      const lines = text === "" && !nl ? [] : text.split("\n");
      out.push("@@F " + r + " " + (nl ? 1 : 0) + " " + lines.length);
      for (const l of lines) out.push("|" + l);
      files.push({ path: r, size: text.length + (nl ? 1 : 0) });
    }
  };
  walk(dir, "");
  return { text: out.join("\n") + "\n", files };
}

// whole lines, each part at most PART characters
function cut(text) {
  const parts = [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  let cur = "";
  for (const line of lines) {
    if (line.length + 1 > PART) throw new Error("A line is longer than " + PART + " characters, too long for a package: " + line.substring(0, 40) + "...");
    if (cur.length + line.length + 1 > PART) { parts.push(cur); cur = ""; }
    cur += line + "\n";
  }
  if (cur !== "") parts.push(cur);
  return parts;
}

function sum(text) { return __n.sum(text); }

function unpack(text, dir) {
  const lines = text.split("\n");
  if (lines[0] !== "NPMPACK 1") throw new Error("That isn't a package (it starts " + JSON.stringify(lines[0].substring(0, 20)) + ")");
  let i = 1, count = 0;
  while (i < lines.length) {
    const head = lines[i];
    if (head === "") { i++; continue; }
    if (head.substring(0, 4) !== "@@F ") throw new Error("The package is damaged near line " + (i + 1));
    const bits = head.substring(4).split(" ");
    const rel = bits[0], nl = bits[1] === "1", n = parseInt(bits[2]);
    if (rel.indexOf("..") >= 0 || rel.indexOf(":") >= 0 || rel.charAt(0) === "/" || rel.charAt(0) === "\\") throw new Error("The package wants to write outside its folder: " + rel);
    const body = lines.slice(i + 1, i + 1 + n).map((l) => l.substring(1)).join("\n") + (nl ? "\n" : "");
    const file = dir + "\\" + rel.split("/").join("\\");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
    count++;
    i += 1 + n;
  }
  return count;
}

// ---------------------------------------------------------------- package.json

const PKGFILE = "PACKAGE.JSN";
function readPkg(dir) {
  const f = dir + "\\" + PKGFILE;
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f)); } catch (e) { throw new Error("Can't read " + f + ": " + e.message); }
}
function writePkg(dir, pkg) { fs.writeFileSync(dir + "\\" + PKGFILE, JSON.stringify(pkg, null, 2) + "\n"); }

function goodName(n) {
  if (typeof n !== "string" || n.length < 1 || n.length > 8 || n.charAt(0) === "-" || n.charAt(0) === "_") return false;
  for (let i = 0; i < n.length; i++) if ("abcdefghijklmnopqrstuvwxyz0123456789-_".indexOf(n.charAt(i)) < 0) return false;
  return true;
}
const NAMERULE = "a package name is 1 to 8 of a-z, 0-9, - and _ (it's a folder name on every machine)";

// "name", "name@^1.0.0", "name@1.2.3" -> {name, range}
function spec(s) {
  const at = s.indexOf("@", 1);
  return at < 0 ? { name: s.toLowerCase(), range: "latest" } : { name: s.substring(0, at).toLowerCase(), range: s.substring(at + 1) || "latest" };
}

function installedVersion(dir) {
  try { const p = readPkg(dir); return p && p.version ? p.version : null; } catch (e) { return null; }
}

// ---------------------------------------------------------------- output

const out = (s) => console.log(s === undefined ? "" : s);
function size(n) { return n < 1024 ? n + " B" : Math.round(n / 102.4) / 10 + " KB"; }
function seconds(since) { return Math.round((Date.now() - since) / 100) / 10 + "s"; }
function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }
function pad(s, n) { s = String(s); return s.length >= n ? s.substring(0, n - 1) + " " : s + " ".repeat(n - s.length); }

const VERBOSE = process.argv.indexOf("--verbose") >= 0;
function fail(e) {
  out("npm ERR! " + (e && e.message ? e.message : String(e)));
  if (VERBOSE && e && e.stack) out(e.stack);
  process.exitCode = 1;
}

// ---------------------------------------------------------------- downloading

function download(name, version) {
  return info(name).then((data) => {
    const v = data.versions[version];
    if (!v) throw new Error(name + "@" + version + " isn't in the registry.");
    const parts = [];
    const next = (n) => {
      if (n > v.parts) return Promise.resolve();
      const get = (left) => api("GET", { do: "part", p: name, v: version, n }).then((res) => {
        if (res.status !== 200) throw new Error("Part " + n + " of " + name + "@" + version + ": " + res.text.split("\n")[0]);
        return res;
      }).catch((e) => (left > 0 ? get(left - 1) : Promise.reject(e)));
      return get(2).then((res) => { parts.push(res.text); return next(n + 1); });
    };
    return next(1).then(() => {
      // (a message arrives as lines: a part that ended in a line break may come without it)
      const text = parts.map((p) => (p.substring(p.length - 1) === "\n" ? p : p + "\n")).join("");
      if (text.length !== v.bytes || sum(text) !== v.sum) throw new Error(name + "@" + version + " arrived damaged (" + text.length + " of " + v.bytes + " characters, sum " + sum(text) + " not " + v.sum + "): try again.");
      return text;
    });
  });
}

// ---------------------------------------------------------------- install

// Where packages go: the project's NODE_MOD, or C:\NODE\MODULES with -g.
function modDir(base, global) { return global ? GLOBALDIR : base + "\\NODE_MOD"; }

// Works out what to fetch, then fetches it. wants: [{name, range, explicit}].
// Each package goes at the top of NODE_MOD, unless one of another version is
// there already that the range doesn't take: then it goes in the NODE_MOD of
// the package that needs it.
function install(base, wants, opts) {
  const started = Date.now();
  const top = modDir(base, opts.global);
  const placed = {};   // folder -> version
  const plan = [];
  const queue = wants.map((w) => ({ name: w.name, range: w.range, into: top, explicit: !!w.explicit, force: !!w.force }));
  const chosen = {};   // explicit name -> version
  const step = () => {
    if (queue.length === 0) return Promise.resolve();
    const w = queue.shift();
    if (!goodName(w.name)) return Promise.reject(new Error("Invalid package name \"" + w.name + "\": " + NAMERULE));
    return info(w.name).then((data) => {
      const all = Object.keys(data.versions);
      let range = w.range;
      if (range === "latest" || range === "") range = data["dist-tags"].latest;
      else if (data["dist-tags"][range]) range = data["dist-tags"][range];
      if (!semver.validRange(range)) throw new Error("Invalid version range for " + w.name + ": " + w.range);
      const version = semver.maxSatisfying(all, range);
      if (!version) throw new Error("No matching version found for " + w.name + "@" + w.range + " (there " + (all.length === 1 ? "is " : "are ") + (all.length ? all.join(", ") : "none") + ")");
      if (w.explicit) chosen[w.name] = version;
      // where it goes: the top of NODE_MOD, unless another version is there
      // that this range doesn't take; then in the NODE_MOD of what needs it
      const fits = (v) => !!v && (w.explicit || w.force ? v === version : semver.satisfies(v, range));
      let dir = top + "\\" + w.name.toUpperCase();
      const there = placed[dir] || installedVersion(dir);
      if (there && !fits(there)) {
        if (w.into !== top) dir = w.into + "\\" + w.name.toUpperCase();
        else if (placed[dir]) throw new Error(w.name + " is wanted at both " + placed[dir] + " and " + version + ".");
      }
      const now = placed[dir] || installedVersion(dir);
      if (fits(now)) { placed[dir] = now; return step(); }
      placed[dir] = version;
      plan.push({ name: w.name, version, dir, was: installedVersion(dir) });
      const deps = data.versions[version].dependencies || {};
      for (const d of Object.keys(deps)) queue.push({ name: d, range: deps[d], into: dir + "\\NODE_MOD", explicit: false });
      return step();
    });
  };
  return step().then(() => {
    if (!fs.existsSync(top)) fs.mkdirSync(top, { recursive: true });
    const next = (i) => {
      if (i >= plan.length) return Promise.resolve();
      const p = plan[i];
      return download(p.name, p.version).then((text) => {
        if (fs.existsSync(p.dir)) fs.rmSync(p.dir, { recursive: true, force: true });
        fs.mkdirSync(p.dir, { recursive: true });
        unpack(text, p.dir);
        if (opts.global && p.dir.substring(0, top.length + 1) === top + "\\" && p.dir.indexOf("\\", top.length + 1) < 0) linkBins(p.dir, p.name);
        out((p.was ? "~ " : "+ ") + p.name + "@" + p.version + (p.was ? " (was " + p.was + ")" : ""));
        return next(i + 1);
      });
    };
    return next(0);
  }).then(() => {
    // the project remembers what it was asked for
    if (!opts.global && opts.save && wants.some((w) => w.explicit)) {
      const pkg = readPkg(base) || {};
      const key = opts.dev ? "devDependencies" : "dependencies";
      pkg[key] = pkg[key] || {};
      for (const w of wants) if (w.explicit) {
        pkg[key][w.name] = w.range === "latest" || w.range === "" ? "^" + chosen[w.name] : w.range;
        if (key === "devDependencies" && pkg.dependencies) delete pkg.dependencies[w.name];
      }
      writePkg(base, pkg);
    }
    if (plan.length === 0) out("up to date in " + seconds(started));
    else out("\nadded " + plural(plan.filter((p) => !p.was).length, "package") + (plan.some((p) => p.was) ? ", changed " + plan.filter((p) => p.was).length : "") + " in " + seconds(started));
    return plan;
  });
}

// A global package's commands ("bin" in its PACKAGE.JSN) as Sim Shell
// scripts in C:\PROGRAMS, which is on the shell's PATH.
function bins(dir, name) {
  const pkg = readPkg(dir);
  if (!pkg || !pkg.bin) return {};
  if (typeof pkg.bin === "string") { const o = {}; o[name] = pkg.bin; return o; }
  return pkg.bin;
}
function binFile(cmd) { return BINDIR + "\\" + cmd.toUpperCase() + ".SH"; }
function linkBins(dir, name) {
  const b = bins(dir, name);
  for (const cmd of Object.keys(b)) {
    if (!goodName(cmd)) { out("npm WARN " + name + "'s command \"" + cmd + "\" isn't an 8.3 name, so it was left out"); continue; }
    if (fs.existsSync(BINDIR + "\\" + cmd.toUpperCase() + ".SPK")) { out("npm WARN " + name + "'s command \"" + cmd + "\" would hide C:\\PROGRAMS\\" + cmd.toUpperCase() + ".SPK, so it was left out"); continue; }
    const file = dir + "\\" + b[cmd].split("/").join("\\").split(".\\").join("");
    fs.writeFileSync(binFile(cmd), "' " + name + " (npm install -g): runs " + file + "\nnode " + file + " $1 $2 $3 $4 $5 $6 $7 $8 $9\n");
    out("  the " + cmd + " command: " + binFile(cmd));
  }
}

// ---------------------------------------------------------------- the commands

const commands = {};

commands.help = () => {
  out("npm " + VERSION + " for SIM95, with the registry at " + registry);
  out();
  out("  npm init [-y]               make a PACKAGE.JSN here");
  out("  npm install                 everything PACKAGE.JSN lists, into NODE_MOD");
  out("  npm install <pkg>[@range]   a package (saved in PACKAGE.JSN; -D: as a devDependency)");
  out("  npm install -g <pkg>        for the whole machine, in C:\\NODE\\MODULES, with its commands");
  out("  npm uninstall <pkg>         npm update [pkg]     npm outdated     npm ls");
  out("  npm search <words>          npm view <pkg> [field]");
  out("  npm adduser                 make an account on the registry, or log in to yours");
  out("  npm publish                 share the package here; npm unpublish <pkg>@<version>");
  out("  npm version patch|minor|major");
  out("  npm run <script>            npm start, npm test: the scripts in PACKAGE.JSN");
  out("  npm config set registry http://host/npm/");
  out();
  out("File names are 8.3: node_modules is NODE_MOD, package.json is PACKAGE.JSN.");
};

commands.version = (args) => {
  const base = process.cwd();
  const pkg = readPkg(base);
  if (args.length === 0) { out("{ npm: '" + VERSION + "', node: '" + process.version.substring(1) + "'" + (pkg && pkg.name ? ", " + pkg.name + ": '" + pkg.version + "'" : "") + " }"); return; }
  if (!pkg) throw new Error("There's no " + PKGFILE + " here.");
  const to = semver.valid(args[0]) || semver.inc(pkg.version || "0.0.0", args[0]);
  if (!to) throw new Error("npm version patch, minor, major, prerelease, or a version like 1.2.3");
  pkg.version = to;
  writePkg(base, pkg);
  out("v" + to);
};

commands.init = (args) => {
  const base = process.cwd();
  const old = readPkg(base) || {};
  let name = String(old.name || path.basename(base).toLowerCase());
  name = name.split("").filter((c) => "abcdefghijklmnopqrstuvwxyz0123456789-_".indexOf(c) >= 0).join("").substring(0, 8) || "myapp";
  const pkg = {
    name, version: old.version || "1.0.0", description: old.description || "", main: old.main || "INDEX.JS",
    scripts: old.scripts || { start: "node INDEX.JS" }, keywords: old.keywords || [], author: old.author || "", license: old.license || "ISC",
  };
  for (const k of Object.keys(old)) if (pkg[k] === undefined) pkg[k] = old[k];
  const finish = () => {
    writePkg(base, pkg);
    out("Wrote to " + base + "\\" + PKGFILE + ":");
    out();
    out(JSON.stringify(pkg, null, 2));
  };
  if (args.indexOf("-y") >= 0 || args.indexOf("--yes") >= 0) { finish(); return; }
  out("This makes a " + PKGFILE + " here. Press Enter to keep what's in brackets.");
  out();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q, dflt) => new Promise((ok) => rl.question(q + ": " + (dflt !== "" ? "(" + dflt + ") " : ""), (a) => ok(a.trim() === "" ? dflt : a.trim())));
  return ask("package name", pkg.name).then((a) => {
    if (!goodName(a)) out("  (\"" + a + "\" won't do: " + NAMERULE + ". Kept " + pkg.name + ".)");
    else pkg.name = a;
    return ask("version", pkg.version);
  }).then((a) => { if (semver.valid(a)) pkg.version = semver.valid(a); return ask("description", pkg.description); })
    .then((a) => { pkg.description = a; return ask("entry point", pkg.main); })
    .then((a) => { pkg.main = a.toUpperCase(); if (pkg.scripts.start === "node INDEX.JS") pkg.scripts.start = "node " + pkg.main; return ask("keywords", pkg.keywords.join(" ")); })
    .then((a) => { pkg.keywords = a.split(" ").filter((x) => x); return ask("author", pkg.author || rc.user || ""); })
    .then((a) => { pkg.author = a; rl.close(); finish(); });
};

function flags(args) {
  const o = { global: false, dev: false, save: true, names: [] };
  for (const a of args) {
    if (a === "-g" || a === "--global") o.global = true;
    else if (a === "-D" || a === "--save-dev") o.dev = true;
    else if (a === "--no-save") o.save = false;
    else if (a === "-S" || a === "--save" || a === "-P" || a === "--save-prod") o.save = true;
    else if (a.charAt(0) !== "-") o.names.push(a);
  }
  return o;
}

commands.install = (args) => {
  const o = flags(args);
  const base = o.global ? GLOBALDIR : process.cwd();
  let wants;
  if (o.names.length > 0) {
    wants = o.names.map((n) => { const s = spec(n); return { name: s.name, range: s.range, explicit: true }; });
  } else {
    if (o.global) throw new Error("npm install -g needs a package name.");
    const pkg = readPkg(base);
    if (!pkg) throw new Error("There's no " + PKGFILE + " in " + base + ". npm init makes one; npm install <pkg> installs one package.");
    const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
    wants = Object.keys(deps).map((n) => ({ name: n, range: deps[n] }));
    if (wants.length === 0) { out("up to date: " + PKGFILE + " lists no dependencies"); return; }
  }
  return install(base, wants, o);
};

commands.update = (args) => {
  const base = process.cwd();
  const pkg = readPkg(base);
  if (!pkg) throw new Error("There's no " + PKGFILE + " here.");
  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  const names = flags(args).names.length ? flags(args).names : Object.keys(deps);
  // the newest each range takes, in place of what's there
  const wants = names.map((n) => ({ name: n, range: deps[n] || "latest", force: true }));
  const pick = (i) => {
    if (i >= wants.length) return Promise.resolve();
    return info(wants[i].name).then((data) => {
      const r = wants[i].range === "latest" ? data["dist-tags"].latest : wants[i].range;
      wants[i].range = semver.maxSatisfying(Object.keys(data.versions), r) || r;
      return pick(i + 1);
    });
  };
  return pick(0).then(() => install(base, wants, { save: false }));
};

commands.uninstall = (args) => {
  const o = flags(args);
  if (o.names.length === 0) throw new Error("npm uninstall <pkg>");
  const base = o.global ? GLOBALDIR : process.cwd();
  const top = modDir(base, o.global);
  let removed = 0;
  for (const n of o.names) {
    const name = spec(n).name;
    const dir = top + "\\" + name.toUpperCase();
    if (fs.existsSync(dir)) {
      if (o.global) for (const cmd of Object.keys(bins(dir, name))) if (fs.existsSync(binFile(cmd))) fs.unlinkSync(binFile(cmd));
      fs.rmSync(dir, { recursive: true, force: true });
      out("- " + name);
      removed++;
    }
    if (!o.global && o.save) {
      const pkg = readPkg(base);
      if (pkg) {
        let changed = false;
        for (const k of ["dependencies", "devDependencies"]) if (pkg[k] && pkg[k][name] !== undefined) { delete pkg[k][name]; changed = true; }
        if (changed) writePkg(base, pkg);
      }
    }
  }
  out(removed ? "\nremoved " + plural(removed, "package") : "up to date: nothing to remove");
};

// the tree of what's installed: what PACKAGE.JSN asks for, and under each
// what it needs (in its own NODE_MOD, or at the top)
function tree(base, global) {
  const top = modDir(base, global);
  const lines = [];
  const shown = {};
  const pkgAt = (dir) => readPkg(dir) || {};
  const render = (name, range, dir, prefix, last, depth) => {
    const lead = prefix + (last ? "`-- " : "+-- ");
    if (!dir) { lines.push(lead + "UNMET DEPENDENCY " + name + "@" + range); return; }
    const p = pkgAt(dir);
    let note = range && range !== "*" && !semver.satisfies(p.version, range) ? " invalid (wanted " + range + ")" : "";
    if (shown[dir]) { lines.push(lead + name + "@" + p.version + " deduped" + note); return; }
    shown[dir] = true;
    lines.push(lead + name + "@" + p.version + note);
    if (depth >= 8 || global) return;
    const deps = p.dependencies || {};
    const names = Object.keys(deps).sort();
    names.forEach((d, i) => {
      const own = dir + "\\NODE_MOD\\" + d.toUpperCase(), up = top + "\\" + d.toUpperCase();
      render(d, deps[d], fs.existsSync(own) ? own : fs.existsSync(up) ? up : null, prefix + (last ? "    " : "|   "), i === names.length - 1, depth + 1);
    });
  };
  const have = fs.existsSync(top) ? fs.readdirSync(top).filter((n) => fs.statSync(top + "\\" + n).isDirectory()) : [];
  const nameOf = (folder) => pkgAt(top + "\\" + folder).name || folder.toLowerCase();
  let roots;
  if (global) roots = have.map((f) => [nameOf(f), "", top + "\\" + f]);
  else {
    const pkg = readPkg(base) || {};
    const wanted = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
    roots = Object.keys(wanted).map((n) => [n, wanted[n], fs.existsSync(top + "\\" + n.toUpperCase()) ? top + "\\" + n.toUpperCase() : null]);
  }
  roots.sort((x, y) => (x[0] < y[0] ? -1 : 1));
  // a first pass finds what's needed; folders nothing needs come last, as extraneous
  roots.forEach((r, i) => render(r[0], r[1], r[2], "", i === roots.length - 1, 0));
  const extra = have.filter((f) => !shown[top + "\\" + f]);
  lines.splice(0, lines.length);
  for (const k of Object.keys(shown)) delete shown[k];
  const all = roots.concat(extra.map((f) => [nameOf(f), "", top + "\\" + f, true]));
  all.forEach((r, i) => {
    if (r[3]) lines.push((i === all.length - 1 ? "`-- " : "+-- ") + r[0] + "@" + pkgAt(r[2]).version + " extraneous");
    else render(r[0], r[1], r[2], "", i === all.length - 1, 0);
  });
  return lines;
}

commands.ls = (args) => {
  const o = flags(args);
  const base = o.global ? GLOBALDIR : process.cwd();
  const pkg = o.global ? null : readPkg(base);
  out(o.global ? GLOBALDIR : (pkg && pkg.name ? pkg.name + "@" + pkg.version + " " : "") + base);
  const lines = tree(base, o.global);
  if (lines.length === 0) out("`-- (empty)");
  lines.forEach((l) => out(l));
};
commands.list = commands.ls;

commands.outdated = () => {
  const base = process.cwd();
  const pkg = readPkg(base) || {};
  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  const names = Object.keys(deps);
  const rows = [];
  const next = (i) => {
    if (i >= names.length) return Promise.resolve();
    const n = names[i];
    return info(n).then((data) => {
      const cur = installedVersion(base + "\\NODE_MOD\\" + n.toUpperCase());
      const wanted = semver.maxSatisfying(Object.keys(data.versions), deps[n]);
      const latest = data["dist-tags"].latest;
      if (cur !== wanted || cur !== latest) rows.push([n, cur || "MISSING", wanted || "-", latest]);
      return next(i + 1);
    }).catch(() => next(i + 1));
  };
  return next(0).then(() => {
    if (rows.length === 0) return;
    out(pad("Package", 10) + pad("Current", 10) + pad("Wanted", 10) + "Latest");
    rows.forEach((r) => out(pad(r[0], 10) + pad(r[1], 10) + pad(r[2], 10) + r[3]));
    process.exitCode = 1;
  });
};

commands.search = (args) => {
  const q = args.filter((a) => a.charAt(0) !== "-").join(" ");
  return apiGet({ do: "search", q }).then((res) => {
    const list = JSON.parse(res.text);
    if (list.length === 0) { out("No matches found for \"" + q + "\""); return; }
    out(pad("NAME", 10) + pad("DESCRIPTION", 42) + pad("AUTHOR", 12) + pad("DATE", 11) + "VERSION");
    list.forEach((p) => out(pad(p.name, 10) + pad(p.description, 42) + pad("=" + p.owner, 12) + pad(p.date, 11) + p.version));
  });
};

commands.view = (args) => {
  if (!args[0]) throw new Error("npm view <pkg>[@version] [field]");
  const s = spec(args[0]);
  return info(s.name).then((data) => {
    const v = s.range === "latest" ? data["dist-tags"].latest : semver.maxSatisfying(Object.keys(data.versions), s.range);
    if (!v) throw new Error("No version of " + s.name + " matches " + s.range);
    const ver = data.versions[v];
    const field = args[1];
    if (field === "versions") { out(semver.sort(Object.keys(data.versions)).join(", ")); return; }
    if (field === "version") { out(v); return; }
    if (field === "dependencies") { out(JSON.stringify(ver.dependencies)); return; }
    if (field) { const x = field in ver ? ver[field] : data[field]; out(x === undefined ? "" : typeof x === "string" ? x : JSON.stringify(x)); return; }
    const deps = Object.keys(ver.dependencies || {});
    out();
    out(s.name + "@" + v + " | " + (deps.length === 1 ? "1 dependency" : deps.length + " dependencies") + " | versions: " + Object.keys(data.versions).length);
    if (data.description) out(data.description);
    if (data.keywords) out("keywords: " + data.keywords);
    out();
    out("size: " + size(ver.bytes) + " in " + plural(ver.parts, "part") + "   sum: " + ver.sum);
    if (deps.length) { out(); out("dependencies:"); deps.forEach((d) => out("  " + d + ": " + ver.dependencies[d])); }
    out();
    out("published " + ver.date + " by " + ver.publisher + "   owner: " + data.owner + "   downloads: " + data.downloads);
    out("latest: " + data["dist-tags"].latest + "   " + registry + "pkg.asp?p=" + s.name);
  });
};
commands.info = commands.show = commands.v = commands.view;

commands.adduser = () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((ok) => rl.question(q, (a) => ok(a.trim())));
  let user, pw;
  out("Log in to " + registry + " (a new name makes a new account). The password shows as you type it.");
  return ask("Username: ").then((a) => { user = a.toLowerCase(); return ask("Password: "); })
    .then((a) => { pw = a; return ask("Email (shown to nobody; Enter to skip): "); })
    .then((email) => {
      rl.close();
      return api("POST", { do: "adduser" }, query({ u: user, pw, email }), "application/x-www-form-urlencoded");
    }).then((res) => {
      const rest = okText(res).split("\n");
      rc.user = user;
      rc.token = rest[0].trim();
      writeRc(rc);
      out(rest.slice(1).join(" ") || "Logged in as " + user + ".");
    });
};
commands.login = commands.adduser;

commands.logout = () => {
  if (!rc.token) { out("Not logged in."); return; }
  out("Logged out " + rc.user + ".");
  delete rc.token;
  delete rc.user;
  writeRc(rc);
};

commands.whoami = () => {
  if (!rc.token) throw new Error("Not logged in. npm adduser logs in.");
  return apiGet({ do: "whoami", u: rc.user, t: rc.token }).then((res) => out(okText(res)));
};

function readme(dir) {
  for (const n of fs.readdirSync(dir)) if (n.substring(0, 6) === "README") return fs.readFileSync(dir + "\\" + n);
  return "";
}

commands.publish = () => {
  const base = process.cwd();
  const pkg = readPkg(base);
  if (!pkg) throw new Error("There's no " + PKGFILE + " here: npm init makes one.");
  if (!goodName(pkg.name)) throw new Error("\"" + pkg.name + "\" can't be published: " + NAMERULE + ".");
  if (!semver.valid(pkg.version)) throw new Error("The version \"" + pkg.version + "\" isn't like 1.0.0.");
  if (pkg.private) throw new Error("This package is marked private, so it can't be published.");
  if (!rc.token) throw new Error("You need to log in first: npm adduser");
  const p = pack(base);
  const parts = cut(p.text);
  const deps = pkg.dependencies || {};
  out("npm notice package: " + pkg.name + "@" + pkg.version);
  p.files.forEach((f) => out("npm notice " + pad(size(f.size), 9) + f.path));
  out("npm notice " + plural(p.files.length, "file") + ", " + size(p.text.length) + " in " + plural(parts.length, "part"));
  const q = {
    do: "begin", u: rc.user, t: rc.token, p: pkg.name, v: semver.valid(pkg.version), parts: parts.length, bytes: p.text.length, sum: sum(p.text),
    deps: Object.keys(deps).map((d) => d + "=" + deps[d]).join(";"), desc: pkg.description || "", kw: (pkg.keywords || []).join(" "),
  };
  let ticket;
  return api("POST", q, readme(base)).then((res) => {
    ticket = okText(res).trim();
    const next = (i) => {
      if (i >= parts.length) return Promise.resolve();
      return api("POST", { do: "put", k: ticket, n: i + 1 }, parts[i]).then((r) => { okText(r); return next(i + 1); });
    };
    return next(0);
  }).then(() => api("POST", { do: "finish", k: ticket }, "")).then((res) => {
    out("+ " + okText(res).trim());
  });
};

commands.unpublish = (args) => {
  if (!args[0] || args[0].indexOf("@", 1) < 0) throw new Error("npm unpublish <pkg>@<version>");
  if (!rc.token) throw new Error("You need to log in first: npm adduser");
  const s = spec(args[0]);
  return api("POST", { do: "unpublish", u: rc.user, t: rc.token, p: s.name, v: s.range }, "").then((res) => out("- " + okText(res).trim()));
};

// scripts: "node FILE args" runs in a Node window of its own; anything else
// is a program in C:\PROGRAMS.
commands.run = (args) => {
  const base = process.cwd();
  const pkg = readPkg(base);
  if (!pkg) throw new Error("There's no " + PKGFILE + " here.");
  const scripts = pkg.scripts || {};
  if (!args[0]) {
    out("Scripts in " + pkg.name + ":");
    Object.keys(scripts).forEach((k) => out("  " + k + "\n    " + scripts[k]));
    return;
  }
  let line = scripts[args[0]];
  if (line === undefined && args[0] === "start" && fs.existsSync(base + "\\SERVER.JS")) line = "node SERVER.JS";
  if (line === undefined) throw new Error("Missing script: \"" + args[0] + "\"");
  line = line + (args.length > 1 ? " " + args.slice(1).join(" ") : "");
  out("> " + pkg.name + "@" + pkg.version + " " + args[0]);
  out("> " + line);
  out();
  const words = line.split(" ").filter((w) => w);
  const prog = words[0].toLowerCase();
  if (prog === "echo") { out(words.slice(1).join(" ").split("\"").join("")); return; }
  const exe = prog === "node" ? "NODE" : prog;
  const child = require("child_process").spawn(exe, (exe === "NODE" ? ["--cwd=" + base] : []).concat(words.slice(1)));
  out("(started in its own window: process " + child.pid + ")");
};
commands["run-script"] = commands.run;
commands.start = (args) => commands.run(["start"].concat(args));
commands.test = (args) => commands.run(["test"].concat(args));
commands.t = commands.test;

commands.config = (args) => {
  const what = args[0];
  if (what === "set" && args[1]) {
    let k = args[1], v = args[2];
    if (k.indexOf("=") > 0 && v === undefined) { v = k.substring(k.indexOf("=") + 1); k = k.substring(0, k.indexOf("=")); }
    rc[k] = v || "";
    writeRc(rc);
    return;
  }
  if (what === "get" && args[1]) { out(args[1] === "registry" ? registry : rc[args[1]] === undefined ? "undefined" : rc[args[1]]); return; }
  if (what === "delete" && args[1]) { delete rc[args[1]]; writeRc(rc); return; }
  out("; " + RCFILE);
  out("registry = " + registry);
  for (const k of Object.keys(rc)) if (k !== "registry") out(k + " = " + (k === "token" ? "(protected)" : rc[k]));
};

// the short names npm takes
const aliases = { i: "install", add: "install", isntall: "install", ci: "install", rm: "uninstall", r: "uninstall", un: "uninstall", remove: "uninstall", up: "update", upgrade: "update", s: "search", find: "search", la: "ls", ll: "ls", c: "config", "-v": "version", "--version": "version", "-h": "help", "--help": "help" };

function main() {
  process.title = "npm";
  __n.title("npm" + (process.argv.length > 2 ? " " + process.argv.slice(2).join(" ") : ""));
  const argv = process.argv.slice(2).filter((a) => a !== "--verbose");
  let cmd = (argv[0] || "help").toLowerCase();
  cmd = aliases[cmd] || cmd;
  if (cmd === "version" && argv[0] && argv[0].charAt(0) === "-") { out(VERSION); return; }
  const fn = commands[cmd];
  if (!fn) { out("Unknown command: \"" + argv[0] + "\"\n"); commands.help(); process.exitCode = 1; return; }
  let r;
  try { r = fn(argv.slice(1)); } catch (e) { fail(e); return; }
  if (r && typeof r.then === "function") r.then(null, fail);
}

main();
