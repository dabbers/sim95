// End-to-end tests for WikiSim (wikisim/): the data that tools/make-wikisim.mjs
// made (the 1996 cut, the sizes), the encyclopedia's pages on the real SPARK
// page renderer, and WikiSim in a SimHost folder.
//   node tools/aspsim/wikisim.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, MESSAGE_LIMIT } from "./sim.mjs";
import { Network } from "./network.mjs";
import { LATEYEAR, BANNED, isLate, sentences } from "../make-wikisim.mjs";

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
const dataDir = path.join(root, "wikisim/DATA");
const data = (f) => fs.readFileSync(path.join(dataDir, f), "utf8");

// The data, as the pages see it
const index = data("INDEX.TXT").trim().split("\n").map((l) => l.split("|"));
const titleOf = new Map(index.map((p) => [Number(p[0]), p[1]]));
const articles = new Map();
for (const f of fs.readdirSync(dataDir).filter((f) => /^VOL\d\d\.TXT$/.test(f))) {
  for (const l of data(f).trim().split("\n")) {
    const [id, title] = l.split("|");
    articles.set(Number(id), { title, text: l.slice(id.length + title.length + 2), vol: f });
  }
}
const plain = (t) => t.replace(/\{\d+\|([^}]*)\}/g, "$1").replace(/\\/g, " ");
const byTitle = (t) => Number(index.find((p) => p[1] === t)[0]);

const net = new Network();
const wait = (fn, what, ms = 20000) => net.until(fn, ms, what);
async function install(m, app) {
  m.write("C:\\MYFILES\\INSTALL.SPK", installer(app));
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !m.running(pid) || /in Voyager/.test(m.output(pid)), app + "'s installer", 180000);
  assert.deepEqual(m.ui.dialogs, [], app + ": " + m.output(pid));
  return m.output(pid);
}
// How many of a page's 20,000 yields (one per 512 statements) it needs.
async function stepsFor(m, url) {
  let lo = 0, hi = 20000;
  const fits = async (budget) => !(await m.request("GET", url, { budget })).body.includes("ran for too long");
  if (!(await fits(hi))) return Infinity;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (await fits(mid)) hi = mid; else lo = mid; }
  return hi;
}

// ---------------------------------------------------------------- the data

await test("the data: every article indexed, in order, in volumes that fit", async () => {
  assert.ok(index.length >= 500, index.length + " articles");
  assert.equal(articles.size, index.length);
  index.forEach((p, i) => {
    assert.equal(Number(p[0]), i + 1, "ids follow the index");
    assert.equal(articles.get(i + 1).title, p[1]);
    assert.equal("VOL" + p[3].padStart(2, "0") + ".TXT", articles.get(i + 1).vol);
    assert.equal(p[2], /[A-Z]/.test(p[1][0].toUpperCase()) ? p[1][0].toUpperCase() : "#");
  });
  const titles = index.map((p) => p[1]);
  assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b)), "A to Z");
  for (const f of fs.readdirSync(dataDir)) assert.ok(fs.statSync(path.join(dataDir, f)).size <= 40000, f + " is small enough to read fast");
  for (const [id, a] of articles) {
    assert.ok(a.text.length <= 1300 && plain(a.text).length >= 150, a.title + " is " + a.text.length);
    for (const m of a.text.matchAll(/\{(\d+)\|[^}]*\}/g)) assert.ok(titleOf.has(Number(m[1])) && Number(m[1]) !== id, a.title + " links to " + m[1]);
  }
  for (const l of data("LINKS.TXT").trim().split("\n")) {
    const [id, see] = l.split("|");
    assert.ok(titleOf.has(Number(id)));
    for (const s of see.split(" ").filter(Boolean)) assert.ok(titleOf.has(Number(s)), "see also " + s);
  }
  for (const want of ["Albert Einstein", "History", "Music", "Paris", "World War II", "Nelson Mandela"]) assert.ok(titles.includes(want), want);
});

