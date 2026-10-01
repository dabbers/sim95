// End-to-end tests for ColdMail: the mail server (coldmail/PROGRAMS/MAILD.SPK)
// and the webmail (coldmail/WEB), on two machines of a pretend network.
//   node tools/aspsim/coldmail.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser as rawBrowser, page, MESSAGE_LIMIT } from "./sim.mjs";
import { Network } from "./network.mjs";
import { withResolver } from "../simxplorer-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + (e.message || e) + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}
const ok = (r) => {
  assert.equal(r.status, "200 OK", r.url + " -> " + r.status + "\n" + r.body.slice(-400));
  assert.ok(!r.body.includes("ActiveSparkPages error"), r.url + ": " + r.body.slice(r.body.indexOf("ActiveSparkPages error"), r.body.indexOf("ActiveSparkPages error") + 300));
  return r;
};

// A visitor using ColdMail's own pages, whose forms carry the form token.
function browser(m) {
  const b = rawBrowser(m);
  const { post, get } = b;
  b.token = async () => (/name="t" value="([0-9A-F]+)"/.exec((await m.request("GET", "/compose.asp", { cookies: b.cookies() })).body) || [])[1] ?? "";
  b.post = async (url, form) => post(url, form && !("t" in form) ? { ...form, t: await b.token() } : form);
  b.get = async (url) => (/^\/logout\.asp$/.test(url) ? get(url + "?t=" + (await b.token())) : get(url));
  return b;
}

const net = new Network();
const installer = fs.readFileSync(path.join(root, "coldmail/INSTALL.SPK"), "utf8");
async function install(m) {
  if (!m.exists("C:\\MAILDATA")) m.mkdir("C:\\MAILDATA");
  m.write("C:\\MAILDATA\\MAILD.INI", "retry=1\ntries=2");
  m.write("C:\\MYFILES\\INSTALL.SPK", installer);
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await net.until(() => !m.running(pid), 20000, "the installer");
  await net.until(() => maild(m) && m.widgets(maild(m), "ListBox")[0]?.items.length > 0, 10000, "the mail server");
  return m.output(pid);
}
const maild = (m) => m.kernel.ps().find((p) => p.name === "MAILD")?.pid;
const serverLog = (m) => {
  if (!maild(m)) throw new Error("no mail server running on " + m.stack.hostname() + ": " + JSON.stringify(m.ui.dialogs) + " " + m.errors.join("; "));
  return m.widgets(maild(m), "ListBox")[0].get("Items").join("\n");
};
async function join(m, u, name, pw = "secret") {
  const b = browser(m);
  const r = ok(await b.post("/join.asp", { name, u, pw, pw2: pw }));
  assert.equal(r.url, "/inbox.asp", "could not sign up " + u);
  return b;
}
const inbox = (m, u) => (m.exists(`C:\\MAILDATA\\BOX\\${u.toUpperCase()}\\INBOX.TXT`) ? m.read(`C:\\MAILDATA\\BOX\\${u.toUpperCase()}\\INBOX.TXT`).trim().split("\n").filter(Boolean) : []);
const arrives = (m, u, subject) => net.until(() => inbox(m, u).some((l) => l.split("|")[4] === subject), 15000, `"${subject}" for ${u}`);
const numberOf = (m, u, subject) => inbox(m, u).find((l) => l.split("|")[4] === subject).split("|")[0];

const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");

await test("the installer writes the pages and the server, starts it, and adds it to startup", async () => {
  const said = await install(alpha);
  await install(bravo);
  assert.match(said, /ColdMail is installed \(14 files\)/);
  assert.match(said, /started C:\\PROGRAMS\\MAILD.SPK/);
  for (const f of fs.readdirSync(path.join(root, "coldmail/WEB"))) assert.equal(alpha.read("C:\\WEB\\" + f.toUpperCase()), fs.readFileSync(path.join(root, "coldmail/WEB", f), "utf8"), f);
  assert.equal(alpha.read("C:\\SYSTEM\\STARTUP\\MAIL.RUN"), "C:\\PROGRAMS\\MAILD.SPK");
  assert.match(serverLog(alpha), /Listening on port 25 as ALPHA/);
});

