// End-to-end tests for SimDNS (simdns/): the name server (NAMED.SPK), the
// resolver (RESOLVE.SPK) in Simxplorer and DIG, the web server with virtual
// hosts (HTTPD.SPK), and SimNIC, the registrar - on a pretend network of
// real machines.
//   node tools/aspsim/simdns.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { machine, browser, MESSAGE_LIMIT } from "./sim.mjs";
import { Network } from "./network.mjs";
import { simxplorerSource } from "../simxplorer-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = (f) => fs.readFileSync(path.join(root, f), "utf8");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (r) => {
  assert.equal(r.status, "200 OK", (r.url || "") + " -> " + r.status + "\n" + r.body.slice(-400));
  assert.ok(!r.body.includes("ActiveSparkPages error"), r.body.slice(r.body.indexOf("ActiveSparkPages error"), r.body.indexOf("ActiveSparkPages error") + 400));
  return r;
};
const decode = (x) => x.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

const net = new Network();
const dnsbox = await net.boot("DNSBOX");
const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");
const charlie = await net.boot("CHARLIE");
const until = (fn, what, ms = 10000) => net.until(fn, ms, what);

// One question to a name server, the way the resolver asks it.
async function ask(from, server, question) {
  const conn = await from.stack.connect(0, server, 53);
  const answer = new Promise((r) => conn.onMessage(r));
  conn.send(question);
  const got = await Promise.race([answer, sleep(6000).then(() => null)]);
  try { conn.close(); } catch {}
  return got;
}
// A real HTTP request over the network, with any Host header.
async function http(from, host, method, p, { body = "", cookie = "", hostHeader = host.toLowerCase(), agent = "Voyager/1.1 (SIM95)" } = {}) {
  const conn = await from.stack.connect(0, host, 80);
  const parts = [];
  const done = new Promise((r) => conn.onClose(r));
  conn.onMessage((t) => parts.push(t));
  let req = `${method} ${p} HTTP/1.0\nHost: ${hostHeader}\nUser-Agent: ${agent}` + (cookie ? `\nCookie: ${cookie}` : "");
  if (method === "POST") req += `\nContent-Type: application/x-www-form-urlencoded\nContent-Length: ${body.length}\n\n${body}`;
  conn.send(req);
  await Promise.race([done, sleep(8000)]);
  const raw = parts.join("\n");
  const cut = raw.indexOf("\n\n");
  const lines = (cut < 0 ? raw : raw.slice(0, cut)).split("\n");
  return { status: lines[0].replace(/^HTTP\/1\.0 /, ""), headers: lines.slice(1), body: cut < 0 ? "" : raw.slice(cut + 2), raw, url: host + p };
}
const header = (r, name) => (r.headers.find((h) => h.toLowerCase().startsWith(name.toLowerCase() + ": ")) || "").replace(/^[^:]*: /, "");
const install = async (m, app, ms = 60000) => {
  m.write("C:\\MYFILES\\INSTALL.SPK", src(app + "/INSTALL.SPK"));
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await net.until(() => !m.running(pid), ms, app + "'s installer");
  return m.output(pid);
};
const named = (m) => m.kernel.ps().find((p) => p.name === "NAMED")?.pid;
const namedLog = (m) => (m.widgets(named(m), "ListBox")[0]?.get("Items") ?? []).join("\n");
const webPid = (m) => m.kernel.ps().find((p) => p.name === "HTTPD")?.pid;
const STOCK = (await machine("X")).read("C:\\PROGRAMS\\HTTPD.SPK");

// DNSBOX: a name server and nothing else, with a zone written by hand.
dnsbox.mkdir("C:\\DNS");
dnsbox.write("C:\\DNS\\NAMED.CNF", `; DNSBOX's zones
directory   C:\\DNS
primary     coolsite.sim     COOLSITE.SIM
forwarders  alpha
`);
dnsbox.write("C:\\DNS\\COOLSITE.SIM", `; coolsite.sim, by hand
$TTL 300
@        IN  SOA    dnsbox hostmaster ( 1996070401
                    3600 )            ; refresh
@        IN  NS     dnsbox
@        IN  CNAME  alpha             ; the domain itself is on ALPHA
www      IN  CNAME  alpha             ; a CNAME straight to a machine
shop         CNAME  store             ; to a name in this zone...
store        CNAME  www               ; ...to another, to the machine
mirror       CNAME  www.coolsite.sim. ; a whole name
old      60  A      65.16.0.250       ; an address, just in case
@            MX     10 alpha
@            TXT    "Best viewed in Simxplorer; 800x600"
*.users      CNAME  bravo             ; anyone.users.coolsite.sim
loop1        CNAME  loop2
loop2        CNAME  loop1
east         NS     alpha             ; east.coolsite.sim is ALPHA's
oops         A      alpha             ; not an address
`);
dnsbox.write("C:\\PROGRAMS\\NAMED.SPK", src("simdns/src/NAMED.SPK"));
dnsbox.run("C:\\PROGRAMS\\NAMED.SPK");

// ALPHA: the web server as SIM95 starts it, then SimDNS installed over it.
alpha.run("C:\\PROGRAMS\\HTTPD.SPK");
bravo.run("C:\\PROGRAMS\\HTTPD.SPK");
await until(() => named(dnsbox) && namedLog(dnsbox).includes("Listening"), "DNSBOX's name server");

await test("the installer: NAMED running and starting with the machine, the new web server, the old one kept", async () => {
  const oldWeb = webPid(alpha);
  const out = await install(alpha, "simdns");
  assert.match(out, /kept the old web server as C:\\PROGRAMS\\HTTPD.ORG/);
  assert.match(out, /wrote C:\\PROGRAMS\\HTTPD.SPK/);
  assert.match(out, /SimDNS is installed \(19 files\)/);
  assert.match(out, /NAMED will start with the machine/);
  assert.match(out, /restarted the web server/);
  assert.equal(alpha.read("C:\\PROGRAMS\\HTTPD.ORG"), STOCK, "the stock web server, kept as it was");
  assert.equal(alpha.read("C:\\PROGRAMS\\HTTPD.SPK"), src("simdns/src/HTTPD.SPK"), "simdns/INSTALL.SPK is out of date: node tools/build-installer.mjs simdns");
  assert.equal(alpha.read("C:\\PROGRAMS\\NAMED.SPK"), src("simdns/src/NAMED.SPK"));
  assert.equal(alpha.read("C:\\PROGRAMS\\DIG.SPK"), src("simdns/src/DIG.SPK") + "\n" + src("simdns/src/RESOLVE.SPK"));
  assert.equal(alpha.read("C:\\SYSTEM\\STARTUP\\NAMED.RUN"), "C:\\PROGRAMS\\NAMED.SPK");
  assert.equal(alpha.read("C:\\SYSTEM\\RESOLV.INI"), "nameserver=alpha\n");
  assert.ok(alpha.exists("C:\\WEB\\NIC.SPK") && alpha.exists("C:\\WEB\\WELCOME.HTM"), "SimNIC is the home page");
  assert.match(alpha.read("C:\\WEB\\VHOSTS.TXT"), /^; VHOSTS.TXT/);
  await until(() => named(alpha) && webPid(alpha), "NAMED and HTTPD");
  assert.notEqual(webPid(alpha), oldWeb, "a new web server");
  // Vapor deletes the files in the header when it uninstalls: never the web server
  const head = src("simdns/INSTALL.SPK").split("\n")[0];
  assert.match(head, /\|kind=web\|.*\|tasks=NAMED\|startup=NAMED.RUN\|folder=DNS\|/);
  assert.ok(head.includes("C:\\PROGRAMS\\NAMED.SPK") && !head.includes("HTTPD"), head);
  // running it again keeps the stock copy, not ours
  await install(alpha, "simdns");
  assert.equal(alpha.read("C:\\PROGRAMS\\HTTPD.ORG"), STOCK);
  assert.deepEqual(alpha.errors, []);
  assert.deepEqual(alpha.ui.dialogs, []);
});

// ---------------------------------------------------------------- the name server

