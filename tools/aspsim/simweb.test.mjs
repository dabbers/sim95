// End-to-end tests for simweb (simweb/): the web server with sites by name
// (HTTPD.SPK), Personal Web Manager (PWM.SPK), DIG and the resolver
// (RESOLVE.SPK), which asks the central name server on STARTHERE.56k.net
// unless told otherwise - on a pretend network of real machines:
//   STARTHERE.56k.net  SimNIC and NAMED, as the network's central host
//   WEB                a SimHost machine with SimBook and ELIZA-95, then simweb
//   CLIENT             Simxplorer and DIG, with no C:\SYSTEM\RESOLV.INI at all
//   CHARLIE            a machine with no name server, for one that is down
//   node tools/aspsim/simweb.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { machine, browser } from "./sim.mjs";
import { Network } from "./network.mjs";
import { simxplorerSource, withResolver, resolverSource, CENTRAL } from "../simxplorer-source.mjs";

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
const central = await net.boot("STARTHERE.56k.net");
const web = await net.boot("WEB");
const client = await net.boot("CLIENT");
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
const task = (m, name) => m.kernel.ps().find((p) => p.name === name)?.pid;
const named = (m) => task(m, "NAMED");
const namedLog = (m) => (m.widgets(named(m), "ListBox")[0]?.get("Items") ?? []).join("\n");
const webPid = (m) => task(m, "HTTPD");
const STOCK = (await machine("X")).read("C:\\PROGRAMS\\HTTPD.SPK");

// STARTHERE.56k.net: SimNIC, as the central host has it, and a zone by hand
for (const m of [central, web, charlie]) m.run("C:\\PROGRAMS\\HTTPD.SPK");
assert.match(await install(central, "simnic"), /SimNIC is installed/);
central.write("C:\\DNS\\HAND.SIM", `$TTL 300
@        IN  NS     starthere.56k.net
@        IN  CNAME  web
www      IN  CNAME  web
shop         CNAME  store             ; to a name in this zone...
store        CNAME  www               ; ...to another, to the machine
old      60  A      65.16.0.250
@            MX     10 web
`);
central.write("C:\\DNS\\NAMED.CNF", central.read("C:\\DNS\\NAMED.CNF") + "primary hand.sim HAND.SIM\n");
await until(async () => named(central) && (await ask(charlie, "starthere.56k.net", "QUERY www.hand.sim")) === "OK\nwww.hand.sim 300 CNAME web", "the central name server", 15000);

