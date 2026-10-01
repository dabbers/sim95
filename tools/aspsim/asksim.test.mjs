// End-to-end tests for AskSim: the crawler (asksim/PROGRAMS/CRAWLER.SPK) going
// round real web servers on a pretend network, and the search pages
// (asksim/WEB/ASK) answering from what it found.
//   node tools/aspsim/asksim.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, MESSAGE_LIMIT } from "./sim.mjs";
import { Network } from "./network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + (e.message || e) + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}
const ok = (r) => {
  assert.equal(r.status, "200 OK", r.url + " -> " + r.status + "\n" + r.body.slice(-400));
  assert.ok(!r.body.includes("ActiveSparkPages error"), r.url + ": " + r.body.slice(r.body.indexOf("ActiveSparkPages error"), r.body.indexOf("ActiveSparkPages error") + 300));
  return r;
};

const net = new Network();
const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");
const charlie = await net.boot("CHARLIE");

// Some sites worth finding
bravo.write("C:\\WEB\\INDEX.HTM", `<html><head><title>Bravo's Hobby Corner</title></head><body>
<h1>Welcome to Bravo's hobby corner</h1>
<p>I like <a href="chess.htm">chess</a>, <a href="/recipes.htm">cooking</a> and my friend's
<a href="http://charlie/club.htm">Chess Club</a>.</p>
<p><a href="secret/plans.htm">My secret plans</a> &middot; <a href="logout.asp?t=1">Log out</a> &middot; <a href="mailto:bob@bravo">Mail me</a> &middot; <a href="/docs/spark.txt">The SPARK manual</a></p>
<script type="spark">SUB Hidden ()
    PAGE.Status = "zebra"
END SUB</script>
</body></html>`);
bravo.write("C:\\WEB\\CHESS.HTM", `<html><head><title>All About Chess</title></head><body>
<p>Chess is a game for two players. The knight moves in an L shape; the bishop moves diagonally.
Chess openings: the Sicilian, the French and the Ruy Lopez. <a href="index.htm">Home</a></p></body></html>`);
bravo.write("C:\\WEB\\RECIPES.HTM", `<html><head><title>Recipes</title>
<meta name="description" content="Bravo's favourite breakfast recipes.">
<meta name="keywords" content="cookbook, zeppelin, breakfast"></head><body><p>Pancakes: flour, eggs, milk &amp; butter. Mix, fry, flip.</p></body></html>`);
bravo.mkdir("C:\\WEB\\SECRET");
bravo.write("C:\\WEB\\SECRET\\PLANS.HTM", `<html><head><title>Secret</title></head><body>Take over the world with platypus.</body></html>`);
bravo.write("C:\\WEB\\ORPHAN.HTM", `<html><head><title>Nobody links here</title></head><body>An unlinked page about walrus.</body></html>`);
bravo.write("C:\\WEB\\DOCS\\SPARK.TXT", "The SPARK manual, which every machine has: ocelot.");
bravo.write("C:\\WEB\\ROBOTS.TXT", "User-agent: *\nDisallow: /secret/\n");
charlie.write("C:\\WEB\\CLUB.HTM", `<html><head><title>Charlie's Chess Club</title></head><body>
<p>The chess club meets on Tuesdays. Bring your own chess board. Chess chess chess!</p>
<p><img src="board.pic"> <a href="index.htm">Charlie's home page</a></p></body></html>`);

const webOf = {};
for (const m of [alpha, bravo, charlie]) webOf[m.stack.hostname()] = m.run("C:\\PROGRAMS\\HTTPD.SPK");
const crawlerPid = () => alpha.kernel.ps().find((p) => p.name === "CRAWLER")?.pid;
const stats = () => (alpha.exists("C:\\ASKDATA\\STATS.TXT") ? alpha.read("C:\\ASKDATA\\STATS.TXT") : "");
const docs = () => alpha.read("C:\\ASKDATA\\DOCS.TXT").trim().split("\n");
const doc = (url) => docs().find((l) => l.split("|")[1] === url);
const asked = (m) => m.widgets(webOf[m.stack.hostname()], "ListBox")[0].get("Items").join("\n");
const visitor = browser(alpha);
const ask = async (q) => ok(await visitor.get("/index.asp?q=" + encodeURIComponent(q)));

