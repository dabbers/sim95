// End-to-end tests for domain names in the native programs: SimPlayer (on its
// own and built into Simxplorer), Vapor, Frostbird, ColdMail's MAILD, the Sim
// Shell and AskSim's crawler, each with the SimDNS resolver joined on by the
// builder, asking the central name server on STARTHERE.56k.net (no machine
// here has a C:\SYSTEM\RESOLV.INI). Then the name server stops, and every
// program goes on with machine names, without hanging.
//   STARTHERE.56k.net  NAMED, with fun.sim, post.sim and cname.sim
//   WEB                simweb's web server: www.fun.sim, shop.fun.sim; a Vapor store
//   MAILBOX            ColdMail for fun.sim (its MX) and cname.sim (no MX, a CNAME)
//   POSTBOX            ColdMail for post.sim; sshd, at shell.post.sim
//   CLIENT             SimPlayer, Simxplorer, Vapor, Frostbird, the Sim Shell, AskSim
//   node tools/aspsim/dnsapps.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser as rawBrowser } from "./sim.mjs";
import { Network } from "./network.mjs";
import { simxplorerSource, resolverSource } from "../simxplorer-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = (f) => fs.readFileSync(path.join(root, f), "utf8");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const net = new Network();
const wait = (fn, what, ms = 20000) => net.until(fn, ms, what);
const task = (m, name) => m.kernel.ps().find((p) => p.name === name)?.pid;
async function boot(name) {
  const m = await net.boot(name);
  m.write("C:\\SYSTEM\\USERS.INI", "name=" + name.toLowerCase() + "\npassword=sekret\n");
  m.run("C:\\PROGRAMS\\FILESVC.SPK");
  return m;
}
const central = await boot("STARTHERE.56k.net");
const web = await boot("WEB");
const mailbox = await boot("MAILBOX");
const postbox = await boot("POSTBOX");
const client = await boot("CLIENT");
const install = async (m, app, ms = 60000) => {
  m.write("C:\\MYFILES\\INSTALL.SPK", src(app + "/INSTALL.SPK"));
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !m.running(pid), app + "'s installer on " + m.hostname(), ms);
  return m.output(pid);
};
const webLog = () => (web.widgets(task(web, "HTTPD"), "ListBox")[0]?.get("Items") ?? []).join("\n");
const namedLog = () => (central.widgets(task(central, "NAMED"), "ListBox")[0]?.get("Items") ?? []).join("\n");
async function ask(from, server, question) {
  const conn = await from.stack.connect(0, server, 53);
  const answer = new Promise((r) => conn.onMessage(r));
  conn.send(question);
  const got = await Promise.race([answer, sleep(6000).then(() => null)]);
  try { conn.close(); } catch {}
  return got;
}

// ---------------------------------------------------------------- the network

// STARTHERE.56k.net: the central name server, with zones written by hand
central.mkdir("C:\\DNS");
central.write("C:\\DNS\\NAMED.CNF", "primary fun.sim FUN.SIM\nprimary post.sim POST.SIM\nprimary cname.sim CNAME.SIM\n");
central.write("C:\\DNS\\FUN.SIM", "$TTL 300\n@ IN NS starthere.56k.net\n@ CNAME web\nwww CNAME web\nshop CNAME web\n@ MX 10 mailbox\n");
central.write("C:\\DNS\\POST.SIM", "$TTL 300\n@ IN NS starthere.56k.net\n@ MX 10 postbox\nshell CNAME postbox\n");
central.write("C:\\DNS\\CNAME.SIM", "$TTL 300\n@ IN NS starthere.56k.net\n@ CNAME mailbox\n");
central.write("C:\\PROGRAMS\\NAMED.SPK", src("simnic/src/NAMED.SPK"));
central.run("C:\\PROGRAMS\\NAMED.SPK");

