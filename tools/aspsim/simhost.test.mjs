// End-to-end tests for SimHost (simhost/): every web app on one machine, each in
// a folder of its own, apps that were the home page moved into theirs, and
// Move In bringing another machine's data over its Files service.
//   node tools/aspsim/simhost.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser } from "./sim.mjs";
import { Network } from "./network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}
const ok = (r) => {
  assert.equal(r.status, "200 OK", r.url + " -> " + r.status + "\n" + r.body.slice(-400));
  assert.ok(!r.body.includes("ActiveSparkPages error"), r.url + ": " + r.body.slice(r.body.indexOf("ActiveSparkPages error"), r.body.indexOf("ActiveSparkPages error") + 300));
  return r;
};

const net = new Network();
const wait = (fn, what, ms = 20000) => net.until(fn, ms, what);
const proc = (m, name) => m.kernel.ps().find((p) => p.name === name)?.pid;
const installer = (app) => fs.readFileSync(path.join(root, app, "INSTALL.SPK"), "utf8");
async function install(m, app) {
  m.write("C:\\MYFILES\\INSTALL.SPK", installer(app));
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !m.running(pid) || /in Voyager/.test(m.output(pid)), app + "'s installer", 30000);
  assert.deepEqual(m.ui.dialogs, [], app + ": " + m.output(pid));
  return m.output(pid);
}
// Signing up on a SimBook, wherever it is.
async function joinBook(m, base, u, name) {
  const b = browser(m);
  const r = ok(await b.post(base + "join.asp", { name, u, pw: "secret", pw2: "secret" }));
  assert.match(r.url, /(home|edit)\.asp/, "could not join " + u + ": " + r.body.slice(0, 300));
  return b;
}

const host = await net.boot("HOST");

