// End-to-end tests for Frostbird (frostbird/PROGRAMS/FROSTBRD.SPK), the mail
// program, and the port-110 side of ColdMail's server it talks to.
// ALPHA and BRAVO run ColdMail; Frostbird runs on CHARLIE, reading ann@alpha.
//   node tools/aspsim/frostbird.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser as rawBrowser } from "./sim.mjs";
import { Network } from "./network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}

function browser(m) {
  const b = rawBrowser(m);
  const { post } = b;
  b.token = async () => (/name="t" value="([0-9A-F]+)"/.exec((await m.request("GET", "/compose.asp", { cookies: b.cookies() })).body) || [])[1] ?? "";
  b.post = async (url, form) => post(url, form && !("t" in form) ? { ...form, t: await b.token() } : form);
  return b;
}

const net = new Network();
const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");
const charlie = await net.boot("CHARLIE");
const maild = (m) => m.kernel.ps().find((p) => p.name === "MAILD")?.pid;
async function installColdMail(m) {
  if (!m.exists("C:\\MAILDATA")) m.mkdir("C:\\MAILDATA");
  m.write("C:\\MAILDATA\\MAILD.INI", "retry=1\ntries=2");
  m.write("C:\\MYFILES\\INSTALL.SPK", fs.readFileSync(path.join(root, "coldmail/INSTALL.SPK"), "utf8"));
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await net.until(() => !m.running(pid), 20000, "ColdMail's installer");
  await net.until(() => maild(m) && /port 110/.test(m.widgets(maild(m), "ListBox")[0]?.get("Items").join("\n")), 10000, "the mail server");
}
await installColdMail(alpha);
await installColdMail(bravo);
const ann = browser(alpha);
assert.equal((await ann.post("/join.asp", { name: "Ann Example", u: "ann", pw: "secret", pw2: "secret" })).url, "/inbox.asp");
const bob = browser(bravo);
assert.equal((await bob.post("/join.asp", { name: "Bob Bravo", u: "bob", pw: "hunter2", pw2: "hunter2" })).url, "/inbox.asp");
const box = (m, u, f = "INBOX") => (m.exists(`C:\\MAILDATA\\BOX\\${u}\\${f}.TXT`) ? m.read(`C:\\MAILDATA\\BOX\\${u}\\${f}.TXT`).trim().split("\n").filter(Boolean) : []);

// A raw conversation with a server's port 110: each line sent waits for its answer.
async function talk(m, host, lines) {
  const conn = await m.stack.connect(0, host, 110);
  const answers = [];
  let waiting;
  conn.onMessage((t) => { answers.push(t); waiting?.(); });
  const next = () => new Promise((r) => { waiting = r; });
  await next();
  for (const l of lines) { conn.send(l); await next(); }
  conn.close();
  return answers;
}

await test("ColdMail's server lets mail programs sign in on port 110", async () => {
  const a = await talk(charlie, "ALPHA", ["LIST", "USER ann", "PASS wrong", "USER ann@alpha", "PASS secret", "QUIT"]);
  assert.match(a[0], /^\+OK ALPHA ColdMail POP ready/);
  assert.equal(a[1], "-ERR USER and PASS first");
  assert.equal(a[3], "-ERR That name and password do not match.");
  assert.equal(a[5], "+OK 1 letters", "ColdMail's welcome letter");
  assert.equal(a[6], "+OK Bye");
});

await test("it lists, hands over and deletes letters, and sends them", async () => {
  await bob.post("/compose.asp", { to: "ann@alpha", subject: "First", text: "One." });
  await net.until(() => box(alpha, "ANN").length === 2, 15000, "the letter to ann");
  const n = box(alpha, "ANN").find((l) => l.includes("|First|")).split("|")[0];
  let a = await talk(charlie, "ALPHA", ["USER ann", "PASS secret", "LIST", "RETR " + n, "LIST", "SEND\nTo: bob@bravo\nSubject: From a program\n\nHello Bob.", "LIST SENT", "QUIT"]);
  assert.match(a[3], new RegExp(`\\n${n}\\|[^|]+\\|Bob Bravo <bob@bravo>\\|ann@alpha\\|First\\|\\d+\\|N$`));
  assert.match(a[4], /^\+OK\nReceived: from BRAVO[\s\S]*Subject: First[\s\S]*\n\nOne\.$/);
  assert.ok(!a[5].endsWith("|N"), "read now");
  assert.equal(a[6], "+OK sent");
  assert.match(a[7], /\|Ann Example <ann@alpha>\|bob@bravo\|From a program\|/);
  await net.until(() => box(bravo, "BOB").some((l) => l.includes("|From a program|")), 15000, "the letter to bob");
  a = await talk(charlie, "ALPHA", ["USER ann", "PASS secret", "DELE " + n, "LIST", "QUIT"]);
  assert.equal(a[3], "+OK deleted");
  assert.match(a[4], /^\+OK\n\d+\|[^\n]*\|Welcome to ColdMail!\|\d+\|N?$/);
});

