// Tests for the Welcome Wagon (welcome/PROGRAMS/WELCOME.SPK): the greeter bot
// on the central host that waits in #general on every machine's Chat service,
// says hello to newcomers, and links the rooms into one (stand-ins under
// people's own names). Real Chat services (C:\PROGRAMS\CHATSVC.SPK)
// and the real Chat program (CHAT.SPK) on a pretend network:
//   STARTHERE.56k.net  the hub: some SimHost apps, and the Welcome Wagon
//   NEWBIE             opens Chat before the bot has come round
//   LATE               joins the network while the bot is running
//   REGULAR            chats on STARTHERE's own #general
//   NOCHAT             has its Chat service turned off
//   CLASH              somebody there calls themselves regular too
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
    async open(server, nick) {
      if (!self.pid || !m.running(self.pid)) {
        self.pid = m.run("C:\\PROGRAMS\\CHAT.SPK");
        await wait(() => m.widgets(self.pid, "Button").length >= 2, "Chat on " + m.stack.hostname());
      }
      if (server) m.widgets(self.pid, "TextBox")[0].set("Text", server);
      if (nick) m.widgets(self.pid, "TextBox")[1].set("Text", nick);
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
    // (Chat reads the box when it gets to the click: one line at a time)
    async say(text) {
      const box = m.widgets(self.pid, "TextBox")[3];
      box.set("Text", text);
      m.button(self.pid, "Send").call("Click");
      await wait(() => box.get("Text") === "", "sent: " + text);
    },
    from: (nick) => self.lines().filter((l) => l.startsWith("<" + nick + "> ")).map((l) => l.slice(nick.length + 3)),
  };
  return self;
}
const bot = () => proc(hub, "WELCOME");
process.on("exit", () => { if (hub.ui.dialogs.length) console.log("HUB DIALOGS:", JSON.stringify(hub.ui.dialogs)); if (hub.errors.length) console.log("HUB ERRORS:", hub.errors.join(" ;; ")); });
const journal = () => hub.widgets(bot(), "ListBox")[0].get("Items").join("\n");

const N = chat(newbie);
const R = chat(regular);
const BOT = "StartHereBot";
const hellos = (c, nick) => c.from(BOT).filter((l) => l.startsWith("Hi " + nick + ",")).length;

await test("somebody already in their own Chat room is greeted when the bot comes round, and told the room is linked", async () => {
  await N.open(); // its own machine, #general: as Chat starts
  assert.deepEqual(N.users(), ["newbie"]);
  hub.write("C:\\PROGRAMS\\WELCOME.SPK", fs.readFileSync(path.join(root, "welcome/PROGRAMS/WELCOME.SPK"), "utf8"));
  hub.run("C:\\PROGRAMS\\WELCOME.SPK");
  await wait(() => N.from(BOT).length >= 4, "the greeting: " + N.lines().join(" / "));
  assert.deepEqual(N.from(BOT), [
    "Hi newbie, welcome to SIM95! I'm the greeter bot from STARTHERE.",
    "Open Voyager and go to http://starthere/ for AskSim, SimBook and Vapor.",
    "This room is linked to #general on every machine: whoever comes in anywhere on the network will be here too, and see what you say.",
    "Say sites for the list, unlink to keep this room to this machine, or bye and I'll leave it alone.",
  ]);
  assert.ok(N.lines().includes("*** StartHereBot joined #general"));
  await wait(() => N.users().includes(BOT), "the bot in the list");
  assert.match(journal(), /Greeted newbie on NEWBIE/);
  assert.equal(hub.read("C:\\WELCOME\\SEEN.TXT"), "NEWBIE|newbie\n");
});

await test("sites lists them, one a line (and not again straight away)", async () => {
  await N.say("sites");
  await wait(() => N.from(BOT).length >= 7, "the list: " + N.lines().join(" / "));
  assert.deepEqual(N.from(BOT).slice(4), [
    "AskSim - http://starthere/ask/ - A search engine with a real crawler that goes round every machine on the network.",
    "SimBook - http://starthere/book/ - The social network: profiles, friends, a news feed, walls, photos and pokes.",
    "Vapor - http://starthere/vapor/ - The store: games and every SIM95 program, for your own machine.",
  ]);
  await N.say("StartHereBot: sites?");
  await sleep(1500);
  assert.equal(N.from(BOT).length, 7, "once in a while is plenty");
});