// SimNIC, as somebody using it from their browser
const nic = browser(central);
const token = async (url = "/nic/home.asp") => (/(?:name="t" value="|logout\.asp\?t=)([0-9A-F]+)/.exec((await nic.get(url)).body) || [])[1];
ok(await nic.post("/nic/join.asp", { name: "Dab", u: "dab", pw: "secret", pw2: "secret" }));
async function register(d, machineName) {
  ok(await nic.post("/nic/register.asp", { d, t: await token() }));
  if (machineName) ok(await nic.post("/nic/point.asp", { d, machine: machineName, t: await token("/nic/domain.asp?d=" + d) }));
}

// ---------------------------------------------------------------- installing

await test("the installer: the new web server, the old one kept, Personal Web Manager open, no RESOLV.INI", async () => {
  assert.match(await install(web, "simhost"), /mode=folders/);
  for (const app of ["simbook", "eliza"]) assert.match(await install(web, app, 120000), / is installed \(/, app);
  const oldWeb = webPid(web);
  const out = await install(web, "simweb");
  assert.match(out, /wrote C:\\WEB\\VHOSTS.TXT/);
  assert.match(out, /kept the old web server as C:\\PROGRAMS\\HTTPD.ORG/);
  assert.match(out, /simweb is installed \(4 files\)/);
  assert.match(out, /restarted the web server/);
  assert.equal(web.read("C:\\PROGRAMS\\HTTPD.ORG"), STOCK, "the stock web server, kept as it was");
  assert.equal(web.read("C:\\PROGRAMS\\HTTPD.SPK"), src("simweb/src/HTTPD.SPK"), "simweb/INSTALL.SPK is out of date: node tools/build-installer.mjs simweb");
  assert.equal(web.read("C:\\PROGRAMS\\PWM.SPK"), withResolver(src("simweb/src/PWM.SPK")));
  assert.equal(web.read("C:\\PROGRAMS\\DIG.SPK"), withResolver(src("simweb/src/DIG.SPK")));
  assert.equal(web.read("C:\\PROGRAMS\\RESOLVE.SPK"), resolverSource());
  assert.match(resolverSource(), new RegExp(`^CONST RSCENTRAL = "${CENTRAL.replace(/\./g, "\\.")}"`, "m"));
  assert.ok(!web.exists("C:\\SYSTEM\\RESOLV.INI"), "the central name server needs no setting");
  assert.ok(web.exists("C:\\WEB\\SITES"));
  await until(() => webPid(web) && task(web, "PWM"), "HTTPD and PWM");
  assert.notEqual(webPid(web), oldWeb, "a new web server");
  // a program for Vapor, which never deletes the web server when it uninstalls
  const head = src("simweb/INSTALL.SPK").split("\n")[0];
  assert.match(head, /^' VAPOR\|id=SIMWEB\|name=simweb\|kind=program\|.*\|run=C:\\PROGRAMS\\PWM.SPK\|files=C:\\PROGRAMS\\PWM.SPK;C:\\PROGRAMS\\DIG.SPK;C:\\PROGRAMS\\RESOLVE.SPK\|tasks=PWM\|/);
  assert.ok(!head.includes("HTTPD"), head);
  // running it again keeps the stock copy, not ours
  await install(web, "simweb");
  assert.equal(web.read("C:\\PROGRAMS\\HTTPD.ORG"), STOCK);
  assert.deepEqual(web.errors, []);
  assert.deepEqual(web.ui.dialogs, []);
});

// ---------------------------------------------------------------- DIG and the resolver

const dig = async (m, ...args) => {
  const pid = m.run("C:\\PROGRAMS\\DIG.SPK", args);
  await net.until(() => !m.running(pid), 10000, "DIG");
  return m.output(pid);
};
client.write("C:\\PROGRAMS\\DIG.SPK", withResolver(src("simweb/src/DIG.SPK")));

await test("DIG asks the central name server with no RESOLV.INI; SET NONE, SET DEFAULT and SET machine", async () => {
  assert.ok(!client.exists("C:\\SYSTEM\\RESOLV.INI"));
  assert.match(await dig(client, "SET"), /The name server is starthere\.56k\.net, the central one\./);
  const out = await dig(client, "shop.hand.sim");
  assert.match(out, /; <<>> DiG 2.1 for SIM95 \(SimDNS\) <<>> shop.hand.sim A/);
  assert.match(out, /status: NOERROR, answers: 3/);
  assert.match(out, /;; ANSWER SECTION:\nshop.hand.sim. +300 +IN +CNAME +store.hand.sim\nstore.hand.sim. +300 +IN +CNAME +www.hand.sim\nwww.hand.sim. +300 +IN +CNAME +web\n/);
  assert.match(out, new RegExp(";; web is a SIM95 machine name: " + web.stack.localIp().replace(/\./g, "\\.") + " \\(asked SIM95, not SimDNS\\)"));
  assert.match(out, /;; SERVER: starthere\.56k\.net \(65\.16\.0\.\d+\) port 53/);
  assert.match(await dig(client, "hand.sim", "MX"), /hand.sim. +300 +IN +MX +10 web/);
  assert.match(await dig(client, "nope.hand.sim"), /status: NXDOMAIN, answers: 0/);
  assert.match(await dig(client, "www.hand.sim", "@web"), /connection to web \(65\.16\.0\.\d+\) port 53 failed: Connection refused\. Is NAMED.SPK running there\?/);
  assert.match(await dig(client, "www.hand.sim", "@nowhere"), /there is no machine called nowhere/);
  assert.match(await dig(client, "SET", "NONE"), /No name server now/);
  assert.equal(client.read("C:\\SYSTEM\\RESOLV.INI"), "nameserver=none\n");
  assert.match(await dig(client, "www.hand.sim"), /SimDNS is off \(nameserver=none/);
  assert.match(await dig(client, "SET", "charlie"), /The name server is now charlie/);
  assert.equal(client.read("C:\\SYSTEM\\RESOLV.INI"), "nameserver=charlie\n");
  assert.match(await dig(client, "SET", "DEFAULT"), /the central one again: starthere\.56k\.net/);
  assert.ok(!client.exists("C:\\SYSTEM\\RESOLV.INI"), "nothing left to say, so no file");
  assert.deepEqual(client.ui.dialogs, []);
});

// A program that uses RESOLVE.SPK with RsNext, as the native programs do: one
// question a tick, the Connect last. It prints where each name went, and how
// long it took.
client.write("C:\\MYFILES\\RSTEST.SPK", `
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
    IF at >= names.Count THEN SYS.Exit(0)
    IF NOT waiting THEN
        waiting = TRUE
        began = SYS.Ticks
    END IF
    IF RsNext(names[at]) THEN RETURN
    Print(names[at] + " -> " + RsTarget(names[at]) + " | " + RsCanonical(names[at]) + " | " + Str(RsKnown(names[at])) + " | " + Str(SYS.Ticks - began) + " | " + rsWhy + " | " + Str(RsNoSuchName(names[at])))
    at = at + 1
    waiting = FALSE
END SUB
` + "\n" + resolverSource());
const resolve = async (...names) => {
  const pid = client.run("C:\\MYFILES\\RSTEST.SPK", names);
  await net.until(() => !client.running(pid), 20000, "the resolver");
  assert.deepEqual(client.ui.dialogs, []);
  return client.output(pid).trim().split("\n").map((l) => l.split(" | "));
};
const questions = (name) => (namedLog(central).match(new RegExp("  " + name.replace(/\./g, "\\.") + " A -> ", "g")) || []).length;

await test("the resolver, with no RESOLV.INI: the central name server's CNAMEs to the machine, an address, and SIM95's own names", async () => {
  const r = await resolve("www.hand.sim", "shop.hand.sim", "old.hand.sim", "web", "65.16.0.9", "nope.hand.sim", "STARTHERE.56k.net");
  assert.deepEqual(r[0].slice(0, 3), ["www.hand.sim -> web", "www.hand.sim", "True"]);
  assert.deepEqual(r[1].slice(0, 3), ["shop.hand.sim -> web", "www.hand.sim", "True"], "the chain, to its machine");
  assert.deepEqual(r[2].slice(0, 3), ["old.hand.sim -> 65.16.0.250", "old.hand.sim", "True"]);
  assert.deepEqual(r[3].slice(0, 3), ["web -> web", "web", "False"], "a machine name is not asked about");
  assert.deepEqual(r[4].slice(0, 3), ["65.16.0.9 -> 65.16.0.9", "65.16.0.9", "False"]);
  assert.deepEqual([...r[5].slice(0, 3), r[5][5]], ["nope.hand.sim -> nope.hand.sim", "nope.hand.sim", "False", "True"], "NXDOMAIN: SIM95 tries the name itself");
  assert.deepEqual(r[6].slice(0, 3), ["STARTHERE.56k.net -> STARTHERE.56k.net", "STARTHERE.56k.net", "False"], "the name server's own name is SIM95's");
  // a search domain, still with the central name server (no nameserver= line)
  client.write("C:\\SYSTEM\\RESOLV.INI", "search=hand.sim\n");
  const s = await resolve("store", "web");
  assert.deepEqual(s[0].slice(0, 2), ["store -> web", "www.hand.sim"], "store means store.hand.sim");
  assert.deepEqual(s[1].slice(0, 2), ["web -> web", "web"], "NXDOMAIN for web.hand.sim: the machine");
  client.remove("C:\\SYSTEM\\RESOLV.INI");
});

await test("the resolver keeps answers for their TTL, so a name is asked about once", async () => {
  const before = questions("store.hand.sim");
  const r = await resolve("store.hand.sim", "store.hand.sim", "Store.Hand.Sim");
  assert.deepEqual(r.map((x) => x[0]), ["store.hand.sim -> web", "store.hand.sim -> web", "Store.Hand.Sim -> web"]);
  assert.equal(questions("store.hand.sim") - before, 1);
});

await test("a name server that is down, missing or switched off: names go to SIM95 at once", async () => {
  client.write("C:\\SYSTEM\\RESOLV.INI", "nameserver=charlie\n"); // a machine, but no name server on it
  let r = await resolve("www.hand.sim", "www.toys.com", "web");
  assert.equal(r[0][0], "www.hand.sim -> www.hand.sim");
  assert.ok(Number(r[0][3]) < 1500, "gave up in " + r[0][3] + " ms");
  assert.match(r[0][4], /the name server charlie refused/);
  assert.ok(Number(r[1][3]) < 100, "and did not try again: " + r[1][3] + " ms");
  client.write("C:\\SYSTEM\\RESOLV.INI", "nameserver=nowhere\n"); // no such machine
  r = await resolve("www.hand.sim");
  assert.equal(r[0][0], "www.hand.sim -> www.hand.sim");
  assert.ok(Number(r[0][3]) < 1500, "gave up in " + r[0][3] + " ms");
  assert.match(r[0][4], /there is no machine called nowhere/);
  client.write("C:\\SYSTEM\\RESOLV.INI", "nameserver=none\n");
  r = await resolve("www.hand.sim");
  assert.equal(r[0][0], "www.hand.sim -> www.hand.sim");
  assert.ok(Number(r[0][3]) < 100);
  client.remove("C:\\SYSTEM\\RESOLV.INI");
});

// ---------------------------------------------------------------- Personal Web Manager

const pwm = () => task(web, "PWM");
const pw = {
  win: () => web.widgets(pwm(), "Window").find((w) => String(w.get("Title")).startsWith("Personal Web Manager")),
  dialog: () => web.widgets(pwm(), "Window").find((w) => / Web Site$/.test(String(w.get("Title")))),
  button: (text) => web.button(pwm(), text),
  tagged: (type, tag) => web.widgets(pwm(), type).find((w) => w.get("Tag") === tag),
  list: () => web.widgets(pwm(), "ListBox")[0],
  rows: () => pw.list().get("Items"),
  row: (name) => pw.rows().find((r) => r.split(" ")[0] === name) ?? "",
  label: (re) => web.widgets(pwm(), "Label").map((l) => String(l.get("Text"))).find((t) => re.test(t)) ?? "",
  select: async (name) => { pw.list().set("Selected", pw.rows().findIndex((r) => r.split(" ")[0] === name)); pw.list().fire("onSelect"); await sleep(150); },
  vhosts: () => web.read("C:\\WEB\\VHOSTS.TXT").split("\n").filter((l) => l && !l.startsWith(";")),
};
const click = async (text) => { pw.button(text).call("Click"); await sleep(150); };
async function siteDialog({ name, www = true, serves = "own", app = "" }, edit = "") {
  if (edit) await pw.select(edit);
  pw.button(edit ? "Edit..." : "Add...").call("Click");
  await until(() => pw.dialog(), "the site dialog");
  if (edit) assert.equal(pw.tagged("TextBox", "sitename").get("Text"), edit, "the dialog starts with the site");
  pw.tagged("TextBox", "sitename").set("Text", name);
  pw.tagged("CheckBox", "www").set("Checked", www);
  for (const t of ["own", "app", "home"]) pw.tagged("RadioButton", t).set("Checked", t === serves);
  if (app) {
    const dd = web.widgets(pwm(), "DropDown")[0];
    dd.set("Selected", dd.get("Items").findIndex((i) => i.startsWith(app + " (")));
  }
  web.button(pwm(), "OK").call("Click");
  await until(() => !pw.dialog(), "the site dialog to close");
}

await test("Personal Web Manager: Main says the web server is on, and where SimNIC is", async () => {
  await until(() => pw.win(), "Personal Web Manager");
  assert.equal(pw.win().get("Title"), "Personal Web Manager - Main");
  assert.match(pw.label(/Web publishing/), /^Web publishing is on\. Your home page is available at:/);
  assert.equal(pw.label(/^http:\/\/web\//), "http://web/");
  assert.match(pw.label(/SimNIC/), /register it at SimNIC\n\(http:\/\/starthere\.56k\.net\/nic\/\) and point it at this machine, WEB\.\nSimxplorer users reach it only once its name points here at SimNIC\./);
  assert.ok(pw.button("Register / point it at SimNIC"));
  assert.match(pw.label(/sites by name/), /No sites by name yet/);
});

await test("Personal Web Manager: add a site with its own pages (and www.), and one that is SimBook", async () => {
  await click("Web Sites");
  assert.equal(pw.win().get("Title"), "Personal Web Manager - Web Sites");
  await siteDialog({ name: "CoolSite.SIM", www: true, serves: "own" });
  assert.deepEqual(pw.vhosts(), ["coolsite.sim|C:\\WEB\\SITES\\COOLSITE", "www.coolsite.sim|C:\\WEB\\SITES\\COOLSITE"]);
  assert.match(web.read("C:\\WEB\\SITES\\COOLSITE\\INDEX.HTM"), /<h1>coolsite.sim<\/h1>[\s\S]*Under construction/);
  assert.match(pw.row("coolsite.sim"), /^coolsite\.sim \+www +own pages \(SITES\\COOLSITE\) +/);
  await siteDialog({ name: "coolbook.sim", www: false, serves: "app", app: "SimBook" });
  assert.deepEqual(pw.vhosts().slice(2), ["coolbook.sim|C:\\WEB\\BOOK"]);
  assert.match(pw.row("coolbook.sim"), /^coolbook\.sim +SimBook \(BOOK\) +/);
  assert.ok(!web.exists("C:\\WEB\\SITES\\COOLBOOK"), "an app needs no folder of its own");
  // typed with www.: the same as the box ticked
  await siteDialog({ name: "www.myhome.sim", www: false, serves: "home" });
  assert.deepEqual(pw.vhosts().slice(3), ["myhome.sim|C:\\WEB", "www.myhome.sim|C:\\WEB"]);
  assert.match(pw.row("myhome.sim"), /^myhome\.sim \+www +home page +/);
  // the addresses, for Simxplorer and for Voyager
  await pw.select("coolsite.sim");
  assert.equal(pw.label(/In Simxplorer/), "In Simxplorer: http://coolsite.sim/\nIn Voyager:    http://web/coolsite.sim/");
  // the same name twice
  await click("Add...");
  await until(() => pw.dialog(), "the dialog");
  pw.tagged("TextBox", "sitename").set("Text", "coolsite.sim");
  web.button(pwm(), "OK").call("Click");
  await until(() => web.ui.dialogs.length > 0, "the warning");
  assert.match(web.ui.dialogs.splice(0)[0].text, /coolsite.sim is already one of this machine's sites/);
  web.button(pwm(), "Cancel").call("Click");
  await until(() => !pw.dialog(), "the dialog to close");
  await click("Main");
  assert.match(pw.label(/sites by name/), /^3 sites by name/);
});

await test("Personal Web Manager: edit a site (a new name, and its own pages instead of the home page), and remove one", async () => {
  await click("Web Sites");
  await siteDialog({ name: "ourhome.sim", www: true, serves: "own" }, "myhome.sim");
  assert.deepEqual(pw.vhosts().slice(3), ["ourhome.sim|C:\\WEB\\SITES\\OURHOME", "www.ourhome.sim|C:\\WEB\\SITES\\OURHOME"]);
  assert.ok(web.exists("C:\\WEB\\SITES\\OURHOME\\INDEX.HTM"));
  // edit back to SimBook, without www.
  await siteDialog({ name: "ourhome.sim", www: false, serves: "app", app: "ELIZA-95" }, "ourhome.sim");
  assert.deepEqual(pw.vhosts().slice(3), ["ourhome.sim|C:\\WEB\\ELIZA"]);
  await pw.select("ourhome.sim");
  await click("Remove");
  await until(() => !pw.vhosts().some((l) => l.startsWith("ourhome.sim|")), "the site to go");
  assert.match(web.ui.dialogs.splice(0)[0].text, /Take ourhome.sim off this web server\?/);
  assert.ok(web.exists("C:\\WEB\\SITES\\OURHOME\\INDEX.HTM"), "its folder stays");
  assert.deepEqual(pw.vhosts(), ["coolsite.sim|C:\\WEB\\SITES\\COOLSITE", "www.coolsite.sim|C:\\WEB\\SITES\\COOLSITE", "coolbook.sim|C:\\WEB\\BOOK"]);
  assert.match(web.read("C:\\WEB\\VHOSTS.TXT"), /^; VHOSTS.TXT/, "the comments stay");
});

await test("Personal Web Manager: name my apps under a domain - tick some, untick one", async () => {
  await click("Domain Apps");
  assert.equal(pw.win().get("Title"), "Personal Web Manager - Domain Apps");
  const box = pw.tagged("TextBox", "domain");
  assert.equal(box.get("Text"), "coolsite.sim", "the first domain of the machine's sites");
  const book = pw.tagged("CheckBox", "app:C:\\WEB\\BOOK");
  const eliza = pw.tagged("CheckBox", "app:C:\\WEB\\ELIZA");
  assert.equal(book.get("Text"), "SimBook");
  assert.equal(eliza.get("Text"), "ELIZA-95");
  assert.equal(pw.tagged("TextBox", "label:C:\\WEB\\BOOK").get("Text"), "book", "labels start as the folder's name");
  assert.equal(pw.tagged("TextBox", "label:C:\\WEB\\ELIZA").get("Text"), "eliza");
  assert.equal(book.get("Checked"), false);
  book.set("Checked", true);
  eliza.set("Checked", true);
  pw.tagged("TextBox", "label:C:\\WEB\\ELIZA").set("Text", "Chat");
  await click("Save");
  assert.deepEqual(pw.vhosts().slice(3), ["book.coolsite.sim|C:\\WEB\\BOOK", "chat.coolsite.sim|C:\\WEB\\ELIZA"]);
  // another domain is another list
  box.set("Text", "coolbook.sim");
  box.fire("onChange");
  await sleep(150);
  assert.equal(book.get("Checked"), false);
  box.set("Text", "coolsite.sim");
  box.fire("onChange");
  await sleep(150);
  assert.equal(book.get("Checked"), true);
  assert.equal(pw.tagged("TextBox", "label:C:\\WEB\\ELIZA").get("Text"), "chat");
  // untick one: only that one goes
  eliza.set("Checked", false);
  await click("Save");
  assert.deepEqual(pw.vhosts().slice(3), ["book.coolsite.sim|C:\\WEB\\BOOK"]);
  // a label that can't be a name changes nothing
  eliza.set("Checked", true);
  pw.tagged("TextBox", "label:C:\\WEB\\ELIZA").set("Text", "no good");
  await click("Save");
  await until(() => web.ui.dialogs.length > 0, "the warning");
  assert.match(web.ui.dialogs.splice(0)[0].text, /can't be a name under coolsite.sim/);
  assert.deepEqual(pw.vhosts().slice(3), ["book.coolsite.sim|C:\\WEB\\BOOK"]);
  eliza.set("Checked", false);
  pw.tagged("TextBox", "label:C:\\WEB\\ELIZA").set("Text", "eliza");
});

await test("Personal Web Manager: the DNS column - points here, points at another machine, not registered, name server not answering", async () => {
  await register("coolsite.sim", "web");
  await register("coolbook.sim", "WEB");
  await register("elsewhere.sim", "client");
  await click("Web Sites");
  await siteDialog({ name: "elsewhere.sim", www: false, serves: "home" });
  await siteDialog({ name: "nothere.sim", www: false, serves: "home" });
  await until(async () => (await ask(charlie, "starthere.56k.net", "QUERY elsewhere.sim")) === "OK\nelsewhere.sim 60 CNAME client", "NAMED", 8000);
  await click("Check DNS");
  const dns = (name) => pw.row(name).slice(52);
  await until(() => !pw.rows().some((r) => r.endsWith("checking...")), "the answers", 15000);
  assert.equal(dns("coolsite.sim"), "\u2713 points here");
  assert.equal(dns("coolbook.sim"), "\u2713 points here");
  assert.equal(dns("elsewhere.sim"), "points at client");
  assert.equal(dns("nothere.sim"), "not registered");
  assert.equal(dns("book.coolsite.sim"), "not registered", "book needs a CNAME at SimNIC too");
  assert.match(pw.label(/must point at WEB at SimNIC/), /A site's name must point at WEB at SimNIC \(http:\/\/starthere\.56k\.net\/nic\/\)/);
  // the name server stops: said at once, nothing hangs
  central.kernel.kill(named(central));
  await click("Check DNS");
  await until(() => !pw.rows().some((r) => r.endsWith("checking...")), "the answers", 8000);
  assert.equal(dns("coolsite.sim"), "name server not answering");
  assert.equal(dns("nothere.sim"), "name server not answering");
  central.run("C:\\PROGRAMS\\NAMED.SPK");
  await until(() => named(central) && namedLog(central).includes("Listening"), "NAMED again");
  await click("Check DNS");
  await until(() => dns("coolsite.sim") === "\u2713 points here", "the answers again", 15000);
  // tidy up the two test sites
  for (const n of ["elsewhere.sim", "nothere.sim"]) {
    await pw.select(n);
    await click("Remove");
    await until(() => !pw.vhosts().some((l) => l.startsWith(n + "|")), n + " to go");
  }
  web.ui.dialogs.splice(0);
  assert.deepEqual(web.errors, []);
});

await test("Personal Web Manager: Stop, Start and Restart the web server", async () => {
  await click("Main");
  const before = webPid(web);
  await click("Stop");
  await until(() => !webPid(web), "the web server to stop");
  assert.match(pw.label(/Web publishing/), /^Web publishing is off\./);
  assert.ok(pw.button("Start"));
  assert.equal(pw.button("Restart").get("Enabled"), false);
  await click("Start");
  await until(() => webPid(web), "the web server to start");
  assert.notEqual(webPid(web), before);
  assert.match(pw.label(/Web publishing/), /^Web publishing is on\./);
  const second = webPid(web);
  await click("Restart");
  await until(() => webPid(web) && webPid(web) !== second, "a new web server");
  await until(async () => (await http(client, "WEB", "GET", "/", { hostHeader: "coolsite.sim" }).catch(() => ({ body: "" }))).body.includes("Under construction"), "it to answer", 8000);
});

// ---------------------------------------------------------------- the web server

const site = (f, text) => web.write("C:\\WEB\\SITES\\COOLSITE\\" + f, text);
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
web.mkdir("C:\\WEB\\SITES\\COOLSITE\\SUB");
site("SUB\\DEEP.HTM", "<html><head><title>Deep</title></head><body><a href=\"../index.htm\">Up</a></body></html>");
web.mkdir("C:\\WEB\\SITES\\USERS");
web.write("C:\\WEB\\SITES\\USERS\\INDEX.HTM", "<html><head><title>Somebody's page</title></head><body>users</body></html>");
web.write("C:\\WEB\\VHOSTS.TXT", web.read("C:\\WEB\\VHOSTS.TXT") + "*.users.coolsite.sim|C:\\WEB\\SITES\\USERS\nevil.sim|C:\\SYSTEM\n");

await test("Voyager path mode: http://web/www.coolsite.sim/ is the site, and the page sees the path inside it", async () => {
  let r = await http(client, "WEB", "GET", "/www.coolsite.sim");
  assert.equal(r.status, "302 Found");
  assert.equal(header(r, "Location"), "/www.coolsite.sim/");
  r = await http(client, "WEB", "GET", "/www.coolsite.sim?a=1");
  assert.equal(header(r, "Location"), "/www.coolsite.sim/?a=1");
  r = ok(await http(client, "WEB", "GET", "/www.coolsite.sim/"));
  assert.match(r.body, /<h1>Welcome to my cool site!<\/h1>/);
  assert.equal(header(r, "Content-Type"), "text/html");
  assert.match(ok(await http(client, "WEB", "GET", "/coolsite.sim/")).body, /Welcome to my cool site/, "the address Personal Web Manager gives");
  assert.equal(ok(await http(client, "WEB", "GET", "/www.coolsite.sim/dot.pic")).body, "SIM95PIC 2 2\nC9\n9C\n");
  assert.match(ok(await http(client, "WEB", "GET", "/WWW.COOLSITE.SIM/sub/deep.htm")).body, /Deep/);
  r = ok(await http(client, "WEB", "GET", "/www.coolsite.sim/more.asp?x=1"));
  assert.match(r.body, /<p id="host">web<\/p><p id="path">\/more.asp<\/p><p id="query">x=1<\/p>/);
  assert.match(r.body, /<p id="site">www.coolsite.sim<\/p><p id="base">\/www.coolsite.sim\/<\/p>/);
  assert.match(r.body, /<p id="script">C:\\WEB\\SITES\\COOLSITE\\MORE.ASP<\/p>/);
  r = await http(client, "WEB", "POST", "/www.coolsite.sim/more.asp", { body: "who=Ann+%26+Bob" });
  assert.match(r.body, /<p id="form">Ann & Bob<\/p>/, "a POST's body arrives as it was sent");
  r = await http(client, "WEB", "GET", "/www.coolsite.sim/go.asp");
  assert.equal(header(r, "Location"), "/www.coolsite.sim/more.asp?from=go", "a redirect to /... stays inside the site");
  assert.equal((await http(client, "WEB", "GET", "/www.coolsite.sim/nothere.htm")).status, "404 Not Found");
  assert.equal((await http(client, "WEB", "GET", "/www.coolsite.sim/../VHOSTS.TXT")).status, "404 Not Found");
  assert.match(ok(await http(client, "WEB", "GET", "/ann.users.coolsite.sim/")).body, /Somebody's page/, "a *. site by path");
  assert.equal((await http(client, "WEB", "GET", "/evil.sim/USERS.INI")).status, "404 Not Found", "a folder outside C:\\WEB is not a site");
  assert.match(web.widgets(webPid(web), "ListBox")[0].get("Items").join("\n"), /VHOSTS.TXT: evil.sim is not in C:\\WEB, so it is left out/);
  assert.match(ok(await http(client, "WEB", "GET", "/coolbook.sim/")).body, /SimBook/, "an app by path");
});

await test("Host mode: a request for www.coolsite.sim is the site; other names, and none, are C:\\WEB as before", async () => {
  let r = ok(await http(client, "WEB", "GET", "/", { hostHeader: "www.coolsite.sim" }));
  assert.match(r.body, /Welcome to my cool site/);
  r = ok(await http(client, "WEB", "GET", "/more.asp?x=2", { hostHeader: "WWW.CoolSite.sim:80" }));
  assert.match(r.body, /<p id="host">WWW.CoolSite.sim:80<\/p><p id="path">\/more.asp<\/p>/);
  assert.match(r.body, /<p id="site">www.coolsite.sim<\/p><p id="base">\/<\/p>/);
  r = await http(client, "WEB", "GET", "/go.asp", { hostHeader: "coolsite.sim" });
  assert.equal(header(r, "Location"), "/more.asp?from=go", "by name, a redirect is left alone");
  assert.match(ok(await http(client, "WEB", "GET", "/", { hostHeader: "bob.users.coolsite.sim" })).body, /Somebody's page/);
  assert.match(ok(await http(client, "WEB", "GET", "/", { hostHeader: "book.coolsite.sim" })).body, /SimBook/);
  for (const h of ["web", web.stack.localIp(), "www.elsewhere.sim"]) assert.match(ok(await http(client, "WEB", "GET", "/", { hostHeader: h })).body, /<title>WEB - SimHost<\/title>/, h);
  r = await http(client, "WEB", "GET", "/more.asp", { hostHeader: "www.coolsite.sim\nX-Site: evil" });
  assert.match(r.body, /<p id="site">www.coolsite.sim<\/p>/, "a site's X-Site can't be made up by the browser");
  assert.match(header(ok(await http(client, "WEB", "GET", "/", { hostHeader: "coolsite.sim" })), "Server"), /simweb/);
  assert.deepEqual(web.errors, []);
});

// ---------------------------------------------------------------- end to end, in Simxplorer

client.write("C:\\PROGRAMS\\SIMXPLOR.SPK", simxplorerSource());
client.write("C:\\SYSTEM\\SIMXPLOR.INI", "[Simxplorer]\nhome=about:blank\nsearch=\nmail=\n");
let ie, statuses = [];
const sx = {
  win: () => client.widgets(ie, "Window")[0],
  view: () => client.widgets(ie, "HtmlView")[0],
  html: () => String(sx.view().get("Html") ?? ""),
  el: (id) => sx.view().elements.get(id),
  title: () => sx.win().get("Title"),
  loaded: (t, ms = 10000) => until(() => sx.title() === t + " - Simxplorer" && String(sx.win().get("Status")).startsWith("Done"), "the page " + t, ms),
  go: (url) => { const box = client.widgets(ie, "TextBox")[0]; box.set("Text", url); box.fire("onEnter"); },
  address: () => client.widgets(ie, "TextBox")[0].get("Text"),
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
const cq = (name) => (namedLog(central).match(new RegExp("  " + name.replace(/\./g, "\\.") + " A -> ", "g")) || []).length;

await test("end to end: CLIENT, with no RESOLV.INI, opens www.coolsite.sim (WEB's own pages) through the central name server", async () => {
  assert.ok(!client.exists("C:\\SYSTEM\\RESOLV.INI"));
  ie = client.run("C:\\PROGRAMS\\SIMXPLOR.SPK", ["about:blank"]);
  await until(() => sx.win() && sx.view(), "Simxplorer", 30000);
  const w = sx.win();
  const set = w.set.bind(w);
  w.set = (p, v) => { if (p === "Status") statuses.push(v); set(p, v); };
  const asked = cq("www.coolsite.sim");
  sx.go("www.coolsite.sim");
  await sx.loaded("Cool Site");
  assert.equal(sx.address(), "http://www.coolsite.sim/", "the address stays as typed");
  const from = statuses.indexOf("Looking up www.coolsite.sim...");
  assert.ok(from >= 0, statuses.join(" / "));
  assert.ok(statuses.indexOf("Connecting to web...") > from, statuses.join(" / "));
  // the picture and the script's request go to WEB by the same name
  sx.view().fire("onImage", "dot.pic");
  await until(() => sx.view().images?.get("dot.pic"), "the picture");
  assert.equal(sx.view().images.get("dot.pic"), "SIM95PIC 2 2\nC9\n9C\n");
  await until(() => sx.el("news")?.Value === "200 Cool news", "the XMLHttpRequest");
  assert.equal(cq("www.coolsite.sim") - asked, 1, "asked about once, for the page, the picture and the request");
  // a relative link, a page that sees its own name, and a cookie for that name
  sx.view().fire("onNavigate", "more.asp?x=1");
  await sx.loaded("More");
  assert.equal(sx.el("host").Value, "www.coolsite.sim");
  assert.equal(sx.el("base").Value, "/");
  assert.match(client.read("C:\\SYSTEM\\COOKIES.TXT"), /^WWW\.COOLSITE\.SIM\|seen\|yes$/m, "cookies go by the name typed");
  sx.view().fire("onNavigate", "more.asp?x=2");
  await until(() => sx.el("cookie")?.Value === "yes", "the cookie sent back");
  sx.view().fire("onNavigate", "sub/deep.htm");
  await sx.loaded("Deep");
  // names SimDNS doesn't know, and machine names, work as they always did
  sx.go("charlie");
  await sx.loaded("CHARLIE's Home Page");
  sx.go("nope.coolsite.sim");
  await until(() => client.ui.dialogs.length > 0, "the error");
  assert.match(client.ui.dialogs.splice(0)[0].text, /Simxplorer cannot open the Internet site http:\/\/nope.coolsite.sim\/\.\s+The server name or address could not be resolved\./);
  assert.ok(!client.exists("C:\\SYSTEM\\RESOLV.INI"));
  assert.deepEqual(client.errors, []);
});

await test("end to end: coolbook.sim is SimBook on WEB - join through its forms, and its cookie is coolbook.sim's", async () => {
  sx.go("coolbook.sim");
  await until(() => /SimBook/.test(sx.title()) && String(sx.win().get("Status")).startsWith("Done"), "SimBook", 15000);
  assert.equal(sx.address(), "http://coolbook.sim/");
  const joinForm = sx.html().split(/<form\b/i).slice(1).findIndex((f) => /action="sxsubmit:\d+"/.test(f) && /name="pw2"/.test(f));
  assert.ok(joinForm >= 0, "the join form");
  submit(joinForm, { name: "Bob Client", u: "bob", pw: "secret", pw2: "secret" });
  await until(() => /Bob Client/.test(sx.html()) && String(sx.win().get("Status")).startsWith("Done"), "Bob's page", 15000);
  assert.match(sx.address(), /^http:\/\/coolbook\.sim\//);
  assert.match(client.read("C:\\SYSTEM\\COOKIES.TXT"), /^COOLBOOK\.SIM\|simbook\|[0-9A-F]+$/m);
  assert.ok(web.exists("C:\\BOOKDATA\\USERS\\bob.TXT"), "Bob is a SimBook member on WEB");
  // and the same SimBook as an app's name under coolsite.sim (a CNAME at SimNIC first)
  ok(await nic.post("/nic/record.asp", { d: "coolsite.sim", op: "add", name: "book", type: "CNAME", value: "web", t: await token("/nic/domain.asp?d=coolsite.sim") }));
  await until(async () => (await ask(charlie, "starthere.56k.net", "QUERY book.coolsite.sim")) === "OK\nbook.coolsite.sim 60 CNAME web", "the new record", 8000);
  sx.go("book.coolsite.sim");
  await until(() => /SimBook/.test(sx.title()) && String(sx.win().get("Status")).startsWith("Done"), "SimBook at book.coolsite.sim", 15000);
  assert.deepEqual(client.errors, []);
  assert.deepEqual(client.ui.dialogs, []);
});

await test("Simxplorer: Options shows the central name server; a dead one doesn't hold pages up; default goes back", async () => {
  sx.go("about:options");
  await sx.loaded("Options");
  assert.match(sx.html(), /Name server:<\/td><td><input name="dns" size="40" value="starthere\.56k\.net"/);
  assert.match(sx.html(), /the central one, starthere\.56k\.net, unless you say otherwise/);
  submit(0, {});
  await until(() => /Your settings have been saved/.test(sx.html()), "the settings");
  assert.ok(!client.exists("C:\\SYSTEM\\RESOLV.INI"), "the central one is left as the default");
  sx.go("about:options");
  await sx.loaded("Options");
  submit(0, { dns: "charlie" });
  await until(() => client.exists("C:\\SYSTEM\\RESOLV.INI"), "the setting");
  assert.equal(client.read("C:\\SYSTEM\\RESOLV.INI"), "nameserver=charlie\n");
  const t0 = Date.now();
  sx.go("www.ourown.sim");
  await until(() => client.ui.dialogs.length > 0, "the error");
  assert.ok(Date.now() - t0 < 4000, "took " + (Date.now() - t0) + " ms");
  assert.match(client.ui.dialogs.splice(0)[0].text, /could not be resolved/);
  sx.go("http://web/www.coolsite.sim/");
  await sx.loaded("Cool Site");
  sx.go("about:options");
  await sx.loaded("Options");
  submit(0, { dns: "default" });
  await until(() => !client.exists("C:\\SYSTEM\\RESOLV.INI"), "the default again");
});

// ---------------------------------------------------------------- every app, through the new web server

await test("every app on WEB comes through the new web server, by path and by name", async () => {
  for (const app of ["coldmail", "asksim", "simpal", "simtube", "simstats", "vapor"]) assert.match(await install(web, app, 120000), / is installed \(/, app);
  assert.equal(web.read("C:\\PROGRAMS\\HTTPD.SPK"), src("simweb/src/HTTPD.SPK"));
  let r = ok(await http(client, "WEB", "GET", "/"));
  for (const name of ["SimBook", "ColdMail", "AskSim", "SimPal", "SimTube", "SimStats", "Vapor", "ELIZA-95"]) assert.ok(r.body.includes(name), name);
  r = await http(client, "WEB", "POST", "/book/join.asp", { body: "name=Ann&u=ann&pw=secret&pw2=secret" });
  assert.equal(r.status, "302 Found");
  const cookie = header(r, "Set-Cookie").split(";")[0];
  assert.match(ok(await http(client, "WEB", "GET", "/book/home.asp", { cookie })).body, /Ann/);
  assert.match(ok(await http(client, "WEB", "GET", "/book/nopic.pic")).body, /^SIM95PIC /);
  assert.ok(ok(await http(client, "WEB", "GET", "/mail/dist/manifest.txt")).body.includes("|C:\\WEB\\"));
  assert.match(ok(await http(client, "WEB", "GET", "/ask/")).body, /AskSim/);
  assert.match(ok(await http(client, "WEB", "GET", "/pal/")).body, /SimPal/);
  assert.match(ok(await http(client, "WEB", "GET", "/vapor/catalog.txt")).body, /^SIMWEB\|simweb\|/m, "every store stocks simweb");
  assert.match(ok(await http(client, "WEB", "GET", "/vapor/simweb/1.txt")).body, /^' VAPOR\|id=SIMWEB/);
  const id = web.read("C:\\STATDATA\\HOME.TXT").trim();
  r = ok(await http(client, "WEB", "GET", "/stats/hit.asp?s=" + id + "&p=/&t=Test"));
  assert.equal(header(r, "Content-Type"), "image/x-sim95pic");
  r = ok(await http(client, "WEB", "GET", "/tube/"));
  const v = (/watch\.asp\?v=(\d+)/.exec(r.body) || [])[1];
  assert.ok(v, "a movie on the front page");
  r = ok(await http(client, "WEB", "GET", "/tube/movie.asp?v=" + v));
  assert.equal(header(r, "Content-Type"), "video/x-simmovie");
  assert.equal((await http(client, "WEB", "GET", "/nothere.htm")).status, "404 Not Found");
  assert.equal((await http(client, "WEB", "POST", "/welcome.htm", { body: "a=1" })).status, "405 Method Not Allowed");
  assert.deepEqual(web.errors, []);
});

// ---------------------------------------------------------------- uninstalling

await test("uninstalling simweb (as Vapor does) puts the stock web server back", async () => {
  const head = src("simweb/INSTALL.SPK").split("\n")[0];
  const files = /\|files=([^|]*)\|/.exec(head)[1].split(";");
  web.kernel.kill(pwm());
  for (const f of files) if (web.exists(f)) web.remove(f);
  await until(() => web.read("C:\\PROGRAMS\\HTTPD.SPK") === STOCK && !web.exists("C:\\PROGRAMS\\HTTPD.ORG"), "the stock web server", 5000);
  await until(async () => webPid(web) && (await http(client, "WEB", "GET", "/www.coolsite.sim/").catch(() => ({ status: "" }))).status === "404 Not Found", "the stock web server running", 8000);
  assert.match(ok(await http(client, "WEB", "GET", "/welcome.htm")).body, /WEB/);
  assert.deepEqual(web.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
