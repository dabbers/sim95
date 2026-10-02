// Tests for tools/vapor-bridge.js, the browser-console script that stocks a
// Vapor store from GitHub, and for Vapor's side of it (Check for Updates,
// Reinstall, programs found on the machine):
//   STARTHERE  a machine that becomes a store by the bridge alone
//   REFSTORE   a store made the usual way (Vapor's INSTALL.SPK, Publish Apps),
//              to show the bridge stocks shelves just as those do
//   CLIENT     Vapor, shopping at STARTHERE
// The bridge runs as it does in a browser, with the machine and GitHub
// swapped for this one's disk and the repository on disk.
//   node tools/aspsim/bridge.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Network } from "./network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repo = (p) => fs.readFileSync(path.join(root, p), "utf8");
const bridgeCode = repo("tools/vapor-bridge.js");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}

const net = new Network();
const store = await net.boot("STARTHERE");
const refstore = await net.boot("REFSTORE");
const client = await net.boot("CLIENT");
store.run("C:\\PROGRAMS\\HTTPD.SPK");
const wait = (fn, what, ms = 20000) => net.until(fn, ms, what);
const proc = (m, name) => m.kernel.ps().find((p) => p.name === name)?.pid;
const said = (m) => m.ui.dialogs.splice(0).map((d) => d.text).join("\n---\n");
const shelf = repo("vapor/SHELF/SHELF.TXT");
const items = shelf.split("\n").filter((l) => l.startsWith("item ")).map((l) => l.split(" ")[1]);

// The bridge, as pasted into the console: the machine is m, GitHub is the
// repository on disk (with changes, to stand in for newer commits).
async function bridge(m, changed = {}, extra = {}) {
  const logs = [];
  globalThis.VAPOR_BRIDGE = {
    machine: { fs: m.disk, kernel: m.kernel, hostname: () => m.stack.hostname() },
    get: async (p) => (p in changed ? changed[p] : repo(p)),
    log: (...a) => logs.push(a.join(" ")),
    ...extra,
  };
  try { return { ...(await (0, eval)(bridgeCode)), logs }; }
  finally { delete globalThis.VAPOR_BRIDGE; }
}
const catalogOf = (m) => m.read("C:\\WEB\\VAPOR\\CATALOG.TXT").trim().split("\n");
const entry = (m, id) => catalogOf(m).find((l) => l.startsWith(id + "|"));
const joined = (m, id) => { let t = ""; for (let i = 1; i <= +entry(m, id).split("|")[2]; i++) t += m.read(`C:\\WEB\\VAPOR\\${id}\\${i}.TXT`); return t; };

await test("the builder's shelf lists every app with a Vapor header, Vapor itself and the games", async () => {
  assert.deepEqual(items.slice(0, 3), ["vapor/SHELF/VAPOR.SPK", "vapor/SHELF/SIMDOOM.SPK", "vapor/SHELF/SNAKE.SPK"]);
  for (const app of ["simbook", "coldmail", "asksim", "simxplorer", "simplayer", "frostbird", "clippy", "simhost", "geosimies", "simpal", "simtube", "simstats", "simsh", "wikisim", "simweb", "eliza"]) assert.ok(items.includes(app + "/INSTALL.SPK"), app);
  assert.ok(!items.includes("simnic/INSTALL.SPK"), "SimNIC is the central host's alone");
  for (const l of shelf.split("\n").filter((l) => l.startsWith("item "))) {
    const [, p, version] = l.split(" ");
    assert.equal(/\|version=([^|]*)/.exec(repo(p).split("\n")[0])[1], version, p);
  }
  assert.match(shelf, /^soon HL3\|Half-Life 3\|0\|0\|soon\|/m);
  assert.match(shelf, /^site vapor\/WEB\/INDEX.ASP C:\\WEB\\VAPOR\\INDEX.ASP$/m);
});