await test("zones: a CNAME straight to a machine, CNAME to CNAME to a machine, and an A record", async () => {
  assert.equal(await ask(bravo, "dnsbox", "QUERY www.coolsite.sim A"), "OK\nwww.coolsite.sim 300 CNAME alpha");
  assert.equal(await ask(bravo, "dnsbox", "QUERY coolsite.sim A"), "OK\ncoolsite.sim 300 CNAME alpha");
  assert.equal(await ask(bravo, "dnsbox", "QUERY shop.coolsite.sim A"), "OK\nshop.coolsite.sim 300 CNAME store.coolsite.sim\nstore.coolsite.sim 300 CNAME www.coolsite.sim\nwww.coolsite.sim 300 CNAME alpha");
  assert.equal(await ask(bravo, "dnsbox", "QUERY Mirror.CoolSite.SIM."), "OK\nmirror.coolsite.sim 300 CNAME www.coolsite.sim\nwww.coolsite.sim 300 CNAME alpha", "type A when none is given, any case, a last dot");
  assert.equal(await ask(bravo, "dnsbox", "QUERY old.coolsite.sim A"), "OK\nold.coolsite.sim 60 A 65.16.0.250");
  assert.equal(await ask(bravo, "dnsbox", "QUERY www.coolsite.sim CNAME"), "OK\nwww.coolsite.sim 300 CNAME alpha");
});

await test("zones: MX, TXT, NS, SOA, ANY and wildcards", async () => {
  assert.equal(await ask(bravo, "dnsbox", "QUERY coolsite.sim MX"), "OK\ncoolsite.sim 300 MX 10 alpha");
  assert.equal(await ask(bravo, "dnsbox", "QUERY coolsite.sim TXT"), 'OK\ncoolsite.sim 300 TXT "Best viewed in Simxplorer; 800x600"', "a ; inside quotes is not a comment");
  assert.equal(await ask(bravo, "dnsbox", "QUERY coolsite.sim NS"), "OK\ncoolsite.sim 300 NS dnsbox", "the domain's own NS, not its CNAME");
  assert.equal(await ask(bravo, "dnsbox", "QUERY coolsite.sim SOA"), "OK\ncoolsite.sim 300 SOA dnsbox hostmaster 1996070401 3600", "( ) over two lines");
  const any = await ask(bravo, "dnsbox", "QUERY coolsite.sim ANY");
  assert.equal(any.split("\n").length, 6, any);
  assert.equal(await ask(bravo, "dnsbox", "QUERY ann.users.coolsite.sim"), "OK\nann.users.coolsite.sim 300 CNAME bravo");
  assert.equal(await ask(bravo, "dnsbox", "QUERY www.coolsite.sim MX"), "OK\nwww.coolsite.sim 300 CNAME alpha", "no MX at www: its CNAME, for the asker to follow");
  assert.equal(await ask(bravo, "dnsbox", "QUERY users.coolsite.sim"), "OK", "a name with names under it exists, with nothing of its own");
});