// WEB: simweb's web server, a site at www.fun.sim, and its home page at shop.fun.sim
const movie = src("simtube/MOVIES/WELCOME.SMV");
web.write("C:\\PROGRAMS\\HTTPD.SPK", src("simweb/src/HTTPD.SPK"));
web.mkdir("C:\\WEB\\SITES");
web.mkdir("C:\\WEB\\SITES\\FUN");
web.mkdir("C:\\WEB\\SITES\\FUN\\SECRET");
const fun = (f, t) => web.write("C:\\WEB\\SITES\\FUN\\" + f, t);
fun("INDEX.HTM", `<html><head><title>Fun Site</title><meta name="description" content="The funnest site on the SIM95 network"></head><body>
<h1>Fun!</h1><a href="page2.htm">Page two</a> <a href="secret/">Secret</a> <a href="movies.htm">Movies</a></body></html>`);
fun("PAGE2.HTM", "<html><head><title>Fun Page Two</title></head><body>zebras and <a href=\"index.htm\">home</a></body></html>");
fun("MOVIES.HTM", "<html><head><title>Fun Movies</title></head><body><a href=\"welcome.smv\">Welcome</a></body></html>");
fun("SECRET\\INDEX.HTM", "<html><head><title>Secret Fun</title></head><body>flamingos</body></html>");
fun("ROBOTS.TXT", "User-agent: *\nDisallow: /secret/\n");
fun("WELCOME.SMV", movie);
web.write("C:\\WEB\\VHOSTS.TXT", "www.fun.sim|C:\\WEB\\SITES\\FUN\nfun.sim|C:\\WEB\\SITES\\FUN\nshop.fun.sim|C:\\WEB\n");
// the machine's own home page links to the site by name, and by path (twice)
web.write("C:\\WEB\\INDEX.HTM", `<html><head><title>WEB's Home Page</title></head><body>
<a href="http://www.fun.sim/">Fun, by name</a> <a href="/www.fun.sim/page2.htm">Fun page two, by path</a>
<a href="http://web/www.fun.sim/">Fun, by path</a></body></html>`);
web.run("C:\\PROGRAMS\\HTTPD.SPK");
postbox.run("C:\\PROGRAMS\\HTTPD.SPK");
mailbox.run("C:\\PROGRAMS\\HTTPD.SPK");

// MAILBOX and POSTBOX: ColdMail, trying again every second
const maild = (m) => task(m, "MAILD");
async function installColdMail(m) {
  if (!m.exists("C:\\MAILDATA")) m.mkdir("C:\\MAILDATA");
  m.write("C:\\MAILDATA\\MAILD.INI", "retry=1\ntries=8");
  await install(m, "coldmail");
  await wait(() => maild(m) && /port 110/.test(m.widgets(maild(m), "ListBox")[0]?.get("Items").join("\n")), "the mail server");
}
function browser(m) {
  const b = rawBrowser(m);
  const { post } = b;
  b.token = async () => (/name="t" value="([0-9A-F]+)"/.exec((await m.request("GET", "/compose.asp", { cookies: b.cookies() })).body) || [])[1] ?? "";
  b.post = async (url, form) => post(url, form && !("t" in form) ? { ...form, t: await b.token() } : form);
  return b;
}
const box = (m, u, f = "INBOX") => (m.exists(`C:\\MAILDATA\\BOX\\${u}\\${f}.TXT`) ? m.read(`C:\\MAILDATA\\BOX\\${u}\\${f}.TXT`).trim().split("\n").filter(Boolean) : []);
const mailLog = (m) => (m.widgets(maild(m), "ListBox")[0]?.get("Items") ?? []).join("\n");

await test("the network: the central name server answers, and every program carries the resolver", async () => {
  await wait(async () => (await ask(client, "starthere.56k.net", "QUERY www.fun.sim")) === "OK\nwww.fun.sim 300 CNAME web", "the central name server");
  assert.equal(await ask(client, "starthere.56k.net", "QUERY fun.sim MX"), "OK\nfun.sim 300 MX 10 mailbox");
  await installColdMail(mailbox);
  await installColdMail(postbox);
  for (const m of [mailbox, postbox, client, web]) assert.ok(!m.exists("C:\\SYSTEM\\RESOLV.INI"), m.hostname());
  const joined = (f) => f.endsWith("\n" + resolverSource()) || f.endsWith("\n" + resolverSource() + "\n");
  assert.ok(joined(mailbox.read("C:\\PROGRAMS\\MAILD.SPK")), "MAILD");
  // Simxplorer: the browser's resolver is the built-in player's too, once
  const sx = simxplorerSource();
  assert.equal(sx.split("\nSUB RsAsk (").length, 2, "one resolver in Simxplorer");
  assert.ok(!/\bMvRs/.test(sx), "the player's Rs... calls are not renamed");
  assert.match(sx, /IF RsNext\(MvHostOf\(MvSource\)\) THEN RETURN/i);
});