await test("a machine with no store becomes one: every item on the shelves, Vapor installed and running", async () => {
  assert.ok(!store.exists("C:\\WEB\\VAPOR"));
  const r = await bridge(store);
  assert.equal(r.report.length, items.length);
  assert.ok(r.report.every((x) => x.result === "new"), JSON.stringify(r.report));
  assert.match(r.logs.join("\n"), /This machine is a Vapor store now\. Vapor is starting\./);
  assert.match(entry(store, "VAPOR"), /^VAPOR\|Vapor\|\d+\|\d+\|ok\|Vapor\|.*\|client\|[0-9a-f]{8}\|C:\\PROGRAMS\\VAPOR.SPK\|/);
  assert.match(entry(store, "HL3"), /\|soon\|/);
  for (const id of ["SIMDOOM", "SNAKE", "SIMBOOK", "COLDMAIL", "SIMXPLOR", "WIKISIM", "SIMWEB", "ELIZA"]) assert.ok(entry(store, id), id);
  // the parts put back together are the file
  assert.ok(+entry(store, "SIMXPLOR").split("|")[2] > 10, "Simxplorer comes in many parts");
  assert.equal(joined(store, "SIMXPLOR"), repo("simxplorer/INSTALL.SPK").replace(/\n?$/, "\n"));
  assert.equal(store.read("C:\\PROGRAMS\\VAPOR.SPK"), repo("vapor/SHELF/VAPOR.SPK"));
  assert.equal(store.read("C:\\WEB\\VAPOR\\INDEX.ASP"), repo("vapor/WEB/INDEX.ASP"));
  assert.match(store.read("C:\\WEB\\VAPOR\\BRIDGE.TXT"), /^github\.com\/dabbers\/sim95\|main\|main\|\d{4}-\d\d-\d\d \d\d:\d\d\n$/);
  await wait(() => proc(store, "VAPOR"), "Vapor on the store");
  const page = await store.fetch("STARTHERE", "/vapor/");
  assert.match(page, /<b>SimBook<\/b>[\s\S]*<b>WikiSim<\/b>[\s\S]*<b>SimDOOM<\/b>/);
  assert.match(page, /The shelves were last stocked from github\.com\/dabbers\/sim95 \(main, main\) on \d{4}-/);
});

await test("the shelves are the same as Vapor's INSTALL.SPK and Publish Apps make them", async () => {
  refstore.write("C:\\MYFILES\\INSTALL.SPK", repo("vapor/INSTALL.SPK"));
  const pid = refstore.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !refstore.running(pid), "the store installer", 30000);
  await wait(() => proc(refstore, "VAPOR"), "Vapor on REFSTORE");
  refstore.write("C:\\MYFILES\\FROST.SPK", repo("frostbird/INSTALL.SPK"));
  refstore.write("C:\\MYFILES\\ELIZA.SPK", repo("eliza/INSTALL.SPK"));
  refstore.widgets(proc(refstore, "VAPOR"), "Menu")[0].fire("onSelect", "Publish Apps...");
  await wait(() => refstore.ui.dialogs.length, "the publish report", 30000);
  assert.match(said(refstore), /Published:/);
  for (const id of ["VAPOR", "SIMDOOM", "SNAKE", "HL3", "SIMPLAYR", "SIMWEB", "FROSTBRD", "ELIZA"]) {
    assert.equal(entry(store, id), entry(refstore, id), id);
    if (id !== "HL3") assert.equal(joined(store, id), joined(refstore, id), id + "'s parts");
  }
  for (const f of ["GETVAPOR.ASP", "GETVAPOR.TXT", "GO.ASP", "GO.TXT", "INDEX.ASP"]) assert.equal(store.read("C:\\WEB\\VAPOR\\" + f), refstore.read("C:\\WEB\\VAPOR\\" + f).replace(/\n?$/, repo("vapor/WEB/" + f).endsWith("\n") ? "\n" : ""), f);
});

await test("run again, it touches nothing but its note; what the store had besides is kept", async () => {
  store.write("C:\\WEB\\VAPOR\\CATALOG.TXT", store.read("C:\\WEB\\VAPOR\\CATALOG.TXT") + "MYGAME|My Game|1|10|ok|Fun|mine|game|1234abcd|C:\\GAMES\\MYGAME\\MYGAME.SPK|C:\\GAMES\\MYGAME\\MYGAME.SPK|MYGAME||\n");
  const written = [];
  const off = store.disk.onChange((p) => written.push(p));
  const r = await bridge(store);
  off();
  assert.ok(r.report.every((x) => x.result === "up to date"), JSON.stringify(r.report.filter((x) => x.result !== "up to date")));
  assert.deepEqual([...new Set(written)].sort(), ["C:\\WEB\\VAPOR\\BRIDGE.TXT", "C:\\WEB\\VAPOR\\CATALOG.TXT"]);
  assert.ok(entry(store, "MYGAME"), "the store's own item stays");
});

