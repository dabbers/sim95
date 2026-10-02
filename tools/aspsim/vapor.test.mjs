// End-to-end tests for Vapor (vapor/): a store on ALPHA with its download site,
// Vapor fetched onto BRAVO, apps published into the store, installed, updated
// (Vapor itself too), and games played.
//   node tools/aspsim/vapor.test.mjs
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
const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");
alpha.run("C:\\PROGRAMS\\HTTPD.SPK");
const wait = (fn, what, ms = 20000) => net.until(fn, ms, what);
const proc = (m, name) => m.kernel.ps().find((p) => p.name === name)?.pid;
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const installer = (app) => fs.readFileSync(path.join(root, app, "INSTALL.SPK"), "utf8");
const catalog = () => alpha.read("C:\\WEB\\VAPOR\\CATALOG.TXT").trim().split("\n");
const entry = (id) => catalog().find((l) => l.startsWith(id + "|"));
const body = (r) => r.slice(r.indexOf("\n\n") + 2);

await test("the installer makes ALPHA a store, and starts Vapor", async () => {
  alpha.write("C:\\MYFILES\\INSTALL.SPK", installer("vapor"));
  const pid = alpha.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !alpha.running(pid), "the installer", 30000);
  assert.match(alpha.output(pid), /this machine is a store: http:\/\/alpha\/vapor\//);
  assert.match(entry("SIMDOOM"), /^SIMDOOM\|SimDOOM\|\d+\|\d+\|ok\|Shooter\|.*\|game\|[0-9a-f]{8}\|C:\\GAMES\\SIMDOOM\\SIMDOOM.SPK\|/);
  assert.match(entry("HL3"), /\|soon\|/);
  assert.match(entry("VAPOR"), /\|client\|[0-9a-f]{8}\|C:\\PROGRAMS\\VAPOR.SPK\|/);
  assert.match(alpha.read("C:\\PROGRAMS\\VAPOR.SPK"), /^' VAPOR\|id=VAPOR\|name=Vapor\|kind=client\|version=[0-9a-f]{8}\|/);
  // the parts put back together are the file, header and all
  const n = +entry("SIMDOOM").split("|")[2];
  let joined = "";
  for (let i = 1; i <= n; i++) { const p = alpha.read(`C:\\WEB\\VAPOR\\SIMDOOM\\${i}.TXT`); assert.ok(p.length <= 15000); joined += p; }
  assert.match(joined, /^' VAPOR\|id=SIMDOOM\|[^\n]*\n' SIMDOOM.SPK - SimDOOM/);
  assert.equal(joined.split("\n").slice(1).join("\n"), fs.readFileSync(path.join(root, "vapor/GAMES/SIMDOOM.SPK"), "utf8").replace(/\n?$/, "\n"));
  await wait(() => proc(alpha, "VAPOR"), "Vapor on alpha");
});

await test("the store's web site offers Vapor for download", async () => {
  let r = await alpha.fetch("ALPHA", "/vapor/");
  assert.match(r, /HTTP\/1.0 200/);
  assert.match(r, /<b>Get Vapor<\/b>/);
  assert.match(r, /<a href="getvapor.asp">getvapor.asp<\/a>/);
  assert.match(r, /On a new machine:/);
  assert.match(r, /<b>SimDOOM<\/b>[\s\S]*build [0-9a-f]{8}/);
  assert.match(r, /<b>SimPlayer<\/b>/, "every store stocks SimPlayer");
  assert.match(entry("SIMPLAYR"), /^SIMPLAYR\|SimPlayer\|\d+\|\d+\|ok\|Multimedia\|.*\|program\|[0-9a-f]{8}\|C:\\PROGRAMS\\PLAYER.SPK\|/);
  assert.match(r, /CONST FROM = &quot;alpha&quot;/);
  r = await alpha.fetch("ALPHA", "/vapor/getvapor.asp");
  assert.match(r, /Content-Type: text\/plain/);
  assert.match(body(r), /^' GETVAPOR.SPK - copies Vapor from the store on alpha/);
  bravo.write("C:\\MYFILES\\GETVAPOR.SPK", body(r));
  const pid = bravo.run("C:\\MYFILES\\GETVAPOR.SPK");
  await wait(() => !bravo.running(pid), "GETVAPOR", 30000);
  assert.match(bravo.output(pid), /Vapor is installed/);
  assert.equal(bravo.read("C:\\PROGRAMS\\VAPOR.SPK"), alpha.read("C:\\PROGRAMS\\VAPOR.SPK").replace(/\n?$/, "\n"));
  assert.equal(bravo.read("C:\\GAMES\\VAPOR.INI"), "store=http://alpha/vapor/\n");
});

await test("a new machine needs only the 21 lines from go.asp: they fetch GETVAPOR, which fetches Vapor", async () => {
  const r = await alpha.fetch("ALPHA", "/vapor/go.asp");
  assert.match(r, /Content-Type: text\/plain/);
  const go = body(r);
  assert.ok(go.trim().split("\n").length <= 25, "short enough to paste: " + go.trim().split("\n").length + " lines");
  assert.match(go, /s\.Connect\("alpha", 80\)/);
  assert.match((await alpha.fetch("ALPHA", "/vapor/")), /SimDOOM|On a new machine/);
  const fresh = await net.boot("FRESH");
  fresh.write("C:\\MYFILES\\GO.SPK", go);
  fresh.run("C:\\MYFILES\\GO.SPK");
  await wait(() => fresh.exists("C:\\PROGRAMS\\VAPOR.SPK") && proc(fresh, "VAPOR"), "Vapor on the new machine", 40000).catch((e) => { throw new Error(e.message + " " + JSON.stringify(fresh.ui.dialogs) + fresh.errors); });
  assert.equal(fresh.read("C:\\PROGRAMS\\VAPOR.SPK"), alpha.read("C:\\PROGRAMS\\VAPOR.SPK").replace(/\n?$/, "\n"));
  assert.equal(fresh.read("C:\\GAMES\\VAPOR.INI"), "store=http://alpha/vapor/\n");
  assert.deepEqual(fresh.errors, []);
});

// Driving a Vapor window
const ui = (m) => {
  const vapor = () => proc(m, "VAPOR");
  const self = {
    pid: vapor,
    list: () => m.widgets(vapor(), "ListBox")[0],
    items: () => self.list()?.get("Items") ?? [],
    labels: () => m.widgets(vapor(), "Label").map((l) => l.get("Text")),
    button: (text) => m.widgets(vapor(), "Button").find((b) => String(b.get("Text")).replace("&", "") === text && b.get("Visible") !== false),
    menu: (item) => m.widgets(vapor(), "Menu")[0].fire("onSelect", item),
    tab: (x) => m.widgets(vapor(), "Canvas")[0].fire("onMouseDown", x, 20, 1),
    // a tab is shown when the header has been drawn for it (DrawHead notes which in its Tag)
    async toTab(x, name) {
      const head = m.widgets(vapor(), "Canvas")[0];
      head.set("Tag", "");
      self.tab(x);
      await wait(() => head.get("Tag") === name, "the " + name + " tab");
    },
    toStore: () => self.toTab(200, "STORE"),
    toLibrary: () => self.toTab(300, "LIBRARY"),
    async select(name) {
      await wait(() => self.items().some((i) => i.trim().startsWith(name)), name + " in the list: " + self.items().join(" / "));
      self.list().set("Selected", self.items().findIndex((i) => i.trim().startsWith(name)));
      self.list().fire("onSelect");
      await wait(() => m.widgets(vapor(), "Label")[0]?.get("Text") === name, name + "'s page");
    },
    async click(text) {
      await wait(() => self.button(text)?.get("Enabled") !== false && self.button(text), `the ${text} button (have: ${m.widgets(vapor(), "Button").filter((b) => b.get("Visible") !== false).map((b) => b.get("Text")).join(", ")})`);
      self.button(text).call("Click");
    },
  };
  return self;
};
const A = ui(alpha);
const B = ui(bravo);
const library = () => (bravo.exists("C:\\GAMES\\LIBRARY.TXT") ? bravo.read("C:\\GAMES\\LIBRARY.TXT") : "");
const said = (m) => m.ui.dialogs.splice(0).map((d) => d.text).join("\n---\n");

await test("Publish Apps puts the installers in C:\\MYFILES on the shelves", async () => {
  alpha.write("C:\\MYFILES\\FROST.SPK", installer("frostbird"));
  alpha.write("C:\\MYFILES\\CLIPPY.SPK", installer("clippy"));
  alpha.write("C:\\MYFILES\\ELIZA.SPK", installer("eliza"));
  alpha.write("C:\\MYFILES\\NOTES1.SPK", "SUB Main ()\nEND SUB\n"); // not an installer: left alone
  A.menu("Publish Apps...");
  await wait(() => alpha.ui.dialogs.length, "the report", 30000);
  const report = said(alpha);
  assert.match(report, /^Published:\n  Clippy \(build [0-9a-f]{8}\)\n  ELIZA-95 \(build [0-9a-f]{8}\)\n  Frostbird \(build [0-9a-f]{8}\)$/);
  assert.match(entry("FROSTBRD"), /^FROSTBRD\|Frostbird\|\d+\|\d+\|ok\|Internet\|.*\|program\|[0-9a-f]{8}\|C:\\PROGRAMS\\FROSTBRD.SPK\|C:\\PROGRAMS\\FROSTBRD.SPK\|FROSTBRD\|\|$/);
  assert.match(entry("ELIZA"), /\|ELIZA$/, "a web app's folder, for machines that keep them in folders");
  assert.match(entry("ELIZA"), /\|web\|[0-9a-f]{8}\|\/\|C:\\WEB\\BOT.SPK;C:\\WEB\\ELIZA.HTM;C:\\WEB\\INDEX.ASP\|/);
  A.menu("Publish Apps...");
  await wait(() => alpha.ui.dialogs.length, "the second report", 30000);
  assert.equal(said(alpha), "Already up to date: Clippy, ELIZA-95, Frostbird");
  const r = await alpha.fetch("ALPHA", "/vapor/");
  assert.match(r, /<b>Frostbird<\/b>[\s\S]*<b>SimDOOM<\/b>/, "apps, then games");
});

await test("BRAVO's store shows apps and games; Half-Life 3 is coming soon", async () => {
  await wait(() => B.pid() && B.items().length > 0, "Vapor on bravo", 30000);
  B.menu("Refresh");
  await wait(() => B.items().some((i) => i.trim() === "Frostbird") && B.items().includes("- GAMES -"), "the published apps: " + B.items().join(" / "));
  assert.deepEqual(B.items().map((i) => i.trim()), ["- APPS -", "Clippy", "ELIZA-95", "Frostbird", "SimPlayer", "simweb", "- GAMES -", "SimDOOM", "Snake 95", "Half-Life 3"]);
  await B.select("Half-Life 3");
  await wait(() => B.button("Coming soon"), "Coming soon");
  assert.equal(B.button("Coming soon").get("Enabled"), false);
  await B.select("Frostbird");
  await wait(() => B.labels().includes("Frostbird"), "Frostbird's page");
  assert.ok(B.labels().some((t) => /^Internet  -  Program  -  \d+ KB  -  Free$/.test(t)), B.labels().join(" / "));
});

await test("installing a program runs its installer, and it is in the library", async () => {
  await B.click("Install");
  await wait(() => /^FROSTBRD\|Frostbird\|/m.test(library()), "Frostbird in the library", 40000).catch((e) => { throw new Error(e.message + "\n" + JSON.stringify(bravo.kernel.ps().map((p) => p.name)) + "\n" + B.labels().join(" / ") + "\n" + bravo.widgets(B.pid(), "Window")[0].get("Status") + JSON.stringify(bravo.ui.dialogs) + bravo.errors); });
  assert.ok(bravo.exists("C:\\PROGRAMS\\FROSTBRD.SPK"));
  assert.match(library(), new RegExp(`^FROSTBRD\\|Frostbird\\|\\d{4}-\\d\\d-\\d\\d\\|0\\|Internet\\|[^|]*\\|${entry("FROSTBRD").split("|")[8]}\\|program\\|C:\\\\PROGRAMS\\\\FROSTBRD.SPK\\|`, "m"));
  await wait(() => proc(bravo, "FROSTBRD"), "Frostbird started by its installer");
  bravo.kernel.kill(proc(bravo, "FROSTBRD"));
  await B.toLibrary();
  await B.select("Frostbird");
  await B.click("Open");
  await wait(() => proc(bravo, "FROSTBRD"), "Frostbird opened from the library");
});

await test("a web app asks first, then takes the home page; uninstalling gives it back", async () => {
  bravo.write("C:\\WEB\\INDEX.HTM", "<html>bravo's own page</html>");
  await B.toStore();
  await B.select("ELIZA-95");
  bravo.ui.answers.push(true);
  await B.click("Install");
  await wait(() => bravo.ui.dialogs.length, "the question");
  assert.match(said(bravo), /^ELIZA-95 is a web app: it becomes this machine's home page, http:\/\/bravo\/ \(the page there now moves aside to WELCOME.HTM\)\.\n\nInstall it\?$/);
  await wait(() => /^ELIZA\|/m.test(library()), "ELIZA in the library", 40000);
  assert.ok(bravo.exists("C:\\WEB\\INDEX.ASP") && bravo.exists("C:\\WEB\\BOT.SPK"));
  assert.equal(bravo.read("C:\\WEB\\WELCOME.HTM"), "<html>bravo's own page</html>");
  await B.toLibrary();
  await B.select("ELIZA-95");
  bravo.ui.answers.push(true);
  await B.click("Uninstall");
  await wait(() => !/^ELIZA\|/m.test(library()), "ELIZA gone from the library");
  assert.ok(!bravo.exists("C:\\WEB\\INDEX.ASP") && !bravo.exists("C:\\WEB\\BOT.SPK"));
  assert.equal(bravo.read("C:\\WEB\\INDEX.HTM"), "<html>bravo's own page</html>", "the home page is back");
  said(bravo);
});

await test("a newer build in the store shows as an update; Update All brings it", async () => {
  // a new Frostbird is published on alpha
  const fresh = installer("frostbird").replace(/version=[0-9a-f]{8}/, "version=feedf00d") + "' (a newer build)\n";
  alpha.write("C:\\MYFILES\\FROST.SPK", fresh);
  A.menu("Publish Apps...");
  await wait(() => alpha.ui.dialogs.length, "the report", 30000);
  assert.match(said(alpha), /Published:\n  Frostbird \(build feedf00d\)/);
  B.menu("Refresh");
  await B.toLibrary();
  await wait(() => B.items().includes("Frostbird  (update)"), "the update in the library: " + B.items().join(" / "));
  await B.select("Frostbird");
  assert.ok(B.button("Update"), "an Update button");
  B.menu("Update All");
  await wait(() => /^FROSTBRD\|[^\n]*\|feedf00d\|program\|/m.test(library()), "Frostbird updated", 40000).catch((e) => { throw new Error(e.message + "\n" + library() + "\n" + JSON.stringify(bravo.kernel.ps().map((p) => p.name)) + "\n" + B.labels().join(" / ") + "\n" + bravo.widgets(B.pid(), "Window")[0].get("Status") + JSON.stringify(bravo.ui.dialogs)); });
  await wait(() => B.items().includes("Frostbird"), "no longer marked");
  assert.match(bravo.read("C:\\GAMES\\FROSTBRD\\INSTALL.SPK"), /\(a newer build\)\n$/);
});

await test("a newer Vapor in the store: Vapor offers to update itself, and restarts", async () => {
  const before = B.pid();
  const mine = alpha.read("C:\\PROGRAMS\\VAPOR.SPK");
  alpha.write("C:\\MYFILES\\VAPOR2.SPK", mine.replace(/version=[0-9a-f]{8}/, "version=0ddba11e") + "' (Vapor, newer)\n");
  A.menu("Publish Apps...");
  await wait(() => alpha.ui.dialogs.length, "the report", 30000);
  assert.match(said(alpha), /Vapor \(build 0ddba11e\)/);
  bravo.ui.answers.push(true);
  B.menu("Refresh");
  await wait(() => bravo.ui.dialogs.length, "the offer");
  assert.match(said(bravo), /^A new version of Vapor is in the store \(build 0ddba11e; this is [0-9a-f]{8}\)\.\n\nUpdate Vapor now\? It will restart\.$/);
  await wait(() => B.pid() && B.pid() !== before, "the new Vapor running", 30000);
  assert.match(bravo.read("C:\\PROGRAMS\\VAPOR.SPK"), /^' VAPOR\|id=VAPOR\|name=Vapor\|kind=client\|version=0ddba11e\|[\s\S]*\(Vapor, newer\)\n$/);
  await wait(() => B.items().length > 0, "it shows the store again", 30000);
});

await test("games: download SimDOOM, play it, achievements and play time come back", async () => {
  await B.toStore();
  await B.select("SimDOOM");
  await B.click("Install");
  await wait(() => /^SIMDOOM\|SimDOOM\|/m.test(library()), "the download", 40000).catch((e) => { throw new Error(e.message + "\n" + library() + "\n" + JSON.stringify(bravo.kernel.ps().map((p) => p.name + p.pid)) + "\n" + B.labels().join(" / ") + "\n" + bravo.widgets(B.pid(), "Window")[0].get("Status") + JSON.stringify(bravo.ui.dialogs) + bravo.errors + " items " + B.items().join(" / ")); });
  await B.toLibrary();
  await B.select("SimDOOM");
  await B.click("Play");
  await wait(() => proc(bravo, "SIMDOOM") && bravo.widgets(proc(bravo, "SIMDOOM"), "Canvas").length, "the game", 30000);
  const doom = proc(bravo, "SIMDOOM");
  const screen = bravo.widgets(doom, "Canvas")[0];
  const state = () => String(bravo.widgets(doom, "Window")[0].get("Tag"));
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { screen.fire("onKey", k); await new Promise((r) => setTimeout(r, 15)); } };
  await key("Enter");
  await wait(() => state().startsWith("play|100|30|0"), "a new game");
  await key("Space");
  await wait(() => state().startsWith("play|100|29|"), "a shot");
  for (const k of "iddqd") await key(k);
  await new Promise((r) => setTimeout(r, 1200));
  bravo.kernel.kill(doom);
  await wait(() => /^SIMDOOM\|SimDOOM\|[^|]+\|[1-9]\d*\|/m.test(library()), "the play time");
  await wait(() => B.labels().some((t) => /^Played \d+ seconds/.test(t)), "it says so");
  assert.ok(bravo.widgets(B.pid(), "ListBox")[1].get("Items").some((t) => /^\* Cheater - Type IDDQD/.test(t)), "the achievement");
});

await test("SimDOOM -warp: flip the exit switch and E1M1 is done", async () => {
  const pid = bravo.run("C:\\GAMES\\SIMDOOM\\SIMDOOM.SPK", ["-warp"]);
  await wait(() => bravo.widgets(pid, "Canvas").length, "the game", 30000);
  const screen = bravo.widgets(pid, "Canvas")[0];
  screen.fire("onKey", "Enter");
  await wait(() => String(bravo.widgets(pid, "Window")[0].get("Tag")).startsWith("play"), "playing");
  screen.fire("onKey", "e");
  await wait(() => String(bravo.widgets(pid, "Window")[0].get("Tag")).startsWith("won|"), "the exit");
  const got = bravo.read("C:\\GAMES\\SIMDOOM\\ACHIEVE.TXT");
  for (const a of ["E1M1 Complete", "Speedrunner", "Untouchable"]) assert.match(got, new RegExp("^" + a + "\\|", "m"));
  bravo.kernel.kill(pid);
});

await test("Snake 95: download, play, crash into the wall", async () => {
  await B.toStore();
  await B.select("Snake 95");
  await B.click("Install");
  await wait(() => bravo.exists("C:\\GAMES\\SNAKE\\SNAKE.SPK"), "the download", 30000);
  const pid = bravo.run("C:\\GAMES\\SNAKE\\SNAKE.SPK");
  await wait(() => bravo.widgets(pid, "Canvas").length, "the game", 30000);
  const board = bravo.widgets(pid, "Canvas")[0];
  const state = () => String(bravo.widgets(pid, "Window")[0].get("Tag"));
  board.fire("onKey", "Enter");
  await wait(() => state().startsWith("play"), "playing");
  board.fire("onKey", "ArrowUp");
  await wait(() => state().startsWith("over"), "the crash", 10000);
  assert.match(bravo.read("C:\\GAMES\\SNAKE\\ACHIEVE.TXT"), /^Ouroboros\|/m);
  bravo.kernel.kill(pid);
});

await test("uninstalling a program stops it and deletes its files", async () => {
  await B.toLibrary();
  await B.select("Frostbird");
  bravo.ui.answers.push(true);
  await B.click("Uninstall");
  await wait(() => !/^FROSTBRD\|/m.test(library()), "off the library");
  assert.ok(!bravo.exists("C:\\PROGRAMS\\FROSTBRD.SPK"));
  await wait(() => !proc(bravo, "FROSTBRD"), "stopped");
  said(bravo);
  assert.deepEqual(bravo.errors, []);
  assert.deepEqual(alpha.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
