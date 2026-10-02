// Tests for the Welcome Wagon (welcome/PROGRAMS/WELCOME.SPK): the greeter bot
// on the central host that waits in #general on every machine's Chat service
// and says hello to newcomers. Real Chat services (C:\PROGRAMS\CHATSVC.SPK)
// and the real Chat program (CHAT.SPK) on a pretend network:
//   STARTHERE.56k.net  the hub: some SimHost apps, and the Welcome Wagon
//   NEWBIE             opens Chat before the bot has come round
//   LATE               joins the network while the bot is running
//   REGULAR            chats on STARTHERE's own #general
//   NOCHAT             has its Chat service turned off
//   node tools/aspsim/welcome.test.mjs
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
let crashes = 0; // stock Chat services that died of a Disconnect

const net = new Network();
const hub = await net.boot("STARTHERE.56k.net");
const newbie = await net.boot("NEWBIE");
const regular = await net.boot("REGULAR");
const nochat = await net.boot("NOCHAT");
const wait = (fn, what, ms = 15000) => net.until(fn, ms, what);
const proc = (m, name) => m.kernel.ps().find((p) => p.name === name)?.pid;
for (const m of [hub, newbie, regular]) m.run("C:\\PROGRAMS\\CHATSVC.SPK");

// STARTHERE serves a few apps: one with an APP.INF, one known by its files, and Vapor
for (const d of ["BOOK", "ASK", "VAPOR"]) hub.mkdir("C:\\WEB\\" + d);
hub.write("C:\\WEB\\BOOK\\APP.INF", "SimBook|The social network: profiles, friends, a news feed, walls, photos and pokes.|#3B5998");
hub.write("C:\\WEB\\ASK\\ASK.SPK", "' AskSim");
hub.write("C:\\WEB\\VAPOR\\CATALOG.TXT", "");
hub.mkdir("C:\\WELCOME");
hub.write("C:\\WELCOME\\WELCOME.INI", "channel=#general\nevery=1\n");

// The Chat program, driven the way a person would
function chat(m) {
  const self = {
    pid: null,
    async open(server) {
      if (!self.pid || !m.running(self.pid)) {
        self.pid = m.run("C:\\PROGRAMS\\CHAT.SPK");
        await wait(() => m.widgets(self.pid, "Button").length >= 2, "Chat on " + m.stack.hostname());
      }
      if (server) m.widgets(self.pid, "TextBox")[0].set("Text", server);
      m.button(self.pid, "Connect").call("Click");
      await wait(() => m.button(self.pid, "Disconnect"), "connected").catch((e) => { throw new Error(e.message + " | status: " + m.widgets(self.pid, "Window")[0].get("Status") + " | buttons: " + m.widgets(self.pid, "Button").map((b) => b.get("Text")).join(",") + " | " + self.lines().slice(-4).join(" / ") + " | errors: " + m.errors.join(" ;; ") + " | dialogs: " + JSON.stringify(m.ui.dialogs) + " | ps: " + m.kernel.ps().map((p) => p.name).join(",")); });
    },
    // Disconnect. (The stock Chat service often dies of it, with an error box:
    // the program sends QUIT and closes at once, and the service's "OK Bye"
    // then fails. See SIM95-NOTES.md. Like the machine's owner, start it again.)
    async close() {
      m.button(self.pid, "Disconnect")?.call("Click");
      await wait(() => m.button(self.pid, "Connect"), "disconnected");
      await sleep(300);
      if (!proc(m, "CHATSVC")) {
        crashes++;
        m.ui.dialogs.splice(0);
        m.run("C:\\PROGRAMS\\CHATSVC.SPK");
        await sleep(200);
      }
    },
    lines: () => m.widgets(self.pid, "ListBox")[0].get("Items").map((l) => l.replace(/^\d\d:\d\d:\d\d /, "")),
    users: () => m.widgets(self.pid, "ListBox")[1].get("Items"),
    say(text) {
      m.widgets(self.pid, "TextBox")[3].set("Text", text);
      m.button(self.pid, "Send").call("Click");
    },
    from: (nick) => self.lines().filter((l) => l.startsWith("<" + nick + "> ")).map((l) => l.slice(nick.length + 3)),
  };
  return self;
}
const bot = () => proc(hub, "WELCOME");
const journal = () => hub.widgets(bot(), "ListBox")[0].get("Items").join("\n");