// ---------------------------------------------------------------- Frostbird itself

charlie.write("C:\\MYFILES\\INSTALL.SPK", fs.readFileSync(path.join(root, "frostbird/INSTALL.SPK"), "utf8"));
const inst = charlie.run("C:\\MYFILES\\INSTALL.SPK");
await net.until(() => !charlie.running(inst), 20000, "Frostbird's installer");
const fb = () => charlie.kernel.ps().find((p) => p.name === "FROSTBRD")?.pid;
await net.until(() => fb() && charlie.widgets(fb(), "ListBox").length === 2, 30000, "Frostbird");
const pid = fb();
const windows = () => charlie.widgets(pid, "Window");
const main = () => windows()[0];
const windowCalled = (title) => windows().find((w) => w.get("Title") === title && w.get("Visible"));
const inside = (w, type) => charlie.widgets(pid, type).filter((x) => x.parent === w);
const folders = () => charlie.widgets(pid, "ListBox")[0];
const letters = () => charlie.widgets(pid, "ListBox")[1];
const reader = () => charlie.widgets(pid, "TextArea")[0];
const status = () => main().get("Status");
const menu = (item) => charlie.widgets(pid, "Menu")[0].fire("onSelect", item);
const tools = () => charlie.widgets(pid, "Canvas")[0];
const tool = (i) => { tools().fire("onMouseDown", 2 + i * 64 + 30, 20, 1); tools().fire("onMouseUp", 2 + i * 64 + 30, 20, 1); };
const wait = (fn, what, ms = 10000) => net.until(fn, ms, what);
const pick = async (subject) => {
  const i = letters().get("Items").findIndex((l) => l.includes(subject));
  assert.ok(i >= 0, "no letter " + subject + " in " + letters().get("Items").join(" / "));
  letters().set("Selected", i);
  letters().fire("onSelect");
  await wait(() => reader().get("Text").includes("Subject:  " + subject), "the letter " + subject);
};

await test("the first time, it asks for the account, then gets the mail", async () => {
  assert.match(charlie.output(inst), /Frostbird is installed \(1 files\)/);
  await wait(() => windowCalled("Account Settings"), "the account window");
  const w = windowCalled("Account Settings");
  const [address, password] = inside(w, "TextBox");
  address.set("Text", "ann@alpha");
  password.set("Text", "secret");
  inside(w, "Button").find((b) => b.get("Text") === "OK").call("Click");
  await wait(() => /No new mail|new letter/.test(status()), "the first check");
  assert.match(charlie.read("C:\\FROST\\ACCOUNT.INI"), /^address=ann@alpha\npass=[0-9A-F]+\ncheck=5\n$/);
  assert.ok(!charlie.read("C:\\FROST\\ACCOUNT.INI").includes("secret"), "not in plain sight");
  assert.deepEqual(charlie.ui.dialogs, []);
});

await test("Get Mail brings new letters down, unread, and reading one marks it read", async () => {
  await bob.post("/compose.asp", { to: "ann@alpha", subject: "Lunch?", text: "Are you free at noon?\nBob" });
  await bob.post("/compose.asp", { to: "ann@alpha", subject: "Second thoughts", text: "Make it one." });
  await net.until(() => box(alpha, "ANN").length === 3, 15000, "two more letters for ann");
  tool(0);
  await wait(() => status() === "2 new letters from alpha", "the new mail");
  assert.equal(folders().get("Items")[0], "Inbox (3)", "the welcome letter is unread too");
  assert.equal(main().get("Title"), "(3) Frostbird");
  for (const subject of ["Second thoughts", "Lunch?", "Welcome to ColdMail!"]) assert.ok(letters().get("Items").some((l) => l.startsWith("* ") && l.includes(subject)), subject + " unread");
  assert.match(letters().get("Items").find((l) => l.includes("Lunch?")), /^\* Bob Bravo +Lunch\? +\d{4}-\d\d-\d\d \d\d:\d\d$/);
  await pick("Lunch?");
  assert.match(reader().get("Text"), /^From: +Bob Bravo <bob@bravo>\nTo: +ann@alpha\n[\s\S]*\n\nAre you free at noon\?\nBob$/);
  await wait(() => folders().get("Items")[0] === "Inbox (2)", "one fewer unread");
  menu("Get New Mail");
  await wait(() => status() === "No new mail.", "nothing new the second time");
  assert.equal(letters().get("Items").length, 3, "nothing twice");
});