await test("the 1996 cut: no sentence names a year after 1996, or anything banned", async () => {
  const texts = [...[...articles.values()].map((a) => [a.title, plain(a.text)]), ...data("DYK.TXT").trim().split("\n").map((l) => ["DYK " + l.split("|")[0], l.slice(l.indexOf("|") + 1)])];
  for (const [title, text] of texts) {
    assert.ok(!LATEYEAR.test(text), title + ": " + (text.match(new RegExp(".{0,60}" + LATEYEAR.source + ".{0,20}")) || [])[0]);
    assert.ok(!/21st century|as of 20\d\d/i.test(text), title);
    for (const s of text.split("\\").flatMap(sentences)) assert.ok(!isLate(s), title + ": " + s);
    assert.ok(!isLate(title), title);
  }
  for (const word of ["iPhone", "Facebook", "Google", "YouTube", "Wikipedia", "COVID", "Bitcoin", "smartphone", "social media"]) {
    assert.ok(BANNED.includes(word), word + " is on the list");
    for (const [title, text] of texts) assert.ok(!new RegExp("\\b" + word + "\\b", "i").test(text), title + " mentions " + word);
  }
  const titles = index.map((p) => p[1]);
  for (const late of ["Facebook", "Google", "IPhone", "YouTube", "COVID-19 pandemic", "Smartphone", "Social media"]) assert.ok(!titles.includes(late), late + " is from after 1996");
});