// Driving a Vapor window
const ui = (m) => {
  const vapor = () => proc(m, "VAPOR");
  const self = {
    pid: vapor,
    status: () => String(m.widgets(vapor(), "Window")[0]?.get("Status") ?? ""),
    list: () => m.widgets(vapor(), "ListBox")[0],
    items: () => self.list()?.get("Items") ?? [],
    labels: () => m.widgets(vapor(), "Label").map((l) => l.get("Text")),
    button: (text) => m.widgets(vapor(), "Button").find((b) => String(b.get("Text")).replace("&", "") === text && b.get("Visible") !== false),
    menu: (item) => m.widgets(vapor(), "Menu")[0].fire("onSelect", item),
    async toTab(x, name) {
      const head = m.widgets(vapor(), "Canvas")[0];
      head.set("Tag", "");
      head.fire("onMouseDown", x, 20, 1);
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
const C = ui(client);
const library = () => (client.exists("C:\\GAMES\\LIBRARY.TXT") ? client.read("C:\\GAMES\\LIBRARY.TXT") : "");
const libLine = (id) => library().split("\n").find((l) => l.startsWith(id + "|")) ?? "";

await test("Vapor on another machine: programs pasted in by hand are found, and offered as updates", async () => {
  // SimPlayer was put here by pasting its INSTALL.SPK, long ago; ELIZA too, as the home page
  client.write("C:\\PROGRAMS\\PLAYER.SPK", "' an old SimPlayer\nSUB Main ()\nEND SUB\n");
  for (const f of ["BOT.SPK", "ELIZA.HTM", "INDEX.ASP"]) client.write("C:\\WEB\\" + f, "' old ELIZA");
  client.write("C:\\PROGRAMS\\VAPOR.SPK", store.read("C:\\PROGRAMS\\VAPOR.SPK"));
  client.mkdir("C:\\GAMES");
  client.write("C:\\GAMES\\VAPOR.INI", "store=http://starthere/vapor/\n");
  client.run("C:\\PROGRAMS\\VAPOR.SPK");
  await wait(() => C.pid() && C.items().some((i) => i.trim() === "SimBook"), "the store on CLIENT", 30000);
  assert.match(libLine("SIMPLAYR"), /^SIMPLAYR\|SimPlayer\|\d{4}-\d\d-\d\d\|0\|Multimedia\|[^|]*\|found\|program\|/);
  assert.equal(libLine("ELIZA"), "", "a web app on the home page isn't taken for granted");
  assert.match(C.status(), /1 update: Vapor > Update All$/);
  await C.toLibrary();
  await wait(() => C.items().includes("SimPlayer  (update)"), "the update: " + C.items().join(" / "));
  await C.select("SimPlayer");
  assert.ok(C.labels().includes("Program  -  installed without Vapor"), C.labels().join(" / "));
  await C.click("Update");
  await wait(() => libLine("SIMPLAYR").split("|")[6] === entry(store, "SIMPLAYR").split("|")[8], "SimPlayer updated", 40000);
  assert.match(client.read("C:\\PROGRAMS\\PLAYER.SPK"), /SimPlayer/);
  assert.notEqual(client.read("C:\\PROGRAMS\\PLAYER.SPK"), "' an old SimPlayer\nSUB Main ()\nEND SUB\n");
  if (proc(client, "PLAYER")) client.kernel.kill(proc(client, "PLAYER"));
});

await test("a new build on GitHub: the bridge publishes it, Check for Updates finds it, Update brings it", async () => {
  await C.toStore();
  await C.select("Frostbird");
  await C.click("Install");
  await wait(() => libLine("FROSTBRD"), "Frostbird installed", 40000);
  await wait(() => proc(client, "FROSTBRD"), "Frostbird started");
  client.kernel.kill(proc(client, "FROSTBRD"));
  const old = entry(store, "FROSTBRD").split("|")[8];
  assert.equal(libLine("FROSTBRD").split("|")[6], old);
  // the repository moves on: a new Frostbird
  const newer = repo("frostbird/INSTALL.SPK").replace(/version=[0-9a-f]{8}/, "version=feedf00d") + "' (a newer build)\n";
  const r = await bridge(store, { "frostbird/INSTALL.SPK": newer, "vapor/SHELF/SHELF.TXT": shelf.replace(/^(item frostbird\/INSTALL.SPK )[0-9a-f]{8}$/m, "$1feedf00d") });
  assert.deepEqual(r.report.filter((x) => x.result !== "up to date"), [{ item: "Frostbird", id: "FROSTBRD", build: "feedf00d", result: "updated from " + old }]);
  assert.match(r.logs.at(-1), /1 new or updated, \d+ already up to date\./);
  await C.toLibrary();
  assert.ok(C.items().includes("Frostbird"), "not known yet: " + C.items().join(" / "));
  C.menu("Check for Updates");
  await wait(() => /1 update: Vapor > Update All$/.test(C.status()), "the check: " + C.status());
  await wait(() => C.items().includes("Frostbird  (update)"), "marked in the library: " + C.items().join(" / "));
  await C.select("Frostbird");
  await C.click("Update");
  await wait(() => libLine("FROSTBRD").split("|")[6] === "feedf00d", "Frostbird updated", 40000);
  assert.match(client.read("C:\\GAMES\\FROSTBRD\\INSTALL.SPK"), /\(a newer build\)\n$/);
  await wait(() => proc(client, "FROSTBRD"), "the new Frostbird started");
  client.kernel.kill(proc(client, "FROSTBRD"));
  C.menu("Check for Updates");
  await wait(() => /everything is up to date$/.test(C.status()), "nothing more: " + C.status());
});

await test("nothing newer: Reinstall puts the same build back", async () => {
  await C.toLibrary();
  await C.select("Frostbird");
  await wait(() => C.button("Reinstall"), "the Reinstall button");
  assert.ok(!C.button("Update"));
  client.remove("C:\\PROGRAMS\\FROSTBRD.SPK"); // broken somehow
  await C.click("Reinstall");
  await wait(() => client.exists("C:\\PROGRAMS\\FROSTBRD.SPK"), "Frostbird back", 40000);
  await wait(() => proc(client, "FROSTBRD"), "and started");
  client.kernel.kill(proc(client, "FROSTBRD"));
  assert.equal(libLine("FROSTBRD").split("|")[6], "feedf00d");
  assert.deepEqual(client.errors, []);
});

await test("in a browser: it finds the running machine in the page, and fetches one commit from GitHub", async () => {
  const machine = { fs: store.disk, kernel: store.kernel, hostname: () => "starthere" };
  const element = { "__reactFiber$x1": { memoizedProps: { className: "icon" }, return: { memoizedProps: { store: {} }, return: { memoizedProps: { machine, onShutdown() {} }, return: null } } } };
  const asked = [];
  const real = { document: globalThis.document, fetch: globalThis.fetch };
  globalThis.document = { querySelectorAll: () => [{}, element] };
  globalThis.fetch = async (url) => {
    asked.push(url);
    if (url.startsWith("https://api.github.com/repos/dabbers/sim95/commits/")) return { ok: true, json: async () => ({ sha: "0123456789abcdef0123456789abcdef01234567" }) };
    const m = /^https:\/\/raw\.githubusercontent\.com\/dabbers\/sim95\/0123456789abcdef0123456789abcdef01234567\/(.+)$/.exec(url);
    return m ? { ok: true, text: async () => repo(m[1]) } : { ok: false, status: 404, statusText: "Not Found" };
  };
  try {
    const logs = [];
    globalThis.VAPOR_BRIDGE = { ref: "some-branch", log: (...a) => logs.push(a.join(" ")) };
    const r = await (0, eval)(bridgeCode);
    assert.equal(r.sha, "0123456789abcdef0123456789abcdef01234567");
    assert.equal(asked[0], "https://api.github.com/repos/dabbers/sim95/commits/some-branch");
    assert.ok(asked.includes("https://raw.githubusercontent.com/dabbers/sim95/0123456789abcdef0123456789abcdef01234567/vapor/SHELF/SHELF.TXT"));
    assert.match(logs[0], /stocking starthere's store from github\.com\/dabbers\/sim95 \(some-branch 0123456\)/);
    assert.match(store.read("C:\\WEB\\VAPOR\\BRIDGE.TXT"), /^github\.com\/dabbers\/sim95\|some-branch\|0123456789abcdef0123456789abcdef01234567\|/);
    // the newer Frostbird above isn't on GitHub: the store goes back to the repository's
    assert.deepEqual(r.report.filter((x) => x.result !== "up to date").map((x) => x.id), ["FROSTBRD"]);
    // no SIM95 on the page: it says so
    globalThis.document = { querySelectorAll: () => [{}] };
    await assert.rejects((0, eval)(bridgeCode), /no running SIM95 here/);
  } finally {
    delete globalThis.VAPOR_BRIDGE;
    globalThis.document = real.document;
    globalThis.fetch = real.fetch;
  }
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