const N = chat(newbie);
await test("somebody already in their own Chat room is greeted when the bot comes round", async () => {
  await N.open(); // its own machine, #general: as Chat starts
  assert.deepEqual(N.users(), ["newbie"]);
  hub.write("C:\\PROGRAMS\\WELCOME.SPK", fs.readFileSync(path.join(root, "welcome/PROGRAMS/WELCOME.SPK"), "utf8"));
  hub.run("C:\\PROGRAMS\\WELCOME.SPK");
  await wait(() => N.from("StartHereBot").length >= 4, "the greeting: " + N.lines().join(" / "));
  assert.deepEqual(N.from("StartHereBot"), [
    "Hi newbie, welcome to SIM95! I'm the greeter bot from STARTHERE.",
    "Open Voyager and go to http://starthere/ for AskSim, SimBook and Vapor.",
    "Looking for people? We chat in #general on starthere: in Chat, put starthere in Server and press Connect.",
    "Say sites for the list, or bye and I'll leave this machine alone.",
  ]);
  assert.ok(N.lines().includes("*** StartHereBot joined #general"));
  await wait(() => N.users().includes("StartHereBot"), "the bot in the list");
  assert.match(journal(), /Greeted newbie on NEWBIE/);
  assert.equal(hub.read("C:\\WELCOME\\SEEN.TXT"), "NEWBIE|newbie\n");
});

await test("sites lists them, one a line (and not again straight away)", async () => {
  N.say("sites");
  await wait(() => N.from("StartHereBot").length >= 7, "the list: " + N.lines().join(" / "));
  assert.deepEqual(N.from("StartHereBot").slice(4), [
    "AskSim - http://starthere/ask/ - A search engine with a real crawler that goes round every machine on the network.",
    "SimBook - http://starthere/book/ - The social network: profiles, friends, a news feed, walls, photos and pokes.",
    "Vapor - http://starthere/vapor/ - The store: games and every SIM95 program, for your own machine.",
  ]);
  N.say("StartHereBot: sites?");
  await sleep(1500);
  assert.equal(N.from("StartHereBot").length, 7, "once in a while is plenty");
});

await test("once is enough: back in the room, nobody is greeted twice", async () => {
  await N.close();
  await N.open();
  await wait(() => N.users().includes("StartHereBot"), "the bot still there");
  await sleep(1500);
  assert.equal(N.from("StartHereBot").length, 7);
});

const R = chat(regular);
await test("on STARTHERE's own #general: newcomers greeted, without the sales talk; bye there does nothing", async () => {
  await R.open("starthere");
  await wait(() => R.from("StartHereBot").length >= 3, "the greeting on the hub: " + R.lines().join(" / "));
  assert.deepEqual(R.from("StartHereBot"), [
    "Hi regular, welcome to SIM95! I'm the greeter bot from STARTHERE.",
    "Open Voyager and go to http://starthere/ for AskSim, SimBook and Vapor.",
    "Say sites for the list.",
  ]);
  R.say("bye");
  await sleep(1500);
  assert.ok(R.users().includes("StartHereBot"), "still on the hub");
  assert.ok(!hub.exists("C:\\WELCOME\\OPTOUT.TXT"));
});

let late, L;
await test("a machine that joins the network later is found, and whoever opens Chat there is greeted", async () => {
  late = await net.boot("LATE");
  late.run("C:\\PROGRAMS\\CHATSVC.SPK");
  await wait(() => /Found LATE/.test(journal()), "LATE found: " + journal(), 20000);
  await wait(() => /open/.test(hub.widgets(bot(), "Window")[0].get("Status")) && Number(hub.widgets(bot(), "Window")[0].get("Status").split(" ")[0]) >= 3, "three rooms open");
  L = chat(late);
  await L.open();
  await wait(() => L.from("StartHereBot").length >= 4, "LATE's greeting: " + L.lines().join(" / "));
  assert.match(L.from("StartHereBot")[0], /^Hi late, welcome to SIM95!/);
});

