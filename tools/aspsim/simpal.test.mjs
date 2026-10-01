// End-to-end tests for SimPal (simpal/), run on the real SIM95 interpreter by
// sim.mjs and network.mjs.   node tools/aspsim/simpal.test.mjs
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { machine, browser as rawBrowser, MESSAGE_LIMIT } from "./sim.mjs";
import { Network } from "./network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + (e.stack || e).toString().split("\n").slice(0, 5).join("\n      ")); }
}
const ok = (r) => {
  assert.equal(r.status, "200 OK", r.url + " -> " + r.status + "\n" + r.body.slice(-400));
  assert.ok(!r.body.includes("ActiveSparkPages error") && !r.body.includes("did not compile"), r.url + ": " + r.body.slice(0, 600));
  return r;
};
const installer = (app) => fs.readFileSync(path.join(root, app, "INSTALL.SPK"), "utf8");
const form = (f) => Object.entries(f).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v).replace(/%20/g, "+")).join("&");
const decode = (x) => x.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

// A member using SimPal's own pages: their forms carry the session's form
// token, so this browser adds it the way those pages would. rawBrowser is
// somebody else's page aiming a request at SimPal: no token.
function browser(m, base = "/") {
  const b = rawBrowser(m);
  const { post } = b;
  b.base = base;
  b.token = async () => (/name="t" value="([0-9A-F]+)"/.exec((await m.request("GET", base + "send.asp", { cookies: b.cookies() })).body) || [])[1] ?? "";
  b.post = async (url, f) => post(url, f && !("t" in f) && !/(join|login)\.asp/.test(url) ? { ...f, t: await b.token() } : f);
  return b;
}
// Cents from the big balance on the account page.
async function balance(b) {
  const r = ok(await b.get(b.base + "home.asp"));
  const x = /<font size="6" color="#003087"><b>(-?)&sect;([\d,]+)\.(\d\d)<\/b>/.exec(r.body);
  assert.ok(x, "no balance on the account page: " + r.body.slice(0, 300));
  return (x[1] ? -1 : 1) * (Number(x[2].replace(/,/g, "")) * 100 + Number(x[3]));
}
async function join(m, u, name = u.toUpperCase(), base = "/") {
  const b = browser(m, base);
  const r = ok(await b.post(base + "join.asp", { name, u, pw: "secret", pw2: "secret" }));
  assert.match(r.url, /home\.asp\?new=1/, "could not join " + u + ": " + r.body.slice(0, 400));
  return b;
}
async function login(m, u, base = "/") {
  const b = browser(m, base);
  assert.match(ok(await b.post(base + "login.asp", { u, pw: "secret" })).url, /home\.asp$/, "could not log in " + u);
  return b;
}
const send = (b, to, amount, note = "") => b.post(b.base + "send.asp", { to, amount, note });
const said = (r) => decode((/<td bgcolor="#FFF9D7"><font size="2">([^<]*)<\/font>/.exec(r.body) || [])[1] ?? "");
// The pay button pressed on the confirm page: SimPal answers with a redirect
// to the shop's own address (on any machine), so follow it by hand.
async function confirmPay(m, b, fields) {
  const t = await b.token();
  const r = await m.request("POST", b.base + "pay.asp", { body: form({ ...fields, do: "pay", t }), cookies: b.cookies() });
  const loc = r.headers.find((h) => h.startsWith("Location: "));
  return { r, to: loc ? loc.slice(10) : null };
}
const ledgerTotal = (m) => {
  let sum = 0;
  for (const f of m.list("C:\\PALDATA\\BAL")) sum += Number(m.read("C:\\PALDATA\\BAL\\" + f.name).split("|")[0]);
  return sum;
};
const OWNER = { owner: "dab", opw: "hostpw" };

const m = await machine("PALHOST");
await m.runScript(installer("simpal"));
m.write("C:\\SYSTEM\\USERS.INI", "name=dab\npassword=hostpw\n");

await test("INSTALL.SPK writes every file exactly, and PALCHECK.SPK to C:\\PROGRAMS", async () => {
  const dir = path.join(root, "simpal/WEB");
  for (const f of fs.readdirSync(dir)) assert.equal(m.read("C:\\WEB\\" + f.toUpperCase()), fs.readFileSync(path.join(dir, f), "utf8"), f);
  assert.equal(m.read("C:\\PROGRAMS\\PALCHECK.SPK"), fs.readFileSync(path.join(root, "simpal/PROGRAMS/PALCHECK.SPK"), "utf8"));
  assert.ok(!m.exists("C:\\WEB\\INDEX.HTM") && m.exists("C:\\WEB\\WELCOME.HTM"), "the stock home page moved aside");
  assert.match(installer("simpal").split("\n")[0], /^' VAPOR\|id=SIMPAL\|name=SimPal\|kind=web\|.*\|folder=PAL\|/);
});

await test("the front door, the about page and its keywords", async () => {
  const r = ok(await rawBrowser(m).get("/"));
  assert.match(r.body, /Send money to anyone with a SimPal account/);
  assert.match(r.body, /Secure transaction/);
  assert.match(r.body, /Your money is safe with us!!/);
  assert.match(r.body, /&sect;100\.00/);
  const about = ok(await rawBrowser(m).get("/simpal.htm")).body;
  const kw = /<meta name="keywords" content="([^"]+)"/.exec(about)[1];
  for (const k of ["payments", "money", "send money", "paypal", "wallet", "shop"]) assert.ok(kw.split(", ").includes(k), k);
  assert.match(about, /<meta name="description"/);
});

