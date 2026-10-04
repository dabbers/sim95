// Tests for npm on SIM95: the registry (npmreg/, on the central host) and the
// npm client that comes with Node (node/lib/NPM.JS, started by NPM.SPK).
// Searching, installing with dependencies, -g commands, accounts, publishing
// (in parts), conflicting versions, updates, and an Express server.
//   node tools/aspsim/npm.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Network } from "./network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = (f) => fs.readFileSync(path.join(root, f), "utf8");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const net = new Network();
const wait = (fn, what, ms = 30000) => net.until(fn, ms, what);
const reg = await net.boot("STARTHERE");
const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");

async function install(m, file) {
  m.write("C:\\MYFILES\\INSTALL.SPK", src(file));
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !m.running(pid), "the installer " + file, 120000);
  return m.output(pid);
}

function win(m, pid) {
  const w = {
    pid,
    con: () => m.widgets(pid, "Console")[0],
    text: () => w.con()?.text ?? "",
    status: () => String(m.widgets(pid, "Window")[0]?.get("Status") ?? ""),
    title: () => String(m.widgets(pid, "Window")[0]?.get("Title") ?? ""),
    async done(ms = 90000) {
      await wait(() => /^Finished/.test(w.status()), "npm to finish: " + w.text(), ms);
      return w.text();
    },
    async type(line) {
      await wait(() => w.con()?.reading, "the window to want a line: " + w.text());
      w.con().typeLine(line);
      await sleep(100);
    },
  };
  return w;
}
// npm in a folder, as Sim Shell starts it (NPM.SPK passes this on to Node)
const npm = (m, cwd, ...args) => win(m, m.run("C:\\PROGRAMS\\NODE.SPK", ["--cwd=" + cwd, "C:\\NODE\\LIB\\NPM.JS", ...args]));
const node = (m, cwd, ...args) => win(m, m.run("C:\\PROGRAMS\\NODE.SPK", ["--cwd=" + cwd, ...args]));
const run = async (m, cwd, ...args) => npm(m, cwd, ...args).done();

async function web(from, p) {
  const conn = await from.stack.connect(0, "STARTHERE", 80);
  const parts = [];
  const closed = new Promise((r) => conn.onClose(r));
  conn.onMessage((t) => parts.push(t));
  conn.send(`GET ${p} HTTP/1.0\nHost: starthere\nUser-Agent: Voyager/1.1 (SIM95)`);
  await Promise.race([closed, sleep(8000)]);
  const raw = parts.join("\n");
  assert.match(raw, /^HTTP\/1\.0 200/, raw.slice(0, 300));
  assert.ok(!/ActiveSparkPages error|did not compile|Runtime error/i.test(raw), raw.slice(0, 1500));
  return raw.slice(raw.indexOf("\n\n") + 2);
}

for (const d of ["C:\\MYFILES\\APP", "C:\\MYFILES\\GREET", "C:\\MYFILES\\BIG", "C:\\MYFILES\\LP1", "C:\\MYFILES\\LP2", "C:\\MYFILES\\USESOLD", "C:\\MYFILES\\SITE"]) { alpha.mkdir(d); bravo.mkdir(d); }

