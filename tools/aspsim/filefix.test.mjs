// Tests for the Files fix (filefix/): Copy in one Files window, Paste in
// another, on this machine's disk or another machine's. Without the fix,
// each Files window keeps its own clipboard, so Paste in a second window (the
// one Network's Files button opens) does nothing at all.
//   node tools/aspsim/filefix.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Network } from "./network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const net = new Network();
const wait = (fn, what, ms = 10000) => net.until(fn, ms, what);
async function boot(name) {
  const m = await net.boot(name);
  m.write("C:\\SYSTEM\\USERS.INI", "name=" + name.toLowerCase() + "\npassword=sekret\n");
  m.run("C:\\PROGRAMS\\FILESVC.SPK"); // the Files service, port 139
  m.write("C:\\MYFILES\\HELLO.TXT", "Hello from " + name + "\nline two\n");
  return m;
}
const alpha = await boot("ALPHA");
const bravo = await boot("BRAVO");
const charlie = await boot("CHARLIE");
const stock = alpha.read("C:\\PROGRAMS\\FILES.SPK");

// a Files window, as the desktop or Network's Files button opens one
async function files(m, where) {
  const pid = m.run("C:\\PROGRAMS\\FILES.SPK", [where]);
  await wait(() => m.widgets(pid, "Menu")[0], "the Files window");
  const w = {
    pid,
    win: () => m.widgets(pid, "Window")[0],
    status: () => String(w.win()?.get("Status") ?? ""),
    list: () => m.widgets(pid, "ListBox")[0],
    rows: () => w.list()?.get("Items") ?? [],
    menu: (item) => m.widgets(pid, "Menu")[0].fire("onSelect", item),
    async pick(name) {
      // (folders are listed as [NAME])
      const is = (r) => r.startsWith(name + " ") || r.startsWith("[" + name + "]");
      await wait(() => w.rows().some(is), name + " in the list: " + w.rows());
      w.list().set("Selected", w.rows().findIndex(is));
    },
    async go(where) {
      const box = m.widgets(pid, "TextBox")[0];
      box.set("Text", where);
      box.fire("onEnter");
      await sleep(300);
    },
    // the logon box another machine's disk asks for
    async logon(user, pass) {
      await wait(() => m.widgets(pid, "TextBox").length >= 3, "the logon box");
      const boxes = m.widgets(pid, "TextBox");
      boxes[1].set("Text", user);
      boxes[2].set("Text", pass);
      m.widgets(pid, "Button").find((b) => b.get("Text") === "OK").fire("onClick");
      await sleep(500);
    },
  };
  await sleep(300);
  return w;
}

await test("without the fix: Copy in one window, Paste in another does nothing (the bug)", async () => {
  const a = await files(charlie, "C:\\MYFILES");
  const b = await files(charlie, "C:\\DOCS");
  await a.pick("HELLO.TXT");
  a.menu("Copy");
  await wait(() => /^Copied HELLO\.TXT/.test(a.status()), "copied");
  b.menu("Paste");
  await sleep(800);
  assert.equal(charlie.exists("C:\\DOCS\\HELLO.TXT"), false);
  assert.deepEqual(charlie.ui.dialogs, [], "and nothing says why");
  charlie.kernel.kill(a.pid);
  charlie.kernel.kill(b.pid);
});

