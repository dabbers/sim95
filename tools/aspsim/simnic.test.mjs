// End-to-end tests for SimNIC (simnic/): the name server (NAMED.SPK) and the
// registrar, which run on the central host, STARTHERE.56k.net, and nowhere
// else - on a pretend network of real machines. The web server, DIG and the
// resolver are simweb's (tools/aspsim/simweb.test.mjs).
//   node tools/aspsim/simnic.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { machine, browser, MESSAGE_LIMIT } from "./sim.mjs";
import { Network } from "./network.mjs";

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
// A real HTTP request over the network.
async function http(from, host, method, p, { body = "", cookie = "", hostHeader = host.toLowerCase() } = {}) {
  const conn = await from.stack.connect(0, host, 80);
  const parts = [];
  const done = new Promise((r) => conn.onClose(r));
  conn.onMessage((t) => parts.push(t));
  let req = `${method} ${p} HTTP/1.0\nHost: ${hostHeader}\nUser-Agent: Voyager/1.1 (SIM95)` + (cookie ? `\nCookie: ${cookie}` : "");
  if (method === "POST") req += `\nContent-Type: application/x-www-form-urlencoded\nContent-Length: ${body.length}\n\n${body}`;
  conn.send(req);
  await Promise.race([done, sleep(8000)]);
  const raw = parts.join("\n");
  const cut = raw.indexOf("\n\n");
  const lines = (cut < 0 ? raw : raw.slice(0, cut)).split("\n");
  return { status: lines[0].replace(/^HTTP\/1\.0 /, ""), headers: lines.slice(1), body: cut < 0 ? "" : raw.slice(cut + 2), raw, url: host + p };
}
const install = async (m, app, ms = 60000) => {
  m.write("C:\\MYFILES\\INSTALL.SPK", src(app + "/INSTALL.SPK"));
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await net.until(() => !m.running(pid), ms, app + "'s installer");
  return m.output(pid);
};
const named = (m) => m.kernel.ps().find((p) => p.name === "NAMED")?.pid;
const namedLog = (m) => (m.widgets(named(m), "ListBox")[0]?.get("Items") ?? []).join("\n");
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
dnsbox.write("C:\\PROGRAMS\\NAMED.SPK", src("simnic/src/NAMED.SPK"));
dnsbox.run("C:\\PROGRAMS\\NAMED.SPK");
await until(() => named(dnsbox) && namedLog(dnsbox).includes("Listening"), "DNSBOX's name server");

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
  alpha.mkdir("C:\\DNS");
  alpha.write("C:\\DNS\\HAND.NET", "$TTL 120\n@ IN NS alpha\nwww IN CNAME bravo\n");
  alpha.write("C:\\DNS\\EAST.SIM", "@ IN NS alpha\nshop CNAME charlie\n");
  alpha.write("C:\\DNS\\NAMED.CNF", "primary hand.net HAND.NET\nprimary east.coolsite.sim EAST.SIM\nforwarders dnsbox\n");
  alpha.write("C:\\PROGRAMS\\NAMED.SPK", src("simnic/src/NAMED.SPK"));
  alpha.run("C:\\PROGRAMS\\NAMED.SPK");
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
  charlie.write("C:\\PROGRAMS\\NAMED.SPK", src("simnic/src/NAMED.SPK"));
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


// ---------------------------------------------------------------- SimNIC, on the central host