await test("web apps that were the home page move into folders when SimHost comes", async () => {
  // HOST has been a SimBook (with a member and a picture), then a ColdMail
  await install(host, "simbook");
  const ann = await joinBook(host, "/", "ann", "Ann Host");
  host.write("C:\\WEB\\PICS\\ANN.PIC", "picture of ann");
  await install(host, "coldmail");
  assert.match(host.read("C:\\WEB\\INDEX.ASP"), /MAIL\.SPK/, "ColdMail took the home page");

  const said = await install(host, "simhost");
  assert.equal(host.read("C:\\SYSTEM\\WEBAPPS.INI").trim(), "mode=folders");
  assert.match(said, /moved SimBook \(\d+ files\) into C:\\WEB\\BOOK: http:\/\/host\/book\//);
  assert.match(said, /moved ColdMail \(12 files\) into C:\\WEB\\MAIL/);
  assert.match(said, /SimBook is missing DELETE.ASP, INDEX.ASP, JOIN.ASP, LOGIN.ASP, LOGOUT.ASP \(another web app wrote over them\)/);
  assert.equal(host.read("C:\\WEB\\BOOK\\PICS\\ANN.PIC"), "picture of ann");
  assert.ok(host.exists("C:\\WEB\\MAIL\\DIST\\MANIFEST.TXT"));
  assert.ok(!host.exists("C:\\WEB\\BOOK.SPK") && !host.exists("C:\\WEB\\MAIL.SPK") && !host.exists("C:\\WEB\\PICS"));
  assert.ok(host.exists("C:\\PROGRAMS\\MOVEIN.SPK"));

  // SimBook again fills in what it lost, in its folder
  const again = await install(host, "simbook");
  assert.match(again, /Open http:\/\/host\/book\/ in Voyager/);
  assert.ok(host.exists("C:\\WEB\\BOOK\\INDEX.ASP") && host.exists("C:\\WEB\\BOOK\\LOGIN.ASP"));
  assert.ok(!host.exists("C:\\WEB\\BOOK.SPK"));

  // the home page is the list of them
  const home = ok(await browser(host).get("/"));
  assert.match(home.body, /<a href="\/book\/">.*SimBook/);
  assert.match(home.body, /<a href="\/mail\/">.*ColdMail/);
  assert.doesNotMatch(home.body, /AskSim/);
  assert.match(home.body, /The old home page/);

  // and both work from their folders, with what they had
  const b = browser(host);
  let r = ok(await b.post("/book/login.asp", { u: "ann", pw: "secret" }));
  assert.match(r.url, /home\.asp$/, r.body.slice(0, 300));
  r = ok(await b.get("/book/profile.asp?u=ann"));
  assert.match(r.body, /Ann Host/);
  r = ok(await b.get("/book/picture.asp"));
  assert.match(r.body, /<img src="pics\/ann.pic"/);
  assert.match(r.body, /SHRINK.SPK - /, "the program to copy is there");
  assert.equal((await b.get("/book/pics/ann.pic")).body, "picture of ann");
  void ann;
});

await test("ColdMail in its folder: sign up, send mail, and hand it on with GETMAIL", async () => {
  await wait(() => proc(host, "MAILD"), "the mail server");
  const b = browser(host);
  let r = ok(await b.post("/mail/join.asp", { name: "Bob", u: "bob", pw: "secret", pw2: "secret" }));
  assert.match(r.url, /inbox\.asp$/, r.body.slice(0, 300));
  const t = /name="t" value="([0-9A-F]+)"/.exec(ok(await b.get("/mail/compose.asp")).body)[1];
  ok(await b.post("/mail/compose.asp", { t, to: "bob@host", subject: "Note to self", text: "One machine now." }));
  await wait(() => host.exists("C:\\MAILDATA\\BOX\\BOB\\INBOX.TXT") && /Note to self/.test(host.read("C:\\MAILDATA\\BOX\\BOB\\INBOX.TXT")), "the letter", 20000);
  r = ok(await b.get("/mail/host.asp"));
  assert.match(r.body, /CONST BASE = &quot;\/mail\/&quot;/);
  // another machine copies ColdMail from HOST's folder
  const decode = (x) => x.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const guest = await net.boot("GUEST");
  host.run("C:\\PROGRAMS\\HTTPD.SPK");
  guest.write("C:\\MYFILES\\GETMAIL.SPK", decode(r.body.slice(r.body.indexOf("readonly>") + 9, r.body.indexOf("</textarea>"))));
  const pid = guest.run("C:\\MYFILES\\GETMAIL.SPK");
  await wait(() => !guest.running(pid) || /Voyager/.test(guest.output(pid)), "GETMAIL", 30000);
  assert.match(guest.output(pid), /ColdMail is installed \(14 files\)/, guest.output(pid));
  assert.equal(guest.read("C:\\WEB\\MAIL.SPK"), host.read("C:\\WEB\\MAIL\\MAIL.SPK"));
});

await test("SimBook e-mails a password reset link through ColdMail on the same machine", async () => {
  // Ann (SimBook, in /book/) gives her ColdMail address, bob@host, and forgets her password
  const ann = browser(host);
  ok(await ann.post("/book/login.asp", { u: "ann", pw: "secret" }));
  const t = /name="t" value="([0-9A-F]+)"/.exec(ok(await ann.get("/book/edit.asp")).body)[1];
  ok(await ann.post("/book/edit.asp", { t, name: "Ann Host", email: "bob@host" }));
  assert.match(host.read("C:\\BOOKDATA\\USERS\\ANN.TXT"), /^email=bob@host$/m);
  const r = ok(await browser(host).post("/book/reset.asp", { do: "mail", u: "ann" }));
  assert.match(r.body, /a link to reset the password is on its way/);
  const box = "C:\\MAILDATA\\BOX\\BOB";
  await wait(() => /Your SimBook password/.test(host.read(box + "\\INBOX.TXT")), "the reset letter in bob's inbox", 30000);
  const n = host.read(box + "\\INBOX.TXT").trim().split("\n").find((l) => l.includes("Your SimBook password")).split("|")[0];
  const letter = host.read(box + "\\" + n + ".MSG");
  assert.match(letter, /^From: SimBook <simbook@host>/m);
  const link = /http:\/\/host(\/book\/reset\.asp\?k=[0-9A-F]{24})/.exec(letter)[1];
  assert.match(ok(await browser(host).get(link)).body, /Pick a New Password for ann/);
  ok(await browser(host).post("/book/reset.asp", { k: link.split("=")[1], pw: "mailed1", pw2: "mailed1" }));
  assert.match(ok(await browser(host).post("/book/login.asp", { u: "ann", pw: "mailed1" })).url, /home\.asp$/);
  // back as it was, for the tests after this one
  const desk = browser(host);
  if (!host.exists("C:\\SYSTEM\\USERS.INI")) host.write("C:\\SYSTEM\\USERS.INI", "name=dab\npassword=hostpw\n");
  const users = host.read("C:\\SYSTEM\\USERS.INI");
  ok(await desk.post("/book/reset.asp", { u: "ann", pw: "secret", pw2: "secret", owner: /name=(.*)/i.exec(users)[1].trim(), opw: /password=(.*)/i.exec(users)[1] }));
  assert.match(ok(await browser(host).post("/book/login.asp", { u: "ann", pw: "secret" })).url, /home\.asp$/, "the owner's reset");
});

await test("AskSim and ELIZA-95 install straight into their folders", async () => {
  const ask = await install(host, "asksim");
  assert.match(ask, /Open http:\/\/host\/ask\/ in Voyager/);
  await install(host, "eliza");
  assert.ok(host.exists("C:\\WEB\\ASK\\ASK.SPK") && host.exists("C:\\WEB\\ELIZA\\BOT.SPK"));
  assert.ok(!host.exists("C:\\WEB\\ASK.SPK") && !host.exists("C:\\WEB\\BOT.SPK"));
  assert.match(host.read("C:\\WEB\\INDEX.ASP"), /SimHost's front door/, "the home page stays the list");
  const home = ok(await browser(host).get("/"));
  for (const f of ["book", "mail", "ask", "eliza"]) assert.match(home.body, new RegExp(`<a href="/${f}/">`));
  assert.match(home.body, /4 web apps on one computer/);
  ok(await browser(host).get("/ask/index.asp?q=hello"));
  ok(await browser(host).get("/eliza/"));
});

await test("Simxplorer finds the search engine and the mail in their folders", async () => {
  await install(host, "simxplorer");
  const pid = proc(host, "SIMXPLOR");
  if (pid) host.kernel.kill(pid);
  const ini = host.read("C:\\SYSTEM\\SIMXPLOR.INI");
  assert.match(ini, /search=http:\/\/host\/ask\/index.asp\?q=%s/);
  assert.match(ini, /mail=http:\/\/host\/mail\//);
});

await test("Move In copies another machine's data over its Files service", async () => {
  const old = await net.boot("OLDBOOK");
  await install(old, "simbook");
  await joinBook(old, "/", "cat", "Cat Old");
  old.write("C:\\WEB\\PHOTOS\\CAT1.PIC", "a photo");
  old.write("C:\\SYSTEM\\FAVORITE.TXT", "Cat's page|http://oldbook/\nAsk|http://host/ask/\n");
  old.mkdir("C:\\GAMES");
  old.mkdir("C:\\GAMES\\SNAKE");
  old.write("C:\\GAMES\\SNAKE\\BEST.TXT", "120");
  host.write("C:\\SYSTEM\\FAVORITE.TXT", "Ask|http://host/ask/\n");
  if (!old.exists("C:\\SYSTEM\\USERS.INI")) old.write("C:\\SYSTEM\\USERS.INI", "name=cat\npassword=meow\n");
  const users = old.read("C:\\SYSTEM\\USERS.INI");
  const user = /name=(.*)/i.exec(users)[1].trim();
  const pass = /password=(.*)/i.exec(users)[1];
  if (!proc(old, "FILESVC")) old.run("C:\\PROGRAMS\\FILESVC.SPK");
  await wait(() => proc(old, "FILESVC"), "the Files service on OLDBOOK");

  const pid = host.run("C:\\PROGRAMS\\MOVEIN.SPK");
  await wait(() => host.widgets(pid, "Button").length, "Move In's window");
  const boxes = host.widgets(pid, "TextBox");
  boxes[0].set("Text", "oldbook");
  boxes[1].set("Text", user);
  boxes[2].set("Text", "wrong");
  const log = () => host.widgets(pid, "ListBox")[0].get("Items").join("\n");
  host.ui.answers = [true, true, true, true, true, true, true];
  host.button(pid, "Move In").call("Click");
  await wait(() => /did not take that user name and password/.test(log()), "the refusal: " + log());
  boxes[2].set("Text", pass);
  host.button(pid, "Move In").call("Click");
  await wait(() => /^Done:/m.test(log()), "Move In to finish: " + log(), 60000);
  const asked = host.ui.dialogs.splice(0).map((d) => d.text).join("\n");
  assert.match(asked, /already has SimBook data in C:\\BOOKDATA/);
  assert.match(asked, /already has Favorites data/);
  assert.doesNotMatch(asked, /Frostbird/, "no Frostbird letters here: nothing to ask");

  // SimBook: Cat's account, Ann's still there, both in the people list
  assert.match(host.read("C:\\BOOKDATA\\PEOPLE.TXT"), /^ann\|/m);
  assert.match(host.read("C:\\BOOKDATA\\PEOPLE.TXT"), /^cat\|/m);
  assert.equal(host.read("C:\\WEB\\BOOK\\PHOTOS\\CAT1.PIC"), "a photo");
  const b = browser(host);
  const r = ok(await b.post("/book/login.asp", { u: "cat", pw: "secret" }));
  assert.match(r.url, /home\.asp$/, r.body.slice(0, 300));
  // favorites joined, without doubles; saves copied
  assert.equal(host.read("C:\\SYSTEM\\FAVORITE.TXT"), "Ask|http://host/ask/\nCat's page|http://oldbook/\n");
  assert.equal(host.read("C:\\GAMES\\SNAKE\\BEST.TXT"), "120");
  assert.match(log(), /has no C:\\MAILDATA/);
  assert.match(log(), /Nothing on oldbook was changed|Nothing on OLDBOOK was changed/);
  assert.ok(old.exists("C:\\BOOKDATA\\PEOPLE.TXT"), "the old machine keeps its data");
  assert.deepEqual(host.errors, []);
});

await test("Move In onto a new SimHost before SimBook is there, then SimBook finds it all", async () => {
  const fresh = await net.boot("FRESH");
  await install(fresh, "simhost");
  assert.ok(!fresh.exists("C:\\WEB\\BOOK"));
  const old = net.machines.find((m) => m.stack.hostname() === "OLDBOOK") || (await net.boot("OLDBOOK"));
  const users = old.read("C:\\SYSTEM\\USERS.INI");
  const pid = fresh.run("C:\\PROGRAMS\\MOVEIN.SPK");
  await wait(() => fresh.widgets(pid, "Button").length, "Move In's window");
  const boxes = fresh.widgets(pid, "TextBox");
  boxes[0].set("Text", "oldbook");
  boxes[1].set("Text", /name=(.*)/i.exec(users)[1].trim());
  boxes[2].set("Text", /password=(.*)/i.exec(users)[1]);
  const log = () => fresh.widgets(pid, "ListBox")[0].get("Items").join("\n");
  fresh.button(pid, "Move In").call("Click");
  await wait(() => /^(Done|Stopped)/m.test(log()), "Move In to finish: " + log(), 60000);
  assert.match(log(), /^Done:/m, log());
  assert.equal(fresh.read("C:\\WEB\\BOOK\\PHOTOS\\CAT1.PIC"), "a photo");
  assert.deepEqual(fresh.ui.dialogs, [], "nothing here yet: nothing to ask");
  // SimBook installs around them
  await install(fresh, "simbook");
  assert.equal(fresh.read("C:\\WEB\\BOOK\\PHOTOS\\CAT1.PIC"), "a photo");
  const r = ok(await browser(fresh).post("/book/login.asp", { u: "cat", pw: "secret" }));
  assert.match(r.url, /home\.asp$/, r.body.slice(0, 300));
});

await test("Vapor knows web apps live in folders here", async () => {
  // a Vapor library line for SimBook with its folder: Open goes to /book/
  host.write("C:\\MYFILES\\VINST.SPK", installer("vapor"));
  const ipid = host.run("C:\\MYFILES\\VINST.SPK");
  await wait(() => !host.running(ipid) || /store/.test(host.output(ipid)), "Vapor's installer", 30000);
  await wait(() => proc(host, "VAPOR") && host.widgets(proc(host, "VAPOR"), "Canvas").length, "Vapor");
  if (!host.exists("C:\\GAMES")) host.mkdir("C:\\GAMES");
  host.write("C:\\GAMES\\LIBRARY.TXT", "SIMBOOK|SimBook|1996-01-01|0|Social|about|abc|web|/|C:\\WEB\\BOOK.SPK;C:\\WEB\\INDEX.ASP|||BOOK\n");
  const v = proc(host, "VAPOR");
  const head = host.widgets(v, "Canvas")[0];
  head.set("Tag", "");
  head.fire("onMouseDown", 300, 20, 1);
  await wait(() => head.get("Tag") === "LIBRARY", "the library");
  const list = host.widgets(v, "ListBox")[0];
  await wait(() => list.get("Items").some((i) => i.trim().startsWith("SimBook")), "SimBook in the library");
  list.set("Selected", list.get("Items").findIndex((i) => i.trim().startsWith("SimBook")));
  list.fire("onSelect");
  await wait(() => host.button(v, "Open"), "the Open button");
  host.button(v, "Open").call("Click");
  await wait(() => /Opened http:\/\/host\/book\//.test(host.widgets(v, "Window")[0].get("Status")), "Vapor to open /book/: " + host.widgets(v, "Window")[0].get("Status"));
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