// ---------------------------------------------------------------- SimPlayer

function player(args) {
  const pid = client.run("C:\\PROGRAMS\\PLAYER.SPK", args);
  const self = {
    pid,
    win: () => client.widgets(pid, "Window")[0],
    tag: () => String(self.win()?.get("Tag") ?? ""),
    state: () => self.tag().split("|")[0],
    status: () => String(self.win()?.get("Status") ?? ""),
  };
  return self;
}

await test("SimPlayer streams a movie from www.fun.sim, from the machine the name server names, with Host: www.fun.sim", async () => {
  assert.match(await install(client, "simplayer"), /SimPlayer is installed/);
  assert.ok(client.read("C:\\PROGRAMS\\PLAYER.SPK").endsWith(resolverSource().replace(/\n?$/, "\n")), "the resolver joined on");
  client.kernel.kill(task(client, "PLAYER"));
  const p = player(["http://www.fun.sim/welcome.smv"]);
  await wait(() => p.state() === "playing", "playing: " + p.tag() + " " + p.status(), 20000);
  assert.equal(p.win().get("Title"), "SimPlayer - Welcome to SimTube");
  assert.match(webLog(), /GET www\.fun\.sim\/welcome\.smv/, "the web server served the site by its name");
  assert.match(namedLog(), /www\.fun\.sim A -> /);
  client.kernel.kill(p.pid);
  assert.deepEqual(client.ui.dialogs, []);
});

let ie;
const sxw = {
  win: () => client.widgets(ie, "Window")[0],
  view: () => client.widgets(ie, "HtmlView")[0],
  title: () => sxw.win().get("Title"),
  go: (url) => { const b = client.widgets(ie, "TextBox")[0]; b.set("Text", url); b.fire("onEnter"); },
  loaded: (t, ms = 15000) => wait(() => sxw.title() === t + " - Simxplorer" && String(sxw.win().get("Status")).startsWith("Done"), "the page " + t, ms),
};

await test("Simxplorer's built-in SimPlayer plays a movie from a page at www.fun.sim", async () => {
  client.write("C:\\PROGRAMS\\SIMXPLOR.SPK", simxplorerSource());
  client.write("C:\\SYSTEM\\SIMXPLOR.INI", "[Simxplorer]\nhome=about:blank\nsearch=\nmail=\n");
  ie = client.run("C:\\PROGRAMS\\SIMXPLOR.SPK", ["about:blank"]);
  await wait(() => sxw.win() && sxw.view(), "Simxplorer", 30000);
  sxw.go("www.fun.sim/movies.htm");
  await sxw.loaded("Fun Movies");
  sxw.view().fire("onNavigate", "welcome.smv");
  const popup = () => client.widgets(ie, "Window").find((w) => String(w.get("Title")).startsWith("SimPlayer") && !w.destroyed);
  await wait(() => popup() && popup().get("Title") === "SimPlayer - Welcome to SimTube", "the built-in SimPlayer", 20000);
  assert.deepEqual(client.errors, []);
  client.kernel.kill(ie);
});

// ---------------------------------------------------------------- Vapor

const vaporUi = (m) => {
  const vapor = () => task(m, "VAPOR");
  const self = {
    pid: vapor,
    list: () => m.widgets(vapor(), "ListBox")[0],
    items: () => self.list()?.get("Items") ?? [],
    button: (text) => m.widgets(vapor(), "Button").find((b) => String(b.get("Text")).replace("&", "") === text && b.get("Visible") !== false),
    menu: (item) => m.widgets(vapor(), "Menu")[0].fire("onSelect", item),
    async select(name) {
      await wait(() => self.items().some((i) => i.trim().startsWith(name)), name + " in the list: " + self.items().join(" / "));
      self.list().set("Selected", self.items().findIndex((i) => i.trim().startsWith(name)));
      self.list().fire("onSelect");
      await wait(() => m.widgets(vapor(), "Label")[0]?.get("Text") === name, name + "'s page");
    },
    async click(text) {
      await wait(() => self.button(text)?.get("Enabled") !== false && self.button(text), "the " + text + " button");
      self.button(text).call("Click");
    },
  };
  return self;
};
const V = vaporUi(client);
const library = () => (client.exists("C:\\GAMES\\LIBRARY.TXT") ? client.read("C:\\GAMES\\LIBRARY.TXT") : "");

