// Tests for Clippy (clippy/PROGRAMS/CLIPPY.SPK), on a SIM95 machine.
//   node tools/aspsim/clippy.test.mjs
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

const net = new Network();
const m = await net.boot("ALPHA");
const wait = (fn, what, ms = 10000) => net.until(fn, ms, what);
const clippy = () => m.kernel.ps().find((p) => p.name === "CLIPPY")?.pid;
const win = () => m.widgets(clippy(), "Window")[0];
const says = () => String(win()?.get("Tag") ?? "");
const choose = (text) => {
  const b = m.widgets(clippy(), "Button").find((x) => x.get("Text") === text && x.get("Visible"));
  assert.ok(b, `no "${text}" button; the balloon says: ${says()} / ${m.widgets(clippy(), "Button").filter((x) => x.get("Visible")).map((x) => x.get("Text")).join(", ")}`);
  b.call("Click");
};

await test("the installer starts Clippy, and adds him to startup", async () => {
  m.write("C:\\MYFILES\\INSTALL.SPK", fs.readFileSync(path.join(root, "clippy/INSTALL.SPK"), "utf8"));
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !m.running(pid), "the installer", 20000);
  assert.match(m.output(pid), /It looks like you've installed Clippy! Would you like help\?/);
  assert.equal(m.read("C:\\SYSTEM\\STARTUP\\CLIPPY.RUN"), "C:\\PROGRAMS\\CLIPPY.SPK");
  await wait(() => says().startsWith("Hi! I'm Clippy"), "hello");
  choose("Thanks, Clippy!");
  await wait(() => says() === "", "the balloon goes");
});

await test("it looks like you're writing a letter", async () => {
  const notes = m.run("C:\\PROGRAMS\\NOTES.SPK");
  await wait(() => says().startsWith("It looks like you're writing a letter."), "the famous line");
  choose("Get help with writing the letter");
  await wait(() => /Start with "Dear"/.test(says()), "the help");
  choose("That's not help");
  await wait(() => /getting frustrated/.test(says()), "frustration");
  choose("Don't show me this tip again");
  await wait(() => /I won't mention it again/.test(says()), "promise");
  assert.match(m.read("C:\\SYSTEM\\CLIPPY.INI"), /quiet=\|letter\|/);
  choose("Fine");
  m.kernel.kill(notes);
  await new Promise((r) => setTimeout(r, 2500));
  m.run("C:\\PROGRAMS\\NOTES.SPK");
  await new Promise((r) => setTimeout(r, 3000));
  assert.equal(says(), "", "he keeps his promise");
});

await test("it reads what you save in My Files", async () => {
  m.write("C:\\MYFILES\\TODO.TXT", "TODO\n[ ] buy milk\n");
  await wait(() => /making a to-do list/.test(says()), "the to-do list");
  choose("Yes, add it");
  await wait(() => m.read("C:\\MYFILES\\TODO.TXT").includes("[ ] Close Clippy"), "his item on the list");
  choose("We'll see");
  m.write("C:\\MYFILES\\HELLO.SPK", 'SUB Main ()\n    FS.Write("C:\\MYFILES\\RAN.TXT", "yes")\nEND SUB\n');
  await wait(() => /Nice program, HELLO.SPK!/.test(says()), "the program");
  choose("Run it");
  await wait(() => m.exists("C:\\MYFILES\\RAN.TXT"), "it ran");
  choose("OK");
});

await test("click him, and he answers questions, or asks the Web", async () => {
  // a stand-in browser that notes what it was asked to open
  m.write("C:\\PROGRAMS\\SIMXPLOR.SPK", 'SUB Main ()\n    FS.Write("C:\\MYFILES\\OPENED.TXT", SYS.Args[0])\nEND SUB\n');
  m.write("C:\\SYSTEM\\SIMXPLOR.INI", "search=http://asksim/index.asp?q=%s\n");
  const art = m.widgets(clippy(), "Canvas")[0];
  art.fire("onMouseDown", 120, 60, 1);
  await wait(() => says().startsWith("What would you like to do?"), "the question");
  const box = m.widgets(clippy(), "TextBox")[0];
  box.set("Text", "What time is it?");
  box.fire("onEnter");
  await wait(() => /^It's \d\d:\d\d on \d{4}-\d\d-\d\d\./.test(says()), "the time");
  choose("Ask another question");
  await wait(() => says().startsWith("What would you like to do?"), "asked again");
  box.set("Text", "where can I buy a modem");
  m.button(clippy(), "Search").call("Click");
  await wait(() => m.exists("C:\\MYFILES\\OPENED.TXT"), "the browser");
  assert.equal(m.read("C:\\MYFILES\\OPENED.TXT"), "http://asksim/index.asp?q=where+can+I+buy+a+modem");
  assert.match(says(), /I've asked AskSim for you/);
});

await test("ask him to go away, and he does (eventually)", async () => {
  m.widgets(clippy(), "Canvas")[0].fire("onMouseDown", 120, 400, 1);
  await wait(() => says().startsWith("What would you like to do?"), "the question");
  const box = m.widgets(clippy(), "TextBox")[0];
  box.set("Text", "how do I turn off clippy");
  box.fire("onEnter");
  await wait(() => /I'm afraid I can't do that/.test(says()), "HAL");
  choose("Yes, hide and don't start with SIM95");
  await wait(() => !clippy(), "gone");
  assert.ok(!m.exists("C:\\SYSTEM\\STARTUP\\CLIPPY.RUN"));
  assert.deepEqual(m.errors, []);
  assert.deepEqual(m.ui.dialogs, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
