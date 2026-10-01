// End-to-end tests for SimStats (simstats/): accounts and sites, the tracking
// tag fetched across the network by Voyager-style fetches and by a real
// Simxplorer window, the dashboard's numbers, Live via XMLHttpRequest, the
// counter, opting out, public stats, the owner's overview, 3,000 hits within
// the 64K and time limits, and SimStats in a SimHost folder (counting the
// front page, and a GeoSimies homepage carrying the tag).
//   node tools/aspsim/simstats.test.mjs
//
// The machines: ALPHA runs SimStats; BRAVO is a web site carrying the tags;
// CHARLIE browses with Simxplorer, DELTA with Voyager (the same requests
// Voyager makes, cookies and all), ECHO with a program that keeps no cookies;
// HOST is a SimHost machine.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, MESSAGE_LIMIT } from "./sim.mjs";
import { Network } from "./network.mjs";
import { simxplorerSource } from "../simxplorer-source.mjs";

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
const installer = (app) => fs.readFileSync(path.join(root, app, "INSTALL.SPK"), "utf8");
const token = (r) => /name="t" value="([0-9A-F]+)"/.exec(r.body)[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const unhtml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
// what a textarea on a page holds, as the person copying it sees it
const textarea = (r, name) => unhtml(new RegExp(`<textarea name="${name}"[^>]*>([\\s\\S]*?)</textarea>`).exec(r.body)[1]);

const net = new Network();
const wait = (fn, what, ms = 20000) => net.until(fn, ms, what);
async function install(m, app) {
  m.write("C:\\MYFILES\\INSTALL.SPK", installer(app));
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !m.running(pid) || /in Voyager/.test(m.output(pid)), app + "'s installer", 60000);
  assert.deepEqual(m.ui.dialogs, [], app + ": " + m.output(pid));
  return m.output(pid);
}

// Voyager, as the bundle has it: each request a connection of its own, with
// "User-Agent: Voyager/1.1 (SIM95)", no Referer, and the cookie jar's cookies
// for the host in the address. A Set-Cookie in any answer (a picture's too)
// goes in the jar. A page's pictures are every <img> outside <script>:
// Voyager doesn't draw scripts, but it does draw what is in <noscript>.
function resolve(base, rel) {
  if (/^[a-z]+:/i.test(rel)) return rel;
  const b = /^(http:\/\/[^/]+)(\/.*)?$/i.exec(base);
  if (rel.startsWith("/")) return b[1] + rel;
  const p = (b[2] || "/").split("?")[0];
  return b[1] + p.slice(0, p.lastIndexOf("/") + 1) + rel;
}
function voyager(m) {
  const jar = new Map();
  const form = (f) => Object.entries(f).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v).replace(/%20/g, "+")).join("&");
  async function http(url, body) {
    const u = /^http:\/\/([^/:\s]+)(\/[^\s#]*)?/i.exec(url);
    const host = u[1].toUpperCase(), where = u[2] || "/";
    const conn = await m.stack.connect(0, host, 80);
    const parts = [];
    const done = new Promise((r) => conn.onClose(r));
    conn.onMessage((t) => parts.push(t));
    const lines = [`${body !== undefined ? "POST" : "GET"} ${where} HTTP/1.0`, `Host: ${host.toLowerCase()}`, "User-Agent: Voyager/1.1 (SIM95)"];
    const mine = jar.get(host);
    if (mine && mine.size) lines.push("Cookie: " + [...mine].map(([k, v]) => `${k}=${v}`).join("; "));
    if (body !== undefined) lines.push("Content-Type: application/x-www-form-urlencoded", `Content-Length: ${body.length}`);
    conn.send(lines.join("\n") + "\n" + (body !== undefined ? "\n" + body : ""));
    await Promise.race([done, sleep(6000)]);
    const all = parts.join("\n").split("\n");
    const status = +(/^HTTP\/\d\.\d\s+(\d+)/.exec(all[0] || "") || [0, 200])[1];
    const headers = {}, setCookies = [];
    let i = 1;
    for (; i < all.length; i++) {
      if (all[i].trim() === "") { i++; break; }
      const k = all[i].indexOf(":");
      if (k <= 0) continue;
      const name = all[i].slice(0, k).trim().toLowerCase(), v = all[i].slice(k + 1).trim();
      if (name === "set-cookie") setCookies.push(v); else headers[name] = v;
    }
    for (const c of setCookies) {
      const pair = c.split(";")[0], eq = pair.indexOf("=");
      if (!jar.has(host)) jar.set(host, new Map());
      if (pair.slice(eq + 1).trim() === "") jar.get(host).delete(pair.slice(0, eq).trim()); else jar.get(host).set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    return { status, headers, setCookies, body: all.slice(i).join("\n") };
  }
  async function view(url) {
    const page = await http(url);
    const drawn = page.body.replace(/<script[\s\S]*?<\/script>/gi, "");
    const pics = [];
    for (const x of drawn.matchAll(/<img[^>]*\ssrc="([^"]*)"/gi)) {
      const r = await http(resolve(url, x[1]));
      pics.push({ src: x[1], ...r, shown: r.status < 400 && r.body.startsWith("SIM95PIC") });
    }
    return { page, pics };
  }
  return { jar, http, view, post: (url, f) => http(url, form(f)) };
}

const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");
const charlie = await net.boot("CHARLIE");
const delta = await net.boot("DELTA");
const echo = await net.boot("ECHO");
const addr = (m) => m.stack.localIp();
const statFile = (id, f) => alpha.read(`C:\\STATDATA\\S\\${id}\\${f}`);
const total = (m, id) => +m.read(`C:\\STATDATA\\S\\${id}\\TOTAL.TXT`).split("|")[0];
const todayFile = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`; };
// one number from the dashboard's row of big numbers
const big = (body, label) => +(new RegExp(`<font size="5"><b>([\\d,]+)</b></font><br><font size="1">${label}`).exec(body) || [0, "-1"])[1].replace(/,/g, "");
// the count beside an entry in one of the Top lists
const listed = (body, text) => { const m = new RegExp(text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") + `(?:</b><br><font size="1">[^<]*</font>)?</font></td><td align="right" width="60"><font size="2">([\\d,]+)<`).exec(body); return m ? +m[1].replace(/,/g, "") : 0; };

// ---------------------------------------------------------------- installing

let homeId;
await test("the installer makes SimStats ALPHA's home page, with a site for the machine itself", async () => {
  const said = await install(alpha, "simstats");
  assert.match(said, /made the site [0-9A-F]{8} for this machine itself/);
  assert.match(said, /told crawlers to keep off the tag in C:\\WEB\\ROBOTS.TXT/);
  assert.match(said, /SimStats is installed \(\d+ files\)[\s\S]*Open http:\/\/alpha\/ in Voyager/);
  assert.ok(alpha.exists("C:\\WEB\\STATS.SPK") && alpha.exists("C:\\WEB\\HIT.ASP") && alpha.exists("C:\\WEB\\BADGE.PIC"));
  assert.equal(alpha.read("C:\\WEB\\ROBOTS.TXT"), "User-agent: *\nDisallow: /hit.asp\n");
  homeId = alpha.read("C:\\STATDATA\\HOME.TXT").trim();
  assert.match(alpha.read("C:\\STATDATA\\SITES.TXT"), new RegExp(`^${homeId}\\|\\|This machine \\(ALPHA\\)\\|http://alpha/\\|0\\|\\d{4}-\\d\\d-\\d\\d\\|1\\n$`));
  assert.match(installer("simstats"), /^' VAPOR\|id=SIMSTATS\|name=SimStats\|kind=web\|version=[0-9a-f]{8}\|category=Internet\|run=\/\|files=[^|]*C:\\WEB\\HIT.ASP[^|]*\|tasks=\|startup=\|folder=STATS\|about=/);
  // again: an upgrade keeps the machine's site and doesn't repeat the robots line
  const again = await install(alpha, "simstats");
  assert.doesNotMatch(again, /made the site|told crawlers/);
  assert.equal(alpha.read("C:\\STATDATA\\HOME.TXT").trim(), homeId);
  assert.equal(alpha.read("C:\\WEB\\ROBOTS.TXT"), "User-agent: *\nDisallow: /hit.asp\n");
  const r = ok(await browser(alpha).get("/"));
  assert.match(r.body, /Who's visiting YOUR web site\?/);
  assert.doesNotMatch(r.body, /noindex/, "the front door may be in AskSim");
  const about = ok(await browser(alpha).get("/simstats.htm"));
  const keywords = /<meta name="keywords" content="([^"]*)"/.exec(about.body)[1].split(", ");
  for (const k of ["analytics", "web statistics", "hit counter", "traffic", "visitors", "google analytics", "web stats"]) assert.ok(keywords.includes(k), k);
  alpha.run("C:\\PROGRAMS\\HTTPD.SPK");
  bravo.run("C:\\PROGRAMS\\HTTPD.SPK");
  await wait(async () => /200 OK/.test(await alpha.fetch("ALPHA", "/simstats.htm").catch(() => "")), "ALPHA's web server");
});