await test("installing: the registry on the central host, stocked with its first packages; Node with npm", async () => {
  const installer = src("npmreg/INSTALL.SPK");
  assert.ok(!installer.startsWith("' VAPOR|"), "not in the stores: there's one registry, on the central host");
  reg.ui.answers.push(true); // this test's host isn't called starthere.56k.net: install anyway
  const said = await install(reg, "npmreg/INSTALL.SPK");
  assert.match(said, /npm: cowsay@1\.0\.0/);
  assert.match(said, /the npm registry is installed/);
  for (const f of ["INDEX.ASP", "PKG.ASP", "API.ASP", "REG.SPK"]) assert.ok(reg.exists("C:\\WEB\\NPM\\" + f), f);
  assert.match(reg.read("C:\\NPMDATA\\PACKAGES.TXT"), /^cowsay\|1\.0\.0\|A cow says/m);
  assert.match(reg.read("C:\\NPMDATA\\P\\COWSAY\\VERSIONS.TXT"), /^1\.0\.0\|V1\|1\|\d+\|[0-9a-f]{8}\|\d+\|[\d-]+\|sim95\|wrap=\^1\.0\.0$/m);
  // again: the packages are left alone
  reg.write("C:\\NPMDATA\\P\\COWSAY\\DL.TXT", "7");
  reg.ui.answers.push(true);
  assert.doesNotMatch(await install(reg, "npmreg/INSTALL.SPK"), /npm: cowsay/);
  assert.equal(reg.read("C:\\NPMDATA\\P\\COWSAY\\DL.TXT"), "7");
  reg.run("C:\\PROGRAMS\\HTTPD.SPK");
  await wait(async () => /npm/.test(await web(alpha, "/npm/").catch(() => "")), "the registry's web site");
  assert.match(await install(alpha, "node/INSTALL.SPK"), /npm install/);
  await install(bravo, "node/INSTALL.SPK");
  for (const f of ["C:\\PROGRAMS\\NPM.SPK", "C:\\NODE\\LIB\\NPM.JS", "C:\\NODE\\LIB\\SEMVER.JS"]) assert.ok(alpha.exists(f), f);
});

