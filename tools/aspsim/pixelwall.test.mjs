// Tests for the Pixel Wall (pixelwall/): installing it, placing pixels from
// Voyager (plain links) and from Simxplorer (JavaScript, without reloading),
// the wait between pixels, the picture of the wall, and Simxplorer seeing
// other people's pixels arrive by themselves.
//   node tools/aspsim/pixelwall.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MESSAGE_LIMIT } from "./sim.mjs";
import { Network } from "./network.mjs";
import { simxplorerSource } from "../simxplorer-source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = (f) => fs.readFileSync(path.join(root, f), "utf8");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const net = new Network();
const host = await net.boot("WALLHOST");
const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");
const charlie = await net.boot("CHARLIE");
const delta = await net.boot("DELTA");
const wait = (fn, what, ms = 15000) => net.until(fn, ms, what);

// Voyager, as far as the web server can tell: HTTP/1.0, its User-Agent, one connection a request
async function http(from, p, { method = "GET", body = "", agent = "Voyager/1.1 (SIM95)" } = {}) {
  const conn = await from.stack.connect(0, "WALLHOST", 80);
  const parts = [];
  const done = new Promise((r) => conn.onClose(r));
  conn.onMessage((t) => parts.push(t));
  let req = `${method} ${p} HTTP/1.0\nHost: wallhost\nUser-Agent: ${agent}`;
  if (method === "POST") req += `\nContent-Type: application/x-www-form-urlencoded\nContent-Length: ${body.length}\n\n${body}`;
  conn.send(req);
  await Promise.race([done, sleep(8000)]);
  const raw = parts.join("\n");
  const cut = raw.indexOf("\n\n");
  const lines = (cut < 0 ? raw : raw.slice(0, cut)).split("\n");
  return { status: lines[0].replace(/^HTTP\/1\.0 /, ""), headers: lines.slice(1), body: cut < 0 ? "" : raw.slice(cut + 2), raw };
}
const ok = (r) => {
  assert.equal(r.status, "200 OK", r.raw.slice(0, 400));
  assert.ok(!/ActiveSparkPages error|did not compile/.test(r.body), r.body.slice(0, 1500));
  return r;
};
// a link clicked in Voyager: the page it ends up on
async function click(from, href) {
  const r = await http(from, "/wall/" + href);
  assert.match(r.status, /^302/, r.raw.slice(0, 300));
  const to = r.headers.find((h) => h.startsWith("Location: ")).slice(10);
  return ok(await http(from, to.startsWith("/") ? to : "/wall/" + to));
}
const wallRows = () => host.read("C:\\WALLDATA\\WALL.TXT").trim().split("\n");
const pixel = (x, y) => wallRows()[y][x];
// each part of the wall's own wait, forgotten (for tests about something else)
const forgetParts = () => host.write("C:\\WALLDATA\\COOL.TXT", host.read("C:\\WALLDATA\\COOL.TXT").split("\n").filter((l) => !l.startsWith("part")).join("\n"));

await test("installing: the wall in C:\\WEB\\WALL, a white wall in C:\\WALLDATA, and its place on the front page", async () => {
  const installer = src("pixelwall/INSTALL.SPK");
  assert.ok(!installer.startsWith("' VAPOR|"), "not in the stores: there's one wall, on the central host");
  host.write("C:\\MYFILES\\INSTALL.SPK", installer);
  host.ui.answers.push(true); // not the central host: install anyway
  const pid = host.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !host.running(pid), "the installer", 60000);
  const out = host.output(pid);
  assert.match(out, /not the central host, starthere\.56k\.net: installing anyway/);
  assert.match(out, /made a white wall in C:\\WALLDATA/);
  assert.match(out, /Open http:\/\/wallhost\/wall\/ in Voyager\./);
  assert.deepEqual(host.ui.dialogs.map((d) => d.title), ["Pixel Wall Setup"]);
  for (const f of ["INDEX.ASP", "PLACE.ASP", "DATA.ASP", "WALL.ASP", "WALL.SPK", "WALL.JS", "APP.INF"]) assert.ok(host.exists("C:\\WEB\\WALL\\" + f), f);
  assert.match(host.read("C:\\WEB\\WALL\\APP.INF"), /^The Pixel Wall\|One wall of pixels/);
  assert.equal(wallRows().length, 64);
  assert.ok(wallRows().every((r) => r === "F".repeat(64)));
  // running it again keeps the wall
  host.write("C:\\WALLDATA\\WALL.TXT", "9" + "F".repeat(63) + "\n" + wallRows().slice(1).join("\n") + "\n");
  host.ui.answers.push(true);
  const again = host.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !host.running(again), "the installer again", 60000);
  assert.equal(pixel(0, 0), "9");
  host.write("C:\\WALLDATA\\WALL.TXT", ("F".repeat(64) + "\n").repeat(64));
  host.run("C:\\PROGRAMS\\HTTPD.SPK");
  await wait(async () => /200 OK/.test(await host.fetch("WALLHOST", "/wall/wall.asp").catch(() => "")), "the web server", 30000);
});

