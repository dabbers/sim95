// End-to-end tests for SimBook (simbook/WEB), run on the real SIM95
// interpreter by sim.mjs.   node tools/aspsim/simbook.test.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { machine, browser } from "./sim.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + (e.stack || e).toString().split("\n").slice(0, 4).join("\n      ")); }
}
const ok = (r) => {
  assert.equal(r.status, "200 OK", r.url + " -> " + r.status + "\n" + r.body.slice(-400));
  assert.ok(!r.body.includes("ActiveSparkPages error"), r.url + ": " + r.body.slice(r.body.indexOf("ActiveSparkPages error") - 10, r.body.indexOf("ActiveSparkPages error") + 300));
  return r;
};

// Install the way a person would: by running INSTALL.SPK on the machine.
async function fresh() {
  const m = await machine("TESTBOX");
  await m.runScript(fs.readFileSync(path.join(root, "simbook/INSTALL.SPK"), "utf8"));
  return m;
}
async function join(m, u, name, pw = "secret") {
  const b = browser(m);
  ok(await b.post("/join.asp", { name, u, pw, pw2: pw }));
  return b;
}

const m = await fresh();

await test("INSTALL.SPK writes every file exactly", async () => {
  const dir = path.join(root, "simbook/WEB");
  for (const f of fs.readdirSync(dir)) assert.equal(m.read("C:\\WEB\\" + f.toUpperCase()), fs.readFileSync(dir + "/" + f, "utf8"), f);
});

await test("the stock home page is kept as WELCOME.HTM, and the samples still work", async () => {
  assert.ok(!m.exists("C:\\WEB\\INDEX.HTM"));
  assert.match(m.read("C:\\WEB\\WELCOME.HTM"), /<html/i);
  ok(await browser(m).get("/hello.asp"));
});

await test("running the installer again keeps a home page someone put back", async () => {
  const m2 = await fresh();
  m2.write("C:\\WEB\\INDEX.HTM", "mine");
  await m2.runScript(fs.readFileSync(path.join(root, "simbook/INSTALL.SPK"), "utf8"));
  assert.ok(!m2.exists("C:\\WEB\\INDEX.HTM"));
  assert.match(m2.read("C:\\WEB\\WELCOME.HTM"), /<html/i);
  assert.equal(m2.read("C:\\WEB\\INDEX1.HTM"), "mine");
});
const ann = browser(m), bob = browser(m), eve = browser(m);

await test("front door shows login and register", async () => {
  const r = ok(await ann.get("/"));
  assert.match(r.body, /Welcome to SimBook/);
  assert.match(ok(await ann.get("/index.htm")).body, /Welcome to SimBook/);
  assert.match(r.body, /action="join.asp"/);
});

await test("members-only pages send strangers to the front door", async () => {
  for (const p of ["home.asp", "profile.asp?u=ann", "people.asp", "edit.asp"]) {
    const r = ok(await eve.get("/" + p));
    assert.equal(r.url, "/index.asp", p);
  }
});

await test("register signs you in and asks for a profile", async () => {
  const r = ok(await ann.post("/join.asp", { name: "Ann Example", u: "Ann", pw: "hunter2", pw2: "hunter2" }));
  assert.equal(r.url, "/edit.asp?new=1");
  assert.match(r.body, /Welcome to SimBook!/);
  assert.match(r.body, /value="Ann Example"/);
  assert.ok(m.exists("C:\\BOOKDATA\\USERS\\ANN.TXT"));
  assert.ok(!m.read("C:\\BOOKDATA\\USERS\\ANN.TXT").includes("hunter2"), "password stored in clear");
});

await test("register rejects bad names, taken names and mismatched passwords", async () => {
  let r = ok(await eve.post("/join.asp", { name: "X", u: "a/../b", pw: "pppp", pw2: "pppp" }));
  assert.match(r.body, /3 to 8 letters or digits/);
  r = ok(await eve.post("/join.asp", { name: "X", u: "ann", pw: "pppp", pw2: "pppp" }));
  assert.match(r.body, /already has the name ann/);
  r = ok(await eve.post("/join.asp", { name: "X", u: "evelyn", pw: "pppp", pw2: "qqqq" }));
  assert.match(r.body, /two passwords are different/);
  r = ok(await eve.post("/join.asp", { name: "X", u: "waytoolongname", pw: "pppp", pw2: "pppp" }));
  assert.match(r.body, /3 to 8 letters/);
});