await test("the installer puts AskSim in place and the crawler goes round the network", async () => {
  alpha.write("C:\\MYFILES\\INSTALL.SPK", fs.readFileSync(path.join(root, "asksim/INSTALL.SPK"), "utf8"));
  const pid = alpha.run("C:\\MYFILES\\INSTALL.SPK");
  await net.until(() => !alpha.running(pid), 20000, "the installer");
  assert.match(alpha.output(pid), /AskSim is installed \(7 files\)/);
  assert.equal(alpha.read("C:\\SYSTEM\\STARTUP\\ASKSIM.RUN"), "C:\\PROGRAMS\\CRAWLER.SPK");
  await net.until(() => stats() !== "", 60000, "the first crawl");
  assert.deepEqual(alpha.ui.dialogs, []);
  const log = alpha.widgets(crawlerPid(), "ListBox")[0].get("Items").join("\n");
  assert.match(log, /3 machines answered/);
  assert.match(log, /bravo\/robots.txt keeps me out of \/secret\//);
  assert.match(log, /Index built/);
});

await test("it found the pages, followed links between machines, and minded robots.txt", async () => {
  for (const url of ["http://bravo/", "http://bravo/chess.htm", "http://bravo/recipes.htm", "http://charlie/club.htm", "http://charlie/", "http://alpha/", "http://charlie/hello.asp"]) assert.ok(doc(url), url);
  assert.ok(!doc("http://bravo/secret/plans.htm"), "robots.txt");
  assert.ok(!asked(bravo).includes("/secret/"), "never even asked for it");
  assert.ok(!asked(bravo).includes("logout"), "links that change things are left alone");
  assert.ok(!asked(bravo).includes("/docs/"), "the manuals every machine has are skipped");
  assert.match(doc("http://bravo/chess.htm"), /\|All About Chess\|.*\|ok\|$/);
  assert.match(alpha.read(`C:\\ASKDATA\\TEXT\\${doc("http://bravo/").split("|")[0]}.TXT`), /^Bravo's Hobby Corner\nWelcome to Bravo's hobby corner I like chess, cooking/);
  assert.ok(!alpha.read(`C:\\ASKDATA\\TEXT\\${doc("http://bravo/").split("|")[0]}.TXT`).includes("zebra"), "scripts are not text");
});

await test("asking a question finds the best pages, with your words in bold", async () => {
  const r = await ask("Where can I find information about chess?");
  assert.match(r.body, /You asked: <b>Where can I find information about chess\?<\/b>/);
  assert.match(r.body, /Simms found <b>3<\/b> answers\s+about <b>chess<\/b>/); // club, chess.htm, Bravo's home page
  assert.match(r.body, /Simms suggests:<\/b> <a href="http:\/\/charlie\/club.htm"><b>Charlie's Chess Club/, "title and many mentions win");
  assert.ok(r.body.indexOf("All About Chess") > r.body.indexOf("Chess Club</b></a></font></dt>"));
  assert.match(r.body, /<b>chess<\/b> club meets on Tuesdays/i);
  assert.match(r.body, /Where can I find pages about <i>chess<\/i>\?/);
  assert.match(r.body, /What else is on <i>charlie<\/i>\?/);
});

await test("all the words beat some of them; site: keeps to one machine", async () => {
  let r = await ask("knight bishop pancakes");
  const chessAt = r.body.indexOf("All About Chess"), recipesAt = r.body.indexOf(">Recipes<");
  assert.ok(chessAt > 0 && recipesAt > 0 && chessAt < recipesAt, "two words beat one");
  r = await ask("chess site:bravo");
  assert.ok(r.body.includes("All About Chess") && !r.body.includes("Charlie's Chess Club</b>"));
  r = await ask("site:charlie");
  assert.match(r.body, /Charlie's Chess Club/);
  r = await ask("what is it?");
  assert.match(r.body, /couldn't tell what you were looking for/);
  r = await ask("platypus");
  assert.match(r.body, /found nothing about\s*<b>platypus<\/b>/);
});

await test("meta keywords count, and a meta description is what the results show", async () => {
  const r = await ask("zeppelin");
  assert.match(r.body, /Simms suggests:<\/b> <a href="http:\/\/bravo\/recipes.htm">/);
  assert.match(r.body, /Bravo's favourite breakfast recipes\. - Pancakes/);
});

await test("Just take me there goes to the best answer", async () => {
  const r = await alpha.request("GET", "/index.asp?q=chess&go=1");
  assert.equal(r.status, "302 Found");
  assert.ok(r.headers.includes("Location: http://charlie/club.htm"));
});

await test("the cached copy points back at the real site", async () => {
  const id = doc("http://charlie/club.htm").split("|")[0];
  const r = ok(await visitor.get(`/cache.asp?id=${id}`));
  assert.match(r.body, /AskSim<\/b><\/a>'s copy of <a href="http:\/\/charlie\/club.htm">/);
  assert.match(r.body, /The real page may have changed since/);
  assert.match(r.body, /<img src="http:\/\/charlie\/board.pic">/);
  assert.match(r.body, /<a href="http:\/\/charlie\/">Charlie's home page/);
  for (const bad of ["..\\..\\SYSTEM\\USERS", "999", "1.2"]) assert.equal((await alpha.request("GET", "/cache.asp?id=" + encodeURIComponent(bad))).status, "302 Found", bad);
});

await test("a machine that goes away stays findable, marked, with its cached copy", async () => {
  charlie.kernel.kill(webOf.CHARLIE);
  const before = stats();
  alpha.button(crawlerPid(), "Crawl Now").call("Click");
  await net.until(() => stats() !== before, 60000, "the second crawl");
  assert.match(doc("http://charlie/club.htm"), new RegExp(`\\|gone\\|\\d{4}-\\d\\d-\\d\\d$`));
  assert.match(doc("http://bravo/chess.htm"), /\|ok\|$/);
  let r = await ask("chess club");
  assert.match(r.body, /Charlie's Chess Club/);
  assert.match(r.body, /not answering since \d{4}-\d\d-\d\d/);
  r = ok(await visitor.get(`/cache.asp?id=${doc("http://charlie/club.htm").split("|")[0]}`));
  assert.match(r.body, /The real page has not answered since/);
  assert.match(r.body, /Bring your own chess board/);
  // Internet Explorer asks by address when a site is down
  r = ok(await visitor.get("/cache.asp?url=" + encodeURIComponent("http://charlie/club.htm")));
  assert.match(r.body, /The real page has not answered since/);
  r = ok(await visitor.get("/cache.asp?url=charlie"));
  assert.match(r.body, /copy of <a href="http:\/\/charlie\/">/);
  r = await alpha.request("GET", "/cache.asp?url=" + encodeURIComponent("http://nowhere/x.htm"));
  assert.equal(r.status, "302 Found");
  assert.ok(r.headers.includes("Location: index.asp?q=site%3Anowhere"), r.headers.join(","));
});

await test("a submitted site is visited on the next crawl", async () => {
  ok(await visitor.post("/addurl.asp", { url: "http://alpha/index.asp?q=chess" }));
  for (const [app, file] of [["simbook", "SIMBOOK.HTM"], ["coldmail", "COLDMAIL.HTM"], ["eliza", "ELIZA.HTM"]]) {
    bravo.write("C:\\WEB\\" + file, fs.readFileSync(path.join(root, app, "WEB", file), "utf8"));
    ok(await visitor.post("/addurl.asp", { url: "http://bravo/" + file.toLowerCase() }));
  }
  let r = ok(await visitor.post("/addurl.asp", { url: "bravo/orphan.htm" }));
  assert.match(r.body, /Simms will call on http:\/\/bravo\/orphan.htm/);
  r = ok(await visitor.post("/addurl.asp", { url: "http://bravo/orphan.htm" }));
  assert.match(r.body, /already has/);
  r = ok(await visitor.post("/addurl.asp", { url: "not a url at all" }));
  assert.match(r.body, /doesn't look like an address/);
  const before = stats();
  alpha.button(crawlerPid(), "Crawl Now").call("Click");
  await net.until(() => stats() !== before, 60000, "the third crawl");
  assert.match((await ask("walrus")).body, /Nobody links here/);
  assert.deepEqual(docs().filter((l) => /\?q=|cache\.asp|addurl/.test(l)), [], "AskSim's own results and cached copies are never indexed");
  assert.ok(doc("http://alpha/asksim.htm"), "but its about page is");
  const best = async (q) => (await ask(q)).body.match(/Simms suggests:<\/b> <a href="([^"]+)"/)?.[1];
  assert.equal(await best("Where can I find a social network?"), "http://bravo/simbook.htm");
  assert.equal(await best("like twitter or facebook"), "http://bravo/simbook.htm");
  assert.equal(await best("free email"), "http://bravo/coldmail.htm");
  assert.equal(await best("webmail"), "http://bravo/coldmail.htm");
  assert.equal(await best("I want to talk to an AI chat bot"), "http://bravo/eliza.htm");
  assert.equal(await best("virtual assistant"), "http://bravo/eliza.htm");
  assert.equal(await best("search engine"), "http://alpha/asksim.htm");
});

await test("the front page, and a results page full of answers, fit in a message", async () => {
  let r = ok(await visitor.get("/"));
  assert.match(r.body, /Just ask Simms/);
  assert.match(r.body, /Simms knows \d+ pages on 3 machines/, [...new Set(docs().map((l) => l.split("|")[1].split("/")[2]))].join(", "));
  r = await ask("chess cooking pancakes knight bishop club hobby welcome");
  assert.ok(r.raw.length < MESSAGE_LIMIT - 8000, r.raw.length);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