await test("Voyager: the page, a 16 by 16 part of the wall as links, the whole wall as a picture, colours and parts", async () => {
  const r = ok(await http(alpha, "/wall/"));
  assert.ok(r.raw.length < MESSAGE_LIMIT, "fits in one message: " + r.raw.length);
  const squares = [...r.body.matchAll(/<td bgcolor="(#[0-9A-F]{6})"><a href="place\.asp\?x=(\d+)&y=(\d+)&c=0&r=5"><img src="(?:http:\/\/[\d.]+\/wall\/)?c([0-9A-F])\.pic" width="20" height="20" alt=""><\/a><\/td>/g)];
  assert.equal(squares.length, 256, "B2's squares");
  assert.deepEqual([squares[0][2], squares[0][3]], ["16", "16"]);
  assert.deepEqual([squares[255][2], squares[255][3]], ["31", "31"]);
  assert.ok(squares.every((s) => s[1] === "#FFFFFF" && s[4] === "F"));
  assert.match(r.body, /<img src="(?:http:\/\/[\d.]+\/wall\/)?wall\.asp\?v=0" width="128" height="128"/);
  assert.match(r.body, /<b>Colour:<\/b> Black/);
  assert.match(r.body, /<td bgcolor="#FF0000"><a href="index\.asp\?r=5&c=9"><img src="(?:http:\/\/[\d.]+\/wall\/)?c9\.pic" width="20" height="20" alt=""><\/a><\/td>/, "a link for Red");
  assert.match(r.body, /<td bgcolor="#000000"><a href="index\.asp\?r=5&c=0"><img src="(?:http:\/\/[\d.]+\/wall\/)?s0\.pic"/, "Black, in use, with its dot");
  console.log("      (the page is " + r.raw.length + " bytes)");
  assert.match(r.body, /bgcolor="#000080"><font size="2" color="#FFFFFF"><b>B2<\/b>/, "B2 is where we are");
  assert.match(r.body, /<a href="index\.asp\?r=0&c=0">A1<\/a>/);
  assert.match(r.body, /<body [^>]*onload="Page_Load">\s*<script type="spark">\s*SUB Page_Load \(\)\s*SYS\.Sleep\(30000\)\s*PAGE\.Navigate\("http:\/\/wallhost\/wall\/index\.asp\?r=5&c=0"\)/);
  assert.match(r.body, /Ready: click a square/);
  // the pictures in the links: one colour each, and with a dot
  assert.equal((await http(alpha, "/wall/c9.pic")).body, "SIM95PIC 1 1\n9\n");
  assert.equal((await http(alpha, "/wall/s0.pic")).body, "SIM95PIC 5 5\n00000\n00000\n00F00\n00000\n00000\n");
  assert.equal(new Set([...r.body.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1])).size, 17, "16 colour pictures and the wall");
  const pic = await http(alpha, "/wall/wall.asp?v=0");
  assert.match(pic.body, /^SIM95PIC 64 64\n(F{64}\n){64}$/);
});