const ann = await join(m, "ann", "Ann Archer");
const bob = await join(m, "bob", "Bob Baker");
const cat = await join(m, "cat", "Cat Cole");

await test("sign-up bonus: §100.00 each, in the ledger and the history", async () => {
  assert.equal(await balance(ann), 10000);
  assert.equal(await balance(bob), 10000);
  const h = ok(await ann.get("/history.asp")).body;
  assert.match(h, /Welcome bonus from SimPal/);
  assert.match(h, /\+&sect;100\.00/);
  assert.match(m.read("C:\\PALDATA\\LEDGER\\0.TXT"), /^1\|[^|]+\|bonus\|\*\|ann\|10000\|/m);
  // a taken name, a bad name and mismatched passwords open nothing and pay nothing
  let r = ok(await rawBrowser(m).post("/join.asp", { name: "Imposter", u: "ann", pw: "xxxx", pw2: "xxxx" }));
  assert.match(r.body, /Somebody already has the name ann/);
  r = ok(await rawBrowser(m).post("/join.asp", { name: "Bad", u: "a!", pw: "xxxx", pw2: "xxxx" }));
  assert.match(r.body, /3 to 8 letters or digits/);
  r = ok(await rawBrowser(m).post("/join.asp", { name: "Dan", u: "dan", pw: "xxxx", pw2: "yyyy" }));
  assert.match(r.body, /two passwords are different/);
  assert.ok(!m.exists("C:\\PALDATA\\USERS\\DAN.TXT"));
  assert.equal(ledgerTotal(m), 30000);
  // and the password is salted and hashed, not kept
  const rec = m.read("C:\\PALDATA\\USERS\\ANN.TXT");
  assert.match(rec, /^salt=[0-9A-F]+$/m);
  assert.doesNotMatch(rec, /secret/);
  assert.match(ok(await rawBrowser(m).post("/login.asp", { u: "ann", pw: "wrong" })).body, /do not match/);
});

await test("send money with a note", async () => {
  const r = ok(await send(ann, "bob", "12.50", "Pizza <with> everything"));
  assert.match(r.url, /home\.asp/);
  assert.match(said(r), /Sent! §12\.50 is on its way to bob/);
  assert.equal(await balance(ann), 8750);
  assert.equal(await balance(bob), 11250);
  const hb = ok(await bob.get("/history.asp")).body;
  assert.match(hb, /Received from <b>Ann Archer<\/b> \(ann\)/);
  assert.match(hb, /&quot;Pizza &lt;with&gt; everything&quot;/);
  assert.match(ok(await ann.get("/history.asp")).body, /Sent to <b>Bob Baker<\/b>.*-&sect;12\.50/s);
  // amounts in other spellings
  ok(await send(ann, "BOB ", "§1", ""));
  ok(await send(ann, "bob", "$0.5", ""));
  assert.equal(await balance(ann), 8750 - 150);
  ok(await send(bob, "ann", "1.50"));
  assert.equal(await balance(ann), 8750);
});

