// End-to-end tests for the Sim Shell (simsh/): the built-ins through the
// headless core and through the GUI window; ssh and scp between two booted
// machines; and sim-get against a Vapor store booted like vapor.test.mjs.
//   node tools/aspsim/simsh.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Network } from "./network.mjs";
import { withResolver } from "../simxplorer-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}

const installer = (app) => fs.readFileSync(path.join(root, app, "INSTALL.SPK"), "utf8");
const SIMSH = withResolver(fs.readFileSync(path.join(root, "simsh/src/CORE.SPK"), "utf8") + "\n" +
  fs.readFileSync(path.join(root, "simsh/src/NETJOB.SPK"), "utf8") + "\n" +
  fs.readFileSync(path.join(root, "simsh/src/WINDOW.SPK"), "utf8"));

const net = new Network();
const wait = (fn, what, ms = 20000) => net.until(fn, ms, what);
const proc = (m, name) => m.kernel.ps().find((p) => p.name === name)?.pid;

// A driver for a running Sim Shell window on machine m.
function shell(m, pid) {
  const box = () => m.widgets(pid, "TextBox")[0];
  const screen = () => m.widgets(pid, "ListBox")[0];
  const prompt = () => m.widgets(pid, "Label")[0].get("Text");
  const items = () => screen().get("Items");
  const self = {
    pid, prompt, items,
    text: () => items().join("\n"),
    async settle(ms = 40000) {
      let n = -1, same = 0; const end = Date.now() + ms;
      while (Date.now() < end) {
        await sleep(40);
        const idle = box().get("Enabled") !== false || prompt().toLowerCase().includes("password");
        const c = items().length;
        if (idle && c === n) { if (++same >= 3) return; } else { same = 0; n = c; }
      }
    },
    // type a line and wait until the shell is idle again (or asks a password)
    async type(line) {
      await wait(() => box().get("Enabled") !== false, "the prompt before: " + line);
      box().set("Text", line);
      box().fire("onEnter");
      await self.settle();
    },
    // the lines printed since a mark (the count items() had)
    since(mark) { return items().slice(mark).join("\n"); },
    mark() { return items().length; },
  };
  return self;
}
async function boot(name) {
  const m = await net.boot(name);
  m.write("C:\\SYSTEM\\USERS.INI", "name=" + name.toLowerCase() + "\npassword=sekret\n");
  m.run("C:\\PROGRAMS\\FILESVC.SPK");  // the Files service, for scp (port 139)
  return m;
}
function openShell(m) {
  const pid = m.run("C:\\PROGRAMS\\SIMSH.SPK");
  return pid;
}

const alpha = await boot("ALPHA");
const bravo = await boot("BRAVO");
alpha.run("C:\\PROGRAMS\\HTTPD.SPK");

// ---------------------------------------------------------------- headless core

// Run a batch of command lines through a fresh shell with no window, the way
// SSHD does, and return everything printed. (Compiles CORE + a tiny Main.)
async function headless(m, lines) {
  const prog = fs.readFileSync(path.join(root, "simsh/src/CORE.SPK"), "utf8") + `
VAR outText AS String
SUB Main ()
    VAR ln AS String
    ShInit("tester", "testhost")
    FOR EACH ln IN SYS.Args
        outText = outText + ShRun(ln.Replace(Chr(1), " "))
    NEXT
    Print(outText)
END SUB
`;
  return (await m.runScript(prog, { args: lines.map((l) => l.replace(/ /g, "\x01")) })).join("\n");
}

await test("the headless core runs built-ins, pipes, redirects, vars and aliases", async () => {
  const hm = await net.boot("CORE1");
  const out = await headless(hm, [
    "echo hello world",
    "mkdir -p /myfiles/t",
    "cd /myfiles/t",
    "echo one > a.txt",
    "echo two >> a.txt",
    "cat a.txt",
    "cat a.txt | wc -l",
    "grep -n two a.txt",
    "X=7; echo val=$X done",
    "alias g='grep -i'; echo TWO | g two",
    "echo a > b.txt; wc -c < b.txt",
    "seq 1 3 | tail -n 1",
  ]);
  assert.match(out, /hello world/);
  assert.match(out, /one\ntwo/);
  assert.match(out, /^ +2$/m, "wc -l counted two lines");
  assert.match(out, /^2:two$/m, "grep -n");
  assert.match(out, /val=7 done/);
  assert.match(out, /^TWO$/m, "alias g = grep -i matched case-insensitively");
  assert.match(out, /^ +2$/m, "wc -c of 'a\\n'");
  assert.match(out, /^3$/m, "seq|tail");
});