await test("the installer stays small enough to paste", async () => {
  const total = fs.readdirSync(dataDir).reduce((n, f) => n + fs.statSync(path.join(dataDir, f)).size, 0);
  const size = installer("wikisim").length;
  console.log(`      data ${total} bytes in ${fs.readdirSync(dataDir).length} files; INSTALL.SPK ${size} bytes`);
  assert.ok(size < 950000, "INSTALL.SPK is " + size);
  assert.match(installer("wikisim"), /^' VAPOR\|id=WIKISIM\|name=WikiSim\|kind=web\|version=[0-9a-f]{8}\|category=Reference\|run=\/\|files=[^|]*C:\\WIKIDATA\\INDEX.TXT[^|]*\|tasks=\|startup=\|folder=WIKI\|about=/);
});

// ---------------------------------------------------------------- the pages

const alpha = await net.boot("ALPHA");
const b = browser(alpha);

await test("the installer makes WikiSim ALPHA's home page, with the articles in C:\\WIKIDATA", async () => {
  alpha.mkdir("C:\\WIKIDATA");
  alpha.write("C:\\WIKIDATA\\VOL99.TXT", "an old volume");
  const said = await install(alpha, "wikisim");
  assert.match(said, /WikiSim is installed \(\d+ files\)/);
  assert.match(said, /Open http:\/\/alpha\/ in Voyager/);
  assert.ok(alpha.exists("C:\\WEB\\WIKI.SPK") && alpha.exists("C:\\WEB\\WELCOME.HTM"));
  for (const f of fs.readdirSync(dataDir)) assert.equal(alpha.read("C:\\WIKIDATA\\" + f), data(f), f);
  assert.ok(!alpha.exists("C:\\WIKIDATA\\VOL99.TXT"), "an older copy's leftovers go");
});

await test("the front page: logo, search, A to Z, random, article of the day, did you know", async () => {
  const r = ok(await b.get("/"));
  assert.match(r.body, /<b>W<\/b><\/font>.*<b>iki<\/b>.*<b>S<\/b>.*<b>im<\/b>/);
  assert.match(r.body, /<form action="search.asp" method="get">/);
  for (const L of "ABCXYZ") assert.match(r.body, new RegExp(`<a href="letter.asp\\?l=${L}"><b>${L}</b></a>`));
  assert.match(r.body, /<a href="random.asp"><b>Random article<\/b><\/a>/);
  assert.match(r.body, new RegExp(index.length + " articles"));
  // the article of the day is the same all day, and is the one the date picks
  const date = (await alpha.runScript('SUB Main ()\n    Print(TIME.Date)\nEND SUB'))[0];
  const seed = Number(date.slice(0, 4)) * 372 + Number(date.slice(5, 7)) * 31 + Number(date.slice(8, 10));
  const day = ((seed * 7919) % index.length) + 1;
  const box = r.body.slice(r.body.indexOf("Article of the Day"));
  assert.ok(box.includes(`<a href="article.asp?a=${day}">${titleOf.get(day).replace(/&/g, "&amp;")}</a>`), "article of the day " + day + " " + titleOf.get(day));
  assert.equal(ok(await b.get("/")).body, r.body, "the same all day");
  const dyk = data("DYK.TXT").trim().split("\n")[(seed * 31) % data("DYK.TXT").trim().split("\n").length];
  assert.ok(r.body.includes(`<a href="article.asp?a=${dyk.split("|")[0]}">`), "did you know " + dyk);
  assert.match(r.body, /Did you know\?/);
});

await test("an article: its text, links to other articles, See also, and where it came from", async () => {
  const id = byTitle("Albert Einstein");
  const a = articles.get(id);
  let r = ok(await b.get("/article.asp?a=" + id));
  assert.match(r.body, /<title>Albert Einstein - WikiSim 96<\/title>/);
  assert.match(r.body, /From Wikipedia, the free encyclopedia \(text as of 1996, edited\) &mdash; <a href="license.htm">CC BY-SA 4.0<\/a>\. Original article: &quot;Albert Einstein&quot;/);
  for (const m of a.text.matchAll(/\{(\d+)\|([^}]*)\}/g)) assert.ok(r.body.includes(`<a href="article.asp?a=${m[1]}">${m[2].replace(/&/g, "&amp;")}</a>`), "link to " + m[1]);
  // See also: the articles that link here, for every article that has any
  const seeOf = (n) => ((data("LINKS.TXT").split("\n").find((l) => l.startsWith(n + "|")) || "|").split("|")[1]).split(" ").filter(Boolean);
  assert.equal(r.body.includes("<h3>See also</h3>"), seeOf(id).length > 0);
  const linked = Number(data("LINKS.TXT").split("\n")[0].split("|")[0]);
  const lr = ok(await b.get("/article.asp?a=" + linked));
  assert.match(lr.body, /<h3>See also<\/h3>/);
  for (const s of seeOf(linked)) {
    assert.ok(lr.body.includes(`<li><a href="article.asp?a=${s}">${titleOf.get(Number(s)).replace(/&/g, "&amp;")}</a>`), "see also " + s);
    assert.ok(articles.get(Number(s)).text.includes("{" + linked + "|"), titleOf.get(Number(s)) + " links to " + linked);
  }
  assert.ok(r.body.includes(`<a href="article.asp?a=${id - 1}">&lt;&lt; `) && r.body.includes(`<a href="article.asp?a=${id + 1}">`), "either side");
  // by title, in any case, and by a short title
  assert.equal(ok(await b.get("/article.asp?a=albert+einstein")).body, r.body);
  assert.equal(ok(await b.get("/article.asp?a=World+War+II")).body, ok(await b.get("/article.asp?a=" + byTitle("World War II"))).body);
  const doom = index.find((p) => p[1].startsWith("Doom ("));
  if (doom) assert.match(ok(await b.get("/article.asp?a=doom")).body, new RegExp("<title>" + doom[1].replace(/[()]/g, "\\$&")));
  // somewhere that isn't there
  r = await b.get("/article.asp?a=Facebook");
  assert.equal(r.status, "404 Not Found");
  assert.match(r.body, /Perhaps it had not happened yet in 1996/);
  assert.equal((await b.get("/article.asp?a=999999")).status, "404 Not Found");
});

