// End-to-end tests for SimTube (simtube/): the SimMovie format, SimPlayer
// playing from a disk and streaming from another machine, the web app
// (accounts, uploads, views, stars, comments), and SimTube in a SimHost folder.
//   node tools/aspsim/simtube.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, MESSAGE_LIMIT } from "./sim.mjs";
import { Network } from "./network.mjs";
import { withResolver } from "../simxplorer-source.mjs";
import { parse, calls, cut, samples, Movie, PART } from "../make-movies.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}
const ok = (r) => {
  assert.equal(r.status, "200 OK", r.url + " -> " + r.status + "\n" + r.body.slice(-400));
  assert.ok(!r.body.includes("ActiveSparkPages error") && !r.body.includes("did not compile"), r.url + ": " + r.body.replace(/<[^>]+>/g, " ").slice(0, 600));
  return r;
};
const movieFile = (f) => fs.readFileSync(path.join(root, "simtube/MOVIES", f), "utf8");
const installer = (app) => fs.readFileSync(path.join(root, app, "INSTALL.SPK"), "utf8");
const token = (r) => /name="t" value="([0-9A-F]+)"/.exec(r.body)[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const net = new Network();
const wait = (fn, what, ms = 20000) => net.until(fn, ms, what);
async function install(m, app) {
  m.write("C:\\MYFILES\\INSTALL.SPK", installer(app));
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !m.running(pid) || /in Voyager|from Files/.test(m.output(pid)), app + "'s installer", 60000);
  assert.deepEqual(m.ui.dialogs, [], app + ": " + m.output(pid));
  return m.output(pid);
}

const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");
const host = await net.boot("HOST");

// ---------------------------------------------------------------- the format

await test("the sample movies are what tools/make-movies.mjs makes, and parse", async () => {
  for (const s of samples) {
    const text = movieFile(s.file);
    assert.equal(text, s.make().toString(), s.file + " is out of date: run node tools/make-movies.mjs");
    const { meta, frames, pics } = parse(text);
    assert.equal(+meta.frames, frames.length, s.file);
    assert.ok(frames[0].startsWith("*"), s.file + " starts with a keyframe");
    assert.ok(+meta.width <= 320 && +meta.height <= 240 && +meta.fps >= 1 && +meta.fps <= 30);
    for (const p of cut(text)) assert.ok(p.length <= PART);
    for (const f of frames) for (const c of f.replace(/^\*/, "").split(";")) assert.match(c, /^(-|C\d+|B\d+|X|[FR]\d+,\d+,\d+,\d+|[DO]\d+,\d+,\d+|[LPQ][\d,-]+|T\d+,\d+,[^;]*|I\d+,\d+,\w+|S\d+,\d+)$/, s.file + ": " + c);
    for (const f of frames) for (const m of f.matchAll(/I\d+,\d+,(\w+)/g)) assert.ok(pics[m[1]], "picture " + m[1]);
  }
  assert.equal(parse(movieFile("WELCOME.SMV")).pics.logo.split("\n")[0], "SIM95PIC 24 24");
  assert.ok(cut(movieFile("DANCE.SMV")).length >= 3, "the dancing baby is long enough to stream");
});

// ---------------------------------------------------------------- the web app at the root