await test("Vapor shops at a store at a domain (http://shop.fun.sim/vapor/): the catalog, a download, and its own update", async () => {
  assert.match(await install(web, "vapor", 120000), /Vapor is installed/);
  client.mkdir("C:\\GAMES");
  client.write("C:\\GAMES\\VAPOR.INI", "store=http://shop.fun.sim/vapor/\n");
  client.write("C:\\PROGRAMS\\VAPOR.SPK", web.read("C:\\PROGRAMS\\VAPOR.SPK"));
  assert.ok(web.read("C:\\PROGRAMS\\VAPOR.SPK").includes("\nSUB RsAsk ("), "the Vapor client has the resolver");
  client.run("C:\\PROGRAMS\\VAPOR.SPK");
  await wait(() => V.items().includes("- GAMES -"), "the store's catalog", 30000);
  assert.ok(V.items().some((i) => i.trim() === "simweb"), "every store stocks simweb: " + V.items().join(" / "));
  assert.match(webLog(), /GET shop\.fun\.sim\/vapor\/catalog\.txt/);
  await V.select("Snake 95");
  await V.click("Install");
  await wait(() => /^SNAKE\|Snake 95\|/m.test(library()), "Snake 95 in the library", 40000);
  assert.match(webLog(), /GET shop\.fun\.sim\/vapor\/snake\/1\.txt/);
  // a newer Vapor in the store: it updates itself from the domain too
  const W = vaporUi(web);
  await wait(() => W.pid(), "Vapor on WEB");
  web.write("C:\\MYFILES\\VAPOR2.SPK", web.read("C:\\PROGRAMS\\VAPOR.SPK").replace(/version=[0-9a-f]{8}/, "version=0ddba11e") + "' (Vapor, newer)\n");
  web.ui.dialogs.splice(0);
  W.menu("Publish Apps...");
  await wait(() => web.ui.dialogs.length, "the publish report", 30000);
  assert.match(web.ui.dialogs.splice(0).map((d) => d.text).join("\n"), /Vapor \(build 0ddba11e\)/);
  const before = V.pid();
  client.ui.answers.push(true);
  V.menu("Refresh");
  await wait(() => client.ui.dialogs.length, "the offer");
  assert.match(client.ui.dialogs.splice(0)[0].text, /^A new version of Vapor is in the store \(build 0ddba11e/);
  await wait(() => V.pid() && V.pid() !== before, "the new Vapor running", 30000);
  assert.match(client.read("C:\\PROGRAMS\\VAPOR.SPK"), /version=0ddba11e[\s\S]*\(Vapor, newer\)\n$/);
  await wait(() => V.items().length > 0, "it shows the store again", 30000);
  assert.match(client.read("C:\\GAMES\\VAPOR.INI"), /^store=http:\/\/shop\.fun\.sim\/vapor\/$/m);
  assert.deepEqual(client.errors, []);
});

// ---------------------------------------------------------------- mail

const ann = browser(mailbox);
const bob = browser(postbox);

await test("MAILD: mail for ann@fun.sim goes where fun.sim's MX says, and MAILBOX takes it as its own", async () => {
  assert.equal((await ann.post("/join.asp", { name: "Ann Fun", u: "ann", pw: "secret", pw2: "secret" })).url, "/inbox.asp");
  assert.equal((await bob.post("/join.asp", { name: "Bob Post", u: "bob", pw: "hunter2", pw2: "hunter2" })).url, "/inbox.asp");
  await bob.post("/compose.asp", { to: "ann@fun.sim", subject: "By MX", text: "Found you." });
  await wait(() => box(mailbox, "ANN").some((l) => l.includes("|By MX|")), "the letter, by MX", 30000);
  await wait(() => /Sent bob@postbox -> ann@fun\.sim/.test(mailLog(postbox)), "POSTBOX to say so");
  assert.match(mailLog(postbox), /Will try ann@fun\.sim again: 451 Looking up fun\.sim; try again shortly/, "MAILBOX looked fun.sim up first");
  await wait(() => /fun\.sim's mail comes here/.test(mailLog(mailbox)), "MAILBOX to say fun.sim is its own");
  // a domain with no MX: its CNAME's machine takes the mail
  await bob.post("/compose.asp", { to: "ann@cname.sim", subject: "By CNAME", text: "Found you again." });
  await wait(() => box(mailbox, "ANN").some((l) => l.includes("|By CNAME|")), "the letter, by CNAME", 30000);
  assert.deepEqual([...mailbox.errors, ...postbox.errors], []);
});

// A raw SMTP conversation with port 25: each line waits for its answer.
async function smtp(host, lines) {
  const conn = await client.stack.connect(0, host, 25);
  const answers = [];
  let waiting;
  conn.onMessage((t) => { answers.push(t); waiting?.(); });
  const next = () => new Promise((r) => { waiting = r; });
  await next();
  for (const l of lines) { conn.send(l); await next(); }
  conn.close();
  return answers;
}

await test("MAILD: a domain in C:\\MAILDATA\\DOMAINS.TXT is taken at once; one whose MX is elsewhere is refused once looked up", async () => {
  mailbox.write("C:\\MAILDATA\\DOMAINS.TXT", "listed.sim\n");
  let a = await smtp("MAILBOX", ["HELO CLIENT", "MAIL FROM:<x@client>", "RCPT TO:<ann@listed.sim>", "QUIT"]);
  assert.match(a[3], /^250/, a.join(" / "));
  a = await smtp("MAILBOX", ["HELO CLIENT", "MAIL FROM:<x@client>", "RCPT TO:<bob@post.sim>", "QUIT"]);
  assert.match(a[3], /^451 Looking up post\.sim/, "not known yet: try again shortly");
  await wait(async () => /^551/.test((await smtp("MAILBOX", ["HELO CLIENT", "MAIL FROM:<x@client>", "RCPT TO:<bob@post.sim>", "QUIT"]))[3]), "post.sim looked up: not ours", 10000);
});

const fb = () => task(client, "FROSTBRD");
await test("Frostbird: ann@fun.sim collects her mail from fun.sim's MX, MAILBOX, and her reply to bob@post.sim goes by MX", async () => {
  assert.match(await install(client, "frostbird"), /Frostbird is installed/);
  await wait(() => fb() && client.widgets(fb(), "Window").some((w) => w.get("Title") === "Account Settings" && w.get("Visible")), "the account window", 30000);
  const w = client.widgets(fb(), "Window").find((x) => x.get("Title") === "Account Settings");
  const [address, password] = client.widgets(fb(), "TextBox").filter((x) => x.parent === w);
  address.set("Text", "ann@fun.sim");
  password.set("Text", "secret");
  client.widgets(fb(), "Button").find((b) => b.parent === w && b.get("Text") === "OK").call("Click");
  const main = () => client.widgets(fb(), "Window")[0];
  await wait(() => /new letters? from fun\.sim/.test(String(main().get("Status"))), "the mail: " + main().get("Status"), 20000);
  const letters = client.widgets(fb(), "ListBox")[1];
  assert.ok(letters.get("Items").some((l) => l.includes("By MX")), letters.get("Items").join(" / "));
  // a letter from Frostbird, through MAILBOX, to bob@post.sim (post.sim's MX is POSTBOX)
  const before = box(postbox, "BOB").length;
  const conn = await client.stack.connect(0, "MAILBOX", 110);
  const said = [];
  let waiting;
  conn.onMessage((t) => { said.push(t); waiting?.(); });
  const next = () => new Promise((r) => { waiting = r; });
  await next();
  for (const l of ["USER ann", "PASS secret", "SEND\nTo: bob@post.sim\nSubject: Back at you\n\nHi Bob.", "QUIT"]) { conn.send(l); await next(); }
  assert.equal(said[3], "+OK sent");
  await wait(() => box(postbox, "BOB").length > before && box(postbox, "BOB").some((l) => l.includes("|Back at you|")), "the reply, by MX", 30000);
  assert.match(mailLog(mailbox), /Sent ann@mailbox -> bob@post\.sim/);
  assert.deepEqual(client.errors, []);
});

// ---------------------------------------------------------------- the Sim Shell

function shell(m, pid) {
  const tb = () => m.widgets(pid, "TextBox")[0];
  const prompt = () => m.widgets(pid, "Label")[0].get("Text");
  const items = () => m.widgets(pid, "ListBox")[0].get("Items");
  const self = {
    prompt,
    async settle(ms = 40000) {
      let n = -1, same = 0; const end = Date.now() + ms;
      while (Date.now() < end) {
        await sleep(40);
        const idle = tb().get("Enabled") !== false || prompt().toLowerCase().includes("password");
        const c = items().length;
        if (idle && c === n) { if (++same >= 3) return; } else { same = 0; n = c; }
      }
    },
    async type(line) {
      await wait(() => tb().get("Enabled") !== false, "the prompt before: " + line);
      tb().set("Text", line);
      tb().fire("onEnter");
      await self.settle();
    },
    async run(line, pw) {
      const k = items().length;
      await self.type(line);
      if (pw) {
        await wait(() => prompt().toLowerCase().includes("password"), "the password prompt");
        tb().set("Text", pw);
        tb().fire("onEnter");
        await self.settle();
      }
      return items().slice(k).join("\n");
    },
  };
  return self;
}
let sh;

await test("Sim Shell: host asks the central name server, as DIG does", async () => {
  assert.match(await install(postbox, "simsh"), /Sim Shell is installed/);
  await wait(() => task(postbox, "SSHD"), "sshd on POSTBOX");
  assert.match(await install(client, "simsh"), /Sim Shell is installed/);
  await wait(() => task(client, "SIMSH"), "the shell window");
  sh = shell(client, task(client, "SIMSH"));
  let out = await sh.run("host shell.post.sim");
  assert.match(out, /; <<>> DiG 2\.1 for SIM95 \(SimDNS\) <<>> shell\.post\.sim A/);
  assert.match(out, /status: NOERROR, answers: 1/);
  assert.match(out, /shell\.post\.sim\. +300 +IN +CNAME +postbox/);
  assert.match(out, /;; postbox is a SIM95 machine name: 65\.16\.0\.\d+ \(asked SIM95, not SimDNS\)/);
  assert.match(out, /;; SERVER: starthere\.56k\.net \(65\.16\.0\.\d+\) port 53/);
  out = await sh.run("host fun.sim MX");
  assert.match(out, /fun\.sim\. +300 +IN +MX +10 mailbox/);
  out = await sh.run("nslookup nope.fun.sim");
  assert.match(out, /status: NXDOMAIN, answers: 0/);
});

await test("Sim Shell: ssh and scp to shell.post.sim, and sim-get from a store at a domain (Host: sent)", async () => {
  let out = await sh.run("ssh postbox@shell.post.sim whoami", "sekret");
  assert.match(out, /^postbox$/m, out);
  client.write("C:\\MYFILES\\NOTE.TXT", "from client");
  out = await sh.run("scp /myfiles/note.txt postbox@shell.post.sim:/myfiles/note.txt", "sekret");
  await wait(() => postbox.exists("C:\\MYFILES\\NOTE.TXT"), "the copy: " + out);
  assert.equal(postbox.read("C:\\MYFILES\\NOTE.TXT").trim(), "from client");
  out = await sh.run("sim-get store shop.fun.sim");
  assert.match(out, /Store: http:\/\/shop\.fun\.sim\/vapor\//);
  out = await sh.run("sim-get update");
  assert.match(out, /Get:1 http:\/\/shop\.fun\.sim\/vapor\/ catalog\.txt/);
  assert.match(out, /Reading package lists\.\.\. Done/);
  assert.match(await sh.run("sim-get search simweb"), /simweb - simweb/);
  assert.deepEqual(client.errors, []);
});

// ---------------------------------------------------------------- AskSim's crawler

const docs = () => (client.exists("C:\\ASKDATA\\DOCS.TXT") ? client.read("C:\\ASKDATA\\DOCS.TXT") : "");
const crawlLog = () => (client.widgets(task(client, "CRAWLER"), "ListBox")[0]?.get("Items") ?? []).join("\n");
const stats = () => (client.exists("C:\\ASKDATA\\STATS.TXT") ? client.read("C:\\ASKDATA\\STATS.TXT") : "");

await test("AskSim's crawler indexes www.fun.sim by its name, minds its robots.txt, and never twice by path", async () => {
  assert.match(await install(client, "asksim"), /AskSim is installed/);
  await wait(() => stats() !== "", "the first crawl", 120000);
  const urls = docs().split("\n").filter(Boolean).map((l) => l.split("|")[1]);
  for (const u of ["http://www.fun.sim/", "http://www.fun.sim/page2.htm", "http://www.fun.sim/movies.htm", "http://web/"]) assert.ok(urls.includes(u), u + " in " + urls.join(" "));
  assert.ok(!urls.some((u) => /^http:\/\/web\/www\.fun\.sim/.test(u)), "the path address is the same site: " + urls.filter((u) => u.includes("fun")).join(" "));
  assert.ok(!urls.some((u) => u.includes("/secret")), "kept out by www.fun.sim's own robots.txt");
  assert.match(crawlLog(), /www\.fun\.sim\/robots\.txt keeps me out of \/secret\//);
  assert.match(webLog(), /GET www\.fun\.sim\/robots\.txt/, "asked of the site, by name");
  const id = docs().split("\n").find((l) => l.split("|")[1] === "http://www.fun.sim/page2.htm").split("|")[0];
  assert.match(client.read("C:\\ASKDATA\\TEXT\\" + id + ".TXT"), /^Fun Page Two\nzebras/);
  assert.deepEqual(client.errors, []);
});

// ---------------------------------------------------------------- the name server down

await test("with the name server down, every program goes on with machine names, and nothing hangs", async () => {
  central.kernel.kill(task(central, "NAMED"));
  // SimPlayer: a new domain fails at once; the site by path plays
  let p = player(["http://nothere.fun.sim/welcome.smv"]);
  const t0 = Date.now();
  await wait(() => p.state() === "error", "the error: " + p.status(), 10000);
  assert.ok(Date.now() - t0 < 6000, "took " + (Date.now() - t0) + " ms");
  client.kernel.kill(p.pid);
  p = player(["http://web/www.fun.sim/welcome.smv"]);
  await wait(() => p.state() === "playing", "playing by path", 20000);
  client.kernel.kill(p.pid);
  // the Sim Shell: host says so; sim-get and ssh by machine name
  let out = await sh.run("host www.post.sim");
  assert.match(out, /connection to starthere\.56k\.net \(65\.16\.0\.\d+\) port 53 failed: Connection refused/);
  out = await sh.run("sim-get store web");
  out = await sh.run("sim-get update");
  assert.match(out, /Get:1 http:\/\/web\/vapor\/ catalog\.txt/);
  assert.match(await sh.run("ssh postbox@postbox whoami", "sekret"), /^postbox$/m);
  // MAILD: mail to a machine name
  await bob.post("/compose.asp", { to: "ann@mailbox", subject: "No DNS", text: "Still works." });
  await wait(() => box(mailbox, "ANN").some((l) => l.includes("|No DNS|")), "the letter by machine name", 30000);
  // Vapor: a store by machine name
  V.menu("Change Store...");
  await wait(() => client.widgets(V.pid(), "Window").some((w) => w.get("Title") === "Vapor Store"), "the store box");
  const sw = client.widgets(V.pid(), "Window").find((w) => w.get("Title") === "Vapor Store");
  client.widgets(V.pid(), "TextBox").find((t) => t.parent === sw).set("Text", "web");
  client.widgets(V.pid(), "Button").find((b) => b.parent === sw && String(b.get("Text")).replace("&", "") === "OK").call("Click");
  await wait(() => V.items().includes("- GAMES -") && client.read("C:\\GAMES\\VAPOR.INI").includes("http://web/vapor/"), "the store by machine name", 30000);
  // the crawler: a whole crawl, which finishes
  const before = stats();
  client.widgets(task(client, "CRAWLER"), "Button")[0].call("Click");
  await wait(() => stats() !== before, "the crawl to finish", 120000);
  assert.deepEqual(client.errors, []);
  assert.deepEqual(client.ui.dialogs.filter((d) => d.kind === "error"), []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