const central = await net.boot("STARTHERE.56k.net");
central.run("C:\\PROGRAMS\\HTTPD.SPK");
const nic = browser(central);
const token = async (b, url = "/nic/home.asp") => (/(?:name="t" value="|logout\.asp\?t=)([0-9A-F]+)/.exec((await b.get(url)).body) || [])[1];
const notice = (r) => decode((/<td bgcolor="#(?:E0FFE0|FFF0C0)"><b>([^<]*)<\/b>/.exec(r.body) || [])[1] ?? "");
const zone = (m, f) => m.read("C:\\DNS\\" + f);
const records = (m, f) => zone(m, f).split("\n").filter((l) => / IN /.test(l) && !/SOA|^@ +IN +NS/.test(l)).map((l) => l.replace(/ +/g, " "));

await test("the installer, anywhere but the central host: it warns, and stops if you say no", async () => {
  const out = await (async () => { bravo.ui.answers.push(false); return install(bravo, "simnic"); })();
  assert.match(bravo.ui.dialogs[0].text, /This machine is BRAVO, not STARTHERE\.56K\.NET\.[\s\S]*SimNIC is meant to run only on the central host\./);
  assert.equal(bravo.ui.dialogs[0].buttons, "yesno");
  assert.match(out, /SimNIC was not installed: it belongs on starthere\.56k\.net\./);
  assert.ok(!bravo.exists("C:\\WEB\\NIC\\NIC.SPK") && !bravo.exists("C:\\PROGRAMS\\NAMED.SPK") && !named(bravo));
  bravo.ui.dialogs.splice(0);
});

await test("the installer on STARTHERE.56k.net: NAMED running and starting with the machine, SimNIC at /nic/, the web server left alone", async () => {
  const out = await install(central, "simnic");
  assert.deepEqual(central.ui.dialogs, [], "no warning on the central host");
  assert.match(out, /SimNIC is installed \(15 files\)/);
  assert.match(out, /NAMED will start with the machine/);
  assert.match(out, /Open http:\/\/starthere\.56k\.net\/nic\/ in Voyager/);
  assert.equal(central.read("C:\\PROGRAMS\\NAMED.SPK"), src("simnic/src/NAMED.SPK"));
  assert.equal(central.read("C:\\SYSTEM\\STARTUP\\NAMED.RUN"), "C:\\PROGRAMS\\NAMED.SPK");
  assert.ok(central.exists("C:\\WEB\\NIC\\NIC.SPK") && central.exists("C:\\WEB\\NIC\\POINT.ASP"));
  assert.ok(central.exists("C:\\WEB\\INDEX.HTM"), "the home page is not touched");
  assert.match(central.read("C:\\DNS\\NAMED.CNF"), /^; NAMED.CNF/);
  // hosting is not SimNIC's job: the stock web server, no sites
  assert.equal(central.read("C:\\PROGRAMS\\HTTPD.SPK"), STOCK);
  assert.ok(!central.exists("C:\\PROGRAMS\\HTTPD.ORG") && !central.exists("C:\\WEB\\VHOSTS.TXT") && !central.exists("C:\\WEB\\SITES"));
  // not for any Vapor store
  assert.doesNotMatch(src("simnic/INSTALL.SPK").split("\n")[0], /^' VAPOR\|/);
  await until(() => named(central) && namedLog(central).includes("Listening"), "NAMED");
  // over the network, by its whole name and by just STARTHERE
  assert.match(ok(await http(bravo, "starthere.56k.net", "GET", "/nic/")).body, /<title>Domain Name Registration - SimNIC<\/title>/);
  assert.match(ok(await http(bravo, "STARTHERE", "GET", "/nic/help.asp")).body, /Frequently Asked Questions/);
  assert.deepEqual(central.errors, []);
});

await test("SimNIC: sign up, look a name up under every TLD, register it (free without SimPal)", async () => {
  let r = ok(await nic.get("/nic/"));
  assert.match(r.body, /Registration is <b>FREE<\/b>/);
  assert.match(r.body, /Every Simxplorer on the network asks <b>starthere\.56k\.net<\/b>/);
  r = ok(await nic.post("/nic/join.asp", { name: "Dab's Fun Company", u: "dab", pw: "secret", pw2: "secret" }));
  assert.match(r.url, /home\.asp\?new=1/);
  assert.match(nic.cookies(), /simnic=[0-9A-F]+/);
  r = ok(await nic.get("/nic/search.asp?d=coolsite"));
  for (const tld of ["sim", "com", "net", "org"]) assert.match(r.body, new RegExp(`<b>coolsite\\.${tld}</b></td><td><font color="#008000"><b>Available!`));
  r = ok(await nic.post("/nic/register.asp", { d: "CoolSite.SIM", t: await token(nic) }));
  assert.match(r.url, /domain\.asp\?d=coolsite\.sim&new=1/);
  assert.match(notice(r), /Congratulations! coolsite.sim is yours until \d{4}-.*Now point it at the machine your site is on\./);
  assert.match(central.read("C:\\NICDATA\\DOMAINS.TXT"), /^coolsite\.sim\|dab\|\d{4}-\d\d-\d\d\|\d{4}-\d\d-\d\d\|COOLSITE\.SIM\|active$/m);
  assert.match(zone(central, "COOLSITE.SIM"), /^\$TTL 60\n@ +IN +SOA +starthere\.56k\.net hostmaster \( \d+ \)\n@ +IN +NS +starthere\.56k\.net\n$/m);
  assert.match(central.read("C:\\DNS\\NAMED.CNF"), /^primary coolsite\.sim COOLSITE\.SIM$/m);
  assert.match(ok(await nic.get("/nic/search.asp?d=coolsite.sim")).body, /<font color="#CC0000">Taken<\/font>/);
  assert.equal(notice(ok(await nic.post("/nic/register.asp", { d: "coolsite.sim", t: await token(nic) }))), "Sorry, coolsite.sim is already registered.");
  assert.match(notice(ok(await nic.post("/nic/register.asp", { d: "x.sim", t: await token(nic) }))), /That is not a domain name SimNIC can register/);
  // SIM95's own ISPs are machines' names (STARTHERE.56k.net): never for sale
  for (const isp of ["56k.net", "56K.NET"]) assert.match(notice(ok(await nic.post("/nic/register.asp", { d: isp, t: await token(nic) }))), /That is not a domain name SimNIC can register/, isp);
  assert.match(notice(ok(await nic.post("/nic/register.asp", { d: "fun.biz", t: await token(nic) }))), /That is not a domain name SimNIC can register/);
  // a domain that points nowhere yet: the name server knows it, with nothing to say
  await until(async () => (await ask(bravo, "starthere.56k.net", "QUERY coolsite.sim")) === "OK", "NAMED's reload", 8000);
});

await test("SimNIC: the domain's page leads with one field, and Save points the domain and its www at that machine", async () => {
  let r = ok(await nic.get("/nic/domain.asp?d=coolsite.sim"));
  assert.match(r.body, /<b><tt>coolsite\.sim<\/tt> points to machine:<\/b><\/font>\s*<input name="machine" size="24" value="">/, "blank the first time");
  assert.ok(r.body.indexOf("points to machine") < r.body.indexOf("Advanced DNS"), "the field first, Advanced DNS below");
  assert.match(r.body, /doesn't point anywhere yet/);
  assert.match(r.body, /Personal Web Manager/);
  assert.doesNotMatch(r.body, /Host it here|hostit\.asp|apps\.asp/);
  const point = async (d, machine) => notice(ok(await nic.post("/nic/point.asp", { d, machine, t: await token(nic, "/nic/domain.asp?d=" + d) })));
  assert.equal(await point("coolsite.sim", " Alpha "), "coolsite.sim and www.coolsite.sim point to alpha now. The name server has it within a few seconds.");
  assert.deepEqual(records(central, "COOLSITE.SIM"), ["@ IN CNAME alpha", "www IN CNAME alpha"]);
  await until(async () => (await ask(bravo, "starthere.56k.net", "QUERY www.coolsite.sim")) === "OK\nwww.coolsite.sim 60 CNAME alpha", "NAMED", 8000);
  assert.equal(await ask(bravo, "starthere.56k.net", "QUERY coolsite.sim"), "OK\ncoolsite.sim 60 CNAME alpha");
  r = ok(await nic.get("/nic/domain.asp?d=coolsite.sim"));
  assert.match(r.body, /<input name="machine" size="24" value="alpha">/);
  assert.match(r.body, /<b>coolsite\.sim<\/b> and <b>www\.coolsite\.sim<\/b> go to the machine <b>alpha<\/b>/);
  // the next domain starts with the machine the last one went to
  ok(await nic.post("/nic/register.asp", { d: "coolbook.sim", t: await token(nic) }));
  assert.match(ok(await nic.get("/nic/domain.asp?d=coolbook.sim")).body, /<input name="machine" size="24" value="alpha">/);
  assert.match(central.read("C:\\NICDATA\\USERS\\dab.TXT"), /^machine=alpha$/m);
  // pointed somewhere else: the CNAMEs move, nothing else is touched
  assert.match(await point("coolsite.sim", "bob.dialup.zone"), /point to bob\.dialup\.zone now/);
  assert.deepEqual(records(central, "COOLSITE.SIM"), ["@ IN CNAME bob.dialup.zone", "www IN CNAME bob.dialup.zone"]);
  // what can't be a machine
  assert.match(await point("coolsite.sim", "65.16.0.7"), /That is an address, and addresses change when a machine restarts/);
  assert.match(await point("coolsite.sim", "no such<b>"), /That doesn't look like a machine name/);
  assert.match(await point("coolsite.sim", "www.coolsite.sim"), /A domain can't point at itself/);
  // empty: nowhere
  assert.equal(await point("coolsite.sim", ""), "coolsite.sim points nowhere now.");
  assert.deepEqual(records(central, "COOLSITE.SIM"), []);
  assert.equal(await point("coolsite.sim", "alpha"), "coolsite.sim and www.coolsite.sim point to alpha now. The name server has it within a few seconds.");
  assert.match(ok(await nic.get("/nic/home.asp")).body, /<a href="domain.asp\?d=coolsite\.sim"><b>coolsite\.sim<\/b><\/a><\/td><td>[\d-]+<\/td><td>[\d-]+<\/td><td><tt>alpha<\/tt><\/td>/);
});

await test("SimNIC: Advanced DNS - subdomain CNAMEs, MX, TXT and A, with their hints - and NAMED serves them", async () => {
  let r = ok(await nic.get("/nic/domain.asp?d=coolsite.sim"));
  assert.match(r.body, /<h3>Advanced DNS<\/h3>/);
  assert.match(r.body, /<select name="type"><option value="CNAME" selected>CNAME<\/option><option value="MX">MX<\/option><option value="TXT">TXT<\/option><option value="A">A<\/option><\/select>/);
  assert.match(r.body, /<b>MX<\/b> - your machine, to get mail at your domain with ColdMail/);
  assert.match(r.body, /<b>A<\/b> - an address\. Addresses change when a machine restarts, so prefer CNAME\./);
  const add = async (name, type, value) => notice(ok(await nic.post("/nic/record.asp", { d: "coolsite.sim", op: "add", name, type, value, t: await token(nic, "/nic/domain.asp?d=coolsite.sim") })));
  assert.match(await add("book", "CNAME", "alpha"), /Record added/);
  assert.match(await add("shop", "CNAME", "book"), /Record added/);
  assert.match(await add("*", "CNAME", "alpha"), /Record added/);
  assert.match(await add("box", "A", "65.16.0.77"), /Record added/);
  assert.match(await add("@", "MX", "alpha"), /Record added/);
  assert.match(await add("@", "TXT", 'Say "hi"'), /Record added/);
  assert.match(await add("box", "A", "alpha"), /An A record needs an address/);
  assert.match(await add("bad name", "CNAME", "alpha"), /A name is letters, digits and hyphens/);
  assert.match(await add("x", "SRV", "alpha"), /SimNIC can make CNAME, A, MX, TXT and NS records/);
  assert.deepEqual(records(central, "COOLSITE.SIM"), ["@ IN CNAME alpha", "www IN CNAME alpha", "book IN CNAME alpha", "shop IN CNAME book", "* IN CNAME alpha", "box IN A 65.16.0.77", "@ IN MX 10 alpha", `@ IN TXT "Say 'hi'"`]);
  await until(async () => (await ask(bravo, "starthere.56k.net", "QUERY shop.coolsite.sim")) === "OK\nshop.coolsite.sim 60 CNAME book.coolsite.sim\nbook.coolsite.sim 60 CNAME alpha", "NAMED", 8000);
  assert.equal(await ask(bravo, "starthere.56k.net", "QUERY anything.coolsite.sim"), "OK\nanything.coolsite.sim 60 CNAME alpha", "* stands for the rest");
  assert.equal(await ask(bravo, "starthere.56k.net", "QUERY coolsite.sim MX"), "OK\ncoolsite.sim 60 MX 10 alpha");
  assert.equal(await ask(bravo, "starthere.56k.net", "QUERY box.coolsite.sim"), "OK\nbox.coolsite.sim 60 A 65.16.0.77");
  // delete one, by its place in the list
  r = ok(await nic.get("/nic/domain.asp?d=coolsite.sim"));
  assert.match(r.body, /<td><tt>box<\/tt><\/td><td><tt>A<\/tt><\/td><td><tt>65.16.0.77<\/tt><\/td>/);
  r = ok(await nic.post("/nic/record.asp", { d: "coolsite.sim", op: "del", n: "5", t: await token(nic, "/nic/domain.asp?d=coolsite.sim") }));
  assert.equal(notice(r), "Record deleted.");
  assert.doesNotMatch(zone(central, "COOLSITE.SIM"), /65\.16\.0\.77/);
  assert.match(zone(central, "COOLSITE.SIM"), /^@ +IN +SOA/m, "the head of the zone stays");
  // pointing again keeps the advanced records
  ok(await nic.post("/nic/point.asp", { d: "coolsite.sim", machine: "alpha", t: await token(nic, "/nic/domain.asp?d=coolsite.sim") }));
  assert.match(zone(central, "COOLSITE.SIM"), /^book +IN +CNAME +alpha$/m);
  assert.match(zone(central, "COOLSITE.SIM"), /^@ +IN +MX +10 alpha$/m);
});

await test("SimNIC: WHOIS says who has a domain and which machine it points to", async () => {
  let r = ok(await nic.get("/nic/whois.asp?d=coolsite.sim"));
  assert.match(decode(r.body), /Registrant:\n   Dab's Fun Company \(DAB\)\n\n   Domain Name: COOLSITE.SIM/);
  assert.match(decode(r.body), /Points to machine: ALPHA\n/);
  assert.match(decode(r.body), /Domain servers in listed order:\n\n   STARTHERE\.56K\.NET/);
  ok(await nic.post("/nic/point.asp", { d: "coolbook.sim", machine: "", t: await token(nic, "/nic/domain.asp?d=coolbook.sim") }));
  assert.match(decode(ok(await nic.get("/nic/whois.asp?d=coolbook.sim")).body), /Points to machine: \(none yet\)/);
  assert.match(decode(ok(await browser(central).get("/nic/whois.asp?d=nobody.com")).body), /No match for "nobody.com"\./);
});

await test("SimNIC: forms from anywhere else change nothing (CSRF), and other people's domains are theirs", async () => {
  const before = zone(central, "COOLSITE.SIM");
  // another site's page posting with dab's cookie, but without the form token
  let r = await central.request("POST", "/nic/point.asp", { body: "d=coolsite.sim&machine=evil", cookies: nic.cookies() });
  assert.match(r.headers.join("\n"), /Location: home.asp\?why=That\+did\+not\+come\+from\+a\+SimNIC\+page/);
  r = await central.request("POST", "/nic/record.asp", { body: "d=coolsite.sim&op=add&name=www&type=CNAME&value=evil", cookies: nic.cookies() });
  assert.match(r.headers.join("\n"), /Location: home.asp\?why=That\+did\+not/);
  r = await central.request("POST", "/nic/record.asp", { body: "d=coolsite.sim&op=del&n=0&t=12345678", cookies: nic.cookies() });
  assert.match(r.headers.join("\n"), /Location: home.asp\?why=That\+did\+not/);
  await central.request("POST", "/nic/register.asp", { body: "d=evil.sim", cookies: nic.cookies() });
  await central.request("GET", "/nic/logout.asp", { cookies: nic.cookies() });
  assert.equal(zone(central, "COOLSITE.SIM"), before);
  assert.doesNotMatch(central.read("C:\\NICDATA\\DOMAINS.TXT"), /evil/);
  assert.match(ok(await nic.get("/nic/home.asp")).body, /My Domains/, "still logged in");
  // somebody else can't touch coolsite.sim, or see its page
  const eve = browser(central);
  ok(await eve.post("/nic/join.asp", { name: "Eve", u: "eve", pw: "secret", pw2: "secret" }));
  assert.equal(notice(ok(await eve.get("/nic/domain.asp?d=coolsite.sim"))), "That is not one of your domains.");
  assert.equal(notice(ok(await eve.post("/nic/point.asp", { d: "coolsite.sim", machine: "evil", t: await token(eve) }))), "That is not one of your domains.");
  assert.equal(notice(ok(await eve.post("/nic/record.asp", { d: "coolsite.sim", op: "add", name: "www", type: "CNAME", value: "evil", t: await token(eve) }))), "That is not one of your domains.");
  assert.equal(zone(central, "COOLSITE.SIM"), before);
  // nobody logged in
  r = await central.request("GET", "/nic/home.asp");
  assert.match(r.headers.join("\n"), /Location: index.asp\?why=Please\+log\+in/);
  assert.ok(!(await nic.post("/nic/login.asp", { u: "dab", pw: "wrong" })).url.includes("home.asp"));
});

await test("SimNIC: every page fits in a message, a domain has at most 40 records, a contact 10 domains", async () => {
  const t = await token(nic, "/nic/domain.asp?d=coolsite.sim");
  let said = "";
  for (let i = 0; said !== "A domain at SimNIC has at most 40 records." && i < 50; i++) {
    said = notice(ok(await nic.post("/nic/record.asp", { d: "coolsite.sim", op: "add", name: "n" + i + "-" + "a".repeat(30), type: "TXT", value: "z".repeat(200), t })));
  }
  assert.equal(said, "A domain at SimNIC has at most 40 records.");
  assert.ok(ok(await nic.get("/nic/domain.asp?d=coolsite.sim")).raw.length < MESSAGE_LIMIT);
  await until(async () => (await ask(bravo, "starthere.56k.net", "QUERY coolsite.sim ANY")) !== null, "NAMED", 8000);
  const any = await ask(bravo, "starthere.56k.net", "QUERY coolsite.sim ANY");
  assert.ok(any.length < MESSAGE_LIMIT && any.startsWith("OK"), any.slice(0, 80));
  for (let i = 0; i < 8; i++) ok(await nic.post("/nic/register.asp", { d: `more${i}.com`, t: await token(nic) }));
  assert.equal(notice(ok(await nic.post("/nic/register.asp", { d: "toomany.com", t: await token(nic) }))), "SimNIC registers at most 10 domains per contact.");
  assert.ok(ok(await nic.get("/nic/home.asp")).raw.length < MESSAGE_LIMIT);
  // and after all that, still no sites, no site folders: hosting is not SimNIC's job
  assert.ok(!central.exists("C:\\WEB\\VHOSTS.TXT") && !central.exists("C:\\WEB\\SITES"));
  assert.deepEqual(central.errors, []);
});

await test("SimNIC with SimPal on the machine: §70.00 for two years, paid at SimPal, checked with PALCHECK", async () => {
  assert.match(await install(central, "simpal", 120000), /SimPal is installed/);
  const simnic = browser(central);
  const owner = browser(central);
  ok(await simnic.post("/join.asp", { name: "SimNIC", u: "simnic", pw: "secret", pw2: "secret" }));
  ok(await owner.post("/join.asp", { name: "Ann", u: "ann", pw: "secret", pw2: "secret" }));
  ok(await owner.post("/nic/join.asp", { name: "Ann", u: "ann", pw: "secret", pw2: "secret" }));
  let r = ok(await owner.get("/nic/"));
  assert.match(r.body, /Registration is <b>&sect;70.00<\/b> for two years, paid with SimPal/);
  r = ok(await owner.post("/nic/register.asp", { d: "ann.sim", t: await token(owner) }));
  assert.match(r.body, /<form action="http:\/\/starthere\.56k\.net\/pay\.asp" method="post">/);
  const field = (n) => (new RegExp(`name="${n}" value="([^"]*)"`).exec(r.body) || [])[1];
  assert.equal(field("to"), "simnic");
  assert.equal(field("amount"), "70.00");
  assert.equal(field("return"), "http://starthere.56k.net/nic/paid.asp");
  const order = field("order");
  assert.match(central.read("C:\\NICDATA\\DOMAINS.TXT"), /^ann\.sim\|ann\|\d+\|\|\|unpaid$/m, "held while they pay");
  assert.match(ok(await browser(central).get("/nic/search.asp?d=ann.sim")).body, /Taken/);
  assert.equal(await ask(bravo, "starthere.56k.net", "QUERY ann.sim"), "NXDOMAIN", "but not in the name server yet");
  // pay, as SimPal's pay page does
  const pt = (/name="t" value="([0-9A-F]+)"/.exec((await owner.get("/send.asp")).body) || [])[1];
  const paid = await central.request("POST", "/pay.asp", { body: new URLSearchParams({ to: "simnic", amount: "70.00", item: field("item"), order, return: field("return"), do: "pay", t: pt }).toString(), cookies: owner.cookies() });
  const back = (paid.headers.find((h) => h.startsWith("Location: ")) || "").slice(10);
  assert.match(back, /^http:\/\/starthere\.56k\.net\/nic\/paid\.asp\?receipt=R\d+-[0-9A-F]+&order=/, paid.body.slice(0, 300));
  r = ok(await owner.get(back.replace("http://starthere.56k.net", "")));
  assert.match(notice(r), /^Thank you! ann.sim is registered to Ann until \d{4}-/);
  assert.match(central.read("C:\\NICDATA\\DOMAINS.TXT"), /^ann\.sim\|ann\|[\d-]+\|[\d-]+\|ANN\.SIM\|active$/m);
  r = ok(await owner.get(back.replace("http://starthere.56k.net", "")));
  assert.match(notice(r), /SimNIC has no order/, "coming back again registers nothing twice");
  // a made-up receipt
  r = ok(await owner.post("/nic/register.asp", { d: "cheap.sim", t: await token(owner) }));
  const order2 = (/name="order" value="([^"]*)"/.exec(r.body) || [])[1];
  r = ok(await owner.get("/nic/paid.asp?receipt=R1-DEADBEEF&order=" + order2));
  assert.match(notice(r), /SimPal says that receipt is no good/);
  assert.match(central.read("C:\\NICDATA\\DOMAINS.TXT"), /^cheap\.sim\|ann\|\d+\|\|\|unpaid$/m);
});

await test("SimNIC on a SimHost machine (for testing, say yes): in /nic/, and on the front page", async () => {
  const host = await net.boot("HOSTBOX");
  host.run("C:\\PROGRAMS\\HTTPD.SPK");
  assert.match(await install(host, "simhost"), /mode=folders/);
  const out = await install(host, "simnic");
  assert.match(host.ui.dialogs[0]?.text ?? "", /SimNIC is meant to run only on the central host/);
  assert.match(out, /not the central host, starthere\.56k\.net: installing anyway/);
  assert.match(out, /wrote C:\\WEB\\NIC\\NIC.SPK/);
  assert.match(host.read("C:\\WEB\\NIC\\APP.INF"), /^SimNIC\|Register your own domain name/);
  const r = ok(await http(bravo, "HOSTBOX", "GET", "/"));
  assert.match(r.body, /<a href="\/nic\/"><font color="#FFFFFF" size="4"><b>SimNIC<\/b>/);
  assert.match(ok(await http(bravo, "HOSTBOX", "GET", "/nic/")).body, /SimNIC/);
  await until(() => named(host), "NAMED");
  assert.deepEqual(host.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