await test("bye: it leaves that machine alone, for good", async () => {
  L.say("bye!");
  await wait(() => L.from("StartHereBot").some((l) => l.startsWith("OK, I'll leave this machine alone.")), "the goodbye");
  await wait(() => !L.users().includes("StartHereBot"), "the bot gone: " + L.users().join(","));
  assert.equal(hub.read("C:\\WELCOME\\OPTOUT.TXT"), "LATE\n");
  assert.match(journal(), /late said bye: leaving LATE alone/);
  await sleep(3000); // three looks round
  await L.close();
  await L.open();
  await sleep(1500);
  assert.ok(!L.users().includes("StartHereBot"), "it doesn't come back");
});

await test("a Chat service that restarts gets the bot back; one that's off is left until later", async () => {
  newbie.kernel.kill(proc(newbie, "CHATSVC"));
  await wait(() => /Left NEWBIE \(closed\)/.test(journal()), "the room closed");
  newbie.run("C:\\PROGRAMS\\CHATSVC.SPK");
  await N.close();
  await N.open();
  await wait(() => N.users().includes("StartHereBot"), "the bot back on NEWBIE", 20000);
  assert.ok(!/Greeted newbie on NEWBIE[\s\S]*Greeted newbie on NEWBIE/.test(journal()), "and no second hello");
  assert.ok(/Found NOCHAT/.test(journal()));
  assert.ok(!/Greeted [^\n]* on NOCHAT/.test(journal()));
  assert.ok(proc(hub, "WELCOME"), "still running");
  assert.deepEqual(hub.errors, []);
  assert.deepEqual(hub.ui.dialogs, []);
});

await test("the installer: on STARTHERE it (re)starts the Welcome Wagon, and with the machine; elsewhere it asks first", async () => {
  const installer = fs.readFileSync(path.join(root, "welcome/INSTALL.SPK"), "utf8");
  assert.ok(!installer.startsWith("' VAPOR|"), "no store sells it");
  const before = bot();
  hub.write("C:\\MYFILES\\INSTALL.SPK", installer);
  let pid = hub.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => bot() && bot() !== before, "the new Welcome Wagon", 30000);
  await wait(() => /The Welcome Wagon is running/.test(hub.output(pid)), "the installer's last word: " + hub.output(pid));
  assert.match(hub.output(pid), /stopped the old WELCOME/);
  assert.equal(hub.read("C:\\SYSTEM\\STARTUP\\WELCOME.RUN"), "C:\\PROGRAMS\\WELCOME.SPK");
  assert.equal(hub.read("C:\\PROGRAMS\\WELCOME.SPK"), fs.readFileSync(path.join(root, "welcome/PROGRAMS/WELCOME.SPK"), "utf8").replace(/\n?$/, "\n"));
  // it remembers whom it greeted: nobody twice, even after a restart
  await sleep(2500);
  assert.equal(N.from("StartHereBot").length, 7);
  // anywhere else: a warning first
  nochat.write("C:\\MYFILES\\INSTALL.SPK", installer);
  nochat.ui.answers.push(false);
  pid = nochat.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !nochat.running(pid), "the installer on NOCHAT", 30000);
  assert.match(nochat.ui.dialogs.map((d) => d.text).join("\n"), /^This machine is NOCHAT, not STARTHERE\.56K\.NET\./);
  assert.match(nochat.output(pid), /The Welcome Wagon was not installed: it belongs on starthere\.56k\.net\./);
  assert.ok(!nochat.exists("C:\\PROGRAMS\\WELCOME.SPK") && !nochat.exists("C:\\WELCOME"));
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