await test("the installer makes SimTube ALPHA's home page; the first visit puts the samples up", async () => {
  const said = await install(alpha, "simtube");
  assert.match(said, /SimTube is installed \(\d+ files\)/);
  assert.match(said, /Open http:\/\/alpha\/ in Voyager/);
  assert.ok(alpha.exists("C:\\WEB\\TUBE.SPK"));
  assert.ok(!alpha.exists("C:\\PROGRAMS\\PLAYER.SPK"), "SimPlayer is an app of its own now, from Vapor");
  // SimPlayer, installed on its own
  const playerSaid = await install(alpha, "simplayer");
  assert.match(playerSaid, /SimPlayer is installed \(1 files\)/);
  assert.equal(alpha.read("C:\\PROGRAMS\\PLAYER.SPK"), withResolver(fs.readFileSync(path.join(root, "simplayer/src/PLAYER.SPK"), "utf8")).replace(/\n?$/, "\n"), "with the SimDNS resolver joined on");
  assert.match(installer("simplayer"), /^' VAPOR\|id=SIMPLAYR\|name=SimPlayer\|kind=program\|version=[0-9a-f]{8}\|category=Multimedia\|run=C:\\PROGRAMS\\PLAYER.SPK\|files=C:\\PROGRAMS\\PLAYER.SPK\|tasks=PLAYER\|/);
  await wait(() => alpha.kernel.ps().some((x) => x.name === "PLAYER"), "SimPlayer to start");
  for (const x of alpha.kernel.ps().filter((x) => x.name === "PLAYER")) alpha.kernel.kill(x.pid);
  assert.ok(alpha.exists("C:\\TUBEDATA\\SEED\\DANCE.SMV"));
  assert.match(installer("simtube"), /^' VAPOR\|id=SIMTUBE\|name=SimTube\|kind=web\|version=[0-9a-f]{8}\|category=Fun\|run=\/\|files=(?![^|]*PLAYER)[^|]*\|tasks=\|startup=\|folder=TUBE\|about=.*SimPlayer/);

  const r = ok(await browser(alpha).get("/"));
  assert.match(r.body, /Welcome to SimTube[\s\S]*Dancing Baby[\s\S]*All Your Base/, "newest first");
  assert.match(r.body, /<img src="thumb.asp\?v=1"/);
  assert.match(r.body, /0 views/);
  assert.deepEqual(alpha.list("C:\\TUBEDATA\\SEED"), [], "the samples moved onto the shelf");
  const videos = alpha.read("C:\\TUBEDATA\\VIDEOS.TXT").trim().split("\n");
  assert.equal(videos.length, 3);
  assert.match(videos[1], /^2\|simtube\|Dancing Baby\|\d{4}-\d\d-\d\d\|240\|10\|160\|120\|4\|\d+\|Ooga chaka/);
  // visiting again does not put them up twice
  ok(await browser(alpha).get("/"));
  assert.equal(alpha.read("C:\\TUBEDATA\\VIDEOS.TXT").trim().split("\n").length, 3);
  // the installer again: an upgrade, the samples are not doubled
  await install(alpha, "simtube");
  ok(await browser(alpha).get("/"));
  assert.equal(alpha.read("C:\\TUBEDATA\\VIDEOS.TXT").trim().split("\n").length, 3);
});

await test("movie.asp serves a manifest and parts that add up to the movie; thumb.asp a picture", async () => {
  const b = browser(alpha);
  let r = ok(await b.get("/movie.asp?v=2"));
  assert.ok(r.headers.includes("Content-Type: video/x-simmovie"), r.headers.join(" / "));
  assert.match(r.body, /^SIMMOVIE-PARTS 1\ntitle=Dancing Baby\n[\s\S]*width=160\nheight=120\nfps=10\nframes=240\nbg=0\nparts=4\npart=movie.asp\?v=2&p=1\npart=movie.asp\?v=2&p=2\n/);
  let frames = [];
  for (let p = 1; p <= 4; p++) {
    r = ok(await b.get("/movie.asp?v=2&p=" + p));
    assert.ok(r.body.length <= PART, "part " + p + " is " + r.body.length);
    if (p === 1) assert.match(r.body, /^SIMMOVIE 1\ntitle=Dancing Baby\nframes=240\n/);
    frames = frames.concat(r.body.split("\n").filter((l) => l && !/^(SIMMOVIE|\w+=|\.$|!|')/.test(l)));
  }
  assert.deepEqual(frames, parse(movieFile("DANCE.SMV")).frames);
  assert.equal((await b.get("/movie.asp?v=2&p=9")).status, "404 Not Found");
  assert.equal((await b.get("/movie.asp?v=99")).status, "404 Not Found");
  r = ok(await b.get("/thumb.asp?v=3"));
  assert.ok(r.headers.includes("Content-Type: image/x-sim95pic"));
  const rows = r.body.trim().split("\n");
  assert.equal(rows[0], "SIM95PIC 80 60");
  assert.equal(rows.length, 61);
  assert.ok(rows.slice(1).every((l) => /^[0-9A-F]{80}$/.test(l)));
  assert.ok(rows.join("").includes("9"), "the red S logo is in Welcome's picture");
});

// ---------------------------------------------------------------- SimPlayer

const statuses = new Map();
function player(m, args) {
  const pid = m.run("C:\\PROGRAMS\\PLAYER.SPK", args);
  const self = {
    pid,
    win: () => m.widgets(pid, "Window")[0],
    tag: () => String(self.win()?.get("Tag") ?? ""),
    state: () => self.tag().split("|")[0],
    frame: () => +self.tag().split("|")[1],
    status: () => String(self.win()?.get("Status") ?? ""),
    screen: () => m.widgets(pid, "Canvas")[0],
    seek: () => m.widgets(pid, "Canvas")[1],
    box: (text) => m.widgets(pid, "CheckBox").find((b) => String(b.get("Text")).replace("&", "") === text),
    click: (text) => m.button(pid, text).call("Click"),
    ready: () => wait(() => self.win() && self.screen(), "SimPlayer's window", 30000),
  };
  return self;
}

await test("SimPlayer plays a movie from the disk at its own speed", async () => {
  bravo.write("C:\\MYFILES\\DANCE.SMV", movieFile("DANCE.SMV"));
  bravo.write("C:\\PROGRAMS\\PLAYER.SPK", alpha.read("C:\\PROGRAMS\\PLAYER.SPK"));
  const p = player(bravo, ["C:\\MYFILES\\DANCE.SMV"]);
  await p.ready();
  // every Status any window is given, from now on
  const proto = Object.getPrototypeOf(p.win());
  const set = proto.set;
  proto.set = function (k, v) { if (k === "Status") { if (!statuses.has(this.pid)) statuses.set(this.pid, []); statuses.get(this.pid).push(String(v)); } return set.call(this, k, v); };
  await wait(() => p.state() === "playing", "playing: " + p.tag());
  assert.equal(p.win().get("Title"), "SimPlayer - Dancing Baby");
  assert.match(p.tag(), /^playing\|\d+\|240\|240\|1\|1\|0\|0$/);
  const f1 = p.frame();
  await sleep(1500);
  const moved = p.frame() - f1;
  assert.ok(moved >= 10 && moved <= 20, "about 15 frames in 1.5 seconds at 10 a second, not " + moved);
  // pause holds the picture
  p.click("Pause");
  await wait(() => p.state() === "paused", "paused");
  const held = p.frame();
  await sleep(400);
  assert.equal(p.frame(), held);
  assert.match(p.status(), /^Paused/);
  bravo.kernel.kill(p.pid);
});

await test("frame-step draws exactly the next frame's commands; seek, rewind and stop", async () => {
  const p = player(bravo, ["C:\\MYFILES\\DANCE.SMV"]);
  await p.ready();
  await wait(() => p.state() === "playing", "playing");
  p.click("Pause");
  await wait(() => p.state() === "paused", "paused");
  const frames = parse(movieFile("DANCE.SMV")).frames;
  const screen = p.screen();
  const log = [];
  const orig = screen.call;
  screen.call = function (m, ...a) { log.push(m); return orig.call(this, m, ...a); };
  for (let i = 0; i < 25; i++) {
    const at = p.frame();
    log.length = 0;
    p.click(">");
    await wait(() => p.frame() === at + 1, "step to " + (at + 1));
    assert.deepEqual(log, calls(frames[at + 1]), "frame " + (at + 1) + ": " + frames[at + 1]);
  }
  assert.ok(log.filter((c) => c === "FillRect").length > 0);
  // step back redraws from the keyframe before
  let at = p.frame();
  log.length = 0;
  p.click("<");
  await wait(() => p.frame() === at - 1, "a step back");
  let key = at - 1;
  while (!frames[key].startsWith("*")) key--;
  assert.deepEqual(log, frames.slice(key, at).flatMap(calls));
  // the seek bar: click, drag, let go
  const bar = p.seek();
  const w = bar.get("Width");
  bar.fire("onMouseDown", 6 + Math.round((w - 12) / 2), 7, 1);
  await wait(() => Math.abs(p.frame() - 120) <= 1, "the middle: " + p.tag());
  bar.fire("onMouseMove", w - 6, 7);
  await wait(() => p.frame() === 239, "dragged to the end: " + p.tag());
  bar.fire("onMouseUp", 6 + Math.round((w - 12) / 4), 7, 1);
  await wait(() => Math.abs(p.frame() - 60) <= 1, "let go a quarter in: " + p.tag());
  bar.fire("onMouseMove", w - 6, 7);
  await sleep(100);
  assert.ok(Math.abs(p.frame() - 60) <= 1, "moving without the button does not seek");
  assert.match(p.win().get("Tag"), /^paused\|/);
  // rewind, stop
  p.click("Rewind");
  await wait(() => p.frame() === 0, "rewound");
  p.click("Play");
  await wait(() => p.frame() > 3, "playing again");
  p.click("Stop");
  await wait(() => p.state() === "stopped" && p.frame() === 0, "stopped at the start");
  const labels = bravo.widgets(p.pid, "Label").map((l) => l.get("Text"));
  assert.ok(labels.includes("0:00 / 0:24"), labels.join(" / "));
  assert.ok(labels.includes("Dancing Baby  -  by SimTube"));
  bravo.kernel.kill(p.pid);
});

await test("loop goes round again; without it the movie finishes; mute stops the beeps", async () => {
  bravo.write("C:\\MYFILES\\WELCOME.SMV", movieFile("WELCOME.SMV"));
  const beeps = [];
  bravo.ui.beep = (f) => beeps.push(f);
  const p = player(bravo, ["C:\\MYFILES\\WELCOME.SMV"]);
  await p.ready();
  await wait(() => p.state() === "playing", "playing");
  // from near the end, with Loop on
  const xFor = (f) => 6 + Math.ceil(f * (p.seek().get("Width") - 12) / 89);
  const near = async (f) => {
    p.click("Pause");
    await wait(() => p.state() === "paused", "paused");
    p.seek().fire("onMouseDown", xFor(f), 7, 1);
    p.seek().fire("onMouseUp", xFor(f), 7, 1);
    await wait(() => p.frame() === f, "at frame " + f + ": " + p.tag());
    p.click("Play");
  };
  p.box("Loop").set("Checked", true);
  p.box("Loop").fire("onChange");
  await near(80);
  await wait(() => p.state() === "playing" && p.frame() < 30, "round again: " + p.tag());
  assert.match(p.tag(), /\|1\|0$/);
  // the logo beeps when it hits a wall
  await wait(() => beeps.length > 0, "a beep", 10000);
  p.box("Mute").set("Checked", true);
  p.box("Mute").fire("onChange");
  await sleep(100);
  beeps.length = 0;
  await sleep(2500);
  assert.deepEqual(beeps, [], "muted");
  assert.match(p.status(), /\[muted\]/);
  // Loop off: it plays to the end and stops there
  p.box("Loop").set("Checked", false);
  p.box("Loop").fire("onChange");
  await near(80);
  await wait(() => p.state() === "ended", "the end: " + p.tag(), 10000);
  assert.equal(p.frame(), 89);
  assert.match(p.status(), /^Finished/);
  // Play from the end starts again
  p.click("Play");
  await wait(() => p.state() === "playing" && p.frame() < 20, "from the top");
  bravo.kernel.kill(p.pid);
});

await test("SimPlayer opens a manifest and its parts from the disk, and says no to other files", async () => {
  const text = movieFile("DANCE.SMV");
  const parts = cut(text);
  bravo.mkdir("C:\\MYFILES\\BABY");
  parts.forEach((p, i) => bravo.write(`C:\\MYFILES\\BABY\\${i + 1}.SMV`, p));
  bravo.write("C:\\MYFILES\\BABY\\BABY.SML", "SIMMOVIE-PARTS 1\ntitle=Baby, in parts\nwidth=160\nheight=120\nfps=10\nframes=240\n" + parts.map((_, i) => `part=${i + 1}.SMV\n`).join(""));
  const p = player(bravo, ["C:\\MYFILES\\BABY\\BABY.SML"]);
  await p.ready();
  await wait(() => p.state() === "playing", "playing: " + p.tag() + " " + p.status());
  assert.match(p.tag(), /^playing\|\d+\|240\|240\|4\|4\|/);
  assert.equal(p.win().get("Title"), "SimPlayer - Baby, in parts");
  bravo.kernel.kill(p.pid);
  bravo.write("C:\\MYFILES\\NOTES.TXT", "Dear diary");
  const q = player(bravo, ["C:\\MYFILES\\NOTES.TXT"]);
  await q.ready();
  await wait(() => q.state() === "error", "an error");
  assert.match(q.status(), /That is not a SimMovie/);
  bravo.kernel.kill(q.pid);
});

await test("SimPlayer streams from ALPHA's web server: Buffering..., then plays while the rest arrive", async () => {
  alpha.run("C:\\PROGRAMS\\HTTPD.SPK");
  await wait(async () => /200 OK/.test(await alpha.fetch("ALPHA", "/simtube.htm").catch(() => "")), "ALPHA's web server");
  const p = player(bravo, ["http://alpha/movie.asp?v=2"]);
  await p.ready();
  const seen = new Set();
  await wait(() => { seen.add(p.tag().split("|").slice(0, 1).concat(p.tag().split("|").slice(4, 6)).join("|")); return p.tag().startsWith("playing") && /\|4\|4\|/.test(p.tag()); }, "all four parts in, playing: " + p.tag() + " " + p.status(), 30000);
  const said = statuses.get(p.pid) || [];
  assert.ok(said.some((s) => /^Buffering\.\.\. 0%/.test(s)), said.join(" / "));
  assert.ok(said.some((s) => /^Playing  \((25|50|75)% downloaded\)/.test(s)), "played before all of it came: " + said.join(" / "));
  assert.ok([...seen].some((s) => /^playing\|[123]\|4$/.test(s)), [...seen].join(" "));
  assert.equal(p.win().get("Title"), "SimPlayer - Dancing Baby");
  assert.match(p.tag(), /\|240\|240\|4\|4\|/);
  bravo.kernel.kill(p.pid);
});

await test("SimPlayer's address box; a dead address says so", async () => {
  const p = player(bravo, []);
  await p.ready();
  assert.equal(p.state(), "empty");
  const box = bravo.widgets(p.pid, "TextBox")[0];
  box.set("Text", "http://alpha/movie.asp?v=3");
  box.fire("onEnter");
  await wait(() => p.state() === "playing", "Welcome from the address box: " + p.status());
  assert.equal(p.win().get("Title"), "SimPlayer - Welcome to SimTube");
  box.set("Text", "http://nobody/movie.asp?v=1");
  p.click("Open");
  await wait(() => p.state() === "error", "the error", 40000);
  assert.match(p.status(), /^Could not get http:\/\/nobody\/movie.asp\?v=1/);
  box.set("Text", "http://alpha/movie.asp?v=42");
  p.click("Open");
  await wait(() => p.state() === "error" && /404/.test(p.status()), "the 404: " + p.status(), 20000);
  assert.match(p.status(), /404 Not Found/);
  assert.deepEqual(bravo.ui.dialogs, []);
  bravo.kernel.kill(p.pid);
});

// ---------------------------------------------------------------- the web app

const tiny = (title) => new Movie({ title, width: 64, height: 48, fps: 5, bg: 15 });
function ball(title, n = 10) {
  const m = tiny(title);
  for (let i = 0; i < n; i++) m.frame(i === 0 ? ["C12", `D${10 + i * 4},24,6`] : ["C15", `F${3 + (i - 1) * 4},17,15,15`, "C12", `D${10 + i * 4},24,6`], i === 0);
  return m.toString();
}

const ann = browser(alpha);
const bob = browser(alpha);
await test("accounts: sign up, log in and out, with a salted hash and SimTube's own cookie", async () => {
  let r = ok(await ann.post("/join.asp", { name: "Ann <b>Tube</b>", u: "ann", pw: "secret", pw2: "secret" }));
  assert.match(r.body, /Hello, Ann &lt;b&gt;Tube&lt;\/b&gt;/);
  assert.match(ann.cookies(), /^simtube=[0-9A-F]{8}$/);
  const rec = alpha.read("C:\\TUBEDATA\\USERS\\ANN.TXT");
  assert.match(rec, /^salt=[0-9A-F]+$/m);
  assert.match(rec, /^pass=[0-9A-F]+-[0-9A-F]+$/m);
  assert.doesNotMatch(rec, /secret/);
  r = ok(await bob.post("/join.asp", { name: "Bob", u: "ann", pw: "x1234", pw2: "x1234" }));
  assert.match(r.body, /Somebody already has the name ann/);
  r = ok(await bob.post("/join.asp", { name: "Bob", u: "simtube", pw: "x1234", pw2: "x1234" }));
  assert.match(r.body, /Somebody already has the name simtube/);
  ok(await bob.post("/join.asp", { name: "Bob", u: "bob", pw: "bobpw", pw2: "bobpw" }));
  const t = token(ok(await bob.get("/upload.asp")));
  ok(await bob.get("/logout.asp?t=" + t));
  assert.equal(bob.cookies(), "");
  r = ok(await bob.post("/login.asp", { u: "bob", pw: "wrong" }));
  assert.match(r.body, /do not match/);
  r = ok(await bob.post("/login.asp", { u: "bob", pw: "bobpw" }));
  assert.match(r.body, /Hello, Bob/);
  r = ok(await browser(alpha).get("/upload.asp"));
  assert.match(r.body, /you need to log in first/, "upload.asp sends strangers to log in");
});

await test("upload: a movie goes up, gets a page, a picture and parts; bad ones are turned away", async () => {
  let r = ok(await ann.get("/upload.asp"));
  const t = token(r);
  r = ok(await ann.post("/upload.asp", { t, movie: ball("Red Ball", 12), title: "", about: "It rolls. <i>Wow</i>" }));
  assert.match(r.url, /watch.asp\?v=4$/, r.body.replace(/<[^>]+>/g, " ").slice(0, 400));
  assert.match(r.body, /<h2>Red Ball<\/h2>/);
  assert.match(r.body, /It rolls\. &lt;i&gt;Wow&lt;\/i&gt;/);
  assert.match(r.body, /value="http:\/\/alpha\/movie.asp\?v=4" readonly/);
  assert.match(r.body, /<a href="movie.asp\?v=4" type="video\/x-simmovie">/);
  assert.match(r.body, /From: <b>Ann &lt;b&gt;Tube&lt;\/b&gt;<\/b>/);
  assert.match(r.body, /Runs: 0:02 \(12 frames at 5 a second, 64x48\)/);
  assert.match(r.body, /Add More Frames/, "the owner can add to it");
  assert.match(alpha.read("C:\\TUBEDATA\\MOVIES\\4\\THUMB.PIC"), /^SIM95PIC 80 60\n/);
  assert.match(alpha.read("C:\\TUBEDATA\\MOVIES\\4\\1.SMV"), /^SIMMOVIE 1\ntitle=Red Ball\nframes=12\nauthor=SimTube\nwidth=64\n/);
  // no token, no movie
  r = ok(await ann.post("/upload.asp", { movie: ball("Sneaky"), title: "Sneaky" }));
  assert.match(r.body, /did not come from a SimTube page/);
  assert.doesNotMatch(alpha.read("C:\\TUBEDATA\\VIDEOS.TXT"), /Sneaky/);
  // not a movie, too big, too wide
  r = ok(await ann.post("/upload.asp", { t, movie: "Dear diary, today I made a movie." }));
  assert.match(r.body, /That is not a SimMovie/);
  r = ok(await ann.post("/upload.asp", { t, movie: ball("Wide").replace("width=64", "width=640") }));
  assert.match(r.body, /from 16x16 to 320x240/);
  r = ok(await ann.post("/upload.asp", { t, movie: ball("Empty", 0) }));
  assert.match(r.body, /has no frames/);
});

await test("a long movie: one upload is cut into parts; Add More Frames adds the rest", async () => {
  const text = movieFile("DANCE.SMV");
  const t = token(ok(await bob.get("/upload.asp")));
  // the first 40K, then the rest, the way a long movie goes up
  const lines = text.split("\n");
  let firstPiece = "";
  let i = 0;
  while (firstPiece.length + lines[i].length < 40000) firstPiece += lines[i++] + "\n";
  const rest = lines.slice(i).join("\n");
  let r = ok(await bob.post("/upload.asp", { t, movie: firstPiece, title: "Baby (Bob's copy)" }));
  const id = /watch.asp\?v=(\d+)$/.exec(r.url)[1];
  const before = alpha.read("C:\\TUBEDATA\\VIDEOS.TXT").trim().split("\n").find((l) => l.startsWith(id + "|")).split("|");
  assert.ok(+before[8] >= 3, "cut into parts: " + before[8]);
  r = ok(await ann.post("/upload.asp", { t: token(ok(await ann.get("/upload.asp"))), to: id, movie: rest }));
  assert.match(r.body, /Only the person who put a movie up can add to it/);
  r = ok(await bob.post("/upload.asp", { t, to: id, movie: rest }));
  assert.match(r.body, /The frames were added\. The movie is 0:24 long now\./);
  const after = alpha.read("C:\\TUBEDATA\\VIDEOS.TXT").trim().split("\n").find((l) => l.startsWith(id + "|")).split("|");
  assert.equal(after[4], "240");
  const m = ok(await bob.get("/movie.asp?v=" + id)).body;
  assert.match(m, /frames=240\n/);
  const n = +/parts=(\d+)/.exec(m)[1];
  let frames = [];
  for (let p = 1; p <= n; p++) {
    const part = ok(await bob.get(`/movie.asp?v=${id}&p=${p}`)).body;
    assert.ok(part.length <= PART);
    if (p === 1) assert.match(part, /\nframes=240\n/);
    frames = frames.concat(part.split("\n").filter((l) => l && !/^(SIMMOVIE|\w+=|\.$|!|')/.test(l)));
  }
  assert.deepEqual(frames, parse(text).frames);
  // and SimPlayer plays the joined-up movie to the end
  const p = player(bravo, ["http://alpha/movie.asp?v=" + id]);
  await p.ready();
  await wait(() => /^(playing|paused)\|\d+\|240\|240\|/.test(p.tag()) && p.tag().split("|")[4] === p.tag().split("|")[5], "all of Bob's copy: " + p.tag(), 30000);
  bravo.kernel.kill(p.pid);
});

await test("watching counts views; Most Viewed puts the most watched first", async () => {
  const views = () => +alpha.read("C:\\TUBEDATA\\VIEWS\\4.TXT");
  ok(await bob.get("/watch.asp?v=4"));
  const v = views();
  ok(await bob.get("/watch.asp?v=4"));
  let r = ok(await browser(alpha).get("/watch.asp?v=4"));
  assert.equal(views(), v + 2);
  assert.match(r.body, new RegExp(`Views: <b>${v + 2}</b>`));
  ok(await browser(alpha).get("/watch.asp?v=4&back=1"));
  assert.equal(views(), v + 2, "coming back from a comment is not a view");
  ok(await browser(alpha).get("/watch.asp?v=1"));
  r = ok(await browser(alpha).get("/top.asp"));
  assert.match(r.body, /Red Ball[\s\S]*All Your Base/);
  assert.match(r.body, new RegExp(`${v + 2} views`));
  r = ok(await browser(alpha).get("/"));
  const most = r.body.slice(r.body.indexOf("Most Viewed</b>"));
  assert.match(most, /^[\s\S]*?Red Ball[\s\S]*?All Your Base/);
  assert.match((await browser(alpha).get("/watch.asp?v=999")).url, /^\/index.asp$/, "no such movie: the front page");
});

await test("stars: one rating each, changed by rating again, averaged", async () => {
  let r = ok(await ann.get("/watch.asp?v=4"));
  const t = token(r);
  r = ok(await ann.post("/rate.asp", { t, v: "4", stars: "5" }));
  assert.match(r.body, /Thanks! You gave it 5 stars/);
  r = ok(await bob.post("/rate.asp", { t: token(ok(await bob.get("/watch.asp?v=4"))), v: "4", stars: "2" }));
  assert.match(r.body, /\(2 ratings\)/);
  assert.match(r.body, /<b>\*\*\*\*<\/b><\/font><font color="#C0C0C0"><b>\*<\/b>/, "3.5 rounds to 4 stars");
  r = ok(await ann.post("/rate.asp", { t, v: "4", stars: "1" }));
  assert.equal(alpha.read("C:\\TUBEDATA\\RATINGS\\4.TXT"), "|bob=2|ann=1|");
  assert.match(r.body, /\(2 ratings\)/);
  assert.match(r.body, /<option value="1" selected>/);
  r = ok(await ann.post("/rate.asp", { t, v: "4", stars: "9" }));
  assert.match(r.body, /Pick from one to five stars/);
  r = ok(await ann.post("/rate.asp", { t: "BAD", v: "4", stars: "5" }));
  assert.equal(alpha.read("C:\\TUBEDATA\\RATINGS\\4.TXT"), "|bob=2|ann=1|", "no token, no rating");
  r = ok(await browser(alpha).get("/watch.asp?v=4"));
  assert.match(r.body, /Log in<\/a> to rate and comment/);
});

await test("comments are kept, escaped, newest first", async () => {
  const t = token(ok(await ann.get("/watch.asp?v=4")));
  ok(await ann.post("/comment.asp", { t, v: "4", text: "First!" }));
  let r = ok(await bob.post("/comment.asp", { t: token(ok(await bob.get("/watch.asp?v=4"))), v: "4", text: "<script>Alert()</script> & a|pipe\nand a new line" }));
  assert.match(r.body, /&lt;script&gt;Alert\(\)&lt;\/script&gt; &amp; a\|pipe<br>and a new line[\s\S]*First!/);
  assert.doesNotMatch(r.body, /<script>Alert/);
  assert.match(r.body, /Comments \(2\)/);
  assert.match(alpha.read("C:\\TUBEDATA\\COMMENTS\\4.TXT"), /\|bob\|<script>Alert\(\)<\/script> & a%7Cpipe%0Aand a new line\n$/);
  r = ok(await ann.post("/comment.asp", { t, v: "4", text: "x".repeat(501) }));
  assert.match(r.body, /Keep comments under 500 characters/);
  r = ok(await ann.post("/comment.asp", { v: "4", text: "no token" }));
  assert.doesNotMatch(alpha.read("C:\\TUBEDATA\\COMMENTS\\4.TXT"), /no token/);
});

await test("pages stay under 64K: a full front page, and a movie with a pile of comments", async () => {
  const t = token(ok(await ann.get("/upload.asp")));
  for (let i = 0; i < 14; i++) ok(await ann.post("/upload.asp", { t, movie: ball("Ball number " + i + " " + "&<>\"".repeat(10), 6) }));
  const front = ok(await browser(alpha).get("/"));
  assert.equal((front.body.match(/<td valign="top" width="33%">/g) || []).length, 12, "a screenful of movies");
  assert.ok(front.raw.length < MESSAGE_LIMIT);
  const long = "<&>\"".repeat(125);
  for (let i = 0; i < 40; i++) ok(await bob.post("/comment.asp", { t: token(ok(await bob.get("/watch.asp?v=4&back=1"))), v: "4", text: long }));
  const r = ok(await browser(alpha).get("/watch.asp?v=4"));
  assert.ok(r.raw.length < MESSAGE_LIMIT, "watch.asp is " + r.raw.length);
  const shown = (r.body.match(/<tr><td bgcolor="#EEEEEE">/g) || []).length;
  assert.ok(shown >= 8 && shown < 42, shown + " comments shown");
  assert.match(r.body, new RegExp(`The newest ${shown} of 42 comments`));
  assert.match(r.body, /Comments \(42\)/);
  for (const page of ["/top.asp", "/upload.asp", "/simtube.htm", "/getplay.asp", "/movie.asp?v=2", "/thumb.asp?v=2"]) {
    const x = await ann.get(page);
    assert.ok(x.raw.length < MESSAGE_LIMIT && x.body.length > 100, page);
  }
  const get = (await ann.get("/getplay.asp")).body;
  assert.match(get, /SimPlayer is built in/);
  assert.match(get, /from <b>Vapor<\/b>/);
  assert.match(get, /sim-get install simplayr/);
  assert.deepEqual(alpha.errors, []);
});

// ---------------------------------------------------------------- SimHost

await test("in a SimHost folder: /tube/ works, its movies' addresses are under /tube/, and SimPlayer plays them", async () => {
  await install(host, "simhost");
  const said = await install(host, "simtube");
  assert.match(said, /Open http:\/\/host\/tube\/ in Voyager/);
  assert.ok(host.exists("C:\\WEB\\TUBE\\TUBE.SPK") && !host.exists("C:\\WEB\\TUBE.SPK"));
  assert.match(host.read("C:\\WEB\\INDEX.ASP"), /SimHost's front door/, "the home page stays the list");
  const b = browser(host);
  let r = ok(await b.get("/"));
  assert.match(r.body, /<a href="\/tube\/">.*SimTube/);
  r = ok(await b.get("/tube/"));
  assert.match(r.body, /Dancing Baby/);
  r = ok(await b.post("/tube/join.asp", { name: "Cat", u: "cat", pw: "meow1", pw2: "meow1" }));
  assert.match(r.url, /\/tube\/index.asp$/);
  r = ok(await b.get("/tube/watch.asp?v=3"));
  assert.match(r.body, /value="http:\/\/host\/tube\/movie.asp\?v=3"/);
  r = ok(await b.post("/tube/upload.asp", { t: token(r), movie: ball("Cat's ball") }));
  assert.match(r.url, /\/tube\/watch.asp\?v=4$/);
  host.run("C:\\PROGRAMS\\HTTPD.SPK");
  await wait(async () => /200 OK/.test(await host.fetch("HOST", "/tube/simtube.htm").catch(() => "")), "HOST's web server");
  const p = player(bravo, ["http://host/tube/movie.asp?v=2"]);
  await p.ready();
  await wait(() => /^playing\|\d+\|240\|240\|4\|4\|/.test(p.tag()), "Dancing Baby from /tube/: " + p.tag() + " " + p.status(), 30000);
  bravo.kernel.kill(p.pid);
});

await test("SimHost moves a SimTube that was the home page into /tube/, movies and all", async () => {
  const said = await install(alpha, "simhost");
  assert.match(said, /moved SimTube \(\d+ files\) into C:\\WEB\\TUBE: http:\/\/alpha\/tube\//);
  assert.ok(alpha.exists("C:\\WEB\\TUBE\\TUBE.SPK") && !alpha.exists("C:\\WEB\\TUBE.SPK"));
  const b = browser(alpha);
  let r = ok(await b.post("/tube/login.asp", { u: "ann", pw: "secret" }));
  assert.match(r.body, /Hello, Ann/);
  r = ok(await b.get("/tube/watch.asp?v=4"));
  assert.match(r.body, /Red Ball/);
  assert.match(r.body, /value="http:\/\/alpha\/tube\/movie.asp\?v=4"/);
  assert.deepEqual(alpha.errors, []);
  assert.deepEqual(bravo.errors, []);
  assert.deepEqual(host.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