await test("Voyager: a square placed, the wait before the next, and someone else meanwhile", async () => {
  let r = await click(alpha, "place.asp?x=20&y=17&c=9&r=5");
  assert.match(r.body, /Placed: Red at 20,17\./);
  assert.match(r.body, /Next pixel in 1[45] seconds/);
  assert.match(r.body, /ALPHA put Red at 20,17 \(\d\d:\d\d\)/);
  assert.equal(pixel(20, 17), "9");
  assert.match(r.body, /<td bgcolor="#FF0000"><a href="place\.asp\?x=20&y=17&c=9&r=5">/);
  assert.match(r.body, /<img src="(?:http:\/\/[\d.]+\/wall\/)?wall\.asp\?v=1"/);
  // too soon
  r = await click(alpha, "place.asp?x=21&y=17&c=9&r=5");
  assert.match(r.body, /Not yet: one pixel every 15 seconds\./);
  assert.equal(pixel(21, 17), "F");
  // another machine, in the same part: that part takes one pixel every 15 seconds, from anyone
  r = await click(delta, "place.asp?x=22&y=17&c=2&r=5");
  assert.match(r.body, /Someone just drew in this part of the wall: it takes one pixel every 15 seconds\. Try another part, or wait\./);
  assert.match(r.body, /Next pixel in 1[45] seconds/, "and the countdown is the part's");
  assert.equal(pixel(22, 17), "F");
  assert.match(host.read("C:\\WALLDATA\\COOL.TXT"), /^part5\|\d+$/m);
  // another machine, in another part, isn't kept waiting
  r = await click(bravo, "place.asp?x=0&y=0&c=4&r=0");
  assert.match(r.body, /Placed: Navy at 0,0\./);
  assert.match(r.body, /BRAVO put Navy at 0,0[\s\S]*ALPHA put Red at 20,17/, "newest first");
  // nonsense
  r = await click(delta, "place.asp?x=64&y=3&c=2&r=5");
  assert.match(r.body, /That isn't a square on the wall\./);
  const pic = await http(delta, "/wall/wall.asp");
  const rows = pic.body.split("\n");
  assert.equal(rows[0], "SIM95PIC 64 64");
  assert.equal(rows[1][0], "4");
  assert.equal(rows[18][20], "9");
  assert.equal(host.read("C:\\WALLDATA\\VER.TXT").trim(), "2");
});

// Simxplorer on CHARLIE
charlie.write("C:\\PROGRAMS\\SIMXPLOR.SPK", simxplorerSource());
forgetParts();
const ie = charlie.run("C:\\PROGRAMS\\SIMXPLOR.SPK", ["http://wallhost/wall/"]);
const win = () => charlie.widgets(ie, "Window")[0];
const view = () => charlie.widgets(ie, "HtmlView")[0];
const html = () => String(view()?.get("Html") ?? "");
const el = (id) => view().elements.get(id);
// the page's cells with a handler, in order: the 256 squares come first
const cells = () => html().split("<").filter((t) => /^td\b/i.test(t) && /onclick="js:\d+"/.test(t)).map((t) => ({ colour: /bgcolor="?(#[0-9A-Fa-f]{6})/.exec(t)?.[1], js: /onclick="(js:\d+)"/.exec(t)[1], tag: t }));
const fire = (js) => view().fire("onScript", "onclick", js);

await test("Voyager's pictures: all asked for at once, all arrive (by address: lookups of one name at once are lost)", async () => {
  const page = ok(await http(charlie, "/wall/index.asp?r=0&c=9")).body;
  const srcs = [...new Set([...page.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]))];
  assert.ok(srcs.length >= 17, srcs.length + " pictures");
  for (const s of srcs) assert.match(s, /^http:\/\/65\.16\.0\.\d+\/wall\//, s);
  // as Voyager fetches them: every one at the same moment, each connecting to the host in its URL
  const fetchPic = async (url) => {
    const m = /^http:\/\/([^/]+)(\/.*)$/.exec(url);
    const conn = await charlie.stack.connect(0, m[1], 80);
    const parts = [];
    const done = new Promise((r) => conn.onClose(r));
    conn.onMessage((t) => parts.push(t));
    conn.send(`GET ${m[2]} HTTP/1.0\nHost: ${m[1]}\nUser-Agent: Voyager/1.1 (SIM95)`);
    await Promise.race([done, sleep(8000)]);
    const raw = parts.join("\n");
    return raw.slice(raw.indexOf("\n\n") + 2);
  };
  const bodies = await Promise.all(srcs.map((u) => Promise.race([fetchPic(u), sleep(10000).then(() => "never came")])));
  const bad = srcs.filter((u, i) => !bodies[i].startsWith("SIM95PIC"));
  assert.deepEqual(bad, []);
});

await test("robots don't draw: AskSim's crawler is turned away, and the page asks not to be followed", async () => {
  const before = host.read("C:\\WALLDATA\\WALL.TXT");
  const r = await http(delta, "/wall/place.asp?x=40&y=40&c=0&r=10", { agent: "AskSim/1.0 (http://starthere/)" });
  assert.match(r.status, /^403/);
  assert.equal(host.read("C:\\WALLDATA\\WALL.TXT"), before);
  assert.match(ok(await http(delta, "/wall/index.asp?plain=1")).body, /<meta name="robots" content="nofollow">/);
});

await test("Simxplorer: the wall drawn by its script, with every square, colour and part to click", async () => {
  await wait(() => win()?.get("Title") === "The Pixel Wall - Simxplorer" && String(win().get("Status")).startsWith("Done") && /Latest pixels/.test(html()), "the page in Simxplorer: " + win()?.get("Status") + " " + html().slice(0, 300), 60000);
  const c = cells();
  assert.equal(c.length, 256 + 15 + 16, "squares, the other 15 parts, and the colours");
  assert.equal(c[1 * 16 + 4].colour.toUpperCase(), "#FF0000", "ALPHA's red, at 20,17");
  assert.match(html(), /<img src="wall\.asp\?v=2"/);
  assert.match(el("cd").Text, /^Ready: click a square$/);
  assert.match(html(), /BRAVO put Navy at 0,0/);
  assert.deepEqual(charlie.errors, []);
});

await test("Simxplorer: a colour, a square, the countdown, and another part of the wall, without reloading", async () => {
  forgetParts();
  fire(cells()[256 + 15 + 12].js); // Blue
  await wait(() => /<b>Colour:<\/b> Blue/.test(html()), "Blue chosen");
  fire(cells()[2 * 16 + 5].js); // 21,18
  await wait(() => pixel(21, 18) === "C", "the pixel on the wall");
  await wait(() => cells()[2 * 16 + 5]?.colour.toUpperCase() === "#0000FF" && /Placed: Blue at 21,18\./.test(el("msg")?.Text ?? ""), "the page showing it: " + (el("msg")?.Text ?? ""));
  assert.match(el("cd").Text, /^Next pixel in 1[345] seconds$/);
  assert.match(html(), /CHARLIE put Blue at 21,18/);
  // too soon: said, and nothing sent
  fire(cells()[0].js);
  await wait(() => /^Not yet: the next pixel here in 1[0-5] seconds\.$/.test(el("msg").Text), "not yet: " + el("msg").Text);
  assert.equal(pixel(16, 16), "F");
  await wait(() => /^Next pixel in 1[0-3] seconds$/.test(el("cd").Text), "the countdown going down: " + el("cd").Text);
  // A1, the top left
  fire(cells().find((x) => /A1/.test(html().slice(html().indexOf(x.tag), html().indexOf(x.tag) + x.tag.length + 120))).js);
  await wait(() => /<b>A1<\/b>/.test(html()), "A1");
  assert.equal(cells()[0].colour.toUpperCase(), "#000080", "BRAVO's navy at 0,0");
  assert.equal(win().get("Title"), "The Pixel Wall - Simxplorer");
  assert.deepEqual(charlie.errors, []);
});

await test("Simxplorer: someone else's pixel turns up by itself", async () => {
  forgetParts();
  await click(delta, "place.asp?x=1&y=0&c=10&r=0");
  assert.equal(pixel(1, 0), "A");
  await wait(() => cells()[1]?.colour.toUpperCase() === "#00FF00", "DELTA's lime on CHARLIE's page", 20000);
  assert.match(html(), /DELTA put Lime at 1,0/);
  assert.match(html(), /<img src="wall\.asp\?v=4"/, "the picture of the whole wall, fetched again");
  // the plain page, if wanted
  assert.match(html(), /<a href="index\.asp\?r=0&c=12&plain=1">Plain version<\/a>/);
  assert.deepEqual(charlie.errors, []);
  charlie.kernel.kill(ie);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
