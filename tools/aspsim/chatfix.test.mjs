// Tests for the Chat fix (chatfix/): SIM95's Chat service (CHATSVC.SPK,
// port 6667) stops with "Runtime error in Sock_OnMessage: Connection closed"
// when it answers someone who has already gone, as Chat's Disconnect does
// (QUIT, then close at once). The fixed one lets that pass.
//   node tools/aspsim/chatfix.test.mjs
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
const wait = (fn, what, ms = 15000) => net.until(fn, ms, what);
const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");
const charlie = await net.boot("CHARLIE");
const stock = alpha.read("C:\\PROGRAMS\\CHATSVC.SPK");
const service = (m) => m.kernel.ps().find((p) => /CHATSVC/i.test(p.name || p.path || ""));
const crashed = (m) => m.ui.dialogs.some((d) => /Connection closed/.test(d.text || ""));

// a chat client on `from`, to `to`'s service: what it hears, and a way to talk
async function client(from, to) {
  const c = await from.stack.connect(0, to, 6667);
  const heard = [];
  c.onMessage((t) => heard.push(t));
  return { c, heard, say: (t) => c.send(t), close: () => c.close() };
}
// Disconnect as Chat does it: QUIT (or anything that's answered), and close at once
async function rudeGoodbyes(from, to, rounds) {
  for (let k = 0; k < rounds; k++) {
    const x = await client(from, to);
    await sleep(30);
    x.say(k % 2 ? "QUIT" : "NICK " + to.toLowerCase());
    x.close();
    await sleep(40);
  }
}

await test("without the fix: Disconnect at the wrong moment stops the Chat service (the bug)", async () => {
  charlie.run("C:\\PROGRAMS\\CHATSVC.SPK");
  await sleep(300);
  const keep = await client(bravo, "CHARLIE");
  keep.say("NICK charlie");
  await sleep(200);
  for (let k = 0; k < 40 && !crashed(charlie); k++) await rudeGoodbyes(bravo, "CHARLIE", 1);
  await wait(() => crashed(charlie), "the crash", 5000);
  assert.match(charlie.ui.dialogs.find((d) => /Connection closed/.test(d.text)).text, /Runtime error in Sock_OnMessage/);
});

await test("installing: CHATSVC.SPK replaced, the original kept as CHATSVC.ORG, the service restarted", async () => {
  const installer = fs.readFileSync(path.join(root, "chatfix/INSTALL.SPK"), "utf8");
  assert.match(installer, /^' VAPOR\|id=CHATFIX\|name=Chat Fix: No More Crashes\|kind=program\|version=[0-9a-f]{8}\|category=System\|run=C:\\PROGRAMS\\CHAT\.SPK\|files=C:\\SYSTEM\\CHATFIX\.TXT\|/);
  alpha.run("C:\\PROGRAMS\\CHATSVC.SPK");
  await sleep(300);
  alpha.write("C:\\MYFILES\\INSTALL.SPK", installer);
  let pid = alpha.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !alpha.running(pid), "the installer", 30000);
  assert.match(alpha.output(pid), /Fixed C:\\PROGRAMS\\CHATSVC\.SPK \(the original is CHATSVC\.ORG\)\./);
  assert.match(alpha.output(pid), /stopped the old CHATSVC/);
  assert.equal(alpha.read("C:\\PROGRAMS\\CHATSVC.ORG"), stock);
  assert.match(alpha.read("C:\\PROGRAMS\\CHATSVC.SPK"), /\(CHATFIX\)/);
  assert.ok(service(alpha), "running");
  pid = alpha.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !alpha.running(pid), "again", 30000);
  assert.match(alpha.output(pid), /already has the fix/);
  // someone else's Chat service is left alone
  bravo.write("C:\\PROGRAMS\\CHATSVC.SPK", stock.replace("SUB Main ()", "' mine\nSUB Main ()"));
  bravo.write("C:\\MYFILES\\INSTALL.SPK", installer);
  pid = bravo.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !bravo.running(pid), "BRAVO's installer", 30000);
  assert.match(bravo.output(pid), /changed since SIM95 made it, so it was left alone/);
  assert.equal(bravo.exists("C:\\PROGRAMS\\CHATSVC.ORG"), false);
});

await test("with the fix: rude goodbyes by the dozen, and chat carries on", async () => {
  const ann = await client(bravo, "ALPHA");
  ann.say("NICK ann");
  await wait(() => ann.heard.some((t) => t === "OK You are now ann"), "ann's nick");
  ann.say("JOIN #general");
  await rudeGoodbyes(charlie, "ALPHA", 40);
  assert.equal(crashed(alpha), false, JSON.stringify(alpha.ui.dialogs));
  assert.deepEqual(alpha.errors, []);
  assert.ok(service(alpha), "still running");
  const bob = await client(charlie, "ALPHA");
  bob.say("NICK bob");
  await wait(() => bob.heard.some((t) => t === "OK You are now bob"), "bob's nick");
  bob.say("JOIN #general");
  await sleep(300);
  bob.say("MSG #general hello ann");
  await wait(() => ann.heard.includes("MSG #general bob hello ann"), "the message: " + ann.heard.join(" | "));
});

await test("with the fix: lines are handled in the order they were sent", async () => {
  const ann = await client(bravo, "ALPHA");
  ann.say("NICK ann2");
  await wait(() => ann.heard.includes("OK You are now ann2"), "ann's nick");
  ann.say("JOIN #order");
  await sleep(300);
  // a NICK then a JOIN at once: the room hears the new name
  const cat = await client(charlie, "ALPHA");
  cat.say("NICK cat");
  cat.say("JOIN #order");
  const joins = () => ann.heard.filter((t) => t.startsWith("JOIN #order ") && t !== "JOIN #order ann2");
  await wait(() => joins().length > 0, "cat joins");
  assert.deepEqual(joins(), ["JOIN #order cat"]);
  // long and short lines, one straight after another
  const lines = ["x".repeat(390), "two", "y".repeat(300), "four"];
  for (const l of lines) cat.say("MSG #order " + l);
  await wait(() => ann.heard.filter((t) => t.startsWith("MSG #order cat ")).length === 4, "four messages");
  assert.deepEqual(ann.heard.filter((t) => t.startsWith("MSG #order cat ")).map((t) => t.slice(15)), lines);
  // a message, then gone: the message still goes out, and then the goodbye
  cat.say("MSG #order bye now");
  cat.close();
  await wait(() => ann.heard.includes("PART #order cat"), "cat's goodbye");
  assert.ok(ann.heard.indexOf("MSG #order cat bye now") >= 0 && ann.heard.indexOf("MSG #order cat bye now") < ann.heard.indexOf("PART #order cat"));
  assert.equal(crashed(alpha), false);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