await test("running the installer again restarts the server instead of starting a second one", async () => {
  const before = maild(alpha);
  const said = await install(alpha);
  assert.match(said, /stopped the old MAILD/);
  assert.notEqual(maild(alpha), before);
  assert.equal(alpha.kernel.ps().filter((p) => p.name === "MAILD").length, 1);
  assert.deepEqual(alpha.ui.dialogs, []);
});

let ann, bob, cat;
await test("signing up gives you an address and a welcome letter", async () => {
  ann = await join(alpha, "ann", "Ann Alpha");
  cat = await join(alpha, "cat", "Cat Alpha");
  bob = await join(bravo, "bob", "Bob Bravo");
  const r = ok(await ann.get("/inbox.asp"));
  assert.match(r.body, /ann@alpha/);
  assert.match(r.body, /Inbox \(1\)/);
  assert.match(r.body, /<b>Welcome to ColdMail!<\/b>/);
  const bad = ok(await rawBrowser(alpha).post("/join.asp", { name: "X", u: "ann", pw: "pppp", pw2: "pppp" }));
  assert.match(bad.body, /Somebody already has ann@alpha/);
});

await test("a letter crosses the network to another machine's mail server", async () => {
  let r = ok(await ann.post("/compose.asp", { to: "bob@bravo", subject: "Hello from Alpha", text: "Hi Bob,\n<b>how</b> are you?" }));
  assert.equal(r.url.split("?")[0], "/inbox.asp");
  assert.match(r.body, /Your letter is on its way/);
  await arrives(bravo, "bob", "Hello from Alpha");
  r = ok(await bob.get("/inbox.asp"));
  assert.match(r.body, /<b>Ann Alpha<\/b>/);
  const n = numberOf(bravo, "bob", "Hello from Alpha");
  r = ok(await bob.get(`/read.asp?n=${n}`));
  assert.match(r.body, /Ann Alpha &lt;ann@alpha&gt;/);
  assert.match(r.body, /&lt;b&gt;how&lt;\/b&gt; are you\?/);
  assert.match(r.body, /Received:.*from ALPHA \(65\.16\.0\.\d+\) by bravo/);
  assert.ok(!inbox(bravo, "bob").find((l) => l.startsWith(n + "|")).endsWith("|N"), "reading marks it read");
  assert.match(ok(await ann.get("/inbox.asp?f=sent")).body, /To: bob@bravo/);
  assert.match(serverLog(alpha), /Sent ann@alpha -> bob@bravo/);
  assert.match(serverLog(bravo), /Received mail from ann@alpha/);
});

await test("reply starts from the letter, quoted, and goes back to the sender", async () => {
  const n = numberOf(bravo, "bob", "Hello from Alpha");
  let r = ok(await bob.get(`/compose.asp?reply=${n}&f=inbox`));
  assert.match(r.body, /name="to" size="50" maxlength="400" value="ann@alpha"/);
  assert.match(r.body, /value="Re: Hello from Alpha"/);
  assert.match(r.body, /Ann Alpha wrote:\n&gt; Hi Bob,/);
  ok(await bob.post("/compose.asp", { to: "ann@alpha", subject: "Re: Hello from Alpha", text: "Fine thanks!" }));
  await arrives(alpha, "ann", "Re: Hello from Alpha");
  r = ok(await ann.get(`/compose.asp?fwd=${numberOf(alpha, "ann", "Re: Hello from Alpha")}`));
  assert.match(r.body, /value="Fwd: Re: Hello from Alpha"/);
  assert.match(r.body, /----- Forwarded letter -----\nFrom: Bob Bravo &lt;bob@bravo&gt;/);
});