await test("Reply sends through ann's server, and Sent has the copy", async () => {
  await pick("Lunch?");
  menu("Reply");
  await wait(() => windowCalled("Write: Re: Lunch?"), "the reply window");
  const w = windowCalled("Write: Re: Lunch?");
  const [to, subject] = inside(w, "TextBox");
  const text = inside(w, "TextArea")[0];
  assert.equal(to.get("Text"), "bob@bravo");
  assert.equal(subject.get("Text"), "Re: Lunch?");
  assert.match(text.get("Text"), /, Bob Bravo wrote:\n> Are you free at noon\?\n> Bob\n$/);
  text.set("Text", "Noon is perfect.\n" + text.get("Text"));
  inside(w, "Button").find((b) => b.get("Text") === "&Send").call("Click");
  await wait(() => status() === "Your letter is on its way.", "sending");
  await net.until(() => box(bravo, "BOB").some((l) => l.includes("|Re: Lunch?|")), 15000, "the reply at bravo");
  const n = box(bravo, "BOB").find((l) => l.includes("|Re: Lunch?|")).split("|")[0];
  assert.match(bravo.read(`C:\\MAILDATA\\BOX\\BOB\\${n}.MSG`), /From: Ann Example <ann@alpha>[\s\S]*X-Mailer: Frostbird[\s\S]*\n\nNoon is perfect\./);
  folders().set("Selected", 1);
  folders().fire("onSelect");
  await wait(() => letters().get("Items").some((l) => /To: bob@bravo +Re: Lunch\?/.test(l)), "the Sent folder");
});

await test("Delete takes the letter off the server too; letters deleted in the webmail go", async () => {
  folders().set("Selected", 0);
  folders().fire("onSelect");
  await wait(() => letters().get("Items").some((l) => l.includes("Second thoughts")), "the Inbox");
  await pick("Second thoughts");
  menu("Delete");
  await wait(() => !letters().get("Items").some((l) => l.includes("Second thoughts")), "gone here");
  await net.until(() => !box(alpha, "ANN").some((l) => l.includes("|Second thoughts|")), 10000, "gone on the server");
  // the webmail deletes Lunch?; the next Get Mail notices
  const line = box(alpha, "ANN").find((l) => l.includes("|Lunch?|"));
  alpha.write("C:\\MAILDATA\\BOX\\ANN\\INBOX.TXT", alpha.read("C:\\MAILDATA\\BOX\\ANN\\INBOX.TXT").replace(line + "\n", ""));
  menu("Get New Mail");
  await wait(() => !letters().get("Items").some((l) => l.includes("Lunch?")), "the Inbox follows the server");
  assert.equal(letters().get("Items").length, 1, "the welcome letter is left");
});

await test("a wrong password or a missing server says so, and it keeps working", async () => {
  charlie.write("C:\\FROST\\ACCOUNT.INI", charlie.read("C:\\FROST\\ACCOUNT.INI").replace("address=ann@alpha", "address=ann@nowhere"));
  charlie.kernel.kill(pid);
  const pid2 = charlie.run("C:\\PROGRAMS\\FROSTBRD.SPK");
  await net.until(() => charlie.widgets(pid2, "ListBox").length === 2, 30000, "Frostbird again");
  charlie.widgets(pid2, "Menu")[0].fire("onSelect", "Get New Mail");
  await net.until(() => charlie.ui.dialogs.length, 15000, "the complaint");
  assert.match(charlie.ui.dialogs.splice(0)[0].text, /Frostbird could not reach the mail server on nowhere/);
  assert.deepEqual(charlie.errors, []);
});

await test("Simxplorer's Mail button opens Frostbird", async () => {
  const src = fs.readFileSync(path.join(root, "simxplorer/src/BROWSER.SPK"), "utf8");
  assert.match(src, /IF FS.Exists\(MAILPROGRAM\) THEN\n\s+SYS.Start\(MAILPROGRAM, ""\)/);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