await test("installing: Copy and Paste in FILES.SPK replaced, the original kept as FILES.ORG", async () => {
  const installer = fs.readFileSync(path.join(root, "filefix/INSTALL.SPK"), "utf8");
  assert.match(installer, /^' VAPOR\|id=FILEFIX\|name=Files Fix: Copy and Paste Anywhere\|kind=program\|version=[0-9a-f]{8}\|category=System\|run=C:\\PROGRAMS\\FILES\.SPK\|files=C:\\SYSTEM\\FILEFIX\.TXT\|/);
  alpha.write("C:\\MYFILES\\INSTALL.SPK", installer);
  let pid = alpha.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !alpha.running(pid), "the installer", 30000);
  assert.match(alpha.output(pid), /Fixed Copy and Paste in C:\\PROGRAMS\\FILES\.SPK \(the original is FILES\.ORG\)\./);
  assert.equal(alpha.read("C:\\PROGRAMS\\FILES.ORG"), stock);
  const fixed = alpha.read("C:\\PROGRAMS\\FILES.SPK");
  assert.match(fixed, /\(FILEFIX\)/);
  assert.equal(fixed.replace(/' Copy keeps[\s\S]*?\nSUB Paste \(\)[\s\S]*?\nEND SUB/, "X"), stock.replace(/SUB Copy \(\)[\s\S]*?\nSUB Paste \(\)[\s\S]*?\nEND SUB/, "X"), "nothing else changed");
  // again: already done
  pid = alpha.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !alpha.running(pid), "the installer again", 30000);
  assert.match(alpha.output(pid), /Files already has the fix\./);
  // a Files that isn't SIM95's own is left alone
  bravo.write("C:\\PROGRAMS\\FILES.SPK", stock.replace("SUB Copy ()", "SUB Copy ()\n    ' mine"));
  bravo.write("C:\\MYFILES\\INSTALL.SPK", installer);
  pid = bravo.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !bravo.running(pid), "BRAVO's installer", 30000);
  assert.match(bravo.output(pid), /Files has been changed since SIM95 made it, so it was left alone/);
  assert.equal(bravo.exists("C:\\PROGRAMS\\FILES.ORG"), false);
  bravo.write("C:\\PROGRAMS\\FILES.SPK", stock);
});

await test("with the fix: from one window to another, on this disk", async () => {
  const a = await files(alpha, "C:\\MYFILES");
  const b = await files(alpha, "C:\\DOCS");
  b.menu("Paste");
  await wait(() => /^Nothing to paste: Copy a file first$/.test(b.status()), "nothing to paste yet: " + b.status());
  await a.pick("HELLO.TXT");
  a.menu("Copy");
  await wait(() => /^Copied HELLO\.TXT - Paste it into a folder, in any Files window$/.test(a.status()), "copied: " + a.status());
  b.menu("Paste");
  await wait(() => alpha.exists("C:\\DOCS\\HELLO.TXT"), "pasted in the other window");
  assert.equal(alpha.read("C:\\DOCS\\HELLO.TXT"), "Hello from ALPHA\nline two\n");
  await wait(() => b.status() === "Pasted HELLO.TXT" && b.rows().some((r) => r.startsWith("HELLO.TXT")), "and listed: " + b.status());
  // a folder can't be copied, and says so
  await a.go("C:\\");
  await a.pick("MYFILES");
  a.menu("Copy");
  await wait(() => /^Copy works on files, not folders/.test(a.status()), "a folder: " + a.status());
  alpha.kernel.kill(a.pid);
  alpha.kernel.kill(b.pid);
});

await test("with the fix: to another machine's disk and back, as the Network window opens it", async () => {
  const mine = await files(alpha, "C:\\MYFILES");
  const theirs = await files(alpha, "\\\\BRAVO\\");
  await theirs.logon("bravo", "sekret");
  await theirs.go("\\\\BRAVO\\MYFILES");
  await theirs.pick("HELLO.TXT");
  // up: ALPHA's file into BRAVO's DOCS
  await mine.pick("HELLO.TXT");
  mine.menu("Copy");
  await wait(() => /^Copied HELLO\.TXT/.test(mine.status()), "copied");
  await theirs.go("\\\\BRAVO\\DOCS");
  theirs.menu("Paste");
  await wait(() => bravo.exists("C:\\DOCS\\HELLO.TXT"), "on BRAVO");
  assert.equal(bravo.read("C:\\DOCS\\HELLO.TXT"), "Hello from ALPHA\nline two\n");
  // down: BRAVO's own HELLO.TXT into ALPHA's C:\MYFILES\IN (the window here never logged on to BRAVO)
  await theirs.go("\\\\BRAVO\\MYFILES");
  await theirs.pick("HELLO.TXT");
  theirs.menu("Copy");
  await wait(() => /^Copied HELLO\.TXT/.test(theirs.status()), "copied from BRAVO: " + theirs.status());
  await mine.go("C:\\SAMPLES");
  mine.menu("Paste");
  await wait(() => alpha.exists("C:\\SAMPLES\\HELLO.TXT"), "on ALPHA");
  assert.equal(alpha.read("C:\\SAMPLES\\HELLO.TXT"), "Hello from BRAVO\nline two\n");
  assert.deepEqual(alpha.ui.dialogs.filter((d) => d.kind === "error"), []);
  assert.deepEqual(alpha.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