await test("several recipients, on this machine and that one, by full or short address", async () => {
  ok(await ann.post("/compose.asp", { to: "bob@bravo, cat; Cat Alpha <cat@alpha>", subject: "Party", text: "Saturday!" }));
  await arrives(bravo, "bob", "Party");
  await arrives(alpha, "cat", "Party");
  assert.equal(inbox(alpha, "cat").filter((l) => l.split("|")[4] === "Party").length, 1, "cat only once");
  const letter = alpha.read(`C:\\MAILDATA\\BOX\\CAT\\${numberOf(alpha, "cat", "Party")}.MSG`);
  assert.match(letter, /^Received: by alpha; .*\nFrom: Ann Alpha <ann@alpha>\nTo: bob@bravo, cat@alpha\nSubject: Party\n/);
});

await test("mail to nobody, or nowhere, comes back from MAILER-DAEMON", async () => {
  ok(await ann.post("/compose.asp", { to: "nobody@bravo", subject: "Anyone?", text: "Hello?" }));
  ok(await ann.post("/compose.asp", { to: "zed@nowhere", subject: "Lost", text: "Hello?" }));
  ok(await ann.post("/compose.asp", { to: "ghost", subject: "Local ghost", text: "Boo" }));
  for (const s of ["Undeliverable: Anyone?", "Undeliverable: Lost", "Undeliverable: Local ghost"]) await arrives(alpha, "ann", s);
  let r = ok(await ann.get(`/read.asp?n=${numberOf(alpha, "ann", "Undeliverable: Anyone?")}`));
  assert.match(r.body, /Mail Delivery Subsystem &lt;mailer-daemon@alpha&gt;/);
  assert.match(r.body, /nobody@bravo\n    550 No such user here: nobody/);
  assert.match(r.body, /------ This is a copy of your message ------/);
  r = ok(await ann.get(`/read.asp?n=${numberOf(alpha, "ann", "Undeliverable: Lost")}`));
  assert.match(r.body, /Gave up after 2 tries: 421 Unknown host: nowhere/);
  assert.match(serverLog(alpha), /Will try zed@nowhere again/);
});

await test("letters wait in the outbox while the server is down, and go when it is back", async () => {
  alpha.kernel.kill(maild(alpha));
  alpha.write("C:\\MAILDATA\\ALIVE.TXT", "0");
  let r = ok(await ann.post("/compose.asp", { to: "bob@bravo", subject: "Patience", text: "..." }));
  assert.match(r.body, /The mail server is not running/);
  assert.match(r.body, /outbox \(1 now\)/);
  await new Promise((res) => setTimeout(res, 500));
  assert.ok(!inbox(bravo, "bob").some((l) => l.includes("|Patience|")));
  alpha.run("C:\\PROGRAMS\\MAILD.SPK");
  await arrives(bravo, "bob", "Patience");
  assert.ok(!ok(await ann.get("/inbox.asp")).body.includes("not running"));
});

await test("compose refuses bad addresses and long letters, and counts as you type", async () => {
  let r = ok(await ann.post("/compose.asp", { to: "bob@bra vo", subject: "x", text: "x" }));
  assert.match(r.body, /'bob@bra vo' is not an address/);
  assert.match(r.body, /value="bob@bra vo"/, "what you typed is kept");
  r = ok(await ann.post("/compose.asp", { to: "", subject: "x", text: "x" }));
  assert.match(r.body, /Who is it to\?/);
  r = ok(await ann.post("/compose.asp", { to: "bob@bravo", subject: "x", text: "y".repeat(8001) }));
  assert.match(r.body, /under 8000 characters/);
  const p = await page(ok(await ann.get("/compose.asp")).body);
  await p.type("text", "z".repeat(8001));
  assert.equal(p.el("go").Enabled, false);
  assert.equal(p.el("text_n").Text, "1 characters too many");
  await p.type("text", "hi");
  assert.equal(p.el("go").Enabled, true);
});