await test("every article page carries the attribution, and fits in a message", async () => {
  let biggest = ["", 0];
  for (const [id, a] of articles) {
    const r = ok(await alpha.request("GET", "/article.asp?a=" + id));
    assert.ok(r.body.includes("From Wikipedia, the free encyclopedia (text as of 1996, edited) &mdash; <a href=\"license.htm\">CC BY-SA 4.0</a>. Original article: &quot;" + a.title.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + "&quot;"), a.title);
    if (r.raw.length > biggest[1]) biggest = [a.title, r.raw.length];
  }
  console.log(`      biggest article page: ${biggest[0]}, ${biggest[1]} of ${MESSAGE_LIMIT}`);
  assert.ok(biggest[1] < MESSAGE_LIMIT);
});

await test("letter pages list every title, a page at a time, each under 64K", async () => {
  let biggest = 0;
  let seen = 0;
  for (const L of [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0"]) {
    const want = index.filter((p) => p[2] === (L === "0" ? "#" : L));
    for (let p = 1; ; p++) {
      const r = ok(await b.get(`/letter.asp?l=${L}&p=${p}`));
      biggest = Math.max(biggest, r.raw.length);
      const links = [...r.body.matchAll(/<li><a href="article.asp\?a=(\d+)">/g)].map((m) => Number(m[1]));
      if (!links.length) break;
      assert.ok(links.length <= 150);
      seen += links.length;
      for (const id of links) assert.ok(want.some((w) => Number(w[0]) === id), L + " has " + id);
      if (!r.body.includes(`p=${p + 1}"`)) break;
    }
  }
  assert.equal(seen, index.length, "every title is under some letter");
  assert.ok(biggest < MESSAGE_LIMIT, "biggest letter page " + biggest);
  console.log(`      biggest letter page: ${biggest} of ${MESSAGE_LIMIT}`);
  assert.match(ok(await b.get("/letter.asp?l=A&p=2")).body, /Articles under A/);
});

await test("search: titles first, then words in the text; and misses", async () => {
  let r = ok(await b.get("/search.asp?q=music"));
  assert.match(r.body, /found for &quot;music&quot;/);
  const first = /<li><a href="article.asp\?a=(\d+)">/.exec(r.body)[1];
  assert.equal(titleOf.get(Number(first)), "Music", "the title comes first");
  // a word that is in some article's text and in no title
  const word = "telephone";
  const inText = [...articles.values()].filter((a) => plain(a.text).toLowerCase().includes(word) && !a.title.toLowerCase().includes(word));
  assert.ok(inText.length > 0);
  r = ok(await b.get("/search.asp?q=" + word));
  assert.ok(r.body.includes(`>${inText[0].title.replace(/&/g, "&amp;")}</a><br><font size="2"`), "found in the text: " + inText[0].title);
  // two words, both in the title
  r = ok(await b.get("/search.asp?q=world+war"));
  assert.match(r.body, /<b>World War I<\/b>/);
  assert.match(r.body, /<b>World War II<\/b>/);
  // nothing
  r = ok(await b.get("/search.asp?q=myspace+tamagotchiz"));
  assert.match(r.body, /Nothing found for &quot;myspace tamagotchiz&quot;/);
  r = ok(await b.get("/search.asp?q=x"));
  assert.match(r.body, /Type a word or two/);
});

await test("search stays well inside the time limit", async () => {
  const report = [];
  for (const url of ["/search.asp?q=zzzzqqq", "/search.asp?q=the+of+and", "/search.asp?q=e", "/search.asp?q=a+b+c+d+e+f+g", "/letter.asp?l=S", "/index.asp", "/article.asp?a=Zoroastrianism"]) {
    const s = await stepsFor(alpha, url);
    report.push(`${url} ${s}`);
    assert.ok(s < 2000, `${url} needs ${s} of 20000 yields`);
  }
  console.log("      yields used (of 20000): " + report.join(", "));
});

await test("random article goes somewhere different each time", async () => {
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    const r = await alpha.request("GET", "/random.asp");
    assert.equal(r.status.slice(0, 3), "302");
    const id = Number(/Location: article.asp\?a=(\d+)/.exec(r.headers.join("\n"))[1]);
    assert.ok(titleOf.has(id), "random " + id);
    seen.add(id);
  }
  assert.ok(seen.size > 4, "random enough");
  ok(await b.get("/random.asp"));
  assert.match(b.last.body, /From Wikipedia, the free encyclopedia/);
});