await test("insufficient funds, negative amounts, paying yourself and bad input move nothing", async () => {
  const before = [await balance(ann), await balance(bob)];
  const cases = [
    [["bob", "1000"], /Insufficient funds: you have §87\.50/],
    [["bob", "-5"], /isn't an amount of money/],
    [["bob", "0"], /Type an amount/],
    [["bob", ""], /Type an amount/],
    [["bob", "abc"], /isn't an amount/],
    [["bob", "1.234"], /isn't an amount/],
    [["bob", "1."], /isn't an amount/],
    [["bob", "1e3"], /isn't an amount/],
    [["bob", "99999999"], /isn't an amount|most you can move/],
    [["bob", "20000"], /most you can move at once is §10,000\.00/],
    [["ann", "5"], /can't send money to yourself/],
    [["nobody", "5"], /no SimPal member called "nobody"/],
    [["../x", "5"], /no SimPal member/],
  ];
  for (const [[to, amount], why] of cases) {
    const r = ok(await send(ann, to, amount));
    assert.match(r.url, /send\.asp/, to + " " + amount);
    assert.match(said(r), why, to + " " + JSON.stringify(amount) + ": " + said(r));
  }
  assert.deepEqual([await balance(ann), await balance(bob)], before);
  assert.equal(ledgerTotal(m), 30000);
});

await test("every change needs the form token (CSRF)", async () => {
  // another site's page, with ann's cookie but no token
  const evil = rawBrowser(m);
  ok(await evil.post("/login.asp", { u: "ann", pw: "secret" }));
  const before = await balance(ann);
  let r = ok(await evil.post("/send.asp", { to: "bob", amount: "50", note: "gotcha" }));
  assert.match(r.body, /did not come from a SimPal page, so no money moved/);
  r = ok(await evil.post("/send.asp", { to: "bob", amount: "50", t: "0123456789ABCDEF" }));
  assert.match(r.body, /did not come from a SimPal page/);
  ok(await evil.post("/request.asp", { from: "bob", amount: "50" }));
  ok(await evil.post("/pay.asp", { to: "bob", amount: "50", order: "X1", do: "pay" }));
  assert.equal(await balance(ann), before);
  assert.doesNotMatch(m.read("C:\\PALDATA\\LEDGER\\0.TXT"), /gotcha/);
  assert.ok(!m.exists("C:\\PALDATA\\REQUESTS.TXT"), "no request was made");
  // nor can it log her out
  ok(await evil.get("/logout.asp"));
  assert.match(ok(await evil.get("/home.asp")).body, /My Balance/);
});

await test("request money: the payer sees it and pays it", async () => {
  let r = ok(await bob.post("/request.asp", { from: "ann", amount: "5", note: "Movie tickets" }));
  assert.match(said(r), /Your request is on its way to ann/);
  r = ok(await bob.get("/home.asp"));
  assert.match(r.body, /You asked <b>Ann Archer<\/b> \(ann\) for <b>&sect;5\.00<\/b> for &quot;Movie tickets&quot;/);
  const home = ok(await ann.get("/home.asp")).body;
  assert.match(home, /Money Requests for You/);
  assert.match(home, /<b>Bob Baker<\/b> \(bob\) asks you for <b>&sect;5\.00<\/b> for &quot;Movie tickets&quot;/);
  const id = /name="id" value="(\d+)"><input type="hidden" name="do" value="pay">/.exec(home)[1];
  // only ann can pay it
  r = ok(await cat.post("/request.asp", { do: "pay", id }));
  assert.match(said(r), /isn't for you/);
  const [a, b] = [await balance(ann), await balance(bob)];
  r = ok(await ann.post("/request.asp", { do: "pay", id }));
  assert.match(said(r), /Paid!/);
  assert.equal(await balance(ann), a - 500);
  assert.equal(await balance(bob), b + 500);
  assert.match(m.read("C:\\PALDATA\\REQUESTS.TXT"), new RegExp("^" + id + "\\|[^|]+\\|bob\\|ann\\|500\\|Movie tickets\\|paid$", "m"));
  assert.match(ok(await bob.get("/history.asp")).body, /<b>Ann Archer<\/b> paid your request/);
  // paying twice does nothing
  r = ok(await ann.post("/request.asp", { do: "pay", id }));
  assert.match(said(r), /already been paid/);
  assert.equal(await balance(ann), a - 500);
  assert.doesNotMatch(ok(await ann.get("/home.asp")).body, /Money Requests for You/);
});

await test("request money: declined, cancelled, refused, and not paid without the money", async () => {
  ok(await cat.post("/request.asp", { from: "ann", amount: "7", note: "Rent" }));
  let home = ok(await ann.get("/home.asp")).body;
  const id = /name="id" value="(\d+)"><input type="hidden" name="do" value="decline">/.exec(home)[1];
  const a = await balance(ann);
  let r = ok(await ann.post("/request.asp", { do: "decline", id }));
  assert.match(said(r), /Request declined\. No money moved/);
  assert.equal(await balance(ann), a);
  assert.match(m.read("C:\\PALDATA\\REQUESTS.TXT"), new RegExp("^" + id + "\\|.*\\|declined$", "m"));
  assert.match(said(ok(await ann.post("/request.asp", { do: "pay", id }))), /already been declined/);
  assert.equal(await balance(ann), a);
  assert.doesNotMatch(ok(await cat.get("/home.asp")).body, /Your Requests Waiting/);
  // cancelled by the one who asked
  ok(await cat.post("/request.asp", { from: "bob", amount: "1" }));
  const cid = /name="id" value="(\d+)"><input type="hidden" name="do" value="cancel">/.exec(ok(await cat.get("/home.asp")).body)[1];
  assert.match(said(ok(await cat.post("/request.asp", { do: "cancel", id: cid }))), /Request cancelled/);
  // bad ones
  assert.match(said(ok(await ann.post("/request.asp", { from: "ann", amount: "5" }))), /can't ask yourself/);
  assert.match(said(ok(await ann.post("/request.asp", { from: "bob", amount: "-1" }))), /isn't an amount/);
  assert.match(said(ok(await ann.post("/request.asp", { from: "zed", amount: "1" }))), /no SimPal member/);
  // a request bigger than the balance stays open
  ok(await bob.post("/request.asp", { from: "cat", amount: "5000" }));
  home = ok(await cat.get("/home.asp")).body;
  const big = /name="id" value="(\d+)"><input type="hidden" name="do" value="pay">/.exec(home)[1];
  assert.match(said(ok(await cat.post("/request.asp", { do: "pay", id: big }))), /Insufficient funds/);
  assert.match(m.read("C:\\PALDATA\\REQUESTS.TXT"), new RegExp("^" + big + "\\|.*\\|open$", "m"));
  ok(await cat.post("/request.asp", { do: "decline", id: big }));
  assert.equal(ledgerTotal(m), 30000);
});

await test("a page that dies mid-transfer can't make or lose money", async () => {
  const [a, b] = [await balance(ann), await balance(bob)];
  // as if a page died just after writing the ledger line: nothing applied yet
  const id = Number(m.read("C:\\PALDATA\\NEXTID.TXT")) + 1;
  m.write("C:\\PALDATA\\NEXTID.TXT", String(id));
  m.write("C:\\PALDATA\\LEDGER\\0.TXT", m.read("C:\\PALDATA\\LEDGER\\0.TXT") + `${id}|1999-12-31 23:59|send|ann|bob|100|crash||\n`);
  assert.equal(await balance(ann), a - 100, "reads add in the unapplied ledger line");
  assert.equal(await balance(bob), b + 100);
  // ...or one that died after ann's side but before bob's
  const id2 = id + 1;
  m.write("C:\\PALDATA\\NEXTID.TXT", String(id2));
  m.write("C:\\PALDATA\\LEDGER\\0.TXT", m.read("C:\\PALDATA\\LEDGER\\0.TXT") + `${id2}|1999-12-31 23:59|send|ann|bob|200|crash2||\n`);
  m.write("C:\\PALDATA\\BAL\\ANN.TXT", `${a - 300}|${id2}`);
  assert.equal(await balance(ann), a - 300);
  assert.equal(await balance(bob), b + 300);
  // and a third that took a number and died before writing anything
  m.write("C:\\PALDATA\\NEXTID.TXT", String(id2 + 1));
  assert.equal(await balance(ann), a - 300);
  // the next page to move money finishes the job, and counts nothing twice
  ok(await send(cat, "bob", "1"));
  assert.equal(m.read("C:\\PALDATA\\APPLIED.TXT"), String(id2 + 2));
  assert.equal(m.read("C:\\PALDATA\\BAL\\ANN.TXT"), `${a - 300}|${id2}`);
  assert.equal(m.read("C:\\PALDATA\\BAL\\BOB.TXT"), `${b + 400}|${id2 + 2}`);
  assert.equal(await balance(ann), a - 300);
  assert.match(ok(await bob.get("/history.asp")).body, /&quot;crash2&quot;/);
  assert.equal(ledgerTotal(m), 30000);
});

await test("a lock left by a dead page is cleared; a live one makes others wait, then give up", async () => {
  const a = await balance(ann);
  m.mkdir("C:\\PALDATA\\LOCK");
  m.write("C:\\PALDATA\\LOCK\\AT.TXT", String(Math.floor(Date.now() / 1000) - 60));
  ok(await send(ann, "bob", "1"));
  assert.equal(await balance(ann), a - 100);
  assert.ok(!m.exists("C:\\PALDATA\\LOCK"));
  m.mkdir("C:\\PALDATA\\LOCK");
  m.write("C:\\PALDATA\\LOCK\\AT.TXT", String(Math.floor(Date.now() / 1000) + 600));
  const r = ok(await send(ann, "bob", "1"));
  assert.match(said(r), /very busy/);
  assert.equal(await balance(ann), a - 100);
  m.remove("C:\\PALDATA\\LOCK\\AT.TXT");
  m.remove("C:\\PALDATA\\LOCK");
});

await test("two pages racing to spend the same money: one wins", async () => {
  // pages really do interleave here, as under HTTPD: without a lock, five
  // pages adding one to a counter at once lose updates
  m.write("C:\\WEB\\RACE.ASP", "<%\nVAR n AS Integer\nVAR i AS Integer\nVAR j AS Integer\nn = Int(Val(FS.Read(\"C:\\RACE.TXT\")))\nFOR i = 1 TO 5000\nj = j + 1\nNEXT\nFS.Write(\"C:\\RACE.TXT\", Str(n + 1))\n%>");
  m.write("C:\\RACE.TXT", "0");
  await Promise.all(Array.from({ length: 5 }, () => m.request("GET", "/race.asp")));
  assert.ok(Number(m.read("C:\\RACE.TXT")) < 5, "pages ran one after another, so this test proves nothing");
  m.remove("C:\\WEB\\RACE.ASP");
  m.remove("C:\\RACE.TXT");
  const dee = await join(m, "dee");
  const eve = await join(m, "eve");
  // dee has 100.00; two 60.00 payments at once can't both go through
  const t = await dee.token();
  const go = (to) => m.request("POST", "/send.asp", { body: form({ to, amount: "60", t }), cookies: dee.cookies() });
  const rs = await Promise.all([go("eve"), go("ann"), go("bob")]);
  const sent = rs.filter((r) => r.status.startsWith("302") && r.headers.some((h) => /Sent/.test(decodeURIComponent(h)))).length;
  assert.equal(sent, 1, rs.map((r) => r.status + " " + r.headers.join(" ")).join("\n"));
  assert.equal(await balance(dee), 4000);
  // and a crowd of transfers back and forth at once loses nothing
  const te = await eve.token();
  const td = await dee.token();
  await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2
    ? m.request("POST", "/send.asp", { body: form({ to: "dee", amount: "3.33", t: te }), cookies: eve.cookies() })
    : m.request("POST", "/send.asp", { body: form({ to: "eve", amount: "2.22", t: td }), cookies: dee.cookies() }))));
  assert.equal(await balance(dee) + await balance(eve), 4000 + 16000);
  assert.ok(await balance(dee) >= 0 && await balance(eve) >= 0);
  assert.equal(ledgerTotal(m), 50000);
});

const people = { ann, bob, cat };
await test("the money supply is conserved across many random transfers", async () => {
  const names = Object.keys(people);
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let i = 0; i < 40; i++) {
    const from = names[rnd(3)], to = names[rnd(3)];
    const amount = ["0.01", "1", "7.77", "33", "250", "-3", "x", "12.5"][rnd(8)];
    await send(people[from], to, amount, "random " + i);
  }
  let total = 0;
  for (const n of ["ann", "bob", "cat", "dee", "eve"]) {
    const b = await balance(n in people ? people[n] : await login(m, n));
    assert.ok(b >= 0, n + " went negative");
    total += b;
  }
  assert.equal(total, 50000, "five welcome bonuses, no more, no less");
  const admin = ok(await rawBrowser(m).post("/admin.asp", OWNER)).body;
  assert.match(admin, /Money supply \(all balances\)<\/font><\/td><td align="right"><font size="2"><b>&sect;500\.00<\/b>/);
  assert.match(admin, /bonuses \+ grants\)<\/font><\/td><td align="right"><font size="2"><b>&sect;500\.00<\/b>/);
  assert.match(admin, /<font color="#008000">BALANCE<\/font>/);
  assert.doesNotMatch(admin, /DIFFERENT/);
});

await test("admin: the owner sees every account and grants SimBucks; a wrong password gets nothing", async () => {
  let r = ok(await rawBrowser(m).get("/admin.asp"));
  assert.match(r.body, /Open the vault/);
  assert.doesNotMatch(r.body, /Money supply/);
  const c = await balance(cat);
  r = ok(await rawBrowser(m).post("/admin.asp", { do: "grant", u: "cat", amount: "1000", owner: "dab", opw: "nope" }));
  assert.match(r.body, /not this machine's owner/);
  assert.doesNotMatch(r.body, /Money supply/);
  r = ok(await rawBrowser(m).post("/admin.asp", { do: "grant", u: "cat", amount: "1000", owner: "cat", opw: "secret" }));
  assert.match(r.body, /not this machine's owner/);
  assert.equal(await balance(cat), c);
  r = ok(await rawBrowser(m).post("/admin.asp", { do: "grant", u: "cat", amount: "-5", ...OWNER }));
  assert.match(r.body, /isn't an amount/);
  r = ok(await rawBrowser(m).post("/admin.asp", { do: "grant", u: "zed", amount: "5", ...OWNER }));
  assert.match(r.body, /no SimPal member/);
  r = ok(await rawBrowser(m).post("/admin.asp", { do: "grant", u: "cat", amount: "50", note: "Prize", owner: "DAB", opw: "hostpw" }));
  assert.match(r.body, /Granted §50\.00 to cat/);
  assert.equal(await balance(cat), c + 5000);
  assert.match(r.body, /<b>cat<\/b><\/font><\/td><td><font size="2">Cat Cole<\/font>/);
  assert.match(r.body, /welcome bonuses<\/font><\/td><td align="right"><font size="2">&sect;500\.00/);
  assert.match(r.body, /grants<\/font><\/td><td align="right"><font size="2">&sect;50\.00/);
  assert.match(r.body, /Money supply \(all balances\)<\/font><\/td><td align="right"><font size="2"><b>&sect;550\.00<\/b>/);
  assert.match(r.body, /BALANCE/);
  assert.match(ok(await cat.get("/history.asp")).body, /Grant from the SimPal bank.*&quot;Prize&quot;/s);
  assert.equal(ledgerTotal(m), 55000);
});

let shopReceipt;
await test("Pay with SimPal at SimMart: log in, confirm, come back, verified once (PALCHECK.SPK)", async () => {
  let r = ok(await rawBrowser(m).get("/simmart.asp"));
  assert.match(r.body, /SimMart is closed/);
  const mart = await join(m, "simmart", "SimMart Inc.");
  r = ok(await rawBrowser(m).get("/simmart.asp"));
  assert.match(r.body, /<form action="http:\/\/palhost\/pay\.asp" method="post">/);
  const fields = Object.fromEntries([...r.body.matchAll(/<input type="hidden" name="(\w+)" value="([^"]*)">/g)].map((x) => [x[1], decode(x[2])]));
  assert.deepEqual(Object.keys(fields), ["to", "amount", "item", "order", "return"]);
  assert.equal(fields.return, "http://palhost/simmart.asp");
  // a buyer who isn't signed in is asked to, and comes back to the checkout
  const buyer = browser(m);
  r = ok(await buyer.post("/pay.asp", fields));
  assert.match(r.body, /Secure transaction/);
  assert.match(r.body, /Log in to SimPal to pay/);
  assert.match(r.body, /Genuine Y2K Bug \(in a jar\)/);
  const next = decode(/name="next" value="([^"]+)"/.exec(r.body)[1]);
  r = ok(await buyer.post("/login.asp", { u: "ann", pw: "wrong", next }));
  assert.match(r.body, /do not match/);
  r = ok(await buyer.post("/login.asp", { u: "ann", pw: "secret", next }));
  assert.match(r.url, /^\/pay\.asp\?to=simmart&amount=4\.99/);
  assert.match(r.body, /You are logged in as <b>Ann Archer<\/b>/);
  assert.match(r.body, /<input type="submit" value="Pay &sect;4\.99 Now">/);
  const a = await balance(ann), s = await balance(mart);
  const { to } = await confirmPay(m, buyer, fields);
  const back = new RegExp("^http://palhost/simmart\\.asp\\?receipt=(R\\d+-[0-9A-F]+)&order=" + fields.order + "$").exec(to);
  assert.ok(back, "redirected back to the shop: " + to);
  shopReceipt = back[1];
  assert.equal(await balance(ann), a - 499);
  assert.equal(await balance(mart), s + 499);
  assert.match(ok(await ann.get("/history.asp")).body, new RegExp("Purchase at <b>SimMart Inc\\.</b> \\(simmart\\).*order " + fields.order + " &middot; receipt " + shopReceipt, "s"));
  assert.match(ok(await mart.get("/history.asp")).body, /Sale to <b>Ann Archer<\/b>/);
  // the shop checks the receipt: good once, then used
  const path = to.slice("http://palhost".length);
  r = ok(await rawBrowser(m).get(path));
  assert.match(r.body, new RegExp("Thank you, ann! Order " + fields.order + " is paid"));
  r = ok(await rawBrowser(m).get(path));
  assert.match(r.body, /That receipt has already been used for order/);
  // made-up receipts, and a real one for somebody else's order, are no good
  r = ok(await rawBrowser(m).get("/simmart.asp?receipt=" + shopReceipt.replace(/-.*/, "-12345678") + "&order=" + fields.order));
  assert.match(r.body, /no good \(unknown\)/);
  r = ok(await rawBrowser(m).get("/simmart.asp?receipt=R1-0&order=X"));
  assert.match(r.body, /no good \(unknown\)/);
  // cancelling on the way
  assert.match(ok(await rawBrowser(m).get("/simmart.asp?cancelled=1&order=X")).body, /Maybe next millennium/);
});

await test("each order is paid once: pressing Pay again gives the same receipt, another buyer is refused", async () => {
  const fields = { to: "simmart", amount: "4.99", item: "Bug", order: "ONCE1", return: "http://palhost/simmart.asp" };
  const a = await balance(ann);
  const first = (await confirmPay(m, ann, fields)).to;
  const again = (await confirmPay(m, ann, fields)).to;
  assert.equal(again, first);
  assert.equal(await balance(ann), a - 499);
  const { r, to } = await confirmPay(m, bob, fields);
  assert.equal(to, null);
  assert.match(said(r), /Order ONCE1 at simmart has already been paid for/);
  // and the merchant can't buy from itself
  const mart = await login(m, "simmart");
  assert.match(said((await confirmPay(m, mart, fields)).r), /can't buy from yourself/);
});

await test("a shop on another machine: redirect with the receipt, then verify.asp", async () => {
  const fields = { to: "simmart", amount: "19.95", item: "Mouse mat", order: "WEB-42", return: "http://shop/thanks.asp?lang=en" };
  // the shop's link (GET) works as well as its form
  let r = ok(await ann.get("/pay.asp?" + form(fields)));
  assert.match(r.body, /Pay &sect;19\.95 Now/);
  assert.match(r.body, /<a href="http:\/\/shop\/thanks\.asp\?lang=en&amp;cancelled=1&amp;order=WEB-42">Cancel/);
  const { to } = await confirmPay(m, ann, fields);
  const receipt = /^http:\/\/shop\/thanks\.asp\?lang=en&receipt=(R\d+-[0-9A-F]+)&order=WEB-42$/.exec(to)[1];
  const verify = async (q) => {
    const x = ok(await rawBrowser(m).get("/verify.asp?" + q));
    assert.ok(x.headers.includes("Content-Type: text/plain"), x.headers.join(" "));
    return x.body.trim();
  };
  // a wrong amount, merchant or order doesn't use it up
  assert.equal(await verify(`r=${receipt}&m=simmart&a=0.01&o=WEB-42`), "INVALID|wrong amount");
  assert.equal(await verify(`r=${receipt}&m=bob&a=19.95&o=WEB-42`), "INVALID|wrong merchant");
  assert.equal(await verify(`r=${receipt}&m=simmart&a=19.95&o=WEB-43`), "INVALID|wrong order");
  assert.equal(await verify(`r=${receipt.replace(/-.*/, "-ABCDEF12")}`), "INVALID|no such receipt");
  assert.equal(await verify("r=hello"), "INVALID|no such receipt");
  const date = new Date();
  assert.match(await verify(`r=${receipt}&m=simmart&a=19.95&o=WEB-42`), new RegExp(`^VALID\\|simmart\\|19\\.95\\|WEB-42\\|ann\\|${date.getFullYear()}-\\d\\d-\\d\\d \\d\\d:\\d\\d$`));
  assert.match(await verify(`r=${receipt}`), /^USED\|simmart\|19\.95\|WEB-42\|ann\|/);
  // a SimMart receipt already used through PALCHECK is used here too
  assert.match(await verify(`r=${shopReceipt}`), /^USED\|simmart\|4\.99\|/);
});

await test("a shop page on this machine with VerifyReceipt (the example from merchant.asp)", async () => {
  const guide = ok(await ann.get("/merchant.asp")).body;
  const example = decode(/<textarea rows="12" cols="76" readonly>(&lt;%@[^<]*)<\/textarea>/.exec(guide)[1]);
  assert.match(example, /VerifyReceipt\(receipt, "ann", "4\.99", order\)/);
  m.write("C:\\WEB\\THANKS.ASP", example.replace('"ann"', '"simmart"'));
  // a buyer who changed the price in the button: paid, but it doesn't verify
  const cheap = await confirmPay(m, bob, { to: "simmart", amount: "0.01", item: "Bug", order: "CHEAP", return: "http://palhost/thanks.asp" });
  let r = ok(await rawBrowser(m).get(cheap.to.slice(14)));
  assert.match(r.body, /no good \(amount\)/);
  const good = await confirmPay(m, bob, { to: "simmart", amount: "4.99", item: "Bug", order: "FAIR", return: "http://palhost/thanks.asp" });
  r = ok(await rawBrowser(m).get(good.to.slice(14)));
  assert.match(r.body, /Order FAIR is paid/);
  r = ok(await rawBrowser(m).get(good.to.slice(14)));
  assert.match(r.body, /That receipt has been used already/);
  m.remove("C:\\WEB\\THANKS.ASP");
});

await test("checkout refuses broken buttons and empty pockets", async () => {
  const base = { to: "simmart", amount: "4.99", item: "Bug", order: "B1", return: "http://shop/x.asp" };
  const bad = [
    [{ to: "nobody" }, /doesn't exist/],
    [{ amount: "-4.99" }, /bad price/],
    [{ amount: "lots" }, /bad price/],
    [{ order: "" }, /no order number/],
    [{ order: "a|b" }, /no order number/],
    [{ return: "javascript:alert(1)" }, /return address/],
    [{ return: 'http://shop/"><script>' }, /return address/],
  ];
  for (const [change, why] of bad) {
    const r = ok(await ann.get("/pay.asp?" + form({ ...base, ...change })));
    assert.match(said(r), why, JSON.stringify(change));
    assert.doesNotMatch(r.body, /Pay &sect;/);
  }
  const c = await balance(cat);
  const big = await confirmPay(m, cat, { ...base, amount: "9999", order: "BIG" });
  assert.equal(big.to, null);
  assert.match(said(big.r), /Insufficient funds: this costs §9,999\.00/);
  assert.equal(await balance(cat), c);
  // no return address: SimPal shows the receipt itself
  const r = await confirmPay(m, cat, { ...base, return: "", order: "NORET" });
  assert.match(r.r.body, /Payment complete/);
  assert.match(r.r.body, /Your receipt number is <b><tt>R\d+-[0-9A-F]+<\/tt><\/b>/);
});

await test("SimPal for your web site: the button snippet, ready to paste", async () => {
  let r = ok(await rawBrowser(m).get("/merchant.asp"));
  assert.match(r.body, /SimPal for your web site/);
  const snippet = decode(/<textarea rows="9" cols="76" readonly>([^<]*)<\/textarea>/.exec(r.body)[1]);
  assert.match(snippet, /^<form action="http:\/\/palhost\/pay\.asp" method="post">/);
  assert.match(snippet, /name="to" value="yourname"/);
  assert.match(r.body, /how much to trust SimPal/);
  assert.match(r.body, /It's play money/);
  r = ok(await bob.get("/merchant.asp"));
  assert.match(r.body, /name=&quot;to&quot; value=&quot;bob&quot;/);
  assert.match(r.body, /CONST PALHOST = &quot;palhost&quot;/);
  assert.match(r.body, /CONST PALPATH = &quot;\/verify\.asp&quot;/);
});

await test("pages stay under 64K, even full of the worst text allowed", async () => {
  // members with the longest names that grow most (< becomes &lt;)
  const worst = "<".repeat(40);
  for (let i = 0; i < 200; i++) {
    const u = "w" + String(i).padStart(3, "0");
    m.write(`C:\\PALDATA\\USERS\\${u.toUpperCase()}.TXT`, `name=${worst}\nsalt=1\npass=x\njoined=1999-01-01`);
    m.write("C:\\PALDATA\\PEOPLE.TXT", m.read("C:\\PALDATA\\PEOPLE.TXT") + `${u}|${worst}\n`);
  }
  const big = await join(m, "big", worst);
  const other = await join(m, "other", worst);
  const note = "<".repeat(200);
  for (let i = 0; i < 45; i++) await send(i % 2 ? big : other, i % 2 ? "other" : "big", "0.01", note);
  for (let i = 0; i < 20; i++) {
    await big.post("/request.asp", { from: "other", amount: "1", note });
    await other.post("/request.asp", { from: "big", amount: "1", note });
  }
  await confirmPay(m, big, { to: "other", amount: "0.01", item: worst + worst, order: "X".repeat(40), return: "http://x/" + "%3C".repeat(60) });
  let most = 0, which = "";
  const look = async (b, method, url, f) => {
    const r = method === "GET" ? await m.request("GET", url, { cookies: b.cookies() }) : await m.request("POST", url, { body: form(f), cookies: b.cookies() });
    assert.ok(!r.body.includes("ActiveSparkPages error"), url + ": " + r.body.slice(0, 300));
    assert.ok(r.raw.length < MESSAGE_LIMIT, url);
    if (r.raw.length > most) { most = r.raw.length; which = url; }
  };
  for (const url of ["/home.asp", "/history.asp", "/send.asp", "/request.asp", "/merchant.asp", "/simmart.asp", "/index.asp", "/pay.asp?" + form({ to: "other", amount: "1", item: worst, order: "Y", return: "http://x/" })]) {
    await look(big, "GET", url);
  }
  await look(rawBrowser(m), "POST", "/admin.asp", OWNER);
  console.log(`      biggest page: ${which}, ${most} characters`);
});

// ---------------------------------------------------------------- SimHost

const net = new Network();
const wait = (fn, what, ms = 20000) => net.until(fn, ms, what);
const proc = (mm, name) => mm.kernel.ps().find((p) => p.name === name)?.pid;

await test("on a SimHost machine SimPal lives in /pal/, and a program elsewhere checks receipts over the network", async () => {
  const host = await net.boot("BANK");
  await host.runScript(installer("simhost"));
  const said = (await host.runScript(installer("simpal"))).join("\n");
  assert.match(said, /Open http:\/\/bank\/pal\/ in Voyager/);
  assert.ok(host.exists("C:\\WEB\\PAL\\PAL.SPK") && !host.exists("C:\\WEB\\PAL.SPK"));
  assert.match(host.read("C:\\WEB\\INDEX.ASP"), /SimHost's front door/, "the home page is still SimHost's");
  const home = ok(await rawBrowser(host).get("/")).body;
  assert.match(home, /<a href="\/pal\/">.*SimPal/);
  const zoe = await join(host, "zoe", "Zoe", "/pal/");
  await join(host, "simmart", "SimMart", "/pal/");
  assert.equal(await balance(zoe), 10000);
  assert.match(ok(await zoe.get("/pal/merchant.asp")).body, /action=&quot;http:\/\/bank\/pal\/pay\.asp&quot;/);
  // SimMart in the folder sends buyers to /pal/pay.asp and back to /pal/simmart.asp
  const shop = ok(await rawBrowser(host).get("/pal/simmart.asp")).body;
  assert.match(shop, /<form action="http:\/\/bank\/pal\/pay\.asp"/);
  const fields = Object.fromEntries([...shop.matchAll(/<input type="hidden" name="(\w+)" value="([^"]*)">/g)].map((x) => [x[1], decode(x[2])]));
  assert.equal(fields.return, "http://bank/pal/simmart.asp");
  const { to } = await confirmPay(host, zoe, fields);
  assert.match(to, /^http:\/\/bank\/pal\/simmart\.asp\?receipt=R\d+-[0-9A-F]+&order=/);
  assert.match(ok(await rawBrowser(host).get(to.slice(11))).body, /Thank you, zoe!/);
  assert.equal(await balance(zoe), 10000 - 499);

  // a second purchase, checked from another machine with CHECKPAY.SPK
  const sale = await confirmPay(host, zoe, { to: "simmart", amount: "2.50", item: "Sticker", order: "FAR-1", return: "http://faraway/done.asp" });
  const receipt = /receipt=(R\d+-[0-9A-F]+)/.exec(sale.to)[1];
  if (!proc(host, "HTTPD")) host.run("C:\\PROGRAMS\\HTTPD.SPK");
  await wait(() => proc(host, "HTTPD"), "the web server");
  const raw = await host.fetch("BANK", "/pal/verify.asp?r=" + receipt + "&a=1.00");
  assert.match(raw, /Content-Type: text\/plain/);
  assert.match(raw, /INVALID\|wrong amount/);
  const program = decode(/<textarea rows="12" cols="76" readonly>(' CHECKPAY[^<]*)<\/textarea>/.exec(ok(await zoe.get("/pal/merchant.asp")).body)[1]);
  assert.match(program, /CONST PALPATH = "\/pal\/verify\.asp"/);
  const far = await net.boot("FARAWAY");
  far.write("C:\\MYFILES\\CHECKPAY.SPK", program);
  const run = async (args) => {
    const pid = far.run("C:\\MYFILES\\CHECKPAY.SPK", args);
    await wait(() => !far.running(pid), "CHECKPAY.SPK", 20000);
    assert.deepEqual(far.ui.dialogs, [], far.output(pid));
    return far.output(pid);
  };
  let out = await run([receipt, "simmart", "2.50", "FAR-1"]);
  assert.match(out, /^VALID\|simmart\|2\.50\|FAR-1\|zoe\|/m);
  assert.match(out, /Paid: zoe paid simmart 2\.50 for order FAR-1\./);
  out = await run([receipt]);
  assert.match(out, /^USED\|simmart\|2\.50\|FAR-1\|zoe\|/m);
  assert.match(out, /Not paid/);
  out = await run(["R1-00000000"]);
  assert.match(out, /^INVALID\|no such receipt/m);
});

await test("SimPal installed as the home page moves into /pal/ when SimHost comes, money and all", async () => {
  const old = await net.boot("OLDPAL");
  await old.runScript(installer("simpal"));
  const yan = await join(old, "yan");
  await join(old, "zed");
  ok(await send(yan, "zed", "25"));
  const said = (await old.runScript(installer("simhost"))).join("\n");
  assert.match(said, /moved SimPal \(17 files\) into C:\\WEB\\PAL: http:\/\/oldpal\/pal\//);
  assert.doesNotMatch(said, /SimPal is missing/);
  assert.ok(!old.exists("C:\\WEB\\PAL.SPK") && old.exists("C:\\WEB\\PAL\\PAL.SPK"));
  assert.ok(old.exists("C:\\PROGRAMS\\PALCHECK.SPK"), "the helper stays where shops import it from");
  const again = await login(old, "yan", "/pal/");
  assert.equal(await balance(again), 7500);
  assert.match(ok(await rawBrowser(old).get("/")).body, /<a href="\/pal\/">/);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