await test("deleting ticked letters, from the Inbox and from a letter", async () => {
  const before = inbox(alpha, "ann").length;
  const a = numberOf(alpha, "ann", "Undeliverable: Lost"), b = numberOf(alpha, "ann", "Undeliverable: Local ghost");
  let r = ok(await ann.post("/delete.asp", { f: "inbox", ["d" + a]: "on", ["d" + b]: "on" }));
  assert.match(r.body, /2 letters deleted/);
  assert.equal(inbox(alpha, "ann").length, before - 2);
  assert.ok(!alpha.exists(`C:\\MAILDATA\\BOX\\ANN\\${a}.MSG`));
  r = ok(await ann.post("/delete.asp", { f: "inbox", ["d" + numberOf(alpha, "ann", "Undeliverable: Anyone?")]: "1" }));
  assert.match(r.body, /1 letter deleted/);
});

await test("other sites cannot send or delete in your name", async () => {
  const before = alpha.disk.snapshot().files;
  const cookies = ann.cookies();
  for (const [url, form] of [["/compose.asp", { to: "bob@bravo", subject: "forged", text: "x" }], ["/delete.asp", { f: "inbox", d1: "on" }]]) {
    const r = await alpha.request("POST", url, { body: new URLSearchParams(form).toString(), cookies });
    assert.equal(r.status, "302 Found");
    assert.ok(r.headers.some((h) => h.startsWith("Location: inbox.asp?why=That+did+not+come")), url);
  }
  const after = alpha.disk.snapshot().files;
  for (const k of Object.keys(after)) if (!k.endsWith("ALIVE.TXT")) assert.equal(after[k], before[k], k);
});

await test("the mail server speaks SMTP to anyone who connects", async () => {
  const conn = await bravo.stack.connect(0, "ALPHA", 25);
  const said = [];
  conn.onMessage((t) => said.push(t));
  const ask = async (line) => { const n = said.length; conn.send(line); await net.until(() => said.length > n, 3000, line); return said[said.length - 1]; };
  await net.until(() => said.length > 0, 3000, "greeting");
  assert.match(said[0], /^220 ALPHA ColdMail ready/);
  assert.match(await ask("DATA\nhi"), /^503 RCPT TO first/);
  assert.match(await ask("HELO BRAVO"), /^250 Hello BRAVO/);
  assert.match(await ask("RCPT TO:<ann@alpha>"), /^503 MAIL FROM first/);
  assert.match(await ask("MAIL FROM:<mallory@bravo>"), /^250/);
  assert.match(await ask("RCPT TO:<..\\..\\SYSTEM@alpha>"), /^550/);
  assert.match(await ask("RCPT TO:<ann@elsewhere>"), /^551 I only take mail for alpha/);
  assert.match(await ask("RCPT TO:<ann@alpha>"), /^250/);
  assert.match(await ask("DATA\nFrom: mallory@bravo\nSubject: by hand\n\nTyped it myself."), /^250 OK delivered/);
  assert.match(await ask("WHAT"), /^500/);
  assert.match(await ask("QUIT"), /^221 Bye/);
  await arrives(alpha, "ann", "by hand");
});

await test("letters for dead machines don't hold up the rest, and nothing crashes", async () => {
  for (const host of ["gone1", "gone2", "gone3"]) ok(await ann.post("/compose.asp", { to: "zed@" + host, subject: "Into the void " + host, text: "?" }));
  ok(await ann.post("/compose.asp", { to: "bob@bravo", subject: "Behind the void", text: "!" }));
  await arrives(bravo, "bob", "Behind the void");
  for (const host of ["gone1", "gone2", "gone3"]) await arrives(alpha, "ann", "Undeliverable: Into the void " + host);
  assert.deepEqual(alpha.ui.dialogs, [], "no runtime errors");
  assert.ok(alpha.running(maild(alpha)));
});