await test("zones: NXDOMAIN, CNAME loops, bad questions and bad lines", async () => {
  assert.equal(await ask(bravo, "dnsbox", "QUERY nope.coolsite.sim A"), "NXDOMAIN");
  assert.match(await ask(bravo, "dnsbox", "QUERY loop1.coolsite.sim A"), /^SERVFAIL more than 8 CNAMEs in a row from loop1.coolsite.sim \(a loop\?\)$/);
  assert.match(await ask(bravo, "dnsbox", "QUERY www.coolsite.sim AAAA"), /^SERVFAIL SimDNS doesn't know records of type AAAA/);
  assert.match(await ask(bravo, "dnsbox", "HELLO"), /^SERVFAIL ask like this: QUERY www.coolsite.sim A/);
  assert.match(await ask(bravo, "dnsbox", "QUERY <b>hi</b> A"), /^SERVFAIL that is not a name/);
  assert.equal(await ask(bravo, "dnsbox", "QUERY oops.coolsite.sim A"), "NXDOMAIN", "a bad line is left out");
  assert.match(namedLog(dnsbox), /COOLSITE.SIM line 18: A needs an address like 65.16.0.2 \(for a machine, use CNAME alpha\)/);
  assert.match(namedLog(dnsbox), /Loaded 1 zones, 14 records, 1 problem/);
  assert.deepEqual(dnsbox.errors, []);
});

await test("zone files are loaded again when they change, and so is NAMED.CNF", async () => {
  dnsbox.write("C:\\DNS\\COOLSITE.SIM", dnsbox.read("C:\\DNS\\COOLSITE.SIM") + "new      CNAME  charlie\n");
  dnsbox.write("C:\\DNS\\TOYS.COM", "@ IN NS dnsbox\nwww CNAME charlie\n");
  dnsbox.write("C:\\DNS\\NAMED.CNF", dnsbox.read("C:\\DNS\\NAMED.CNF") + "primary toys.com TOYS.COM\n");
  await until(async () => (await ask(bravo, "dnsbox", "QUERY new.coolsite.sim")) !== "NXDOMAIN", "the reload", 8000);
  assert.equal(await ask(bravo, "dnsbox", "QUERY new.coolsite.sim"), "OK\nnew.coolsite.sim 300 CNAME charlie");
  assert.equal(await ask(bravo, "dnsbox", "QUERY www.toys.com"), "OK\nwww.toys.com 3600 CNAME charlie", "the default TTL is an hour");
  assert.match(namedLog(dnsbox), /The zone files have changed[\s\S]*Loaded 2 zones/);
});

await test("other names go to the forwarder; a part of a zone handed off with NS goes to that server", async () => {
  // ALPHA's own name server has a zone of its own, and east.coolsite.sim
  alpha.write("C:\\DNS\\HAND.NET", "$TTL 120\n@ IN NS alpha\nwww IN CNAME bravo\n");
  alpha.write("C:\\DNS\\EAST.SIM", "@ IN NS alpha\nshop CNAME charlie\n");
  alpha.write("C:\\DNS\\NAMED.CNF", alpha.read("C:\\DNS\\NAMED.CNF") + "primary hand.net HAND.NET\nprimary east.coolsite.sim EAST.SIM\nforwarders dnsbox\n");
  await until(async () => (await ask(bravo, "alpha", "QUERY www.hand.net")) === "OK\nwww.hand.net 120 CNAME bravo", "ALPHA's reload", 8000);
  assert.equal(await ask(bravo, "dnsbox", "QUERY www.hand.net"), "OK\nwww.hand.net 120 CNAME bravo", "DNSBOX forwards to ALPHA");
  assert.equal(await ask(bravo, "dnsbox", "QUERY shop.east.coolsite.sim"), "OK\nshop.east.coolsite.sim 3600 CNAME charlie", "delegated with NS");
  assert.equal(await ask(bravo, "alpha", "QUERY www.coolsite.sim"), "OK\nwww.coolsite.sim 300 CNAME alpha", "and ALPHA forwards to DNSBOX");
  // each forwards to the other, but a question passed on is never passed on again
  assert.equal(await ask(bravo, "dnsbox", "QUERY nobody.org"), "NXDOMAIN");
  assert.equal(await ask(bravo, "alpha", "QUERY nobody.org"), "NXDOMAIN");
  assert.equal(await ask(bravo, "dnsbox", "QUERY www.hand.net A NORECURSE"), "NXDOMAIN", "NORECURSE: our own zones only");
  assert.match(namedLog(dnsbox), /www.hand.net A -> asking alpha/);
  assert.match(namedLog(dnsbox), /nobody.org A -> asking alpha/);
  assert.match(namedLog(alpha), /nobody.org A -> asking dnsbox/);
  assert.match(namedLog(alpha), /nobody.org A \(dnsbox\) -> NXDOMAIN/);
  // a forwarder that is not there: SERVFAIL, not silence
  charlie.mkdir("C:\\DNS");
  charlie.write("C:\\DNS\\NAMED.CNF", "forwarders nosuchbox\n");
  charlie.write("C:\\PROGRAMS\\NAMED.SPK", src("simdns/src/NAMED.SPK"));
  charlie.run("C:\\PROGRAMS\\NAMED.SPK");
  await until(() => named(charlie) && namedLog(charlie).includes("Listening"), "CHARLIE's name server");
  assert.equal(await ask(bravo, "charlie", "QUERY www.coolsite.sim"), "SERVFAIL cannot find the name server nosuchbox");
  charlie.kernel.kill(named(charlie));
  assert.deepEqual([...dnsbox.errors, ...alpha.errors, ...charlie.errors], []);
});

await test("an answer must fit in one network message", async () => {
  let big = "";
  for (let i = 0; i < 400; i++) big += `@ TXT "${"x".repeat(180)} ${i}"\n`;
  dnsbox.write("C:\\DNS\\BIG.SIM", big);
  dnsbox.write("C:\\DNS\\NAMED.CNF", dnsbox.read("C:\\DNS\\NAMED.CNF") + "primary big.sim BIG.SIM\n");
  await until(async () => (await ask(bravo, "dnsbox", "QUERY big.sim TXT")) !== "NXDOMAIN", "the big zone", 8000);
  assert.equal(await ask(bravo, "dnsbox", "QUERY big.sim TXT"), "SERVFAIL the answer is too long for one message");
  assert.equal(await ask(bravo, "dnsbox", "QUERY www.coolsite.sim"), "OK\nwww.coolsite.sim 300 CNAME alpha", "and it goes on answering");
  dnsbox.write("C:\\DNS\\NAMED.CNF", dnsbox.read("C:\\DNS\\NAMED.CNF").replace("primary big.sim BIG.SIM\n", ""));
});

// ---------------------------------------------------------------- DIG and the resolver

const dig = async (m, ...args) => {
  const pid = m.run("C:\\PROGRAMS\\DIG.SPK", args);
  await net.until(() => !m.running(pid), 10000, "DIG");
  return m.output(pid);
};
bravo.write("C:\\PROGRAMS\\DIG.SPK", src("simdns/src/DIG.SPK") + "\n" + src("simdns/src/RESOLVE.SPK"));

await test("DIG SET makes a machine the name server; DIG prints the CNAMEs and where the machine is", async () => {
  assert.match(await dig(bravo, "SET"), /No name server is set/);
  assert.match(await dig(bravo, "www.coolsite.sim"), /No name server is set/);
  assert.match(await dig(bravo, "SET", "DNSBOX"), /The name server is now dnsbox/);
  assert.equal(bravo.read("C:\\SYSTEM\\RESOLV.INI"), "nameserver=dnsbox\n");
  const out = await dig(bravo, "shop.coolsite.sim");
  assert.match(out, /; <<>> DiG 2.1 for SIM95 \(SimDNS\) <<>> shop.coolsite.sim A/);
  assert.match(out, /status: NOERROR, answers: 3/);
  assert.match(out, /;; ANSWER SECTION:\nshop.coolsite.sim. +300 +IN +CNAME +store.coolsite.sim\nstore.coolsite.sim. +300 +IN +CNAME +www.coolsite.sim\nwww.coolsite.sim. +300 +IN +CNAME +alpha\n/);
  assert.match(out, new RegExp(";; alpha is a SIM95 machine name: " + alpha.stack.localIp().replace(/\./g, "\\.") + " \\(asked SIM95, not SimDNS\\)"));
  assert.match(out, /;; SERVER: dnsbox \(65\.16\.0\.\d+\) port 53/);
  assert.match(await dig(bravo, "old.coolsite.sim"), /old.coolsite.sim. +60 +IN +A +65.16.0.250\n/);
  assert.match(await dig(bravo, "coolsite.sim", "MX"), /coolsite.sim. +300 +IN +MX +10 alpha/);
  assert.match(await dig(bravo, "www.hand.net", "@alpha"), /www.hand.net. +120 +IN +CNAME +bravo[\s\S]*SERVER: alpha/);
  const nx = await dig(bravo, "nope.coolsite.sim");
  assert.match(nx, /status: NXDOMAIN, answers: 0/);
  assert.doesNotMatch(nx, /ANSWER SECTION/);
  assert.match(await dig(bravo, "loop1.coolsite.sim"), /status: SERVFAIL, answers: 0\n;; more than 8 CNAMEs in a row/);
  assert.match(await dig(bravo, "www.coolsite.sim", "@bravo"), /connection to bravo \(65\.16\.0\.\d+\) port 53 failed: Connection refused\. Is NAMED.SPK running there\?/);
  assert.match(await dig(bravo, "www.coolsite.sim", "@nowhere"), /there is no machine called nowhere/);
  assert.deepEqual(bravo.ui.dialogs, []);
});

// A program that uses RESOLVE.SPK as Simxplorer does: one question a tick,
// the Connect last. It prints where each name went, and how long it took.
bravo.write("C:\\MYFILES\\RSTEST.SPK", `
VAR names AS Array OF String
VAR at AS Integer
VAR waiting AS Bool
VAR began AS Integer
VAR win AS GUI_Window
VAR clock AS GUI_Timer
SUB Main ()
    VAR a AS String
    FOR EACH a IN SYS.Args
        names.Add(a)
    NEXT
    win = GUI_Window.New("rs", 10, 10)
    clock = GUI_Timer.New(win)
    clock.Interval = 20
    clock.onTick = Clock_OnTick
    clock.Start()
END SUB
SUB Clock_OnTick ()
    TRY
        Tick()
    CATCH err
    END TRY
END SUB
SUB Tick ()
    VAR addr AS String
    IF RsBusy() THEN RETURN
    IF waiting THEN
        Print(names[at] + " -> " + RsTarget(names[at]) + " | " + RsCanonical(names[at]) + " | " + Str(RsKnown(names[at])) + " | " + Str(SYS.Ticks - began) + " | " + rsWhy)
        at = at + 1
        waiting = FALSE
    END IF
    IF at >= names.Count THEN SYS.Exit(0)
    waiting = TRUE
    began = SYS.Ticks
    IF NOT RsWants(names[at]) THEN RETURN
    addr = NET.Resolve(RsNameServer())
    IF addr = "" THEN
        RsGiveUp("there is no machine called " + RsNameServer())
        RETURN
    END IF
    RsAsk(names[at], addr)
END SUB
` + "\n" + src("simdns/src/RESOLVE.SPK"));
const resolve = async (...names) => {
  const pid = bravo.run("C:\\MYFILES\\RSTEST.SPK", names);
  await net.until(() => !bravo.running(pid), 20000, "the resolver");
  assert.deepEqual(bravo.ui.dialogs, []);
  return bravo.output(pid).trim().split("\n").map((l) => l.split(" | "));
};
const questions = (name) => (namedLog(dnsbox).match(new RegExp("  " + name.replace(/\./g, "\\.") + " A -> ", "g")) || []).length;

await test("the resolver: CNAMEs to the machine, an address, the search domain, and SIM95's own names", async () => {
  const r = await resolve("www.coolsite.sim", "shop.coolsite.sim", "old.coolsite.sim", "alpha", "65.16.0.9", "nope.coolsite.sim");
  assert.deepEqual(r[0].slice(0, 3), ["www.coolsite.sim -> alpha", "www.coolsite.sim", "True"]);
  assert.deepEqual(r[1].slice(0, 3), ["shop.coolsite.sim -> alpha", "www.coolsite.sim", "True"], "the chain, to its machine");
  assert.deepEqual(r[2].slice(0, 3), ["old.coolsite.sim -> 65.16.0.250", "old.coolsite.sim", "True"]);
  assert.deepEqual(r[3].slice(0, 3), ["alpha -> alpha", "alpha", "False"], "a machine name is not asked about");
  assert.deepEqual(r[4].slice(0, 3), ["65.16.0.9 -> 65.16.0.9", "65.16.0.9", "False"]);
  assert.deepEqual(r[5].slice(0, 3), ["nope.coolsite.sim -> nope.coolsite.sim", "nope.coolsite.sim", "False"], "NXDOMAIN: SIM95 tries the name itself");
  bravo.write("C:\\SYSTEM\\RESOLV.INI", "nameserver=dnsbox\nsearch=coolsite.sim\n");
  const s = await resolve("store", "alpha");
  assert.deepEqual(s[0].slice(0, 2), ["store -> alpha", "www.coolsite.sim"], "store means store.coolsite.sim");
  assert.deepEqual(s[1].slice(0, 2), ["alpha -> alpha", "alpha"], "NXDOMAIN for alpha.coolsite.sim: the machine");
  bravo.write("C:\\SYSTEM\\RESOLV.INI", "nameserver=dnsbox\n");
});

await test("the resolver keeps answers for their TTL, so a name is asked about once", async () => {
  const before = questions("mirror.coolsite.sim");
  const r = await resolve("mirror.coolsite.sim", "mirror.coolsite.sim", "Mirror.CoolSite.Sim");
  assert.deepEqual(r.map((x) => x[0]), ["mirror.coolsite.sim -> alpha", "mirror.coolsite.sim -> alpha", "Mirror.CoolSite.Sim -> alpha"]);
  assert.equal(questions("mirror.coolsite.sim") - before, 1);
});

await test("a name server that is down: names go to SIM95 at once, and it is left alone for a while", async () => {
  bravo.write("C:\\SYSTEM\\RESOLV.INI", "nameserver=charlie\n"); // a machine, but no name server on it
  let r = await resolve("www.coolsite.sim", "www.toys.com", "alpha");
  assert.equal(r[0][0], "www.coolsite.sim -> www.coolsite.sim");
  assert.ok(Number(r[0][3]) < 1500, "gave up in " + r[0][3] + " ms");
  assert.match(r[0][4], /the name server charlie refused/);
  assert.ok(Number(r[1][3]) < 100, "and did not try again: " + r[1][3] + " ms");
  bravo.write("C:\\SYSTEM\\RESOLV.INI", "nameserver=nowhere\n"); // no such machine
  r = await resolve("www.coolsite.sim");
  assert.equal(r[0][0], "www.coolsite.sim -> www.coolsite.sim");
  assert.ok(Number(r[0][3]) < 1500, "gave up in " + r[0][3] + " ms");
  assert.match(r[0][4], /there is no machine called nowhere/);
  bravo.write("C:\\SYSTEM\\RESOLV.INI", "nameserver=dnsbox\n");
});

// ---------------------------------------------------------------- the web server

alpha.mkdir("C:\\WEB\\SITES\\COOLSITE");
const site = (f, text) => alpha.write("C:\\WEB\\SITES\\COOLSITE\\" + f, text);
site("INDEX.HTM", `<html><head><title>Cool Site</title></head><body bgcolor="#000000">
<h1>Welcome to my cool site!</h1><img src="dot.pic"> <a href="more.asp?x=1">More</a> <a href="sub/deep.htm">Deep</a>
<span id="news">no news</span>
<script language="JavaScript">
var r = new XMLHttpRequest();
r.open("GET", "news.txt", true);
r.onreadystatechange = function () { if (r.readyState == 4) document.getElementById("news").innerText = r.status + " " + r.responseText; };
r.send(null);
</script></body></html>`);
site("DOT.PIC", "SIM95PIC 2 2\nC9\n9C\n");
site("NEWS.TXT", "Cool news");
site("MORE.ASP", `<% RESPONSE.SetCookie("seen", "yes") %><html><head><title>More</title></head><body>
<p id="host"><%= REQUEST.Host %></p><p id="path"><%= REQUEST.Path %></p><p id="query"><%= REQUEST.QueryString %></p>
<p id="site"><%= REQUEST.Header("X-Site") %></p><p id="base"><%= REQUEST.Header("X-Base-Path") %></p>
<p id="script"><%= SERVER.ScriptName %></p><p id="cookie"><%= REQUEST.Cookie("seen") %></p><p id="form"><%= REQUEST.Form("who") %></p>
<p><a href="index.htm">Home</a></p></body></html>`);
site("GO.ASP", `<% RESPONSE.Redirect("/more.asp?from=go") %>`);
alpha.mkdir("C:\\WEB\\SITES\\COOLSITE\\SUB");
site("SUB\\DEEP.HTM", "<html><head><title>Deep</title></head><body><a href=\"../index.htm\">Up</a></body></html>");
alpha.mkdir("C:\\WEB\\SITES\\USERS");
alpha.write("C:\\WEB\\SITES\\USERS\\INDEX.HTM", "<html><head><title>Somebody's page</title></head><body>users</body></html>");
alpha.write("C:\\WEB\\VHOSTS.TXT", alpha.read("C:\\WEB\\VHOSTS.TXT") + `www.coolsite.sim|C:\\WEB\\SITES\\COOLSITE
coolsite.sim|C:\\WEB\\SITES\\COOLSITE\\
*.users.coolsite.sim|C:\\WEB\\SITES\\USERS
evil.sim|C:\\SYSTEM
`);

await test("Voyager path mode: http://alpha/www.coolsite.sim/ is the site, and the page sees the path inside it", async () => {
  let r = await http(bravo, "ALPHA", "GET", "/www.coolsite.sim");
  assert.equal(r.status, "302 Found");
  assert.equal(header(r, "Location"), "/www.coolsite.sim/");
  r = await http(bravo, "ALPHA", "GET", "/www.coolsite.sim?a=1");
  assert.equal(header(r, "Location"), "/www.coolsite.sim/?a=1");
  r = ok(await http(bravo, "ALPHA", "GET", "/www.coolsite.sim/"));
  assert.match(r.body, /<h1>Welcome to my cool site!<\/h1>/);
  assert.equal(header(r, "Content-Type"), "text/html");
  assert.equal(ok(await http(bravo, "ALPHA", "GET", "/www.coolsite.sim/dot.pic")).body, "SIM95PIC 2 2\nC9\n9C\n");
  assert.match(ok(await http(bravo, "ALPHA", "GET", "/WWW.COOLSITE.SIM/sub/deep.htm")).body, /Deep/);
  r = ok(await http(bravo, "ALPHA", "GET", "/www.coolsite.sim/more.asp?x=1"));
  assert.match(r.body, /<p id="host">alpha<\/p><p id="path">\/more.asp<\/p><p id="query">x=1<\/p>/);
  assert.match(r.body, /<p id="site">www.coolsite.sim<\/p><p id="base">\/www.coolsite.sim\/<\/p>/);
  assert.match(r.body, /<p id="script">C:\\WEB\\SITES\\COOLSITE\\MORE.ASP<\/p>/);
  r = await http(bravo, "ALPHA", "POST", "/www.coolsite.sim/more.asp", { body: "who=Ann+%26+Bob" });
  assert.match(r.body, /<p id="form">Ann & Bob<\/p>/, "a POST's body arrives as it was sent");
  r = await http(bravo, "ALPHA", "GET", "/www.coolsite.sim/go.asp");
  assert.equal(r.status, "302 Found");
  assert.equal(header(r, "Location"), "/www.coolsite.sim/more.asp?from=go", "a redirect to /... stays inside the site");
  assert.equal((await http(bravo, "ALPHA", "GET", "/www.coolsite.sim/nothere.htm")).status, "404 Not Found");
  assert.equal((await http(bravo, "ALPHA", "GET", "/www.coolsite.sim/../NIC.SPK")).status, "404 Not Found");
  assert.match(ok(await http(bravo, "ALPHA", "GET", "/ann.users.coolsite.sim/")).body, /Somebody's page/, "a *. site by path");
  assert.equal((await http(bravo, "ALPHA", "GET", "/evil.sim/USERS.INI")).status, "404 Not Found", "a folder outside C:\\WEB is not a site");
  assert.match(alpha.widgets(webPid(alpha), "ListBox")[0].get("Items").join("\n"), /VHOSTS.TXT: evil.sim is not in C:\\WEB, so it is left out/);
});

await test("Host mode: a request for www.coolsite.sim is the site; other names, and none, are C:\\WEB as before", async () => {
  let r = ok(await http(bravo, "ALPHA", "GET", "/", { hostHeader: "www.coolsite.sim" }));
  assert.match(r.body, /Welcome to my cool site/);
  r = ok(await http(bravo, "ALPHA", "GET", "/more.asp?x=2", { hostHeader: "WWW.CoolSite.sim:80" }));
  assert.match(r.body, /<p id="host">WWW.CoolSite.sim:80<\/p><p id="path">\/more.asp<\/p>/);
  assert.match(r.body, /<p id="site">www.coolsite.sim<\/p><p id="base">\/<\/p>/);
  r = await http(bravo, "ALPHA", "GET", "/go.asp", { hostHeader: "coolsite.sim" });
  assert.equal(header(r, "Location"), "/more.asp?from=go", "by name, a redirect is left alone");
  assert.match(ok(await http(bravo, "ALPHA", "GET", "/", { hostHeader: "bob.users.coolsite.sim" })).body, /Somebody's page/);
  // this machine, an address, a stranger, no Host at all: SimNIC, the home page
  for (const h of ["alpha", alpha.stack.localIp(), "www.elsewhere.sim"]) assert.match(ok(await http(bravo, "ALPHA", "GET", "/", { hostHeader: h })).body, /<title>Domain Name Registration - SimNIC<\/title>/, h);
  assert.match(ok(await http(bravo, "ALPHA", "GET", "/welcome.htm")).body, /ALPHA/);
  // a site's X-Site can't be made up by the browser
  r = await http(bravo, "ALPHA", "GET", "/more.asp", { hostHeader: "www.coolsite.sim\nX-Site: evil" });
  assert.match(r.body, /<p id="site">www.coolsite.sim<\/p>/);
  assert.deepEqual(alpha.errors, []);
});

// ---------------------------------------------------------------- Simxplorer

bravo.write("C:\\PROGRAMS\\SIMXPLOR.SPK", simxplorerSource());
bravo.write("C:\\SYSTEM\\SIMXPLOR.INI", "[Simxplorer]\nhome=about:blank\nsearch=\nmail=\n");
let ie, statuses = [];
const sx = {
  win: () => bravo.widgets(ie, "Window")[0],
  view: () => bravo.widgets(ie, "HtmlView")[0],
  html: () => String(sx.view().get("Html") ?? ""),
  el: (id) => sx.view().elements.get(id),
  title: () => sx.win().get("Title"),
  loaded: (t, ms = 10000) => until(() => sx.title() === t + " - Simxplorer" && String(sx.win().get("Status")).startsWith("Done"), "the page " + t, ms),
  go: (url) => { const box = bravo.widgets(ie, "TextBox")[0]; box.set("Text", url); box.fire("onEnter"); },
  address: () => bravo.widgets(ie, "TextBox")[0].get("Text"),
};
// Sends form n the way Simxplorer's own form handling would.
function submit(n, typed = {}) {
  const html = sx.html();
  const tag = html.split(/<form\b/i)[n + 1];
  const form = tag.split(/<\/form>/i)[0];
  const attr = (t, a) => (new RegExp(`\\s${a}="([^"]*)"`, "i").exec(t) || [])[1];
  const pairs = [];
  for (const m of form.matchAll(/<(input|textarea|select)\b([^>]*)>/gi)) {
    const t = m[2], name = attr(t, "name"), type = (attr(t, "type") || "text").toLowerCase();
    if (!name || type === "submit" || type === "button") continue;
    pairs.push([name, name in typed ? typed[name] : decode(attr(t, "value") || "")]);
  }
  const body = pairs.map(([k, v]) => encodeURIComponent(k).replace(/%20/g, "+") + "=" + encodeURIComponent(v).replace(/%20/g, "+")).join("&");
  const action = /action="([^"]*)"/.exec(tag)[1];
  if (/method="post"/i.test(tag.split(">")[0])) sx.view().fire("onSubmit", action, body, "");
  else sx.view().fire("onNavigate", action + "?" + body);
}

await test("Simxplorer on BRAVO opens http://www.coolsite.sim/ on ALPHA through DNSBOX's name server", async () => {
  ie = bravo.run("C:\\PROGRAMS\\SIMXPLOR.SPK", ["about:blank"]);
  await until(() => sx.win() && sx.view(), "Simxplorer", 30000);
  const w = sx.win();
  const set = w.set.bind(w);
  w.set = (p, v) => { if (p === "Status") statuses.push(v); set(p, v); };
  const asked = questions("www.coolsite.sim");
  sx.go("www.coolsite.sim");
  await sx.loaded("Cool Site");
  assert.equal(sx.address(), "http://www.coolsite.sim/", "the address stays as typed");
  const from = statuses.indexOf("Looking up www.coolsite.sim...");
  assert.ok(from >= 0, statuses.join(" / "));
  assert.ok(statuses.indexOf("Connecting to alpha...") > from, statuses.join(" / "));
  // the picture and the script's request go to ALPHA by the same name
  sx.view().fire("onImage", "dot.pic");
  await until(() => sx.view().images?.get("dot.pic"), "the picture");
  assert.equal(sx.view().images.get("dot.pic"), "SIM95PIC 2 2\nC9\n9C\n");
  await until(() => sx.el("news")?.Value === "200 Cool news", "the XMLHttpRequest");
  assert.equal(questions("www.coolsite.sim") - asked, 1, "asked about once, for the page, the picture and the request");
  // a relative link, a page that sees its own name, and a cookie for that name
  sx.view().fire("onNavigate", "more.asp?x=1");
  await sx.loaded("More");
  assert.equal(sx.el("host").Value, "www.coolsite.sim");
  assert.equal(sx.el("path").Value, "/more.asp");
  assert.equal(sx.el("base").Value, "/");
  assert.match(bravo.read("C:\\SYSTEM\\COOKIES.TXT"), /^WWW\.COOLSITE\.SIM\|seen\|yes$/m, "cookies go by the name typed");
  sx.view().fire("onNavigate", "more.asp?x=2");
  await until(() => sx.el("cookie")?.Value === "yes", "the cookie sent back");
  sx.view().fire("onNavigate", "sub/deep.htm");
  await sx.loaded("Deep");
  sx.view().fire("onNavigate", "../index.htm");
  await sx.loaded("Cool Site");
  // names SimDNS doesn't know, and machine names, work as they always did
  sx.go("bravo");
  await sx.loaded("BRAVO's Home Page");
  sx.go("nope.coolsite.sim");
  await until(() => bravo.ui.dialogs.length > 0, "the error");
  assert.match(bravo.ui.dialogs.splice(0)[0].text, /Simxplorer cannot open the Internet site http:\/\/nope.coolsite.sim\/\.\s+The server name or address could not be resolved\./);
  assert.deepEqual(bravo.errors, []);
});

await test("Simxplorer: the name server in Options is C:\\SYSTEM\\RESOLV.INI, and a dead one doesn't hold pages up", async () => {
  sx.go("about:options");
  await sx.loaded("Options");
  assert.match(sx.html(), /Name server:<\/td><td><input name="dns" size="40" value="dnsbox"/);
  submit(0, { dns: "charlie" });
  await until(() => /Your settings have been saved/.test(sx.html()), "the setting");
  assert.equal(bravo.read("C:\\SYSTEM\\RESOLV.INI"), "nameserver=charlie\n");
  assert.match(bravo.read("C:\\SYSTEM\\SIMXPLOR.INI"), /home=about:blank/, "the other settings are kept");
  // CHARLIE has no name server running: www.coolsite.sim is nobody, at once
  const t0 = Date.now();
  sx.go("www.coolsite.sim");
  await until(() => bravo.ui.dialogs.length > 0, "the error");
  assert.ok(Date.now() - t0 < 4000, "took " + (Date.now() - t0) + " ms");
  assert.match(bravo.ui.dialogs.splice(0)[0].text, /could not be resolved/);
  sx.go("http://alpha/www.coolsite.sim/");
  await sx.loaded("Cool Site");
  sx.view().fire("onNavigate", "more.asp");
  await sx.loaded("More");
  assert.equal(sx.el("base").Value, "/www.coolsite.sim/", "by path");
  sx.go("about:options");
  await sx.loaded("Options");
  submit(0, { dns: "dnsbox" });
  await until(() => bravo.read("C:\\SYSTEM\\RESOLV.INI") === "nameserver=dnsbox\n", "the setting");
});

// ---------------------------------------------------------------- SimNIC

const nic = browser(alpha);
const token = async (b, url = "/home.asp") => (/(?:name="t" value="|logout\.asp\?t=)([0-9A-F]+)/.exec((await b.get(url)).body) || [])[1];
const notice = (r) => decode((/<td bgcolor="#(?:E0FFE0|FFF0C0)"><b>([^<]*)<\/b>/.exec(r.body) || [])[1] ?? "");
const zone = (m, f) => m.read("C:\\DNS\\" + f);

await test("SimNIC: sign up, look a name up under every TLD, register it (free without SimPal)", async () => {
  let r = ok(await nic.get("/"));
  assert.match(r.body, /Registration is <b>FREE<\/b>/);
  assert.match(r.body, /set your browser's <b>name server<\/b> to <b>alpha<\/b>/);
  r = ok(await nic.post("/join.asp", { name: "Dab's Fun Company", u: "dab", pw: "secret", pw2: "secret" }));
  assert.match(r.url, /home\.asp\?new=1/);
  assert.match(nic.cookies(), /simnic=[0-9A-F]+/);
  r = ok(await nic.get("/search.asp?d=fun"));
  for (const tld of ["sim", "com", "net", "org"]) assert.match(r.body, new RegExp(`<b>fun\\.${tld}</b></td><td><font color="#008000"><b>Available!`));
  r = ok(await nic.post("/register.asp", { d: "Fun.SIM", t: await token(nic) }));
  assert.match(r.url, /domain\.asp\?d=fun\.sim&new=1/);
  assert.match(notice(r), /Congratulations! fun.sim is yours until \d{4}-/);
  assert.match(alpha.read("C:\\NICDATA\\DOMAINS.TXT"), /^fun\.sim\|dab\|\d{4}-\d\d-\d\d\|\d{4}-\d\d-\d\d\|FUN\.SIM\|active$/m);
  assert.match(zone(alpha, "FUN.SIM"), /^\$TTL 60\n@ +IN +SOA +alpha hostmaster \( \d+ \)\n@ +IN +NS +alpha\n$/m);
  assert.match(alpha.read("C:\\DNS\\NAMED.CNF"), /^primary fun\.sim FUN\.SIM$/m);
  r = ok(await nic.get("/search.asp?d=fun.sim"));
  assert.match(r.body, /<font color="#CC0000">Taken<\/font>/);
  r = ok(await nic.post("/register.asp", { d: "fun.sim", t: await token(nic) }));
  assert.equal(notice(r), "Sorry, fun.sim is already registered.");
  r = ok(await nic.post("/register.asp", { d: "x.sim", t: await token(nic) }));
  assert.match(notice(r), /That is not a domain name SimNIC can register/);
  r = ok(await nic.post("/register.asp", { d: "fun.biz", t: await token(nic) }));
  assert.match(notice(r), /That is not a domain name SimNIC can register/);
  r = ok(await nic.get("/whois.asp?d=fun.sim"));
  assert.match(decode(r.body), /Registrant:\n   Dab's Fun Company \(DAB\)\n\n   Domain Name: FUN.SIM/);
  assert.match(ok(await nic.get("/home.asp")).body, /<a href="domain.asp\?d=fun\.sim"><b>fun\.sim<\/b><\/a>/);
});

await test("SimNIC: records - CNAME first in the form, then A, MX, TXT and NS - and NAMED serves them", async () => {
  let r = ok(await nic.get("/domain.asp?d=fun.sim"));
  assert.match(r.body, /<select name="type"><option value="CNAME" selected>CNAME<\/option><option value="A">A<\/option>/);
  assert.match(r.body, /<input name="value" size="24" value="alpha">/, "this machine, ready to point at");
  const add = async (name, type, value) => notice(ok(await nic.post("/record.asp", { d: "fun.sim", op: "add", name, type, value, t: await token(nic, "/domain.asp?d=fun.sim") })));
  assert.match(await add("www", "CNAME", "alpha"), /Record added/);
  assert.match(await add("shop", "CNAME", "www"), /Record added/);
  assert.match(await add("www", "CNAME", "bravo"), /Record added/);
  assert.match(await add("box", "A", "65.16.0.77"), /Record added/);
  assert.match(await add("@", "MX", "alpha"), /Record added/);
  assert.match(await add("@", "TXT", 'Say "hi"'), /Record added/);
  assert.match(await add("east", "NS", "charlie"), /Record added/);
  assert.match(await add("box", "A", "alpha"), /An A record needs an address/);
  assert.match(await add("bad name", "CNAME", "alpha"), /A name is letters, digits and hyphens/);
  assert.match(await add("x", "SRV", "alpha"), /SimNIC can make CNAME, A, MX, TXT and NS records/);
  assert.match(await add("@", "NS", "charlie"), /This domain's own name server is SimNIC's/);
  const records = zone(alpha, "FUN.SIM").split("\n").filter((l) => / IN /.test(l) && !/SOA|^@ +IN +NS/.test(l));
  assert.deepEqual(records.map((l) => l.replace(/ +/g, " ")), ["shop IN CNAME www", "www IN CNAME bravo", "box IN A 65.16.0.77", "@ IN MX 10 alpha", `@ IN TXT "Say 'hi'"`, "east IN NS charlie"], "the second www CNAME took the first one's place");
  await until(async () => (await ask(bravo, "alpha", "QUERY shop.fun.sim")) === "OK\nshop.fun.sim 60 CNAME www.fun.sim\nwww.fun.sim 60 CNAME bravo", "NAMED on ALPHA", 8000);
  assert.equal(await ask(bravo, "alpha", "QUERY box.fun.sim"), "OK\nbox.fun.sim 60 A 65.16.0.77");
  assert.equal(await ask(bravo, "alpha", "QUERY fun.sim TXT"), `OK\nfun.sim 60 TXT "Say 'hi'"`);
  // delete one, by its place in the list
  r = ok(await nic.get("/domain.asp?d=fun.sim"));
  assert.match(r.body, /<td><tt>box<\/tt><\/td><td><tt>A<\/tt><\/td><td><tt>65.16.0.77<\/tt><\/td>/);
  r = ok(await nic.post("/record.asp", { d: "fun.sim", op: "del", n: "2", t: await token(nic, "/domain.asp?d=fun.sim") }));
  assert.equal(notice(r), "Record deleted.");
  assert.doesNotMatch(zone(alpha, "FUN.SIM"), /65\.16\.0\.77/);
  assert.match(zone(alpha, "FUN.SIM"), /^@ +IN +SOA/m, "the head of the zone stays");
});

await test("SimNIC: Host it here makes a site in C:\\WEB\\SITES, by name and by path", async () => {
  let r = ok(await nic.post("/hostit.asp", { d: "fun.sim", t: await token(nic, "/domain.asp?d=fun.sim") }));
  assert.equal(notice(r), "fun.sim is hosted here. Put your pages in C:\\WEB\\SITES\\FUN.");
  assert.match(alpha.read("C:\\WEB\\VHOSTS.TXT"), /^fun\.sim\|C:\\WEB\\SITES\\FUN\nwww\.fun\.sim\|C:\\WEB\\SITES\\FUN\n/m);
  assert.match(alpha.read("C:\\WEB\\SITES\\FUN\\INDEX.HTM"), /<h1>fun.sim<\/h1>[\s\S]*under construction/);
  assert.match(zone(alpha, "FUN.SIM"), /^@ +IN +CNAME +alpha$/m);
  assert.match(zone(alpha, "FUN.SIM"), /^www +IN +CNAME +alpha$/m, "www now points here");
  assert.doesNotMatch(zone(alpha, "FUN.SIM"), /www +IN +CNAME +bravo/);
  assert.match(r.body, /<a href="http:\/\/www.fun.sim\/">http:\/\/www.fun.sim\/<\/a> <font size="2">\(Simxplorer, with a SimDNS name server\)/);
  assert.match(r.body, /<a href="http:\/\/alpha\/www.fun.sim\/">http:\/\/alpha\/www.fun.sim\/<\/a> <font size="2">\(Voyager, or any browser\)/);
  assert.match(ok(await nic.get("/home.asp")).body, /hosted here/);
  // both ways, over the network
  assert.match(ok(await http(bravo, "ALPHA", "GET", "/www.fun.sim/")).body, /Coming soon!/);
  assert.match(ok(await http(bravo, "ALPHA", "GET", "/", { hostHeader: "fun.sim" })).body, /Coming soon!/);
  // and from Simxplorer, with ALPHA's name server (DNSBOX forwards there too)
  await until(async () => (await ask(bravo, "dnsbox", "QUERY www.fun.sim")) === "OK\nwww.fun.sim 60 CNAME alpha", "the new records", 8000);
  sx.go("http://www.fun.sim/");
  await sx.loaded("fun.sim");
  // a second Host it here changes nothing
  ok(await nic.post("/hostit.asp", { d: "fun.sim", t: await token(nic, "/domain.asp?d=fun.sim") }));
  assert.equal((alpha.read("C:\\WEB\\VHOSTS.TXT").match(/fun\.sim\|/g) || []).length, 2);
});

await test("SimNIC: forms from anywhere else change nothing (CSRF), and other people's domains are theirs", async () => {
  const before = zone(alpha, "FUN.SIM");
  const vhosts = alpha.read("C:\\WEB\\VHOSTS.TXT");
  // another site's page posting with dab's cookie, but without the form token
  let r = await alpha.request("POST", "/record.asp", { body: "d=fun.sim&op=add&name=www&type=CNAME&value=evil", cookies: nic.cookies() });
  assert.match(r.headers.join("\n"), /Location: home.asp\?why=That\+did\+not\+come\+from\+a\+SimNIC\+page/);
  r = await alpha.request("POST", "/record.asp", { body: "d=fun.sim&op=del&n=0&t=12345678", cookies: nic.cookies() });
  assert.match(r.headers.join("\n"), /Location: home.asp\?why=That\+did\+not/);
  r = await alpha.request("POST", "/hostit.asp", { body: "d=fun.sim", cookies: nic.cookies() });
  r = await alpha.request("POST", "/register.asp", { body: "d=evil.sim", cookies: nic.cookies() });
  r = await alpha.request("GET", "/logout.asp", { cookies: nic.cookies() });
  assert.equal(zone(alpha, "FUN.SIM"), before);
  assert.equal(alpha.read("C:\\WEB\\VHOSTS.TXT"), vhosts);
  assert.doesNotMatch(alpha.read("C:\\NICDATA\\DOMAINS.TXT"), /evil/);
  assert.match(ok(await nic.get("/home.asp")).body, /My Domains/, "still logged in");
  // somebody else can't touch fun.sim, or see its page
  const eve = browser(alpha);
  ok(await eve.post("/join.asp", { name: "Eve", u: "eve", pw: "secret", pw2: "secret" }));
  r = ok(await eve.get("/domain.asp?d=fun.sim"));
  assert.equal(notice(r), "That is not one of your domains.");
  r = ok(await eve.post("/record.asp", { d: "fun.sim", op: "add", name: "www", type: "CNAME", value: "evil", t: await token(eve) }));
  assert.equal(notice(r), "That is not one of your domains.");
  assert.equal(zone(alpha, "FUN.SIM"), before);
  // nobody logged in
  r = await alpha.request("GET", "/home.asp");
  assert.match(r.headers.join("\n"), /Location: index.asp\?why=Please\+log\+in/);
  assert.ok(!(await nic.post("/login.asp", { u: "dab", pw: "wrong" })).url.includes("home.asp"));
});

await test("SimNIC: every page fits in a message, and a domain has at most 40 records", async () => {
  const t = await token(nic, "/domain.asp?d=fun.sim");
  let said = "";
  for (let i = 0; said !== "A domain at SimNIC has at most 40 records." && i < 50; i++) {
    said = notice(ok(await nic.post("/record.asp", { d: "fun.sim", op: "add", name: "n" + i + "-" + "a".repeat(30), type: "TXT", value: "z".repeat(200), t })));
  }
  assert.equal(said, "A domain at SimNIC has at most 40 records.");
  const r = ok(await nic.get("/domain.asp?d=fun.sim"));
  assert.ok(r.raw.length < MESSAGE_LIMIT, r.raw.length);
  await until(async () => (await ask(bravo, "alpha", "QUERY fun.sim ANY")) !== null, "NAMED", 8000);
  const any = await ask(bravo, "alpha", "QUERY fun.sim ANY");
  assert.ok(any.length < MESSAGE_LIMIT && any.startsWith("OK"), any.slice(0, 80));
  // nine more domains each, and no more
  for (let i = 0; i < 9; i++) ok(await nic.post("/register.asp", { d: `more${i}.com`, t: await token(nic) }));
  assert.equal(notice(ok(await nic.post("/register.asp", { d: "toomany.com", t: await token(nic) }))), "SimNIC registers at most 10 domains per contact.");
  assert.ok(ok(await nic.get("/home.asp")).raw.length < MESSAGE_LIMIT);
});

// ---------------------------------------------------------------- every app, through the new web server

const host = await net.boot("HOST");
host.write("C:\\SYSTEM\\USERS.INI", "name=dab\npassword=hostpw\n");
host.run("C:\\PROGRAMS\\HTTPD.SPK");

await test("a SimHost machine with every app, and SimDNS's web server in front of them", async () => {
  assert.match(await install(host, "simhost"), /mode=folders/);
  const out = await install(host, "simdns");
  assert.match(out, /wrote C:\\WEB\\DNS\\NIC.SPK/);
  assert.match(out, /restarted the web server/);
  assert.match(out, /Open http:\/\/host\/dns\/ in Voyager/);
  for (const app of ["simbook", "coldmail", "asksim", "simpal", "simtube", "simstats", "vapor"]) assert.match(await install(host, app, 120000), / is installed \(/, app);
  assert.equal(host.read("C:\\PROGRAMS\\HTTPD.SPK"), src("simdns/src/HTTPD.SPK"));
  await until(() => webPid(host) && named(host), "the servers");
  assert.deepEqual(host.ui.dialogs.filter((d) => d.kind === "error"), []);
});

await test("every app's pages, pictures and files come through it over the network", async () => {
  // the front page lists the registrar with the rest
  let r = ok(await http(bravo, "HOST", "GET", "/"));
  for (const name of ["SimBook", "ColdMail", "AskSim", "SimPal", "SimTube", "SimStats", "Vapor", "SimDNS"]) assert.ok(r.body.includes(name), name);
  assert.match(ok(await http(bravo, "HOST", "GET", "/dns/")).body, /SimNIC/);
  // SimBook: a page, joining (a POST), and its cookie
  assert.match(ok(await http(bravo, "HOST", "GET", "/book/")).body, /SimBook/);
  r = await http(bravo, "HOST", "POST", "/book/join.asp", { body: "name=Ann&u=ann&pw=secret&pw2=secret" });
  assert.equal(r.status, "302 Found");
  const cookie = header(r, "Set-Cookie").split(";")[0];
  assert.match(cookie, /^simbook=/);
  assert.match(ok(await http(bravo, "HOST", "GET", "/book/home.asp", { cookie })).body, /Ann/);
  assert.match(ok(await http(bravo, "HOST", "GET", "/book/nopic.pic")).body, /^SIM95PIC /);
  // ColdMail: webmail and its copies for GETMAIL
  assert.match(ok(await http(bravo, "HOST", "GET", "/mail/")).body, /ColdMail/);
  assert.ok(ok(await http(bravo, "HOST", "GET", "/mail/dist/manifest.txt")).body.includes("|C:\\WEB\\"));
  // AskSim and SimPal
  assert.match(ok(await http(bravo, "HOST", "GET", "/ask/")).body, /AskSim/);
  assert.match(ok(await http(bravo, "HOST", "GET", "/pal/")).body, /SimPal/);
  // Vapor: the store, a part of a game, and GETVAPOR
  assert.match(ok(await http(bravo, "HOST", "GET", "/vapor/")).body, /Vapor/);
  assert.match(ok(await http(bravo, "HOST", "GET", "/vapor/catalog.txt")).body, /^SIMDOOM\|SimDOOM\|/m);
  assert.match(ok(await http(bravo, "HOST", "GET", "/vapor/simdoom/1.txt")).body, /^' VAPOR\|id=SIMDOOM/);
  r = ok(await http(bravo, "HOST", "GET", "/vapor/getvapor.asp"));
  assert.equal(header(r, "Content-Type"), "text/plain");
  assert.match(r.body, /host/);
  // SimStats: the tracking tag is a picture
  const id = host.read("C:\\STATDATA\\HOME.TXT").trim();
  r = ok(await http(bravo, "HOST", "GET", "/stats/hit.asp?s=" + id + "&p=/&t=Test"));
  assert.equal(header(r, "Content-Type"), "image/x-sim95pic");
  assert.match(r.body, /^SIM95PIC 1 1/);
  r = ok(await http(bravo, "HOST", "GET", "/stats/hit.asp?s=" + id + "&b=1"));
  assert.match(r.body, /^SIM95PIC 88 31/);
  // SimTube: the front page puts the sample movies up; a movie is video/x-simmovie
  r = ok(await http(bravo, "HOST", "GET", "/tube/"));
  const v = (/watch\.asp\?v=(\d+)/.exec(r.body) || [])[1];
  assert.ok(v, "a movie on the front page");
  r = ok(await http(bravo, "HOST", "GET", "/tube/movie.asp?v=" + v));
  assert.equal(header(r, "Content-Type"), "video/x-simmovie");
  assert.match(r.body, /^SIMMOVIE/);
  assert.equal((await http(bravo, "HOST", "GET", "/tube/movie.asp?v=99999")).status, "404 Not Found");
  // the plain old ways: a 404, a POST to a file, and the stock pages
  assert.equal((await http(bravo, "HOST", "GET", "/nothere.htm")).status, "404 Not Found");
  assert.equal((await http(bravo, "HOST", "POST", "/welcome.htm", { body: "a=1" })).status, "405 Method Not Allowed");
  assert.match(ok(await http(bravo, "HOST", "GET", "/hello.asp")).body, /HELLO|Hello|hello/);
  assert.deepEqual(host.errors, []);
});

await test("AskSim's crawler goes round the network through it", async () => {
  const stats = () => (host.exists("C:\\ASKDATA\\STATS.TXT") ? host.read("C:\\ASKDATA\\STATS.TXT") : "");
  await until(() => stats() !== "", "the first crawl", 90000);
  const docs = host.read("C:\\ASKDATA\\DOCS.TXT");
  for (const url of ["http://host/", "http://host/book/", "http://host/dns/", "http://alpha/"]) assert.ok(docs.includes("|" + url + "|"), url);
});

// ---------------------------------------------------------------- SimPal, and an app at book.dab.sim

const owner = browser(host);
await test("SimNIC with SimPal on the machine: §70.00 for two years, paid at SimPal, checked with PALCHECK", async () => {
  // SimNIC's own SimPal account, and a buyer's
  const simnic = browser(host);
  ok(await simnic.post("/pal/join.asp", { name: "SimNIC", u: "simnic", pw: "secret", pw2: "secret" }));
  ok(await owner.post("/pal/join.asp", { name: "Dab", u: "dab", pw: "secret", pw2: "secret" }));
  ok(await owner.post("/dns/join.asp", { name: "Dab", u: "dab", pw: "secret", pw2: "secret" }));
  let r = ok(await owner.get("/dns/"));
  assert.match(r.body, /Registration is <b>&sect;70.00<\/b> for two years, paid with SimPal/);
  r = ok(await owner.post("/dns/register.asp", { d: "dab.sim", t: await token(owner, "/dns/home.asp") }));
  assert.match(r.body, /<form action="http:\/\/host\/pal\/pay.asp" method="post">/);
  const field = (n) => (new RegExp(`name="${n}" value="([^"]*)"`).exec(r.body) || [])[1];
  assert.equal(field("to"), "simnic");
  assert.equal(field("amount"), "70.00");
  assert.equal(field("return"), "http://host/dns/paid.asp");
  const order = field("order");
  assert.match(host.read("C:\\NICDATA\\DOMAINS.TXT"), /^dab\.sim\|dab\|\d+\|\|\|unpaid$/m, "held while they pay");
  assert.match(ok(await browser(host).get("/dns/search.asp?d=dab.sim")).body, /Taken/);
  assert.equal(await ask(bravo, "host", "QUERY dab.sim"), "NXDOMAIN", "but not in the name server yet");
  // pay, as SimPal's pay page does
  const pt = (/name="t" value="([0-9A-F]+)"/.exec((await owner.get("/pal/send.asp")).body) || [])[1];
  const paid = await host.request("POST", "/pal/pay.asp", { body: new URLSearchParams({ to: "simnic", amount: "70.00", item: field("item"), order, return: field("return"), do: "pay", t: pt }).toString(), cookies: owner.cookies() });
  const back = (paid.headers.find((h) => h.startsWith("Location: ")) || "").slice(10);
  assert.match(back, /^http:\/\/host\/dns\/paid\.asp\?receipt=R\d+-[0-9A-F]+&order=/, paid.body.slice(0, 300));
  r = ok(await owner.get(back.replace("http://host", "")));
  assert.match(notice(r), /^Thank you! dab.sim is registered to Dab until \d{4}-/);
  assert.match(host.read("C:\\NICDATA\\DOMAINS.TXT"), /^dab\.sim\|dab\|[\d-]+\|[\d-]+\|DAB\.SIM\|active$/m);
  // coming back again registers nothing twice
  r = ok(await owner.get(back.replace("http://host", "")));
  assert.match(notice(r), /SimNIC has no order/);
  // a made-up receipt
  r = ok(await owner.post("/dns/register.asp", { d: "cheap.sim", t: await token(owner, "/dns/home.asp") }));
  const order2 = (/name="order" value="([^"]*)"/.exec(r.body) || [])[1];
  r = ok(await owner.get("/dns/paid.asp?receipt=R1-DEADBEEF&order=" + order2));
  assert.match(notice(r), /SimPal says that receipt is no good/);
  assert.match(host.read("C:\\NICDATA\\DOMAINS.TXT"), /^cheap\.sim\|dab\|\d+\|\|\|unpaid$/m);
});

await test("SimHost: book.dab.sim, mail.dab.sim... a name for each app, and SimBook works at book.dab.sim in Simxplorer", async () => {
  let r = ok(await owner.get("/dns/domain.asp?d=dab.sim"));
  assert.match(r.body, /<li><tt>book.dab.sim<\/tt> - SimBook<\/li>/);
  r = ok(await owner.post("/dns/apps.asp", { d: "dab.sim", t: await token(owner, "/dns/domain.asp?d=dab.sim") }));
  assert.match(notice(r), /^\d+ apps have names in dab.sim now\.$/);
  assert.match(host.read("C:\\WEB\\VHOSTS.TXT"), /^book\.dab\.sim\|C:\\WEB\\BOOK$/m);
  assert.match(host.read("C:\\WEB\\VHOSTS.TXT"), /^mail\.dab\.sim\|C:\\WEB\\MAIL$/m);
  assert.match(zone(host, "DAB.SIM"), /^book +IN +CNAME +host$/m);
  // BRAVO's Simxplorer, with HOST as its name server
  sx.go("about:options");
  await sx.loaded("Options");
  submit(0, { dns: "host" });
  await until(() => bravo.read("C:\\SYSTEM\\RESOLV.INI") === "nameserver=host\n", "the setting");
  await until(async () => (await ask(bravo, "host", "QUERY book.dab.sim")) === "OK\nbook.dab.sim 60 CNAME host", "HOST's name server", 8000);
  sx.go("book.dab.sim");
  await until(() => /SimBook/.test(sx.title()) && String(sx.win().get("Status")).startsWith("Done"), "SimBook", 15000);
  assert.equal(sx.address(), "http://book.dab.sim/");
  // join, through the forms, and SimBook's cookie is book.dab.sim's
  const joinForm = sx.html().split(/<form\b/i).slice(1).findIndex((f) => /action="sxsubmit:\d+"/.test(f) && /name="pw2"/.test(f));
  assert.ok(joinForm >= 0, "the join form");
  submit(joinForm, { name: "Bob Bravo", u: "bob", pw: "secret", pw2: "secret" });
  await until(() => /Bob Bravo/.test(sx.html()) && String(sx.win().get("Status")).startsWith("Done"), "Bob's page", 15000);
  assert.match(sx.address(), /^http:\/\/book\.dab\.sim\//);
  assert.match(bravo.read("C:\\SYSTEM\\COOKIES.TXT"), /^BOOK\.DAB\.SIM\|simbook\|[0-9A-F]+$/m);
  assert.ok(host.exists("C:\\BOOKDATA\\USERS\\bob.TXT"), "Bob is a SimBook member on HOST");
  // relative links stay at book.dab.sim
  sx.view().fire("onNavigate", "people.asp");
  await until(() => sx.address() === "http://book.dab.sim/people.asp" && /Ann/.test(sx.html()), "the people page", 15000);
  // and the same SimBook by path, for Voyager
  assert.match(ok(await http(bravo, "HOST", "GET", "/book.dab.sim/")).body, /SimBook/);
  assert.deepEqual(bravo.errors, []);
  assert.deepEqual(bravo.ui.dialogs, []);
});

// ---------------------------------------------------------------- uninstalling

await test("uninstalling SimDNS (as Vapor does) puts the stock web server back", async () => {
  // Vapor: stop the tasks, take it out of startup, delete the files in the header
  const head = src("simdns/INSTALL.SPK").split("\n")[0];
  const files = /\|files=([^|]*)\|/.exec(head)[1].split(";");
  alpha.kernel.kill(named(alpha));
  alpha.remove("C:\\SYSTEM\\STARTUP\\NAMED.RUN");
  for (const f of files) if (alpha.exists(f)) alpha.remove(f);
  await until(() => alpha.read("C:\\PROGRAMS\\HTTPD.SPK") === STOCK && !alpha.exists("C:\\PROGRAMS\\HTTPD.ORG"), "the stock web server", 5000);
  await until(async () => webPid(alpha) && (await http(bravo, "ALPHA", "GET", "/www.coolsite.sim/").catch(() => ({ status: "" }))).status === "404 Not Found", "the stock web server running", 8000);
  assert.match(ok(await http(bravo, "ALPHA", "GET", "/welcome.htm")).body, /ALPHA/);
  assert.deepEqual(alpha.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