await test("the about page is found by search engines; the licence says the text was changed", async () => {
  const about = alpha.read("C:\\WEB\\WIKISIM.HTM");
  const kw = /<meta name="keywords" content="([^"]*)"/.exec(about)[1];
  for (const k of ["encyclopedia", "wiki", "wikipedia", "reference", "knowledge", "history", "1996"]) assert.ok(kw.split(", ").includes(k), k);
  const lic = alpha.read("C:\\WEB\\LICENSE.HTM");
  assert.match(lic, /Creative Commons Attribution-ShareAlike 4\.0/);
  assert.match(lic, /The text has been changed/);
  assert.match(fs.readFileSync(path.join(root, "wikisim/LICENSE.TXT"), "utf8"), /CC BY-SA 4\.0[\s\S]*modified/);
  assert.deepEqual(alpha.errors, []);
});

await test("ELIZA-95 on the same machine answers from WikiSim", async () => {
  await install(alpha, "eliza");
  const e = browser(alpha);
  const r = ok(await e.post("/index.asp", { say: "What is music?", temp: "0" }));
  const i = r.body.indexOf('<pre id="answer">');
  const said = r.body.slice(i + 17, r.body.indexOf("</pre>", i)).replace(/\s+/g, " ");
  assert.match(said, /^According to WikiSim \(1996 edition\): Music /);
  assert.match(said, /The whole article is at http:\/\/alpha\/article\.asp\?a=\d+$/);
  assert.ok(said.endsWith("http://alpha/article.asp?a=" + byTitle("Music")), said);
});

// ---------------------------------------------------------------- SimHost

const host = await net.boot("HOST");

await test("in a SimHost folder: /wiki/ works and its links stay inside /wiki/", async () => {
  await install(host, "simhost");
  const said = await install(host, "wikisim");
  assert.match(said, /Open http:\/\/host\/wiki\/ in Voyager/);
  assert.ok(host.exists("C:\\WEB\\WIKI\\WIKI.SPK") && !host.exists("C:\\WEB\\WIKI.SPK"));
  assert.ok(host.exists("C:\\WIKIDATA\\INDEX.TXT"), "the data still goes in C:\\WIKIDATA");
  assert.match(host.read("C:\\WEB\\INDEX.ASP"), /SimHost's front door/, "the home page stays the list");
  const h = browser(host);
  let r = ok(await h.get("/"));
  assert.match(r.body, /<a href="\/wiki\/">.*WikiSim/);
  r = ok(await h.get("/wiki/"));
  assert.match(r.body, /Article of the Day/);
  assert.ok(!/href="\//.test(r.body), "no links from the root");
  r = ok(await h.get("/wiki/search.asp?q=music"));
  assert.match(r.body, /<b>Music<\/b>/);
  ok(await h.get("/wiki/random.asp"));
  assert.match(h.last.url, /^\/wiki\/article\.asp\?a=\d+$/);
  await install(host, "eliza");
  const e = browser(host);
  r = ok(await e.post("/eliza/index.asp", { say: "what is philosophy?", temp: "0" }));
  assert.ok(r.body.includes("http://host/wiki/article.asp?a=" + byTitle("Philosophy")), "ELIZA points into /wiki/");
});

await test("SimHost moves a WikiSim that was the home page into /wiki/", async () => {
  // ALPHA has WikiSim and then ELIZA-95 as its home page
  const said = await install(alpha, "simhost");
  assert.match(said, /moved WikiSim \(\d+ files\) into C:\\WEB\\WIKI: http:\/\/alpha\/wiki\//);
  assert.ok(alpha.exists("C:\\WEB\\WIKI\\ARTICLE.ASP") && !alpha.exists("C:\\WEB\\WIKI.SPK"));
  ok(await browser(alpha).get("/wiki/article.asp?a=Philosophy"));
  assert.deepEqual(alpha.errors, []);
  assert.deepEqual(host.errors, []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
