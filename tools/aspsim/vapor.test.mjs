// End-to-end tests for Vapor (vapor/): a games store on ALPHA, the Vapor
// program fetched from the store's page onto BRAVO, a download, SimDOOM.
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
const wait = (fn, what, ms = 15000) => net.until(fn, ms, what);
const proc = (m, name) => m.kernel.ps().find((p) => p.name === name)?.pid;
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

await test("the installer makes ALPHA a store, and starts Vapor", async () => {
  alpha.write("C:\\MYFILES\\INSTALL.SPK", fs.readFileSync(path.join(root, "vapor/INSTALL.SPK"), "utf8"));
  const pid = alpha.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !alpha.running(pid), "the installer", 30000);
  assert.match(alpha.output(pid), /this machine is a store: http:\/\/alpha\/vapor\//);
  assert.match(alpha.read("C:\\WEB\\VAPOR\\CATALOG.TXT"), /^SIMDOOM\|SimDOOM\|\d+\|\d+\|ok\|Shooter\|/m);
  const doom = fs.readFileSync(path.join(root, "vapor/GAMES/SIMDOOM.SPK"), "utf8");
  const n = +alpha.read("C:\\WEB\\VAPOR\\CATALOG.TXT").split("\n")[0].split("|")[2];
  let joined = "";
  for (let i = 1; i <= n; i++) { const p = alpha.read(`C:\\WEB\\VAPOR\\SIMDOOM\\${i}.TXT`); assert.ok(p.length < 20000); joined += p; }
  assert.equal(joined, doom.endsWith("\n") ? doom : doom + "\n");
  await wait(() => proc(alpha, "VAPOR"), "Vapor on alpha");
});

await test("the store's page lists the games and hands out Vapor to BRAVO", async () => {
  const r = await alpha.fetch("ALPHA", "/vapor/");
  assert.match(r, /HTTP\/1.0 200/);
  assert.match(r, /<b>SimDOOM<\/b>/);
  assert.match(r, /Half-Life 3[\s\S]*Coming soon/);
  const program = decode(/<pre><font color="#A4D007">([\s\S]*?)<\/font><\/pre>/.exec(r)[1]);
  assert.match(program, /CONST FROM = "alpha"/);
  bravo.write("C:\\MYFILES\\GETVAPOR.SPK", program);
  const pid = bravo.run("C:\\MYFILES\\GETVAPOR.SPK");
  await wait(() => !bravo.running(pid), "GETVAPOR", 30000);
  assert.match(bravo.output(pid), /Vapor is installed/);
  assert.equal(bravo.read("C:\\PROGRAMS\\VAPOR.SPK"), fs.readFileSync(path.join(root, "vapor/PROGRAMS/VAPOR.SPK"), "utf8").replace(/\n?$/, "\n"));
  assert.equal(bravo.read("C:\\GAMES\\VAPOR.INI"), "store=http://alpha/vapor/\n");
});

const vapor = () => proc(bravo, "VAPOR");
const games = () => bravo.widgets(vapor(), "ListBox")[0];
const labels = () => bravo.widgets(vapor(), "Label").map((l) => l.get("Text"));
const button = (text) => bravo.widgets(vapor(), "Button").find((b) => String(b.get("Text")).replace("&", "") === text);
const tab = (x) => bravo.widgets(vapor(), "Canvas")[0].fire("onMouseDown", x, 20, 1);
const select = async (name) => {
  await wait(() => games()?.get("Items").some((i) => i.startsWith(name)), name + " in the list");
  games().set("Selected", games().get("Items").findIndex((i) => i.startsWith(name)));
  games().fire("onSelect");
};

await test("BRAVO's Vapor shows the store; Half-Life 3 is coming soon", async () => {
  await wait(() => vapor() && games()?.get("Items").length === 3, "the catalog");
  await select("Half-Life 3");
  await wait(() => button("Coming soon"), "the button");
  assert.equal(button("Coming soon").get("Enabled"), false);
  await select("SimDOOM");
  await wait(() => button("Install"), "Install");
  assert.ok(labels().some((t) => /^Shooter  -  \d+ KB  -  Free$/.test(t)));
});

await test("Install downloads the game part by part into the library", async () => {
  button("Install").call("Click");
  await wait(() => /SIMDOOM\|SimDOOM\|/.test(bravo.exists("C:\\GAMES\\LIBRARY.TXT") ? bravo.read("C:\\GAMES\\LIBRARY.TXT") : ""), "the download", 30000);
  assert.equal(bravo.read("C:\\GAMES\\SIMDOOM\\SIMDOOM.SPK"), fs.readFileSync(path.join(root, "vapor/GAMES/SIMDOOM.SPK"), "utf8").replace(/\n?$/, "\n"));
  assert.ok(labels().some((t) => t === "SimDOOM is ready to play."));
});

await test("Play starts SimDOOM; play time and achievements come back to the library", async () => {
  tab(300);
  await select("SimDOOM");
  await wait(() => button("Play"), "Play");
  button("Play").call("Click");
  await wait(() => proc(bravo, "SIMDOOM") && bravo.widgets(proc(bravo, "SIMDOOM"), "Canvas").length, "the game", 30000);
  const doom = proc(bravo, "SIMDOOM");
  const screen = bravo.widgets(doom, "Canvas")[0];
  const state = () => String(bravo.widgets(doom, "Window")[0].get("Tag"));
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { screen.fire("onKey", k); await new Promise((r) => setTimeout(r, 15)); } };
  await key("Enter");
  await wait(() => state().startsWith("play|100|30|0"), "a new game");
  await key("Space");
  await wait(() => state().startsWith("play|100|29|"), "a shot");
  await key("ArrowUp", 6);
  await wait(() => +state().split("|")[4] > 15, "walking");
  for (const k of "iddqd") await key(k);
  await new Promise((r) => setTimeout(r, 1200));
  bravo.kernel.kill(doom);
  await wait(() => /\|SimDOOM\|[^|]+\|[1-9]\d*\|/.test(bravo.read("C:\\GAMES\\LIBRARY.TXT")), "the play time");
  await wait(() => labels().some((t) => /^Played \d+ seconds/.test(t)), "it says so");
  assert.ok(bravo.widgets(vapor(), "ListBox")[1].get("Items").some((t) => /^\* Cheater - Type IDDQD/.test(t)), "the achievement");
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
  tab(200);
  await select("Snake 95");
  await wait(() => button("Install"), "Install");
  button("Install").call("Click");
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

await test("Uninstall takes it away", async () => {
  tab(300);
  await select("SimDOOM");
  await wait(() => button("Uninstall")?.get("Visible"), "Uninstall");
  bravo.ui.answers.push(true);
  button("Uninstall").call("Click");
  await wait(() => !bravo.exists("C:\\GAMES\\SIMDOOM"), "the files gone");
  assert.ok(!bravo.read("C:\\GAMES\\LIBRARY.TXT").includes("SIMDOOM"), "off the library");
  assert.deepEqual(bravo.errors, []);
  assert.deepEqual(alpha.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