await test("once is enough: back in the room, nobody is greeted twice", async () => {
  await N.close();
  await N.open();
  await wait(() => N.users().includes(BOT), "the bot still there");
  await sleep(2000);
  assert.equal(N.from(BOT).length, 7);
});

await test("STARTHERE's own #general: greeted without the sales talk, and told who's about; bye there does nothing", async () => {
  await R.open("starthere");
  await wait(() => R.from(BOT).length >= 4, "the greeting on the hub: " + R.lines().join(" / "));
  assert.deepEqual(R.from(BOT), [
    "Hi regular, welcome to SIM95! I'm the greeter bot from STARTHERE.",
    "Open Voyager and go to http://starthere/ for AskSim, SimBook and Vapor.",
    "This room is linked to #general on every machine: 1 person elsewhere on the network can talk with you here, and see what you say.",
    "Say sites for the list.",
  ]);
  await R.say("bye");
  await sleep(1500);
  assert.ok(R.users().includes(BOT), "still on the hub");
  assert.ok(!hub.exists("C:\\WELCOME\\OPTOUT.TXT"));
});

await test("the rooms are one: each sees the other under their own name, and what they say, in order", async () => {
  await wait(() => N.users().includes("regular") && R.users().includes("newbie"), "each in the other's list: " + N.users() + " | " + R.users());
  assert.ok(N.lines().includes("*** regular joined #general"));
  await N.say("hello from newbie");
  await wait(() => R.from("newbie").includes("hello from newbie"), "newbie heard on the hub: " + R.lines().join(" / "));
  await R.say("hi newbie, welcome!");
  await wait(() => N.from("regular").includes("hi newbie, welcome!"), "regular heard on NEWBIE: " + N.lines().join(" / "));
  for (const w of ["one", "two", "three", "four"]) await N.say(w);
  await wait(() => R.from("newbie").length >= 5, "four more: " + R.from("newbie").join(" / "));
  assert.deepEqual(R.from("newbie").slice(-4), ["one", "two", "three", "four"]);
  // the bot's own lines stay in their room; and nobody else was greeted
  assert.ok(!R.from(BOT).some((l) => l.includes("newbie,")));
  assert.equal(N.from(BOT).length, 7);
  assert.ok(N.from("regular").includes("bye"), "(regular's bye went across: it's chat)");
  assert.ok(N.users().includes(BOT), "and the bot didn't take it for NEWBIE's");
});

let late, L;
await test("a machine that joins later: found, greeted, and in the conversation", async () => {
  late = await net.boot("LATE");
  late.run("C:\\PROGRAMS\\CHATSVC.SPK");
  await wait(() => /Found LATE/.test(journal()), "LATE found: " + journal(), 20000);
  await sleep(1500);
  L = chat(late);
  await L.open();
  await wait(() => L.from(BOT).length >= 4, "LATE's greeting: " + L.lines().join(" / "));
  assert.equal(L.from(BOT)[2], "This room is linked to #general on every machine: 2 people elsewhere on the network can talk with you here, and see what you say.");
  await wait(() => ["newbie", "regular"].every((n) => L.users().includes(n)) && N.users().includes("late") && R.users().includes("late"), "late everywhere: " + L.users() + " | " + N.users() + " | " + R.users());
  await L.say("hi all");
  await wait(() => N.from("late").includes("hi all") && R.from("late").includes("hi all"), "late heard everywhere");
});

await test("a new name goes everywhere", async () => {
  await L.say("/nick lateguy");
  await wait(() => N.users().includes("lateguy") && !N.users().includes("late") && R.users().includes("lateguy"), "renamed: " + N.users() + " | " + R.users());
  await L.say("it's me");
  await wait(() => N.from("lateguy").includes("it's me") && R.from("lateguy").includes("it's me"), "the new name heard");
});