await test("the web site: the newest packages, search, a package's page with its README, and who uses it", async () => {
  const home = await web(alpha, "/npm/");
  for (const p of ["leftpad", "cowsay", "express", "lodash", "minimist", "ms", "uuid", "wrap"]) assert.match(home, new RegExp('href="pkg\\.asp\\?p=' + p + '"'), p);
  assert.match(home, /8 packages/);
  const found = await web(alpha, "/npm/index.asp?q=cow");
  assert.match(found, /1 package found for &quot;cow&quot;/);
  const page = await web(alpha, "/npm/pkg.asp?p=cowsay");
  assert.match(page, /<tt>npm install cowsay<\/tt>/);
  assert.match(page, /<h2>cowsay<\/h2>/);
  assert.match(page, /<pre>\nnpm install -g cowsay/);
  assert.match(page, /href="pkg\.asp\?p=wrap">wrap<\/a>/);
  assert.match(await web(alpha, "/npm/pkg.asp?p=wrap"), /Used by<\/b><br><a href="pkg\.asp\?p=cowsay">cowsay<\/a>/);
  assert.match(await web(alpha, "/npm/pkg.asp?p=nosuch"), /There's no package called nosuch/);
});

await test("npm help, search and view", async () => {
  assert.match(await run(alpha, "C:\\MYFILES", "help"), /npm install <pkg>\[@range\]/);
  assert.match(await run(alpha, "C:\\MYFILES", "-v"), /^1\.0\.0\n$/);
  const s = await run(alpha, "C:\\MYFILES", "search", "web");
  assert.match(s, /^NAME +DESCRIPTION/);
  assert.match(s, /\nexpress +Web servers the easy way.* =sim95 /);
  assert.match(await run(alpha, "C:\\MYFILES", "search", "zzzz"), /No matches found for "zzzz"/);
  const v = await run(alpha, "C:\\MYFILES", "view", "cowsay");
  assert.match(v, /cowsay@1\.0\.0 \| 1 dependency \| versions: 1/);
  assert.match(v, /dependencies:\n  wrap: \^1\.0\.0/);
  assert.equal(await run(alpha, "C:\\MYFILES", "view", "ms", "version"), "2.1.3\n");
  const w = npm(alpha, "C:\\MYFILES", "view", "nosuch");
  assert.match(await w.done(), /npm ERR! 404 Not Found - 'nosuch' is not in the registry\./);
  assert.match(w.status(), /exit code 1/);
});

await test("npm init -y, npm install a package and what it needs, then use it", async () => {
  const dir = "C:\\MYFILES\\APP";
  assert.match(await run(alpha, dir, "init", "-y"), /Wrote to C:\\MYFILES\\APP\\PACKAGE\.JSN/);
  assert.equal(JSON.parse(alpha.read(dir + "\\PACKAGE.JSN")).name, "app");
  const out = await run(alpha, dir, "install", "cowsay");
  assert.match(out, /\+ wrap@1\.0\.0/);
  assert.match(out, /\+ cowsay@1\.0\.0/);
  assert.match(out, /added 2 packages in /);
  assert.deepEqual(JSON.parse(alpha.read(dir + "\\PACKAGE.JSN")).dependencies, { cowsay: "^1.0.0" });
  assert.ok(alpha.exists(dir + "\\NODE_MOD\\COWSAY\\CLI.JS"));
  assert.ok(alpha.exists(dir + "\\NODE_MOD\\WRAP\\INDEX.JS"));
  assert.equal(alpha.exists(dir + "\\NODE_MOD\\LEFTPAD"), false, "only what was asked for");
  assert.equal(alpha.read(dir + "\\NODE_MOD\\COWSAY\\INDEX.JS"), src("npmreg/seed/COWSAY/INDEX.JS"));
  alpha.write(dir + "\\INDEX.JS", "const cow = require('cowsay');\nconsole.log(cow.say('Hello from npm, and SIM95'));\n");
  const said = await node(alpha, dir, "index.js").done();
  assert.match(said, /< Hello from npm, and SIM95 >/);
  assert.match(said, /\(oo\)\\_______/);
  // again: nothing to do
  assert.match(await run(alpha, dir, "install"), /up to date in /);
  assert.equal(await run(alpha, dir, "ls"), "app@1.0.0 C:\\MYFILES\\APP\n`-- cowsay@1.0.0\n    `-- wrap@1.0.0\n");
  // a package gone missing: npm install brings it back
  for (const f of ["CLI.JS", "INDEX.JS", "PACKAGE.JSN", "README.MD"]) alpha.remove(dir + "\\NODE_MOD\\COWSAY\\" + f);
  alpha.remove(dir + "\\NODE_MOD\\COWSAY");
  const again = await run(alpha, dir, "i");
  assert.match(again, /\+ cowsay@1\.0\.0/);
  assert.doesNotMatch(again, /wrap/, "wrap is there already");
  assert.match(await run(alpha, dir, "uninstall", "cowsay"), /- cowsay\n\nremoved 1 package/);
  assert.deepEqual(JSON.parse(alpha.read(dir + "\\PACKAGE.JSN")).dependencies, {});
  assert.equal(alpha.exists(dir + "\\NODE_MOD\\COWSAY"), false);
});

await test("npm install -g: a command for the whole machine, as a Sim Shell script", async () => {
  const out = await run(alpha, "C:\\MYFILES", "install", "-g", "cowsay");
  assert.match(out, /the cowsay command: C:\\PROGRAMS\\COWSAY\.SH/);
  assert.ok(alpha.exists("C:\\NODE\\MODULES\\COWSAY\\CLI.JS"));
  assert.ok(alpha.exists("C:\\NODE\\MODULES\\WRAP\\INDEX.JS"));
  assert.match(alpha.read("C:\\PROGRAMS\\COWSAY.SH"), /\nnode C:\\NODE\\MODULES\\COWSAY\\CLI\.JS \$1 \$2/);
  const cow = await node(alpha, "C:\\MYFILES", "C:\\NODE\\MODULES\\COWSAY\\CLI.JS", "-d", "global", "moo").done();
  assert.match(cow, /< global moo >[\s\S]*\(xx\)/);
  // require finds global packages too
  alpha.write("C:\\MYFILES\\G.JS", "console.log(require('wrap')('a b c d', 1).length);\n");
  assert.equal(await node(alpha, "C:\\MYFILES", "g.js").done(), "4\n");
  assert.match(await run(alpha, "C:\\MYFILES", "ls", "-g"), /C:\\NODE\\MODULES\n\+-- cowsay@1\.0\.0\n`-- wrap@1\.0\.0/);
  assert.match(await run(alpha, "C:\\MYFILES", "uninstall", "-g", "cowsay"), /- cowsay/);
  assert.equal(alpha.exists("C:\\PROGRAMS\\COWSAY.SH"), false);
});

await test("accounts: npm adduser makes one, logs in to it, and a wrong password is refused", async () => {
  let w = npm(alpha, "C:\\MYFILES", "adduser");
  await w.type("alice");
  await w.type("wonderland");
  await w.type("alice@alpha");
  assert.match(await w.done(), /Welcome, alice! Your account is made\./);
  assert.match(alpha.read("C:\\NODE\\NPMRC.TXT"), /^user=alice\ntoken=[0-9a-f]{16}\n$/);
  assert.match(reg.read("C:\\NPMDATA\\USERS.TXT"), /\nalice\|[0-9a-f]{8}\|[0-9a-f]{16}\|[0-9a-f]{16}\|alice@alpha\|\d+\n/);
  assert.doesNotMatch(reg.read("C:\\NPMDATA\\USERS.TXT"), /wonderland/);
  assert.equal(await run(alpha, "C:\\MYFILES", "whoami"), "alice\n");
  w = npm(bravo, "C:\\MYFILES", "login");
  await w.type("alice");
  await w.type("guess");
  await w.type("");
  assert.match(await w.done(), /npm ERR! That isn't alice's password/);
  assert.equal(bravo.exists("C:\\NODE\\NPMRC.TXT"), false);
  w = npm(bravo, "C:\\MYFILES", "adduser");
  await w.type("bob");
  await w.type("builder");
  await w.type("");
  assert.match(await w.done(), /Welcome, bob!/);
  assert.match(await run(bravo, "C:\\MYFILES", "whoami"), /^bob\n$/);
});

await test("npm publish: a package with a dependency and a README, installed on another machine", async () => {
  const dir = "C:\\MYFILES\\GREET";
  alpha.write(dir + "\\PACKAGE.JSN", JSON.stringify({ name: "greet", version: "1.0.0", description: "Greetings, padded.", main: "INDEX.JS", keywords: ["hello", "greeting"], dependencies: { leftpad: "^1.0.0" } }, null, 2));
  alpha.write(dir + "\\INDEX.JS", "const leftpad = require('leftpad');\nmodule.exports = (name) => 'Hello, ' + leftpad(name, 8, '.') + '!';\n");
  alpha.write(dir + "\\README.MD", "# greet\n\nSay hello, with `leftpad`.\n\n- one\n- two\n");
  alpha.mkdir(dir + "\\NODE_MOD"); // never published
  alpha.write(dir + "\\NODE_MOD\\JUNK.JS", "nope");
  const out = await run(alpha, dir, "publish");
  assert.match(out, /npm notice package: greet@1\.0\.0/);
  assert.match(out, /npm notice 3 files, [\d.]+ (B|KB) in 1 part/);
  assert.match(out, /\+ greet@1\.0\.0/);
  assert.match(reg.read("C:\\NPMDATA\\PACKAGES.TXT"), /\ngreet\|1\.0\.0\|Greetings, padded\.\|alice\|\d+\|[\d-]+\|hello greeting\n/);
  assert.equal(reg.exists("C:\\NPMDATA\\UP") && reg.list("C:\\NPMDATA\\UP").length, 0, "the upload is cleared away");
  const page = await web(bravo, "/npm/pkg.asp?p=greet");
  assert.match(page, /<p>Say hello, with <tt>leftpad<\/tt>\.<\/p>/);
  assert.match(page, /<ul>\n<li>one<\/li>/);
  assert.match(page, /by <a href="index\.asp\?u=alice">alice<\/a>/);
  assert.match(await web(bravo, "/npm/index.asp?u=alice"), /Packages by alice[\s\S]*pkg\.asp\?p=greet/);
  // on BRAVO
  const b = "C:\\MYFILES\\APP";
  const got = await run(bravo, b, "install", "greet");
  assert.match(got, /\+ greet@1\.0\.0[\s\S]*\+ leftpad@1\.0\.0|\+ leftpad@1\.0\.0[\s\S]*\+ greet@1\.0\.0/);
  assert.ok(!bravo.exists(b + "\\NODE_MOD\\GREET\\NODE_MOD"), "NODE_MOD isn't published");
  bravo.write(b + "\\HI.JS", "console.log(require('greet')('Bob'));\n");
  assert.equal(await node(bravo, b, "hi.js").done(), "Hello, .....Bob!\n");
  assert.equal(JSON.parse(bravo.read(b + "\\PACKAGE.JSN")).dependencies.greet, "^1.0.0", "a PACKAGE.JSN is made");
  // the same version again; someone else's package; a bad name
  assert.match(await run(alpha, dir, "publish"), /npm ERR! greet@1\.0\.0 is published already: change the version/);
  bravo.write("C:\\MYFILES\\GREET\\PACKAGE.JSN", JSON.stringify({ name: "greet", version: "9.0.0" }));
  assert.match(await run(bravo, "C:\\MYFILES\\GREET", "publish"), /npm ERR! greet belongs to alice: you can't publish it/);
  bravo.write("C:\\MYFILES\\GREET\\PACKAGE.JSN", JSON.stringify({ name: "much-too-long", version: "1.0.0" }));
  assert.match(await run(bravo, "C:\\MYFILES\\GREET", "publish"), /npm ERR! "much-too-long" can't be published: a package name is 1 to 8/);
});

await test("a new version: npm version patch, publish, npm outdated and npm update", async () => {
  const dir = "C:\\MYFILES\\GREET";
  alpha.write(dir + "\\INDEX.JS", "const leftpad = require('leftpad');\nmodule.exports = (name) => 'Hi there, ' + leftpad(name, 8, '.') + '!';\n");
  assert.equal(await run(alpha, dir, "version", "patch"), "v1.0.1\n");
  assert.match(await run(alpha, dir, "publish"), /\+ greet@1\.0\.1/);
  const b = "C:\\MYFILES\\APP";
  const w = npm(bravo, b, "outdated");
  assert.match(await w.done(), /Package +Current +Wanted +Latest\ngreet +1\.0\.0 +1\.0\.1 +1\.0\.1/);
  assert.match(w.status(), /exit code 1/);
  assert.match(await run(bravo, b, "update"), /~ greet@1\.0\.1 \(was 1\.0\.0\)/);
  assert.equal(await node(bravo, b, "hi.js").done(), "Hi there, .....Bob!\n");
  assert.equal(await run(bravo, b, "outdated"), "");
  // an exact older one
  assert.match(await run(bravo, b, "install", "greet@1.0.0"), /~ greet@1\.0\.0 \(was 1\.0\.1\)/);
  assert.equal(JSON.parse(bravo.read(b + "\\PACKAGE.JSN")).dependencies.greet, "1.0.0");
  assert.match(await run(bravo, b, "view", "greet", "versions"), /^1\.0\.0, 1\.0\.1\n$/);
  assert.match(await web(bravo, "/npm/pkg.asp?p=greet&v=1.0.0"), /\(the latest is <a href="pkg\.asp\?p=greet">1\.0\.1<\/a>\)/);
});

await test("a big package travels in parts, and arrives exactly as it was", async () => {
  const dir = "C:\\MYFILES\\BIG";
  let big = "// lots of lines\n";
  for (let i = 0; i < 1800; i++) big += `exports.f${i} = () => "line ${i}: the quick brown fox";\n`;
  big += "exports.count = 1800;\n";
  alpha.write(dir + "\\PACKAGE.JSN", JSON.stringify({ name: "bigpkg", version: "1.0.0", main: "INDEX.JS" }));
  alpha.write(dir + "\\INDEX.JS", big);
  alpha.mkdir(dir + "\\LIB");
  alpha.write(dir + "\\LIB\\EMPTY.TXT", "");
  alpha.write(dir + "\\LIB\\NOEND.TXT", "no line break at the end\n\nblank above");
  const out = await run(alpha, dir, "publish");
  assert.match(out, /4 files, 98\.3 KB in 4 parts/);
  assert.match(out, /\+ bigpkg@1\.0\.0/);
  const b = "C:\\MYFILES\\APP";
  assert.match(await run(bravo, b, "install", "bigpkg"), /\+ bigpkg@1\.0\.0/);
  assert.equal(bravo.read(b + "\\NODE_MOD\\BIGPKG\\INDEX.JS"), big);
  assert.equal(bravo.read(b + "\\NODE_MOD\\BIGPKG\\LIB\\EMPTY.TXT"), "");
  assert.equal(bravo.read(b + "\\NODE_MOD\\BIGPKG\\LIB\\NOEND.TXT"), "no line break at the end\n\nblank above");
  bravo.write(b + "\\BIG.JS", "const b = require('bigpkg'); console.log(b.count, b.f1234());\n");
  assert.equal(await node(bravo, b, "big.js").done(), "1800 line 1234: the quick brown fox\n");
});

await test("two versions of one package: the one a dependency needs goes in its own NODE_MOD", async () => {
  const pub = async (dir, pkg, code) => {
    alpha.write(dir + "\\PACKAGE.JSN", JSON.stringify(pkg));
    alpha.write(dir + "\\INDEX.JS", code);
    assert.match(await run(alpha, dir, "publish"), new RegExp("\\+ " + pkg.name + "@" + pkg.version.split(".").join("\\.")));
  };
  await pub("C:\\MYFILES\\LP1", { name: "lp", version: "1.4.0" }, "module.exports = 'lp one';\n");
  await pub("C:\\MYFILES\\LP2", { name: "lp", version: "2.0.0" }, "module.exports = 'lp two';\n");
  await pub("C:\\MYFILES\\USESOLD", { name: "usesold", version: "1.0.0", dependencies: { lp: "~1.4.0" } }, "module.exports = 'usesold has ' + require('lp');\n");
  const b = "C:\\MYFILES\\SITE";
  bravo.write(b + "\\PACKAGE.JSN", JSON.stringify({ name: "site", version: "1.0.0", dependencies: { lp: "^2.0.0", usesold: "*" } }));
  const out = await run(bravo, b, "install");
  assert.match(out, /\+ lp@2\.0\.0/);
  assert.match(out, /\+ lp@1\.4\.0/);
  assert.equal(JSON.parse(bravo.read(b + "\\NODE_MOD\\LP\\PACKAGE.JSN")).version, "2.0.0");
  assert.equal(JSON.parse(bravo.read(b + "\\NODE_MOD\\USESOLD\\NODE_MOD\\LP\\PACKAGE.JSN")).version, "1.4.0");
  bravo.write(b + "\\BOTH.JS", "console.log(require('lp'), '/', require('usesold'));\n");
  assert.equal(await node(bravo, b, "both.js").done(), "lp two / usesold has lp one\n");
  assert.match(await run(bravo, b, "ls"), /\+-- lp@2\.0\.0\n`-- usesold@1\.0\.0\n    `-- lp@1\.4\.0/);
  // a range nothing matches
  assert.match(await run(bravo, b, "install", "lp@^3.0.0"), /npm ERR! No matching version found for lp@\^3\.0\.0 \(there are 1\.4\.0, 2\.0\.0\)/);
  // unpublish: the owner only
  assert.match(await run(bravo, b, "unpublish", "lp@1.4.0"), /npm ERR! lp belongs to alice/);
  assert.match(await run(alpha, "C:\\MYFILES", "unpublish", "lp@1.4.0"), /- lp@1\.4\.0 is unpublished/);
  assert.match(await run(bravo, b, "view", "lp", "versions"), /^2\.0\.0\n$/);
});

await test("express from the registry: a web server with routes, params, JSON and static files", async () => {
  const b = "C:\\MYFILES\\SITE";
  assert.match(await run(bravo, b, "install", "express"), /\+ express@4\.18\.2/);
  bravo.mkdir(b + "\\PUBLIC");
  bravo.write(b + "\\PUBLIC\\HELLO.HTM", "<html>static hello</html>");
  bravo.write(b + "\\SERVER.JS", `
const express = require('express');
const app = express();
const seen = [];
app.use((req, res, next) => { seen.push(req.method + ' ' + req.path); next(); });
app.use(express.urlencoded());
app.use(express.static('C:\\\\MYFILES\\\\SITE\\\\PUBLIC'));
app.get('/', (req, res) => res.send('<h1>home</h1>'));
app.get('/hello/:name', (req, res) => res.send('Hello, ' + req.params.name + (req.query.x ? ' ' + req.query.x : '')));
app.get('/api/info', (req, res) => res.json({ ok: true, seen: seen.length }));
app.post('/sign', (req, res) => res.status(201).send('signed by ' + req.body.who));
app.get('/boom', () => { throw new Error('kaboom'); });
app.get('/stop', (req, res) => { res.send('bye'); server.close(); });
const server = app.listen(8080, () => console.log('listening'));
`);
  const w = node(bravo, b, "server.js");
  await wait(() => /listening/.test(w.text()), "the server: " + w.text());
  const get = async (req) => {
    const c = await alpha.stack.connect(0, "BRAVO", 8080);
    const parts = [];
    const closed = new Promise((r) => c.onClose(r));
    c.onMessage((t) => parts.push(t));
    c.send(req);
    await Promise.race([closed, sleep(8000)]);
    return parts.join("\n");
  };
  assert.match(await get("GET / HTTP/1.0\nHost: bravo"), /^HTTP\/1\.0 200 OK[\s\S]*\n\n<h1>home<\/h1>$/);
  assert.match(await get("GET /hello/Ann?x=hi HTTP/1.0\nHost: bravo"), /\n\nHello, Ann hi$/);
  assert.match(await get("GET /hello.htm HTTP/1.0\nHost: bravo"), /\n\n<html>static hello<\/html>$/);
  assert.match(await get("GET /api/info HTTP/1.0\nHost: bravo"), /Content-Type: application\/json[\s\S]*\n\n\{"ok":true,"seen":4\}$/);
  assert.match(await get("POST /sign HTTP/1.0\nHost: bravo\nContent-Type: application/x-www-form-urlencoded\nContent-Length: 7\n\nwho=Al+B"), /^HTTP\/1\.0 201 Created[\s\S]*\n\nsigned by Al B$/);
  assert.match(await get("GET /nope HTTP/1.0\nHost: bravo"), /^HTTP\/1\.0 404 Not Found[\s\S]*Cannot GET \/nope/);
  assert.match(await get("GET /boom HTTP/1.0\nHost: bravo"), /^HTTP\/1\.0 500 [\s\S]*kaboom/);
  await get("GET /stop HTTP/1.0\nHost: bravo");
  await w.done();
});

await test("NPM.SPK: npm as Sim Shell runs it, in the shell's folder", async () => {
  const before = Math.max(0, ...alpha.kernel.ps().map((p) => p.pid));
  const pid = alpha.run("C:\\PROGRAMS\\NPM.SPK", ["--cwd=C:\\MYFILES\\APP", "ls"]);
  await wait(() => !alpha.running(pid), "NPM.SPK");
  await wait(() => alpha.ui.widgets.some((x) => x.pid > before && x.pid !== pid && x.type === "Console"), "Node's window");
  const w = win(alpha, alpha.ui.widgets.find((x) => x.pid > before && x.pid !== pid && x.type === "Console").pid);
  assert.match(await w.done(), /^app@1\.0\.0 C:\\MYFILES\\APP\n/);
  assert.match(w.title(), /^npm ls/);
  assert.match(await run(alpha, "C:\\MYFILES", "frobnicate"), /Unknown command: "frobnicate"/);
  assert.deepEqual(alpha.errors, []);
  assert.deepEqual(bravo.errors, []);
  assert.deepEqual(reg.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