await test("the front page offers to host ColdMail, and says whether the server runs", async () => {
  const r = ok(await rawBrowser(alpha).get("/"));
  assert.match(r.body, /<a href="host.asp"><b>Host ColdMail on your machine<\/b><\/a>/);
  assert.match(r.body, /Mail server on alpha:\s*<font color="#008000"><b>running<\/b>/);
  const h = ok(await rawBrowser(alpha).get("/host.asp"));
  assert.match(h.body, /CONST FROM = &quot;alpha&quot;/);
  assert.match(h.body, /is <b><font color="#008000">running<\/font><\/b>, port 25/);
  const go = await alpha.request("GET", "/host.asp?go=Charlie");
  assert.ok(go.headers.includes("Location: http://charlie/"));
  assert.equal((await alpha.request("GET", "/host.asp?go=" + encodeURIComponent("evil/path?x"))).status, "200 OK");
});

// The program in host.asp's text box, the way a visitor copies it out
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
async function bootstrapFrom(m) {
  const body = (await m.request("GET", "/host.asp")).body;
  return decode(body.slice(body.indexOf("readonly>") + 9, body.indexOf("</textarea>")));
}

await test("GETMAIL.SPK copies ColdMail onto another machine, which can then mail back", async () => {
  const charlie = await net.boot("CHARLIE");
  charlie.run("C:\\PROGRAMS\\HTTPD.SPK");
  charlie.write("C:\\MYFILES\\GETMAIL.SPK", await bootstrapFrom(alpha));
  alpha.run("C:\\PROGRAMS\\HTTPD.SPK");
  const pid = charlie.run("C:\\MYFILES\\GETMAIL.SPK");
  await net.until(() => !charlie.running(pid), 30000, "GETMAIL");
  const said = charlie.output(pid);
  assert.match(said, /ColdMail is installed \(14 files\) and your mail server is running/, said + JSON.stringify(charlie.ui.dialogs));
  for (const f of fs.readdirSync(path.join(root, "coldmail/WEB"))) assert.equal(charlie.read("C:\\WEB\\" + f.toUpperCase()), fs.readFileSync(path.join(root, "coldmail/WEB", f), "utf8"), f);
  assert.equal(charlie.read("C:\\PROGRAMS\\MAILD.SPK"), withResolver(fs.readFileSync(path.join(root, "coldmail/PROGRAMS/MAILD.SPK"), "utf8")), "with the SimDNS resolver joined on");
  assert.equal(charlie.read("C:\\SYSTEM\\STARTUP\\MAIL.RUN"), "C:\\PROGRAMS\\MAILD.SPK");
  await net.until(() => maild(charlie), 10000, "charlie's mail server");
  const dee = await join(charlie, "dee", "Dee Charlie");
  ok(await dee.post("/compose.asp", { to: "ann@alpha", subject: "Hello from Charlie", text: "I host my own now." }));
  await arrives(alpha, "ann", "Hello from Charlie");

  // ...and Charlie can hand it on in turn
  const delta = await net.boot("DELTA");
  delta.write("C:\\MYFILES\\GETMAIL.SPK", await bootstrapFrom(charlie));
  assert.match(delta.read("C:\\MYFILES\\GETMAIL.SPK"), /CONST FROM = "charlie"/);
  const p2 = delta.run("C:\\MYFILES\\GETMAIL.SPK");
  await net.until(() => !delta.running(p2), 30000, "GETMAIL from charlie");
  assert.match(delta.output(p2), /ColdMail is installed \(14 files\)/);
  assert.deepEqual([...charlie.ui.dialogs, ...delta.ui.dialogs], []);
});