// ---------------------------------------------------------------- accounts and sites

let ann, bob, site, plainTag, scriptTag, badgeTag;
await test("signing up, adding a site, and the code to paste", async () => {
  ann = browser(alpha);
  let r = ok(await ann.post("/join.asp", { name: "Ann", u: "ann", pw: "secret", pw2: "secret" }));
  assert.match(r.body, /You aren't counting any sites yet/);
  assert.ok(ann.cookies().startsWith("simstats="), "SimStats' own cookie: " + ann.cookies());
  assert.match(alpha.read("C:\\STATDATA\\USERS\\ann.TXT"), /^name=Ann\nsalt=[0-9A-F]+\npass=[0-9A-F]+-[0-9A-F]+\njoined=/);
  assert.doesNotMatch(alpha.read("C:\\STATDATA\\USERS\\ann.TXT"), /secret/);
  r = ok(await ann.post("/addsite.asp", { t: token(r), name: "Bravo's Place", url: "bravo/" }));
  site = /code\.asp\?s=([0-9A-F]{8})&new=1$/.exec(r.url)[1];
  assert.match(r.body, new RegExp(`Its SimStats id is ${site}`));
  assert.match(alpha.read("C:\\STATDATA\\SITES.TXT"), new RegExp(`\\n${site}\\|ann\\|Bravo's Place\\|http://bravo/\\|0\\|`));
  assert.equal(textarea(r, "plain"), `<img src="http://alpha/hit.asp?s=${site}&p=/" width="1" height="1" border="0" alt="">`);
  r = ok(await ann.get(`/code.asp?s=${site}&page=/plain.htm`));
  plainTag = textarea(r, "plain");
  assert.equal(plainTag, `<img src="http://alpha/hit.asp?s=${site}&p=/plain.htm" width="1" height="1" border="0" alt="">`);
  r = ok(await ann.get(`/code.asp?s=${site}&page=/js.htm`));
  scriptTag = textarea(r, "script");
  assert.match(scriptTag, /^<script language="JavaScript">\n<!--\ndocument\.write\('<img src="http:\/\/alpha\/hit\.asp\?s=[0-9A-F]{8}&p=' \+ escape\(location\.pathname\) \+ '&t=' \+ escape\(document\.title\) \+ '&r=' \+ escape\(document\.referrer\)/);
  assert.match(scriptTag, /<\/script>\n<noscript><img src="http:\/\/alpha\/hit\.asp\?s=[0-9A-F]{8}&p=\/js\.htm" [^>]*><\/noscript>$/);
  r = ok(await ann.get(`/code.asp?s=${site}&page=/badge.htm`));
  badgeTag = textarea(r, "badge");
  assert.equal(badgeTag, `<a href="http://alpha/simstats.htm"><img src="http://alpha/hit.asp?s=${site}&b=1&p=/badge.htm" width="88" height="31" border="0" alt="SimStats counter"></a>`);
  assert.match(r.body, new RegExp(`<img src="hit.asp\\?s=${site}&b=1&n=1"`), "a preview of the counter, which counts nothing");
  r = ok(await ann.get("/"));
  assert.match(r.body, /<a href="dash.asp\?s=[0-9A-F]{8}"><b>Bravo's Place<\/b><\/a>/);
  r = ok(await ann.post("/addsite.asp", { t: token(r), name: "", url: "x" }));
  assert.match(r.body, /Give your site a name/);
  bob = browser(alpha);
  ok(await bob.post("/join.asp", { name: "Bob", u: "bob", pw: "hunter2", pw2: "hunter2" }));
  r = ok(await bob.post("/join.asp", { name: "Ann Again", u: "ann", pw: "xxxx", pw2: "xxxx" }));
  assert.match(r.body, /Somebody already has the name ann/);
});

// the pages on BRAVO, carrying the tags as they were pasted
bravo.write("C:\\WEB\\PLAIN.HTM", `<html><head><title>Plain Page</title></head><body><h1>Plain</h1><a href="js.htm">on</a>\n${plainTag}\n</body></html>`);
bravo.write("C:\\WEB\\JS.HTM", `<html><head><title>Fancy JS Page</title></head><body><h1>Fancy</h1>\n${scriptTag}\n</body></html>`);
bravo.write("C:\\WEB\\BADGE.HTM", `<html><head><title>Counter Page</title></head><body><h1>You are visitor number:</h1>\n${badgeTag}\n</body></html>`);

await test("Voyager across the network: the tags' pictures are shown, cookies kept, and every hit counted", async () => {
  const v = voyager(delta);
  let { page, pics } = await v.view("http://bravo/plain.htm");
  assert.match(page.body, /<h1>Plain<\/h1>/);
  assert.equal(pics.length, 1);
  assert.ok(pics[0].shown, "a picture from ALPHA on BRAVO's page");
  assert.equal(pics[0].body, "SIM95PIC 1 1\nF\n");
  assert.equal(pics[0].headers["content-type"], "image/x-sim95pic");
  const vid = v.jar.get("ALPHA")?.get("ssvid");
  assert.match(vid || "", /^[0-9A-F]{8}$/, "ALPHA's picture set a cookie in Voyager's jar");
  assert.equal(total(alpha, site), 1);
  // the JavaScript page: Voyager takes the <noscript> tag
  ({ pics } = await v.view("http://bravo/js.htm"));
  assert.equal(pics.length, 1, "only the noscript picture");
  assert.match(pics[0].src, /&p=\/js\.htm$/);
  assert.ok(pics[0].shown);
  assert.equal(pics[0].setCookies.length, 0, "the cookie came back, so it needn't be handed out again");
  assert.equal(total(alpha, site), 2);
  const raw = statFile(site, todayFile() + ".LOG").trim().split("\n");
  assert.equal(raw.length, 2);
  assert.match(raw[1], new RegExp(`^\\d\\d:\\d\\d:\\d\\d\\|${addr(delta).replace(/\./g, "\\.")}\\|${vid}\\|Voyager 1\\.1\\|/js\\.htm\\|\\|$`));
  // a program that keeps no cookies is one visitor per machine per day
  for (let i = 0; i < 2; i++) {
    const got = await echo.fetch("ALPHA", `/hit.asp?s=${site}&p=/echo.htm`);
    assert.match(got, /Set-Cookie: ssvid=[0-9A-F]{8}\n(?:[^\n]+\n)*\nSIM95PIC 1 1\nF\n?$/);
  }
  assert.equal(total(alpha, site), 4);
  // a site nobody has: the picture, and nothing counted anywhere
  const nobody = await v.http(`http://alpha/hit.asp?s=12345678&p=/x.htm`);
  assert.equal(nobody.status, 200);
  assert.equal(nobody.body, "SIM95PIC 1 1\nF\n");
  assert.ok(!alpha.exists("C:\\STATDATA\\S\\12345678"));
  const junk = await v.http(`http://alpha/hit.asp?s=../../X&b=1`);
  assert.ok(junk.body.startsWith("SIM95PIC 88 31"), "a counter for nobody still draws");
  // AskSim's crawler is not a visitor
  const before = total(alpha, site);
  const conn = await echo.stack.connect(0, "ALPHA", 80);
  const closed = new Promise((r) => conn.onClose(r));
  conn.send(`GET /hit.asp?s=${site}&p=/crawled.htm HTTP/1.0\nHost: alpha\nUser-Agent: AskSim/1.0 (http://echo/)\n`);
  await closed;
  assert.equal(total(alpha, site), before);
  assert.deepEqual(alpha.errors, []);
});

// ---------------------------------------------------------------- Simxplorer

charlie.write("C:\\PROGRAMS\\SIMXPLOR.SPK", simxplorerSource());
const ie = charlie.run("C:\\PROGRAMS\\SIMXPLOR.SPK", ["http://bravo/plain.htm"]);
const win = () => charlie.widgets(ie, "Window")[0];
const view = () => charlie.widgets(ie, "HtmlView")[0];
const html = () => String(view().get("Html") ?? "");
const loaded = (t) => wait(() => win()?.get("Title") === t + " - Simxplorer" && String(win().get("Status")).startsWith("Done"), "the page " + t);
// GUI_HtmlView asks for every <img> on the page it is given
const drawPictures = () => { for (const x of html().matchAll(/<img[^>]*\ssrc="([^"]*)"/gi)) view().fire("onImage", x[1]); };
const go = (url) => { const box = charlie.widgets(ie, "TextBox")[0]; box.set("Text", url); box.fire("onEnter"); };

await test("Simxplorer: the plain tag, then the JavaScript tag sends the title and the referrer", async () => {
  await wait(() => view(), "Simxplorer's window", 30000);
  await loaded("Plain Page");
  let before = total(alpha, site);
  drawPictures();
  await wait(() => total(alpha, site) === before + 1, "the plain tag's hit");
  await wait(() => charlie.exists("C:\\SYSTEM\\COOKIES.TXT") && /^ALPHA\|ssvid\|[0-9A-F]{8}$/m.test(charlie.read("C:\\SYSTEM\\COOKIES.TXT")), "ALPHA's cookie in Simxplorer's jar");
  go("http://bravo/js.htm");
  await loaded("Fancy JS Page");
  assert.doesNotMatch(html(), /noscript|p=\/js\.htm"/, "Simxplorer drops <noscript>, so the plain tag isn't counted too");
  const tag = /<img src="(http:\/\/alpha\/hit\.asp[^"]*)"/.exec(html());
  assert.ok(tag, "the script wrote the tag: " + html());
  assert.match(tag[1], /&p=\/js\.htm&t=Fancy%20JS%20Page&r=http%3A\/\/bravo\/plain\.htm&z=\d+$/);
  before = total(alpha, site);
  drawPictures();
  await wait(() => total(alpha, site) === before + 1, "the JavaScript tag's hit");
  const live = statFile(site, "LIVE.TXT").trim().split("\n");
  assert.match(live[live.length - 1], new RegExp(`\\|${addr(charlie).replace(/\./g, "\\.")}\\|Simxplorer 3\\.02\\|/js\\.htm\\|Fancy JS Page\\|http://bravo/plain\\.htm$`));
  assert.deepEqual(charlie.errors, []);
});

await test("the dashboard: hits, unique visitors, browsers, pages, titles, referrers, hours and machines", async () => {
  // DELTA: 2 hits (Voyager), ECHO: 2 (no cookies), CHARLIE: 2 (Simxplorer)
  const r = ok(await ann.get(`/dash.asp?s=${site}`));
  assert.match(r.body, /<meta name="robots" content="noindex,nofollow">/);
  assert.equal(big(r.body, "HITS"), 6);
  assert.equal(big(r.body, "UNIQUE VISITORS"), 3, "one each for DELTA, ECHO and CHARLIE");
  assert.equal(big(r.body, "PAGES SEEN"), 3);
  assert.equal(listed(r.body, "Voyager 1.1"), 2);
  assert.equal(listed(r.body, "Simxplorer 3.02"), 2);
  assert.equal(listed(r.body, ">test"), 2, "a program that says it is \"test\"");
  assert.equal(listed(r.body, "/plain.htm"), 2);
  assert.equal(listed(r.body, "/echo.htm"), 2);
  assert.match(r.body, /<b>Fancy JS Page<\/b><br><font size="1">\/js\.htm<\/font><\/font><\/td><td align="right" width="60"><font size="2">2</, "the title the script sent");
  assert.match(r.body, /<a href="http:\/\/bravo\/plain\.htm">http:\/\/bravo\/plain\.htm<\/a><\/font><\/td><td align="right" width="60"><font size="2">1</);
  for (const m of [delta, echo, charlie]) assert.equal(listed(r.body, addr(m)), 2, "machine " + addr(m));
  const hours = [...r.body.matchAll(/<td valign="bottom" align="center"><font size="1">(\d+)<\/font>/g)].map((x) => +x[1]);
  assert.equal(hours.length, 24);
  assert.equal(hours[new Date().getHours()], 6, "all six this hour: " + hours.join(","));
  assert.equal(hours.reduce((a, b) => a + b), 6);
  assert.match(r.body, /Hits and Visitors by Day[\s\S]*<font size="1">6<br>3<\/font>/, "today's bars");
  // the 7- and 30-day views go back that many days
  const week = ok(await ann.get(`/dash.asp?s=${site}&r=7`));
  assert.equal([...week.body.matchAll(/<tr><td><font size="1">(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d\d-\d\d<\/font>/g)].length, 7);
  assert.equal(big(week.body, "HITS"), 6);
  const month = ok(await ann.get(`/dash.asp?s=${site}&r=30`));
  assert.equal([...month.body.matchAll(/<tr><td><font size="1">(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d\d-\d\d<\/font>/g)].length, 30);
  assert.match(month.body, /<b>Last 30 days<\/b>/);
  // the Live box: newest first
  assert.match(r.body, new RegExp(`<span id="live0">\\d\\d:\\d\\d:\\d\\d  ${addr(charlie).replace(/\./g, "\\.")}\\s+Simxplorer 3\\.02\\s+/js\\.htm  from http://bravo/plain\\.htm</span>`));
});

await test("Live in Simxplorer: XMLHttpRequest keeps the last 20 hits up to date without a reload", async () => {
  // ann signs in from CHARLIE (her session cookie in CHARLIE's jar)
  charlie.write("C:\\SYSTEM\\COOKIES.TXT", charlie.read("C:\\SYSTEM\\COOKIES.TXT").trim() + "\nALPHA|" + ann.cookies().replace("=", "|") + "\n");
  go(`http://alpha/dash.asp?s=${site}`);
  await loaded("Stats for Bravo's Place - SimStats");
  const el = (id) => view().elements.get(id);
  assert.match(el("live0").Text, /\/js\.htm/);
  // a new visit, on another machine
  await voyager(delta).view("http://bravo/badge.htm");
  await wait(() => /\/badge\.htm/.test(el("live0").Text) && /\/js\.htm/.test(el("live1").Text), "the Live box to show the new hit: " + el("live0").Text, 30000);
  await wait(() => /^Live: updated \d+ times without reloading\.$/.test(el("livestate").Text), "the Live box to say so: " + el("livestate").Text);
  assert.equal(win().get("Title"), "Stats for Bravo's Place - SimStats - Simxplorer", "the page itself was never reloaded");
  // Voyager has a Reload link, and live.asp?w=1 reloads itself
  const w = ok(await ann.get(`/live.asp?s=${site}&w=1`));
  assert.match(w.body, /<meta http-equiv="refresh" content="15">/);
  assert.match(w.body, /<body [^>]*onload="Page_Load">\s*<script type="spark">\s*SUB Page_Load \(\)\s*SYS\.Sleep\(15000\)\s*PAGE\.Navigate\(PAGE\.Location\)/);
  assert.match(w.body, /\/badge\.htm/);
  assert.deepEqual(charlie.errors, []);
  charlie.kernel.kill(ie);
});

// The counter as hit.asp should draw it: BADGE.PIC with the number in its window.
function expectedBadge(n) {
  const LED = "01110100011001110101110011000101110001000110000100001000010000100011100111010001000010001000100010001111111111000100010000010000011000101110000100011001010100101111100010000101111110000111100000100001100010111000110010001000011110100011000101110111110000100010001000100001000010000111010001100010111010001100010111001110100011000101111000010001001100";
  const rows = fs.readFileSync(path.join(root, "simstats/WEB/BADGE.PIC"), "utf8").replace(/\n$/, "").split("\n");
  const digits = String(n).padStart(5, "0");
  let x = 44 - Math.floor((digits.length * 6 - 1) / 2);
  for (const d of digits) {
    for (let r = 0; r < 7; r++) rows[r + 6] = rows[r + 6].slice(0, x) + LED.substr(+d * 35 + r * 5, 5).replace(/1/g, "A") + rows[r + 6].slice(x + 5);
    x += 6;
  }
  return rows.join("\n");
}

await test("the counter: 88x31 LED digits showing the site's hits, this one included", async () => {
  const v = voyager(delta);
  const before = total(alpha, site);
  const { pics } = await v.view("http://bravo/badge.htm");
  assert.equal(total(alpha, site), before + 1);
  assert.ok(pics[0].shown);
  assert.equal(pics[0].body.split("\n")[0], "SIM95PIC 88 31");
  assert.equal(pics[0].body.trimEnd(), expectedBadge(before + 1));
  assert.ok(pics[0].body.trimEnd().split("\n").slice(1).every((l) => /^[0-9A-F]{88}$/.test(l)));
  // the preview on code.asp counts nothing
  const preview = await v.http(`http://alpha/hit.asp?s=${site}&b=1&n=1`);
  assert.equal(preview.body.trimEnd(), expectedBadge(before + 1));
  assert.equal(total(alpha, site), before + 1);
  assert.equal(expectedBadge(1234567).split("\n").length, 32);
});

await test("opting out: a cookie on ALPHA, and the tags count nothing (but still show)", async () => {
  const v = voyager(delta);
  await v.view("http://bravo/plain.htm");
  let r = await v.http("http://alpha/optout.asp");
  assert.match(r.body, /Right now, SimStats is counting your visits/);
  r = await v.post("http://alpha/optout.asp", { do: "out" });
  assert.equal(r.status, 302);
  assert.equal(v.jar.get("ALPHA").get("ssout"), "1");
  assert.ok(!v.jar.get("ALPHA").has("ssvid"), "the visitor number goes too");
  r = await v.http("http://alpha/optout.asp?done=out");
  assert.match(r.body, /SimStats will not count you on any site[\s\S]*Right now, SimStats is NOT counting you/);
  const before = total(alpha, site);
  const log = statFile(site, todayFile() + ".LOG");
  const { pics } = await v.view("http://bravo/plain.htm");
  assert.ok(pics[0].shown, "the page looks the same");
  const badge = await v.view("http://bravo/badge.htm");
  assert.equal(badge.pics[0].body.trimEnd(), expectedBadge(before), "the counter shows the count, without you");
  assert.equal(total(alpha, site), before);
  assert.equal(statFile(site, todayFile() + ".LOG"), log);
  await v.post("http://alpha/optout.asp", { do: "in" });
  assert.ok(!v.jar.get("ALPHA").has("ssout"));
  await v.view("http://bravo/plain.htm");
  assert.equal(total(alpha, site), before + 1, "counted again");
  const privacy = ok(await browser(alpha).get("/privacy.htm"));
  assert.match(privacy.body, /network address[\s\S]*14 days[\s\S]*100 days[\s\S]*optout\.asp/);
});

await test("one account can't see another's site, and forms without the token change nothing", async () => {
  for (const page of ["dash.asp", "code.asp", "edit.asp", "live.asp"]) {
    const r = ok(await bob.get(`/${page}?s=${site}`));
    assert.doesNotMatch(r.body, new RegExp(addr(delta).replace(/\./g, "\\.")), page + " shows bob nothing of ann's");
    if (page !== "live.asp") assert.match(r.body, /That isn&#39;t one of your sites|That isn't one of your sites/, page);
  }
  assert.equal((await bob.get(`/live.asp?s=${site}&f=text`)).status, "403 Forbidden");
  assert.doesNotMatch(ok(await bob.get("/")).body, /Bravo's Place/);
  // somebody else's page posting with ann's cookie but no token
  const sites = alpha.read("C:\\STATDATA\\SITES.TXT");
  let r = ok(await ann.post("/addsite.asp", { name: "Evil", url: "http://evil/" }));
  assert.match(r.body, /did not come from a SimStats page/);
  r = ok(await ann.post("/edit.asp", { s: site, name: "Hacked", url: "http://evil/", public: "1", on: "1" }));
  assert.match(r.body, /did not come from a SimStats page/);
  r = ok(await ann.post("/edit.asp", { t: "12345678", s: site, do: "delete", sure: "1" }));
  assert.equal(alpha.read("C:\\STATDATA\\SITES.TXT"), sites, "nothing was changed");
  r = ok(await ann.get("/logout.asp"));
  assert.match(r.body, /did not come from a SimStats page/);
  assert.match(ok(await ann.get("/")).body, /My Sites/, "still signed in");
  // bob, with his own token, still can't change ann's site
  r = ok(await bob.get("/"));
  r = ok(await bob.post("/edit.asp", { t: token(r), s: site, name: "Bob's now", url: "http://bob/", on: "1" }));
  assert.equal(alpha.read("C:\\STATDATA\\SITES.TXT"), sites);
});

await test("public stats: anybody can look, and there are no addresses on them", async () => {
  let r = ok(await browser(alpha).get(`/public.asp?s=${site}`));
  assert.match(r.body, /There are no public statistics here/, "not public yet");
  r = ok(await ann.get(`/edit.asp?s=${site}`));
  r = ok(await ann.post("/edit.asp", { t: token(r), s: site, name: "Bravo's Place", url: "http://bravo/", public: "1", on: "1" }));
  assert.match(r.body, /Saved\./);
  assert.match(alpha.read("C:\\STATDATA\\SITES.TXT"), new RegExp(`${site}\\|ann\\|Bravo's Place\\|http://bravo/\\|1\\|`));
  const anyone = browser(alpha);
  for (const days of ["1", "7", "30"]) {
    r = ok(await anyone.get(`/public.asp?s=${site}&r=${days}`));
    assert.match(r.body, /public statistics/);
    assert.ok(big(r.body, "HITS") >= 9);
    assert.match(r.body, /Fancy JS Page/);
    assert.match(r.body, /<meta name="robots" content="noindex,nofollow">/);
    assert.doesNotMatch(r.body, /65\.\d+\.\d+\.\d+/, "no machine's address anywhere");
    assert.doesNotMatch(r.body, /Visiting Machines/);
    assert.match(r.body, /live\.asp\?s=[0-9A-F]{8}&pub=1&f=text/);
  }
  const text = await anyone.get(`/live.asp?s=${site}&f=text`);
  assert.equal(text.status, "200 OK");
  assert.match(text.body, /Voyager 1\.1/);
  assert.doesNotMatch(text.body, /65\.\d+\.\d+\.\d+/);
  // the owner still sees addresses on her dashboard, but not on the public page
  assert.doesNotMatch(ok(await ann.get(`/public.asp?s=${site}`)).body, /65\.\d+\.\d+\.\d+/);
  assert.doesNotMatch((await ann.get(`/live.asp?s=${site}&pub=1&f=text`)).body, /65\.\d+\.\d+\.\d+/);
  assert.match((await ann.get(`/live.asp?s=${site}&f=text`)).body, /65\.\d+\.\d+\.\d+/);
  // the counter now links to the public page
  r = ok(await ann.get(`/code.asp?s=${site}&page=/badge.htm`));
  assert.match(textarea(r, "badge"), new RegExp(`^<a href="http://alpha/public.asp\\?s=${site}">`));
});

await test("paused sites count nothing; the owner's overview needs the machine's password", async () => {
  let r = ok(await ann.get(`/edit.asp?s=${site}`));
  ok(await ann.post("/edit.asp", { t: token(r), s: site, name: "Bravo's Place", url: "http://bravo/", public: "1" }));
  const before = total(alpha, site);
  const { pics } = await voyager(echo).view("http://bravo/plain.htm");
  assert.ok(pics[0].shown);
  assert.equal(total(alpha, site), before, "paused");
  assert.match(ok(await ann.get(`/dash.asp?s=${site}`)).body, /Counting is paused/);
  r = ok(await ann.get(`/edit.asp?s=${site}`));
  ok(await ann.post("/edit.asp", { t: token(r), s: site, name: "Bravo's Place", url: "http://bravo/", public: "1", on: "1" }));

  alpha.write("C:\\SYSTEM\\USERS.INI", "[user]\nname=Owner\npassword=letmein\n");
  r = ok(await bob.post("/admin.asp", { owner: "owner", opw: "wrong" }));
  assert.match(r.body, /That is not this machine's owner/);
  assert.doesNotMatch(r.body, /Bravo's Place|This machine/);
  r = ok(await browser(alpha).post("/admin.asp", { owner: "", opw: "" }));
  assert.doesNotMatch(r.body, /Bravo's Place/);
  r = ok(await browser(alpha).post("/admin.asp", { owner: "owner", opw: "letmein" }));
  assert.match(r.body, /2 sites, 2 accounts/);
  assert.match(r.body, new RegExp(`<b>This machine \\(ALPHA\\)</b> <tt>${homeId}</tt>[\\s\\S]*?<i>nobody</i> \\(this machine\\)`));
  assert.match(r.body, new RegExp(`<b>Bravo's Place</b> <tt>${site}</tt>[\\s\\S]*?ann</font></td>\\s*<td align="right"><font size="2">${total(alpha, site)}</font>`));
  assert.match(r.body, new RegExp(`<b>Total</b>[\\s\\S]*<b>${total(alpha, site)}</b></font></td></tr>\\s*</table>`));
  // the owner hands the machine's own site to bob, who then sees it
  r = ok(await browser(alpha).post("/admin.asp", { owner: "owner", opw: "letmein", do: "give", s: homeId, to: "bob" }));
  assert.match(r.body, /This machine \(ALPHA\) now belongs to bob/);
  r = ok(await browser(alpha).post("/admin.asp", { owner: "owner", opw: "letmein", do: "give", s: site, to: "bob" }));
  assert.match(r.body, /Only a site that belongs to nobody can be handed over/);
  r = ok(await browser(alpha).post("/admin.asp", { owner: "owner", opw: "nope", do: "give", s: homeId, to: "ann" }));
  assert.match(r.body, /not this machine's owner/);
  assert.match(ok(await bob.get("/")).body, /This machine \(ALPHA\)/);
});

// ---------------------------------------------------------------- lots of data

await test("3,000 hits over 30 days: rollups keep every page under 64K and inside the time limit", async () => {
  let r = ok(await ann.get("/"));
  r = ok(await ann.post("/addsite.asp", { t: token(r), name: "Busy " + "<&>\"".repeat(9), url: "http://busy/" }));
  const busy = /s=([0-9A-F]{8})/.exec(r.url)[1];
  // TRACK.SPK is plain SPARK: the same RecordHit hit.asp calls, with days gone by
  const driver = `
SUB Main ()
    VAR i AS Integer
    VAR t0 AS Integer
    VAR vid AS String
    VAR agent AS String
    VAR ref AS String
    t0 = DayNum(TIME.Date)
    FOR i = 0 TO 2999
        vid = ""
        IF i MOD 3 > 0 THEN vid = Hex(268435456 + (i MOD 97))
        agent = "Voyager/1.1 (SIM95)"
        IF i MOD 3 = 1 THEN agent = "Mozilla/2.0 (compatible; Simxplorer 3.02; SIM95)"
        IF i MOD 5 = 2 THEN agent = "Netscape/3.0 (SIM95)"
        ref = ""
        IF i MOD 2 = 0 THEN ref = "http://site" + Str(i MOD 300) + "/a/very/long/path/to/links.htm?a=<b>&c=" + Str(i MOD 7)
        RecordHit("${busy}", DateOf(t0 - 29 + Int(i / 100)), Str(100 + (i * 7) MOD 24).Substring(1, 2) + ":00:00", "65.16.1." + Str(i MOD 250), vid, agent, "/page" + Str(i MOD 400) + ".htm?<&>", "Page number " + Str(i MOD 400) + " <&>" + " and a long, long title".PadRight(70), ref)
    NEXT
    Print("done")
END SUB
`;
  const t1 = Date.now();
  assert.deepEqual(await alpha.runScript(alpha.read("C:\\WEB\\TRACK.SPK") + "\n" + driver), ["done"]);
  const took = Date.now() - t1;
  assert.equal(total(alpha, busy), 3000);
  const files = alpha.list(`C:\\STATDATA\\S\\${busy}`).map((f) => f.name ?? f);
  assert.equal(files.filter((f) => /^\d{8}\.TXT$/.test(f)).length, 30, "a rollup a day");
  assert.equal(files.filter((f) => /^\d{8}\.LOG$/.test(f)).length, 15, "raw logs pruned to the last 14 days and today: " + files.join(" "));
  for (const f of files) assert.ok(alpha.read(`C:\\STATDATA\\S\\${busy}\\${f}`).length < 60000, f + " fits one network message (Move In)");
  // a day keeps at most 200 pages (and referrers); the rest are (other)
  await alpha.runScript(alpha.read("C:\\WEB\\TRACK.SPK") + `
SUB Main ()
    VAR i AS Integer
    FOR i = 1 TO 210
        RecordHit("CAFEF00D", TIME.Date, TIME.Clock, "65.16.9.9", "", "Voyager/1.1 (SIM95)", "/p" + Str(i) + ".htm", "", "")
    NEXT
END SUB
`);
  const rollup = alpha.read(`C:\\STATDATA\\S\\CAFEF00D\\${todayFile()}.TXT`);
  assert.equal((rollup.match(/^p\|/gm) || []).length, 201);
  assert.match(rollup, /^p\|\(other\)\|10$/m);
  assert.match(rollup, /^h\|all\|210$/m);
  assert.match(rollup, /^u\|[0-9A-F]{8}\|210$/m, "one visitor: the same machine, no cookies");

  const pages = ["1", "7", "30"].map((d) => `/dash.asp?s=${busy}&r=${d}`).concat([`/live.asp?s=${busy}`, `/live.asp?s=${busy}&w=1`, `/code.asp?s=${busy}`, `/edit.asp?s=${busy}`, "/"]);
  for (const p of pages) {
    r = ok(await ann.get(p));
    assert.ok(r.raw.length < MESSAGE_LIMIT, p + " is " + r.raw.length);
  }
  r = ok(await ann.get(`/dash.asp?s=${busy}&r=30`));
  assert.equal(big(r.body, "HITS"), 3000);
  assert.match(r.body, /The top 12 of \d+\./);
  const days = [...r.body.matchAll(/<font size="1">(\d+)<br>(\d+)<\/font>/g)].map((x) => +x[1]);
  assert.equal(days.length, 30);
  assert.ok(days.every((n) => n === 100), days.join(","));
  const hours = [...r.body.matchAll(/<td valign="bottom" align="center"><font size="1">(\d+)<\/font>/g)].map((x) => +x[1]);
  assert.equal(hours.reduce((a, b) => a + b), 3000);
  assert.ok(hours.every((n) => n === 125), hours.join(","));
  assert.equal(listed(r.body, "Netscape 3.0"), 600);
  ok(await ann.post("/edit.asp", { t: token(ok(await ann.get("/"))), s: busy, name: "Busy", url: "http://busy/", public: "1", on: "1" }));
  r = ok(await browser(alpha).get(`/public.asp?s=${busy}&r=30`));
  assert.ok(r.raw.length < MESSAGE_LIMIT);
  assert.doesNotMatch(r.body, /65\.16\.1\./);
  r = ok(await browser(alpha).post("/admin.asp", { owner: "owner", opw: "letmein" }));
  assert.ok(r.raw.length < MESSAGE_LIMIT);
  assert.match(r.body, /3,000<\/font><\/td><\/tr>/);
  // and a real hit on top, through hit.asp, is still quick
  const t2 = Date.now();
  await voyager(delta).http(`http://alpha/hit.asp?s=${busy}&p=/one-more.htm`);
  assert.equal(total(alpha, busy), 3001);
  console.log(`      (3,000 hits recorded in ${took} ms; one more over the network in ${Date.now() - t2} ms)`);
  // a page that ran out of time would say so: the 30-day one fits in a fifth of the time
  r = await alpha.request("GET", `/dash.asp?s=${busy}&r=30`, { cookies: ann.cookies(), budget: 4000 });
  ok({ ...r, url: "dash.asp with a fifth of the time" });
  assert.doesNotMatch(r.body, /ran for too long/);
  assert.deepEqual(alpha.errors, []);
});

// ---------------------------------------------------------------- SimHost

const host = await net.boot("HOST");
let hostHome;
await test("in a SimHost folder: /stats/ works, and the front page counts its visitors as this machine", async () => {
  await install(host, "simhost");
  const said = await install(host, "simstats");
  assert.match(said, /Open http:\/\/host\/stats\/ in Voyager/);
  assert.ok(host.exists("C:\\WEB\\STATS\\STATS.SPK") && !host.exists("C:\\WEB\\STATS.SPK"));
  assert.equal(host.read("C:\\WEB\\STATS\\APP.INF"), "SimStats|Web statistics for any site: hits, visitors, top pages, referrers and a hit counter.|#003366");
  assert.match(host.read("C:\\WEB\\ROBOTS.TXT"), /^Disallow: \/stats\/hit\.asp$/m);
  hostHome = host.read("C:\\STATDATA\\HOME.TXT").trim();
  const b = browser(host);
  let r = ok(await b.get("/"));
  assert.match(r.body, /<a href="\/stats\/">.*SimStats/);
  assert.match(r.body, new RegExp(`<img src="/stats/hit\\.asp\\?s=${hostHome}&p=/&t=HOST\\+-\\+SimHost" width="1" height="1" alt="">`));
  r = ok(await b.post("/stats/join.asp", { name: "Zed", u: "zed", pw: "secret", pw2: "secret" }));
  assert.match(r.url, /\/stats\/index\.asp$/);
  r = ok(await b.post("/stats/addsite.asp", { t: token(r), name: "Zed's Zone", url: "http://host/geo/area95/1001/" }));
  const zsite = /s=([0-9A-F]{8})/.exec(r.url)[1];
  r = ok(await b.get(`/stats/code.asp?s=${zsite}&page=/geo/area95/1001/`));
  assert.equal(textarea(r, "plain"), `<img src="http://host/stats/hit.asp?s=${zsite}&p=/geo/area95/1001/" width="1" height="1" border="0" alt="">`);

  host.run("C:\\PROGRAMS\\HTTPD.SPK");
  await wait(async () => /200 OK/.test(await host.fetch("HOST", "/stats/simstats.htm").catch(() => "")), "HOST's web server");
  const v = voyager(delta);
  const { pics } = await v.view("http://host/");
  const counter = pics.find((p) => p.src.startsWith("/stats/hit.asp"));
  assert.ok(counter && counter.shown, "the front page's tag");
  assert.equal(total(host, hostHome), 1);
  assert.match(host.read(`C:\\STATDATA\\S\\${hostHome}\\LIVE.TXT`), /\|Voyager 1\.1\|\/\|HOST - SimHost\|\n$/);
  host.write("C:\\SYSTEM\\USERS.INI", "name=root\npassword=toor\n");
  r = ok(await browser(host).post("/stats/admin.asp", { owner: "root", opw: "toor" }));
  assert.match(r.body, new RegExp(`<b>This machine \\(HOST\\)</b> <tt>${hostHome}</tt>[\\s\\S]*?<i>nobody</i> \\(this machine\\)</font></td>\\s*<td align="right"><font size="2">1</font>`));
  r = ok(await b.get(`/stats/dash.asp?s=${hostHome}`));
  assert.match(r.body, /That isn&#39;t one of your sites|That isn't one of your sites/, "nobody's site: only the overview shows it");

  // GeoSimies: a member pastes the plain tag into her homepage
  await install(host, "geosimies");
  const geo = browser(host);
  r = ok(await geo.post("/geo/join.asp", { name: "Zed", u: "zed", pw: "secret", pw2: "secret", h: "AREA95", n: "", title: "Zed's Zone", tpl: "STARS" }));
  assert.match(r.url, /\/geo\/edit\.asp\?new=1$/, r.body.slice(0, 300));
  const t = /name="t" value="([0-9A-F]+)"/.exec((await host.request("GET", "/geo/upload.asp", { cookies: geo.cookies() })).body)[1];
  const tag = textarea(ok(await b.get(`/stats/code.asp?s=${zsite}&page=/geo/area95/1001/`)), "plain");
  r = ok(await geo.post("/geo/edit.asp", { t, do: "save", p: "index", publish: "1", html: `<html><head><title>Zed's Zone</title></head><body><h1>Welcome to my zone</h1>\n${tag}\n</body></html>` }));
  assert.match(r.body, /Saved! Your page is on the Web/);
  r = ok(await browser(host).get("/geo/area95/1001/"));
  assert.ok(r.body.includes(tag), "GeoSimies kept the tag as it was pasted:\n" + r.body.slice(0, 800));
  const seen = await v.view("http://host/geo/area95/1001/");
  assert.match(seen.page.body, /Welcome to my zone/);
  assert.ok(seen.pics.find((p) => p.src.includes(zsite))?.shown, "the tag's picture on the homepage");
  assert.equal(total(host, zsite), 1);
  r = ok(await b.get(`/stats/dash.asp?s=${zsite}`));
  assert.equal(listed(r.body, "/geo/area95/1001/"), 1);
  assert.equal(listed(r.body, addr(delta)), 1);
  assert.deepEqual(host.errors, []);
});

await test("Move In brings SimStats over, but never joins two sets of accounts", async () => {
  // ALPHA's SimStats moves to a fresh SimHost that has SimStats but no accounts yet
  alpha.write("C:\\SYSTEM\\USERS.INI", "name=owner\npassword=letmein\n");
  alpha.run("C:\\PROGRAMS\\FILESVC.SPK");
  const fresh = await net.boot("FRESH");
  await install(fresh, "simhost");
  await install(fresh, "simstats");
  const freshHome = fresh.read("C:\\STATDATA\\HOME.TXT").trim();
  const moveIn = async () => {
    const pid = fresh.run("C:\\PROGRAMS\\MOVEIN.SPK");
    await wait(() => fresh.widgets(pid, "ListBox").length || !fresh.running(pid), "Move In's window");
    assert.ok(fresh.running(pid), "Move In stopped: " + JSON.stringify(fresh.ui.dialogs) + fresh.errors.join());
    const boxes = fresh.widgets(pid, "TextBox");
    boxes[0].set("Text", "alpha");
    boxes[1].set("Text", "owner");
    boxes[2].set("Text", "letmein");
    for (const c of fresh.widgets(pid, "CheckBox")) c.set("Checked", /SimStats/.test(c.get("Text")));
    const log = () => fresh.widgets(pid, "ListBox")[0].get("Items").join("\n");
    fresh.ui.answers = [true, true, true];
    fresh.button(pid, "Move In").call("Click");
    await wait(() => /^(Done|Stopped)/m.test(log()) || (fresh.ui.dialogs.length && !fresh.running(pid)) || /skipped/.test(fresh.ui.dialogs.map((d) => d.text).join()), "Move In: " + log(), 120000);
    await sleep(200);
    const shown = log();
    fresh.kernel.kill(pid);
    return { log: shown, said: fresh.ui.dialogs.splice(0).map((d) => d.text).join("\n") };
  };
  let { log, said } = await moveIn();
  assert.match(log, /^Done:/m, log);
  assert.match(said, /already has SimStats data/, "only this machine's own site: it asks, then adds");
  const sites = fresh.read("C:\\STATDATA\\SITES.TXT");
  assert.match(sites, new RegExp(`^${freshHome}\\|\\|This machine \\(FRESH\\)`), "its own site stays first");
  assert.match(sites, new RegExp(`\\n${site}\\|ann\\|Bravo's Place`), "ALPHA's sites were added");
  assert.equal(fresh.read("C:\\STATDATA\\HOME.TXT").trim(), freshHome, "HOME.TXT is this machine's");
  assert.equal(total(fresh, site), total(alpha, site));
  assert.ok(fresh.exists("C:\\STATDATA\\USERS\\ann.TXT") && !fresh.exists("C:\\STATDATA\\SESSIONS\\" + ann.cookies().split("=")[1] + ".TXT"));
  const annHere = browser(fresh);
  ok(await annHere.post("/stats/login.asp", { u: "ann", pw: "secret" }));
  const r = ok(await annHere.get(`/stats/dash.asp?s=${site}&r=30`));
  assert.ok(big(r.body, "HITS") >= 9);
  // again: now FRESH has accounts, and two sets can't be joined
  ({ said } = await moveIn());
  assert.match(said, /two SimStats can't be joined/);
  assert.deepEqual(fresh.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