await test("unlink keeps a room to itself; link brings it back", async () => {
  await N.say("unlink");
  await wait(() => N.from(BOT).some((l) => l.startsWith("Unlinked: only people on this machine see this room now.")), "unlinked");
  assert.equal(hub.read("C:\\WELCOME\\UNLINK.TXT"), "newbie\n");
  await wait(() => !R.users().includes("newbie") && !L.users().includes("newbie"), "newbie gone from the others: " + R.users() + " | " + L.users());
  await wait(() => !N.users().includes("regular") && !N.users().includes("lateguy"), "the others gone from NEWBIE: " + N.users());
  await R.say("anyone on newbie?");
  await N.say("just us here");
  await sleep(2000);
  assert.ok(!N.from("regular").includes("anyone on newbie?"));
  assert.ok(!R.from("newbie").includes("just us here"));
  await N.say("link");
  await wait(() => N.from(BOT).some((l) => l.startsWith("Linked: you're in #general with everybody on the network (2 people elsewhere now).")), "linked again: " + N.from(BOT).join(" / "));
  assert.equal(hub.read("C:\\WELCOME\\UNLINK.TXT"), "");
  await wait(() => N.users().includes("regular") && R.users().includes("newbie"), "back together");
  await R.say("there you are");
  await wait(() => N.from("regular").includes("there you are"), "heard again");
});

let clash, C;
await test("a name somebody elsewhere has: its owners are told, once, and change it to be heard", async () => {
  clash = await net.boot("CLASH");
  clash.run("C:\\PROGRAMS\\CHATSVC.SPK");
  await wait(() => /Found CLASH/.test(journal()), "CLASH found", 20000);
  await sleep(1500);
  C = chat(clash);
  await C.open(undefined, "regular");
  const told = (c, where) => c.from(BOT).filter((l) => l === `Somebody on ${where} is already called regular, so you can't be heard there. /nick gives you another name.`).length;
  await wait(() => told(C, "starthere") === 1 && told(R, "clash") === 1, "both told: " + C.from(BOT).join(" / ") + " | " + R.from(BOT).join(" / "));
  await sleep(3000);
  assert.equal(told(C, "starthere"), 1, "once");
  assert.equal(told(R, "clash"), 1, "once");
  assert.ok(!R.users().filter((u) => u === "regular").length !== 1);
  await C.say("/nick clasher");
  await wait(() => R.users().includes("clasher") && C.users().includes("regular"), "linked under the new name: " + R.users() + " | " + C.users() + "\n" + journal() + "\n" + hub.widgets(bot(), "Window")[0].get("Status"));
  await C.say("better");
  await wait(() => R.from("clasher").includes("better"), "heard on the hub now");
});

await test("bye: it leaves that machine alone, for good, and its room leaves the conversation", async () => {
  await L.say("bye!");
  await wait(() => L.from(BOT).some((l) => l.startsWith("OK, I'll leave this machine alone.")), "the goodbye");
  await wait(() => L.users().length === 1, "LATE alone again: " + L.users().join(","));
  assert.deepEqual(L.users(), ["lateguy"]);
  await wait(() => !N.users().includes("lateguy") && !R.users().includes("lateguy"), "lateguy gone from the others");
  assert.equal(hub.read("C:\\WELCOME\\OPTOUT.TXT"), "late\n");
  assert.match(journal(), /lateguy said bye: leaving LATE alone/);
  await sleep(3000); // three looks round
  await L.close();
  await L.open();
  await sleep(2000);
  assert.equal(L.users().length, 1, "it doesn't come back: " + L.users());
});

await test("a Chat service that restarts gets the bot back, and its people back in the conversation", async () => {
  newbie.kernel.kill(proc(newbie, "CHATSVC"));
  await wait(() => /Left NEWBIE \(closed\)/.test(journal()), "the room closed");
  await wait(() => !R.users().includes("newbie"), "newbie gone from the hub");
  newbie.run("C:\\PROGRAMS\\CHATSVC.SPK");
  await N.close();
  await N.open();
  await wait(() => N.users().includes(BOT) && R.users().includes("newbie") && N.users().includes("regular"), "back: " + N.users() + " | " + R.users(), 25000);
  assert.equal(hellos(N, "newbie"), 1, "and no second hello");
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
  await wait(() => R.users().includes("newbie") && N.users().includes("regular"), "linked again by the new one", 25000);
  assert.equal(hellos(N, "newbie"), 1);
  assert.equal(hellos(R, "regular"), 1);
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
