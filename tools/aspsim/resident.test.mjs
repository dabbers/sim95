// Tests for the resident bridge (tools/bridge-resident.js), which keeps
// STARTHERE up to date from GitHub from inside its browser tab, and Sim
// Shell's bridge command, which talks to it over ssh. GitHub is played by this
// repository on disk, at two "commits": OLD (the Pixel Wall's installer and
// the Chat fix a little different) and NEW (as they are).
//   node tools/aspsim/resident.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Network } from "./network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repo = (p) => fs.readFileSync(path.join(root, p), "utf8");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const net = new Network();
const wait = (fn, what, ms = 60000) => net.until(fn, ms, what);
const sh = await net.boot("STARTHERE.56K.NET");
const alpha = await net.boot("ALPHA");
sh.write("C:\\SYSTEM\\USERS.INI", "name=dab\npassword=sekret\n");
sh.run("C:\\PROGRAMS\\HTTPD.SPK");
const B = "C:\\SYSTEM\\BRIDGE";

async function install(m, file) {
  m.write("C:\\MYFILES\\INSTALL.SPK", repo(file));
  m.ui.answers.push(true);
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !m.running(pid), "installing " + file, 120000);
  m.remove("C:\\MYFILES\\INSTALL.SPK");
}

// GitHub, as the bridge sees it: the branch's commit, and files at a commit
let head = "1111111111111111111111111111111111111111";
const OLD = head, NEW = "2222222222222222222222222222222222222222";
const tweak = (p, text) => {
  // OLD's Chat fix is another build (its header's version), so NEW is an upgrade
  if (p === "chatfix/INSTALL.SPK") return text.replace(/\|version=([0-9a-f]{8})\|/, "|version=0ddba11e|");
  if (p === "vapor/SHELF/SHELF.TXT") return text.replace(/^item chatfix\/INSTALL\.SPK [0-9a-f]{8}$/m, "item chatfix/INSTALL.SPK 0ddba11e").replace(/^central pixelwall\/INSTALL\.SPK [0-9a-f]{8}/m, "central pixelwall/INSTALL.SPK 0ddba11e");
  return text;
};
const asked = [];
const github = {
  async commit(ref) { asked.push("commit " + ref); if (ref !== "main" && ref !== "test-branch") throw new Error(`there's no branch or commit called ${ref}`); return head; },
  async file(sha, p) { asked.push(sha.slice(0, 1) + " " + p); const t = repo(p); return sha === OLD ? tweak(p, t) : t; },
};
const logLines = () => (sh.exists(B + "\\LOG.TXT") ? sh.read(B + "\\LOG.TXT") : "");

// ssh, as another machine's Sim Shell does it: AUTH, then RUN lines
async function ssh(line) {
  const c = await alpha.stack.connect(0, "STARTHERE", 22);
  const got = [];
  c.onMessage((t) => got.push(t));
  c.send("AUTH dab|sekret");
  await net.until(() => got.length >= 1, 5000, "ssh login");
  assert.match(got[0], /^OK/);
  c.send("RUN " + line);
  await net.until(() => got.length >= 2, 10000, "ssh reply");
  c.close();
  return got[1].split("\n").slice(2).join("\n");
}