await test("GETMAIL says so when the machine it comes from isn't there", async () => {
  const echo = await net.boot("ECHO");
  echo.write("C:\\MYFILES\\GETMAIL.SPK", (await bootstrapFrom(alpha)).replace('CONST FROM = "alpha"', 'CONST FROM = "nowhere"'));
  const pid = echo.run("C:\\MYFILES\\GETMAIL.SPK");
  await net.until(() => !echo.running(pid), 30000, "GETMAIL");
  assert.match(echo.output(pid), /Could not reach nowhere: Unknown host/);
  assert.ok(!echo.exists("C:\\WEB\\MAIL.SPK"));
});

await test("MAILPASS.SPK gives an account a new password: webmail and the mail server take it", async () => {
  assert.ok(alpha.exists("C:\\PROGRAMS\\MAILPASS.SPK"));
  const src = alpha.read("C:\\PROGRAMS\\MAILPASS.SPK");
  const signedIn = browser(alpha);
  ok(await signedIn.post("/login.asp", { u: "ann", pw: "secret" }));
  assert.equal(ok(await signedIn.get("/inbox.asp")).url, "/inbox.asp");
  let said = (await alpha.runScript(src, { input: ["nobody", "x", "x"] })).join("\n");
  assert.match(said, /There is no account called 'nobody' here/);
  said = (await alpha.runScript(src, { input: ["ann@alpha", "newpw1", "typo"] })).join("\n");
  assert.match(said, /The two passwords are different. Nothing was changed/);
  said = (await alpha.runScript(src, { input: ["ann@alpha", "newpw1", "newpw1"] })).join("\n");
  assert.match(said, /ann@alpha/);
  assert.match(said, /This is your new password for ColdMail: newpw1/);
  assert.match(said, /signed out of the webmail in \d+ place/);
  assert.match(alpha.read("C:\\MAILDATA\\USERS\\ANN.TXT"), /^name=/m, "the rest of the account is kept");
  assert.notEqual(ok(await signedIn.get("/inbox.asp")).url, "/inbox.asp", "signed out");
  assert.notEqual(ok(await browser(alpha).post("/login.asp", { u: "ann", pw: "secret" })).url, "/inbox.asp");
  assert.equal(ok(await browser(alpha).post("/login.asp", { u: "ann", pw: "newpw1" })).url, "/inbox.asp");
  // the mail server (what Frostbird talks to) takes it too
  const pop = async (pw) => {
    const conn = await alpha.stack.connect(0, "ALPHA", 110);
    const got = [];
    conn.onMessage((t) => got.push(t));
    const step = async (line) => { const n = got.length; conn.send(line); await net.until(() => got.length > n, 5000, line); return got[got.length - 1]; };
    await net.until(() => got.length > 0, 5000, "the greeting");
    await step("USER ann");
    const answer = await step("PASS " + pw);
    conn.close?.();
    return answer;
  };
  assert.match(await pop("newpw1"), /^\+OK/);
  assert.match(await pop("secret"), /^-ERR/);
  // put it back for the tests after this one
  await alpha.runScript(src, { input: ["ann", "secret", "secret"] });
});

await test("long folders and long letters still fit on one page", async () => {
  const dir = "C:\\MAILDATA\\BOX\\CAT";
  const lines = [];
  for (let i = 100; i < 260; i++) lines.push(`${i}|1996-07-04 12:00|${"<".repeat(100)} <x@y>|cat@alpha|${"<".repeat(100)}|60000|N`);
  alpha.write(dir + "\\INBOX.TXT", lines.join("\n") + "\n");
  alpha.write(dir + "\\259.MSG", "From: x@y\nSubject: big\n\n" + "<".repeat(60000));
  for (const url of ["/inbox.asp", "/read.asp?n=259", "/compose.asp?reply=259"]) {
    const r = ok(await cat.get(url));
    assert.ok(r.raw.length < MESSAGE_LIMIT - 8000, `${url} is ${r.raw.length}`);
  }
  assert.match(ok(await cat.get("/read.asp?n=259")).body, /ColdMail stopped here/);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