await test("the headless core: && || ; quoting and $?", async () => {
  const hm = await net.boot("CORE2");
  const out = await headless(hm, [
    "false && echo no",
    "false || echo yes",
    "true && echo also",
    "echo 'a | b ; c'",
    "grep zzz /nope.txt; echo status=$?",
    "echo \"quoted $USER\"",
  ]);
  assert.doesNotMatch(out, /^no$/m);
  assert.match(out, /^yes$/m);
  assert.match(out, /^also$/m);
  assert.match(out, /^a \| b ; c$/m, "single quotes keep | and ;");
  assert.match(out, /status=1/, "grep with no match set $? to 1");
  assert.match(out, /quoted tester/, "double quotes expand $USER");
});

await test("a .SH script runs with sh, with $1 and comments", async () => {
  const hm = await net.boot("CORE3");
  hm.write("C:\\MYFILES\\HI.SH", "# a greeting\necho hi $1\necho args $#\n");
  const out = await headless(hm, ["sh /myfiles/hi.sh there", "echo after"]);
  assert.match(out, /hi there/);
  assert.match(out, /args 1/);
  assert.match(out, /after/);
});

// ---------------------------------------------------------------- the GUI window

await test("the installer puts the Sim Shell and sshd on the machine, and starts both", async () => {
  for (const m of [alpha, bravo]) {
    m.write("C:\\MYFILES\\INSTALL.SPK", installer("simsh"));
    const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
    await wait(() => !m.running(pid), m.hostname() + " installer", 40000);
    assert.ok(m.exists("C:\\PROGRAMS\\SIMSH.SPK"), "SIMSH.SPK");
    assert.ok(m.exists("C:\\PROGRAMS\\SSHD.SPK"), "SSHD.SPK");
    assert.equal(m.read("C:\\SYSTEM\\STARTUP\\SSHD.RUN"), "C:\\PROGRAMS\\SSHD.SPK");
    assert.ok(m.exists("C:\\SYSTEM\\SIMSHRC.SH"), "an example rc");
    await wait(() => proc(m, "SSHD"), "sshd on " + m.hostname());
    await wait(() => proc(m, "SIMSH"), "the shell window on " + m.hostname());
  }
});

await test("the window runs built-ins, pipes and redirects; the rc aliases loaded", async () => {
  const pid = proc(alpha, "SIMSH");
  const sh = shell(alpha, pid);
  await sh.settle();
  // the rc ran at startup
  assert.match(sh.text(), /Welcome to the Sim Shell, alpha\./);
  await sh.type("cd /myfiles && pwd");
  assert.match(sh.prompt(), /^alpha@alpha:C:\\MYFILES\$$/);
  let k = sh.mark();
  await sh.type("echo line1 > f.txt; echo line2 >> f.txt; wc -l f.txt");
  assert.match(sh.since(k), /^ +2 f\.txt$/m);
  k = sh.mark();
  await sh.type("cat f.txt | grep -n line2");
  assert.match(sh.since(k), /^2:line2$/m);
  k = sh.mark();
  await sh.type("ll");   // alias from the rc
  assert.match(sh.since(k), /F\.TXT/);
  assert.deepEqual(alpha.errors, []);
});

await test("Up/Down history and Ctrl+Space completion", async () => {
  const pid = proc(alpha, "SIMSH");
  const sh = shell(alpha, pid);
  const box = alpha.widgets(pid, "TextBox")[0];
  await sh.type("echo remember-me");
  box.fire("onKey", "ArrowUp");
  await sleep(60);
  assert.equal(box.get("Text"), "echo remember-me", "Up recalled the last line");
  box.fire("onKey", "ArrowDown");
  await sleep(60);
  box.set("Text", "");
  // completion of a file name in the current directory
  await sh.type("cd /myfiles");
  box.set("Text", "cat f.t");
  box.fire("onKey", "Ctrl+Space");
  await sleep(80);
  assert.equal(box.get("Text"), "cat F.TXT", "Ctrl+Space completed F.TXT");
  box.set("Text", "");
});

// ---------------------------------------------------------------- ssh and scp

// answer the password prompt a shell is waiting at
async function password(sh, pw) {
  const box = sh.pid && sh.items ? null : null;
  await wait(() => sh.prompt().toLowerCase().includes("password"), "a password prompt");
  const tb = global.__box || null;
}
// simpler: type into the box when it asks for a password
function typePassword(m, pid, pw) {
  const box = m.widgets(pid, "TextBox")[0];
  box.set("Text", pw);
  box.fire("onEnter");
}