await test("edit profile saves fields, escapes them, and keeps a picture", async () => {
  const pic = "SIM95PIC 2 2\n9C\nC9\n";
  const r = ok(await ann.post("/edit.asp", {
    name: "Ann <Example>", sex: "Female", birthday: "1980-02-04", hometown: "Cambridge | MA",
    status: "It's Complicated", interests: "line one\r\nline two", music: "", about: "100% real", pic,
  }));
  assert.equal(r.url, "/profile.asp?u=ann");
  assert.match(r.body, /Ann &lt;Example&gt;/);
  assert.match(r.body, /Cambridge \| MA/);
  assert.match(r.body, /line one<br>line two/);
  assert.match(r.body, /100% real/);
  assert.match(r.body, /<img src="pics\/ann.pic"/);
  assert.equal(m.read("C:\\WEB\\PICS\\ANN.PIC"), pic);
  const e = ok(await ann.get("/edit.asp"));
  assert.match(e.body, /<option selected>It's Complicated<\/option>/);
});

await test("edit rejects something that is not a picture", async () => {
  const r = ok(await ann.post("/edit.asp", { name: "Ann Example", pic: "<html>not a pic" }));
  assert.match(r.body, /not a picture/);
  assert.match(m.read("C:\\WEB\\PICS\\ANN.PIC"), /^SIM95PIC/);
});

await test("only friends can write on a Wall", async () => {
  await bob.post("/join.asp", { name: "Bob Builder", u: "bob", pw: "pw1234", pw2: "pw1234" });
  let r = ok(await bob.get("/profile.asp?u=ann"));
  assert.match(r.body, /Add to Friends/);
  assert.match(r.body, /Only Ann Example's friends/);
  r = ok(await bob.post("/post.asp", { to: "ann", text: "sneaky" }));
  assert.match(r.body, /Only friends can write/);
  assert.ok(!r.body.includes("sneaky"));
});

await test("adding a friend is mutual and lets you write on their Wall", async () => {
  let r = ok(await bob.post("/friend.asp", { u: "ann", do: "add" }));
  assert.match(r.body, /is your friend/);
  r = ok(await bob.post("/post.asp", { to: "ann", text: "Hi Ann! <script>alert(1)</script>" }));
  assert.equal(r.url, "/profile.asp?u=ann");
  assert.match(r.body, /Hi Ann! &lt;script&gt;/);
  r = ok(await ann.get("/profile.asp?u=bob"));
  assert.match(r.body, /Remove from Friends/);
  assert.match(r.body, /Friends \(1\)/);
});

await test("status updates and wall posts show up in the News Feed", async () => {
  ok(await ann.post("/post.asp", { to: "ann", text: "is building a\nsocial network", back: "home" }));
  const r = ok(await ann.get("/home.asp"));
  assert.match(r.body, /is building a<br>social network/);
  assert.match(r.body, /Bob Builder<\/b><\/a> &raquo; <a href="profile.asp\?u=ann"><b>Ann Example/);
  assert.ok(r.body.indexOf("social network") < r.body.indexOf("Hi Ann!"), "newest first");
  const rb = ok(await bob.get("/home.asp"));
  assert.match(rb.body, /social network/);
});

await test("strangers' posts stay out of your feed", async () => {
  const cat = await join(m, "cat", "Cat Stranger");
  ok(await cat.post("/post.asp", { to: "cat", text: "nobody knows me", back: "home" }));
  assert.ok(!ok(await ann.get("/home.asp")).body.includes("nobody knows me"));
  assert.match(ok(await cat.get("/home.asp")).body, /nobody knows me/);
});

await test("empty and oversized posts are refused", async () => {
  let r = ok(await ann.post("/post.asp", { to: "ann", text: "   ", back: "home" }));
  assert.match(r.body, /Write something first/);
  r = ok(await ann.post("/post.asp", { to: "ann", text: "x".repeat(1001), back: "home" }));
  assert.match(r.body, /under 1000 characters/);
});

await test("removing a friend is mutual", async () => {
  ok(await ann.post("/friend.asp", { u: "bob", do: "remove" }));
  assert.match(ok(await bob.get("/profile.asp?u=ann")).body, /Add to Friends/);
  assert.equal(m.read("C:\\BOOKDATA\\FRIENDS\\BOB.TXT"), "|");
  ok(await bob.post("/friend.asp", { u: "ann", do: "add" }));
});

await test("people directory lists and searches members", async () => {
  let r = ok(await ann.get("/people.asp"));
  for (const n of ["Ann Example", "Bob Builder", "Cat Stranger"]) assert.ok(r.body.includes(n), n);
  r = ok(await ann.get("/people.asp?q=build"));
  assert.ok(r.body.includes("Bob Builder") && !r.body.includes("Cat Stranger"));
  assert.match(r.body, /your friend/);
});

await test("logout forgets the session, login brings you back", async () => {
  let r = ok(await bob.get("/logout.asp"));
  assert.match(r.body, /You have logged out/);
  assert.equal(ok(await bob.get("/home.asp")).url, "/index.asp");
  r = ok(await bob.post("/login.asp", { u: "bob", pw: "wrong" }));
  assert.match(r.body, /do not match/);
  r = ok(await bob.post("/login.asp", { u: "BOB ", pw: "pw1234" }));
  assert.equal(r.url, "/home.asp");
});

await test("forged or malicious cookies are ignored", async () => {
  for (const c of ["simbook=ann", "simbook=..%5CUSERS%5CANN", "simbook=ZZZZ", "simbook=12345678901"]) {
    const r = await m.request("GET", "/home.asp", { cookies: c });
    assert.equal(r.status, "302 Found", c);
  }
});

await test("profile of nobody goes to the directory", async () => {
  assert.equal(ok(await ann.get("/profile.asp?u=..%5Cx")).url, "/people.asp");
  assert.equal(ok(await ann.get("/profile.asp?u=nobody")).url, "/people.asp");
});

await test("the data survives a restart: it is all on disk", async () => {
  const snap = m.disk.snapshot();
  const m2 = await machine("TESTBOX");
  m2.disk.restore(snap);
  const b = browser(m2);
  ok(await b.post("/login.asp", { u: "ann", pw: "hunter2" }));
  assert.match(b.last.body, /social network/);
});

// ---- the time limit, with a busy network. A page may yield 20,000 times and
// yields once every 512 statements; this finds how many yields a page needs.
async function stepsFor(m, url, cookies) {
  let lo = 0, hi = 20000;
  const fits = async (budget) => !(await m.request("GET", url, { cookies, budget })).body.includes("ran for too long");
  if (!(await fits(hi))) return Infinity;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (await fits(mid)) hi = mid; else lo = mid; }
  return hi;
}

await test("every page stays well inside the time limit on a busy network", async () => {
  const big = await fresh();
  const users = [];
  for (let i = 0; i < 60; i++) users.push("user" + i);
  const books = {};
  for (const u of users) books[u] = await join(big, u, "Person Number " + u.slice(4) + " With A Long Name");
  // user0 is friends with everyone; the rest with a few neighbours
  for (const u of users.slice(1)) ok(await books.user0.post("/friend.asp", { u, do: "add" }));
  // 3000 posts, all of them in user0's circle: the worst case for the feed and the wall.
  const lines = [];
  for (let i = 1; i <= 3000; i++) {
    const a = users[i % 60], w = users[(i * 7) % 60];
    lines.push(`${i}|1996-07-04 12:00|${a}|Person ${a}|${w}|Person ${w}|` + "Post number " + i + " with some text in it to make it a realistic length.".repeat(3));
  }
  big.write("C:\\BOOKDATA\\POSTS.TXT", lines.join("\n") + "\n");
  big.write("C:\\BOOKDATA\\WALLS\\USER0.TXT", lines.join("\n") + "\n");
  big.write("C:\\BOOKDATA\\NEXTID.TXT", "3000");
  const c = books.user0.cookies();
  const report = [];
  for (const url of ["/index.asp", "/home.asp", "/profile.asp?u=user0", "/people.asp", "/people.asp?q=zzz", "/edit.asp"]) {
    const s = await stepsFor(big, url, c);
    report.push(`${url} ${s}`);
    assert.ok(s < 1000, `${url} needs ${s} of 20000 yields`);
  }
  // a page for a lonely member has to scan the whole recent log
  const lonely = await join(big, "lonely", "Lonely");
  const s = await stepsFor(big, "/home.asp", lonely.cookies());
  report.push(`/home.asp (no friends) ${s}`);
  assert.ok(s < 1000, `lonely feed needs ${s} of 20000 yields`);
  console.log("      yields used (of 20000): " + report.join(", "));
});

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