let api;
await test("set up: Sim Shell (with sshd) and the Pixel Wall on STARTHERE; the bridge starts in its tab", async () => {
  await install(sh, "simsh/INSTALL.SPK");
  await install(sh, "pixelwall/INSTALL.SPK");
  assert.ok(sh.exists("C:\\WEB\\WALL\\WALL.SPK"));
  // the tab: as the userscript would, with the machine and (here) GitHub
  globalThis.SIM95_RESIDENT = { machine: { fs: sh.disk, kernel: sh.kernel, hostname: () => sh.stack.hostname() }, github, noFirstRound: true, say: () => {} };
  api = await (0, eval)(repo("tools/bridge-resident.js"));
  delete globalThis.SIM95_RESIDENT;
  assert.equal(sh.read(B + "\\BRIDGE.INI"), "ref=main\nevery=15\nupgrade=1\n");
  assert.match(logLines(), /the bridge is here \(following main, every 15 minutes\)/);
  const out = await ssh("bridge");
  assert.match(out, /^The bridge is running in this machine's browser tab\.\n  follows:  main, checking every 15 minutes\n  now:      .*starting/);
});

await test("the first round: the store stocked from GitHub, the Pixel Wall's installer run, and nothing yet to upgrade", async () => {
  assert.equal(await api.round("start"), "updated");
  assert.ok(sh.exists("C:\\WEB\\VAPOR\\CATALOG.TXT"), "STARTHERE is a store now");
  assert.match(sh.read("C:\\WEB\\VAPOR\\CATALOG.TXT"), /^CHATFIX\|.*\|0ddba11e\|/m);
  assert.match(logLines(), /main is at 1111111: bringing it here \(start\)/);
  assert.match(logLines(), /store: Chat Fix: No More Crashes is new \(build 0ddba11e\)/);
  assert.match(logLines(), /pixelwall: running its installer\n.*pixelwall: Open http:\/\/starthere\.56k\.net\/wall\/ in Voyager\./);
  assert.ok(!/npmreg|welcome|simnic/.test(logLines()), "only the central apps this machine has");
  assert.match(sh.read(B + "\\DONE.TXT"), /^commit\|main\|1111111111111111111111111111111111111111\ncentral\|pixelwall\/INSTALL\.SPK\|0ddba11e\n$/);
  assert.match(logLines(), /upgrade: .*upgraded/);
  assert.match(sh.read(B + "\\STATUS.TXT"), /up to date with main 1111111 \(brought here start\)/);
  // the same commit again: nothing to do, and not much asked of GitHub
  asked.length = 0;
  assert.equal(await api.round("every"), "same");
  assert.deepEqual(asked, ["commit main"]);
});

await test("Sim Shell -c: a command line run as if typed, its screen saved, the window closed", async () => {
  const pid = sh.run("C:\\PROGRAMS\\SIMSH.SPK", ["-c", "sim-get", "install", "-y", "chatfix", "--log=C:\\MYFILES\\GOT.TXT", "--exit"]);
  await wait(() => !sh.running(pid), "the shell to finish and close");
  assert.match(sh.read("C:\\MYFILES\\GOT.TXT"), /sim-get install -y chatfix[\s\S]*1 newly installed/);
  assert.match(sh.read("C:\\PROGRAMS\\CHATSVC.SPK"), /\(CHATFIX\)/);
});

await test("a new commit, asked for over ssh: bridge update, then the store, the wall and the upgrade follow, and bridge log tells", async () => {
  head = NEW;
  const out = await ssh("bridge update");
  assert.match(out, /^Asked the bridge to bring main here\. Follow it with: bridge log/);
  await wait(() => /up to date with main 2222222 \(brought here asked\)/.test(sh.read(B + "\\STATUS.TXT")), "the round: " + sh.read(B + "\\STATUS.TXT"), 180000);
  assert.equal(sh.exists(B + "\\REQUEST.TXT"), false, "picked up");
  assert.match(logLines(), /asked: update/);
  assert.match(logLines(), /main is at 2222222 \(was 1111111\): bringing it here \(asked\)/);
  assert.match(logLines(), /store: Chat Fix: No More Crashes updated from 0ddba11e/);
  assert.match(logLines(), /pixelwall: running its installer/);
  assert.match(logLines(), /upgrade: .*chatfix[\s\S]*upgraded/);
  assert.match(sh.read("C:\\GAMES\\LIBRARY.TXT"), new RegExp("^CHATFIX\\|.*" + /\|version=([0-9a-f]{8})\|/.exec(repo("chatfix/INSTALL.SPK"))[1], "m"));
  const log = await ssh("bridge log 5");
  assert.match(log, /upgrade: .*upgraded/);
  assert.equal(log.trim().split("\n").length, 5);
});

await test("bridge follow and every change what it does; a branch that isn't there is a failure, said so", async () => {
  assert.match(await ssh("bridge every 30"), /checks every 30 minutes/);
  assert.match(await ssh("bridge follow no-such-branch"), /follows no-such-branch/);
  assert.match(sh.read(B + "\\BRIDGE.INI"), /^ref=no-such-branch$/m);
  assert.match(sh.read(B + "\\BRIDGE.INI"), /^every=30$/m);
  await ssh("bridge update");
  await wait(() => /failed: there's no branch or commit called no-such-branch/.test(sh.read(B + "\\STATUS.TXT")), "the failure");
  assert.match(await ssh("bridge status"), /now: .*failed: there's no branch or commit called no-such-branch/);
  await ssh("bridge follow main");
  await ssh("bridge every 15");
  // force: everything again, though main hasn't moved
  await ssh("bridge update force");
  await wait(() => /up to date with main 2222222 \(brought here asked\)/.test(sh.read(B + "\\STATUS.TXT")) && /update force/.test(logLines()), "forced");
});

await test("no bridge: bridge status and update say so plainly", async () => {
  api.stop();
  sh.write(B + "\\ALIVE.TXT", Math.floor(Date.now() / 1000 - 3600) + "|1\n");
  assert.match(await ssh("bridge"), /^The bridge was last heard from 60 minutes ago: is the browser tab still open\?/);
  assert.match(await ssh("bridge update"), /But it isn't running/);
  assert.match(await ssh("bridge nonsense"), /usage: bridge/);
  assert.deepEqual(sh.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