await test("ssh with a bad password is refused", async () => {
  const pid = proc(bravo, "SIMSH");
  const sh = shell(bravo, pid);
  await sh.type("cd /myfiles");
  const k = sh.mark();
  await sh.type("ssh alpha@alpha whoami");
  await wait(() => sh.prompt().toLowerCase().includes("password"), "the password prompt");
  typePassword(bravo, pid, "wrong");
  await sh.settle();
  assert.match(sh.since(k), /Permission denied/);
  assert.doesNotMatch(sh.since(k), /^alpha$/m);
});

await test("ssh host command runs on the remote machine and the output comes back", async () => {
  const pid = proc(bravo, "SIMSH");
  const sh = shell(bravo, pid);
  const k = sh.mark();
  await sh.type("ssh alpha@alpha whoami");
  await wait(() => sh.prompt().toLowerCase().includes("password"), "the password prompt");
  typePassword(bravo, pid, "sekret");
  await sh.settle();
  assert.match(sh.since(k), /^alpha$/m, "whoami ran on alpha");
  // output can be piped locally
  const k2 = sh.mark();
  await sh.type("ssh alpha@alpha 'echo one; echo two' | grep two");
  await wait(() => sh.prompt().toLowerCase().includes("password"), "the password prompt");
  typePassword(bravo, pid, "sekret");
  await sh.settle();
  assert.match(sh.since(k2), /^two$/m);
  assert.doesNotMatch(sh.since(k2), /^one$/m, "grep kept only the matching line");
});

await test("an interactive ssh session runs cd then ls, and exit returns", async () => {
  const pid = proc(bravo, "SIMSH");
  const sh = shell(bravo, pid);
  alpha.write("C:\\MYFILES\\REMOTE.TXT", "i am on alpha\n");
  const k = sh.mark();
  await sh.type("ssh alpha@alpha");
  await wait(() => sh.prompt().toLowerCase().includes("password"), "the password prompt");
  typePassword(bravo, pid, "sekret");
  await sh.settle();
  assert.match(sh.prompt(), /^alpha@alpha:/, "the remote prompt");
  await sh.type("cd /myfiles");
  assert.match(sh.prompt(), /alpha@alpha:C:\\MYFILES\$/, "cd changed the remote directory");
  const k2 = sh.mark();
  await sh.type("ls");
  assert.match(sh.since(k2), /REMOTE\.TXT/, "ls listed alpha's file");
  await sh.type("exit");
  await sh.settle();
  assert.match(sh.prompt(), /^bravo@bravo:/, "back to the local prompt");
  assert.match(sh.since(k), /Connection to alpha closed\./);
});

await test("scp copies a file to and from another machine", async () => {
  const pid = proc(bravo, "SIMSH");
  const sh = shell(bravo, pid);
  await sh.type("cd /myfiles");
  bravo.write("C:\\MYFILES\\UP.TXT", "upload me\n");
  let k = sh.mark();
  await sh.type("scp up.txt alpha@alpha:/myfiles/landed.txt");
  await wait(() => sh.prompt().toLowerCase().includes("password"), "the password prompt");
  typePassword(bravo, pid, "sekret");
  await sh.settle();
  assert.match(sh.since(k), /100%/, "scp reported progress");
  assert.equal(alpha.read("C:\\MYFILES\\LANDED.TXT"), "upload me\n", "the file arrived on alpha");
  // and back down
  alpha.write("C:\\MYFILES\\DOWN.TXT", "come home\n");
  k = sh.mark();
  await sh.type("scp alpha@alpha:/myfiles/down.txt got.txt");
  await wait(() => sh.prompt().toLowerCase().includes("password"), "the password prompt");
  typePassword(bravo, pid, "sekret");
  await sh.settle();
  assert.equal(bravo.read("C:\\MYFILES\\GOT.TXT"), "come home\n", "the file came down to bravo");
});

// ---------------------------------------------------------------- sim-get

await test("sim-get installs from a Vapor store, lists, upgrades and removes", async () => {
  // a store on alpha, like vapor.test.mjs
  alpha.write("C:\\MYFILES\\VAPOR.SPK", installer("vapor"));
  let pid = alpha.run("C:\\MYFILES\\VAPOR.SPK");
  await wait(() => !alpha.running(pid), "the vapor installer", 40000);
  await wait(() => proc(alpha, "VAPOR"), "Vapor on alpha");
  // publish an app from C:\MYFILES, the way Vapor's Publish Apps does
  alpha.write("C:\\MYFILES\\FROST.SPK", installer("frostbird"));
  const vpid = proc(alpha, "VAPOR");
  alpha.widgets(vpid, "Menu")[0].fire("onSelect", "Publish Apps...");
  await wait(() => alpha.ui.dialogs.length, "the publish report", 40000);
  alpha.ui.dialogs.splice(0);
  const catLine = alpha.read("C:\\WEB\\VAPOR\\CATALOG.TXT").split("\n").find((l) => l.startsWith("FROSTBRD|"));
  assert.ok(catLine, "Frostbird is on the shelf");

  // sim-get on bravo
  const bpid = proc(bravo, "SIMSH");
  const sh = shell(bravo, bpid);
  await sh.type("sim-get store alpha");
  let k = sh.mark();
  await sh.type("sim-get update");
  await sh.settle();
  assert.match(sh.since(k), /Get:1 http:\/\/alpha\/vapor\/ catalog\.txt/);
  assert.match(sh.since(k), /Reading package lists\.\.\. Done/);

  k = sh.mark();
  await sh.type("sim-get list");
  assert.match(sh.since(k), /^frostbrd\/program/m);
  k = sh.mark();
  await sh.type("sim-get search mail");
  assert.match(sh.since(k), /frostbrd - Frostbird/);
  k = sh.mark();
  await sh.type("sim-get show frostbrd");
  assert.match(sh.since(k), /^Package: frostbrd$/m);
  assert.match(sh.since(k), /^Installed: no$/m);

  // its first part isn't on the shelf for a moment: sim-get tries again
  const part = "C:\\WEB\\VAPOR\\FROSTBRD\\1.TXT";
  const partText = alpha.read(part);
  alpha.remove(part);
  // (back 3 s later: a job's lines show when it ends, so not waited for)
  setTimeout(() => alpha.write(part, partText), 3000);
  k = sh.mark();
  await sh.type("sim-get install frostbrd");
  await wait(() => bravo.exists("C:\\PROGRAMS\\FROSTBRD.SPK"), "Frostbird installed by sim-get", 40000).catch((e) => { throw new Error(e.message + "\n" + sh.since(k)); });
  await sh.settle();
  assert.match(sh.since(k), /Unpacking Frostbird/);
  assert.match(sh.since(k), /W: frostbrd\/1\.txt didn't come \(HTTP\/1\.0 404[^)]*\); trying again in 2 s \(2 of 5\)/);
  // the library line matches exactly what Vapor writes
  const lib = bravo.read("C:\\GAMES\\LIBRARY.TXT").split("\n").find((l) => l.startsWith("FROSTBRD|"));
  const ver = catLine.split("|")[8];
  assert.match(lib, new RegExp(`^FROSTBRD\\|Frostbird\\|\\d{4}-\\d\\d-\\d\\d\\|0\\|Internet\\|[^|]*\\|${ver}\\|program\\|C:\\\\PROGRAMS\\\\FROSTBRD.SPK\\|C:\\\\PROGRAMS\\\\FROSTBRD.SPK\\|FROSTBRD\\|\\|$`));
  if (proc(bravo, "FROSTBRD")) bravo.kernel.kill(proc(bravo, "FROSTBRD"));

  // a newer build in the store shows as upgradable, and upgrade brings it
  const fresh = installer("frostbird").replace(/version=[0-9a-f]{8}/, "version=feedf00d") + "' (newer)\n";
  alpha.write("C:\\MYFILES\\FROST.SPK", fresh);
  alpha.widgets(vpid, "Menu")[0].fire("onSelect", "Publish Apps...");
  await wait(() => alpha.ui.dialogs.length, "the second report", 40000);
  alpha.ui.dialogs.splice(0);
  await sh.type("sim-get update");
  k = sh.mark();
  await sh.type("sim-get list --upgradable");
  assert.match(sh.since(k), /frostbrd.*upgradable/);
  k = sh.mark();
  await sh.type("sim-get upgrade");
  await wait(() => /\|feedf00d\|program\|/.test(bravo.read("C:\\GAMES\\LIBRARY.TXT")), "Frostbird upgraded", 40000);
  await sh.settle();
  assert.match(sh.since(k), /upgraded/);
  if (proc(bravo, "FROSTBRD")) bravo.kernel.kill(proc(bravo, "FROSTBRD"));

  k = sh.mark();
  await sh.type("sim-get remove frostbrd");
  await sh.settle();
  assert.match(sh.since(k), /Removing Frostbird/);
  assert.ok(!bravo.exists("C:\\PROGRAMS\\FROSTBRD.SPK"), "files gone");
  assert.doesNotMatch(bravo.read("C:\\GAMES\\LIBRARY.TXT") || "", /^FROSTBRD\|/m);

  assert.deepEqual(bravo.errors, []);
  assert.deepEqual(alpha.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
