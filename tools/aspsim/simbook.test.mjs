// End-to-end tests for SimBook (simbook/WEB), run on the real SIM95
// interpreter by sim.mjs.   node tools/aspsim/simbook.test.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { machine, browser as rawBrowser, page, MESSAGE_LIMIT } from "./sim.mjs";

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
// A visitor using SimBook's own pages: their forms and action links carry the
// session's form token, so this browser adds it the way those pages would.
// rawBrowser is somebody else's page aiming a request at SimBook: no token.
function browser(m) {
  const b = rawBrowser(m);
  const { post, get } = b;
  b.token = async () => {
    const r = await m.request("GET", "/picture.asp", { cookies: b.cookies() });
    return (/name="t" value="([0-9A-F]+)"/.exec(r.body) || [])[1] ?? "";
  };
  b.post = async (url, form) => post(url, form && !("t" in form) ? { ...form, t: await b.token() } : form);
  b.get = async (url) => (/^\/(vote|logout|poke)\.asp/.test(url) && !/[?&]t=/.test(url) ? get(url + (url.includes("?") ? "&" : "?") + "t=" + (await b.token())) : get(url));
  return b;
}

async function fresh() {
  const m = await machine("TESTBOX");
  await m.runScript(fs.readFileSync(path.join(root, "simbook/INSTALL.SPK"), "utf8"));
  return m;
}
async function join(m, u, name, pw = "secret") {
  const b = browser(m);
  assert.equal(ok(await b.post("/join.asp", { name, u, pw, pw2: pw })).url, "/edit.asp?new=1", "could not register " + u);
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

await test("edit profile saves fields and escapes them", async () => {
  const r = ok(await ann.post("/edit.asp", {
    name: "Ann <Example>", sex: "Female", birthday: "1980-02-04", hometown: "Cambridge | MA",
    status: "It's Complicated", interests: "line one\r\nline two", music: "", about: "100% real",
  }));
  assert.equal(r.url, "/profile.asp?u=ann");
  assert.match(r.body, /Ann &lt;Example&gt;/);
  assert.match(r.body, /Cambridge \| MA/);
  assert.match(r.body, /line one<br>line two/);
  assert.match(r.body, /100% real/);
  assert.match(r.body, /<img src="av\d\d\.pic" alt="ann">/);
  ok(await ann.post("/edit.asp", { name: "Ann Example", status: "It's Complicated" }));
  const e = ok(await ann.get("/edit.asp"));
  assert.match(e.body, /<option selected>It&#39;s Complicated<\/option>|<option selected>It's Complicated<\/option>/);
});

await test("every member gets a stock picture at random, and can choose another; nothing is uploaded", async () => {
  // twenty stock pictures beside the pages, 80 by 80
  for (let i = 1; i <= 20; i++) {
    const f = "AV" + String(i).padStart(2, "0") + ".PIC";
    assert.match(m.read("C:\\WEB\\" + f), /^SIM95PIC 80 80\n([0-9A-F]{80}\n){80}$/, f);
  }
  assert.match((await m.request("GET", "/av07.pic")).body, /^SIM95PIC 80 80/, "the web server hands them out");
  // ann was given one when she joined
  const n0 = Number(/^avatar=(\d+)$/m.exec(m.read("C:\\BOOKDATA\\USERS\\ANN.TXT"))[1]);
  assert.ok(n0 >= 1 && n0 <= 20);
  const av = (n) => "av" + String(n).padStart(2, "0") + ".pic";
  assert.match(ok(await ann.get("/profile.asp?u=ann")).body, new RegExp(`<img src="${av(n0)}" alt="ann">`));
  // the choosing page: all twenty, hers ticked, by this machine's address (Voyager asks for them all at once)
  let r = ok(await ann.get("/picture.asp"));
  assert.equal([...r.body.matchAll(/<input type="radio" name="avatar" value="(\d+)"/g)].length, 20);
  assert.match(r.body, new RegExp(`value="${n0}" checked`));
  assert.match(r.body, /<img src="http:\/\/[\d.]+\/av01\.pic" width="80" height="80"/);
  assert.doesNotMatch(r.body, /type="file"|value="Upload/i);
  r = ok(await ann.post("/picture.asp", { avatar: "7" }));
  assert.equal(r.url, "/profile.asp?u=ann");
  assert.match(r.body, /<img src="av07\.pic" alt="ann">/);
  // nonsense changes nothing; an upload has nowhere to go
  ok(await ann.post("/picture.asp", { avatar: "99" }));
  ok(await ann.post("/picture.asp", { avatar: "7", pic: "SIM95PIC 2 2\n00\n00\n" }));
  assert.match(m.read("C:\\BOOKDATA\\USERS\\ANN.TXT"), /^avatar=7$/m);
  assert.ok(!m.exists("C:\\WEB\\PICS") && !m.exists("C:\\WEB\\PHOTOS"), "no picture folders at all");
  // a member from before there were stock pictures has one their name picks, always the same
  const rec = m.read("C:\\BOOKDATA\\USERS\\ANN.TXT");
  m.write("C:\\BOOKDATA\\USERS\\ANN.TXT", rec.replace(/^avatar=\d+\n/m, ""));
  const first = /<img src="(av\d\d\.pic)" alt="ann">/.exec(ok(await ann.get("/profile.asp?u=ann")).body)[1];
  assert.equal(/<img src="(av\d\d\.pic)" alt="ann">/.exec(ok(await ann.get("/home.asp")).body)[1], first);
  m.write("C:\\BOOKDATA\\USERS\\ANN.TXT", rec);
});

await test("new members get pictures at random", async () => {
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    await join(m, "rnd" + i, "Random " + i);
    seen.add(/^avatar=(\d+)$/m.exec(m.read(`C:\\BOOKDATA\\USERS\\RND${i}.TXT`))[1]);
  }
  assert.ok(seen.size >= 4, "12 members, " + seen.size + " different pictures");
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

// Every post on a machine, from the chunks of C:\BOOKDATA\LOG.
const logLines = (mm) => mm.list("C:\\BOOKDATA\\LOG").map((f) => mm.read("C:\\BOOKDATA\\LOG\\" + f.name)).join("").split("\n").filter(Boolean);
const postId = (text) => {
  const line = logLines(m).find((l) => l.endsWith("|" + text));
  assert.ok(line, "no post " + text);
  return line.split("|")[0];
};

await test("thumbs up and down count, switch, and take back", async () => {
  ok(await ann.post("/post.asp", { to: "ann", text: "thumb me", back: "home" }));
  const id = postId("thumb me");
  let r = ok(await ann.get(`/vote.asp?id=${id}&v=up&b=home`));
  assert.equal(r.url, "/home.asp");
  assert.match(r.body, /<b>thumbs up \(1\)<\/b>/);
  r = ok(await bob.get(`/vote.asp?id=${id}&v=up&b=ann`));
  assert.equal(r.url, "/profile.asp?u=ann");
  assert.match(r.body, /<b>thumbs up \(2\)<\/b>/);
  r = ok(await bob.get(`/vote.asp?id=${id}&v=down&b=view`));
  assert.equal(r.url, `/view.asp?id=${id}`);
  assert.match(r.body, />thumbs up \(1\)</);
  assert.match(r.body, /<b>thumbs down \(1\)<\/b>/);
  r = ok(await bob.get(`/vote.asp?id=${id}&v=down&b=view`));
  assert.match(r.body, />thumbs down \(0\)</);
  assert.equal(m.read(`C:\\BOOKDATA\\VOTES\\${id}.TXT`), "|ann+|");
});

await test("strangers can see thumbs but not give them", async () => {
  const id = postId("thumb me");
  const cat = browser(m);
  ok(await cat.post("/login.asp", { u: "cat", pw: "secret" }));
  const r = ok(await cat.get(`/vote.asp?id=${id}&v=down&b=view`));
  assert.match(r.body, /thumbs up \(1\) &middot; thumbs down \(0\)/);
  assert.ok(!r.body.includes("vote.asp"));
  assert.match(r.body, /Only friends can reply/);
});

await test("bad post numbers go home", async () => {
  for (const id of ["", "abc", "..%5C1", "999999", "123456789"]) {
    assert.equal(ok(await ann.get(`/vote.asp?id=${id}&v=up&b=view`)).url, "/home.asp", id);
    assert.equal(ok(await ann.get(`/view.asp?id=${id}`)).url, "/home.asp", id);
  }
});

await test("replies show under the post, newest two in the feed, all on the post", async () => {
  const id = postId("thumb me");
  for (const [who, text] of [[bob, "first <reply>"], [ann, "second\nreply"], [bob, "third reply"]]) {
    const r = ok(await who.post("/reply.asp", { id, text }));
    assert.equal(r.url, `/view.asp?id=${id}`);
  }
  let r = ok(await ann.get(`/view.asp?id=${id}`));
  assert.ok(r.body.indexOf("first &lt;reply&gt;") < r.body.indexOf("second<br>reply"), "oldest first");
  assert.ok(r.body.indexOf("second<br>reply") < r.body.indexOf("third reply"));
  r = ok(await ann.get("/home.asp"));
  const at = r.body.indexOf("thumb me");
  const post = r.body.slice(at, r.body.indexOf("</td></tr>\n", at) + 200);
  assert.ok(!r.body.includes("first &lt;reply&gt;"), "only the newest two in the feed");
  assert.match(r.body, /second<br>reply/);
  assert.match(r.body, /See all 3 replies/);
  assert.equal(m.read(`C:\\BOOKDATA\\REPLIES\\${id}.TXT`).trim().split("\n").length, 3);
});

await test("replies are refused from strangers, and when empty or too long", async () => {
  const id = postId("thumb me");
  const cat = browser(m);
  ok(await cat.post("/login.asp", { u: "cat", pw: "secret" }));
  let r = ok(await cat.post("/reply.asp", { id, text: "let me in" }));
  assert.match(r.body, /Only friends can reply to that/);
  r = ok(await ann.post("/reply.asp", { id, text: "  " }));
  assert.match(r.body, /Write something first/);
  r = ok(await ann.post("/reply.asp", { id, text: "y".repeat(501) }));
  assert.match(r.body, /under 500 characters/);
  assert.equal(m.read(`C:\\BOOKDATA\\REPLIES\\${id}.TXT`).trim().split("\n").length, 3);
});

await test("text boxes count down as you type and grey out the button when over", async () => {
  const e = await page(ok(await ann.get("/edit.asp")).body);
  assert.equal(e.el("go").Enabled, true);
  await e.type("about", "a".repeat(400));
  assert.equal(e.el("about_n").Text, "100 characters left");
  await e.type("music", "m".repeat(520));
  assert.equal(e.el("music_n").Text, "20 characters too many");
  assert.equal(e.el("go").Enabled, false);
  await e.type("music", "m".repeat(500));
  assert.equal(e.el("go").Enabled, true);
  for (const [url, most] of [["/home.asp", 1000], ["/profile.asp?u=ann", 1000], [`/view.asp?id=${postId("thumb me")}`, 500]]) {
    const p = await page(ok(await ann.get(url)).body);
    await p.type("text", "z".repeat(most + 1));
    assert.equal(p.el("go").Enabled, false, url);
    await p.type("text", "z".repeat(most));
    assert.equal(p.el("text_n").Text, "0 characters left", url);
    assert.equal(p.el("go").Enabled, true, url);
  }
});

await test("pages hand out the form token in forms and action links", async () => {
  const t = await ann.token();
  assert.match(t, /^[0-9A-F]{16}$/);
  const home = ok(await ann.get("/home.asp")).body;
  assert.ok(home.includes(`<input type="hidden" name="t" value="${t}">`));
  assert.ok(home.includes(`logout.asp?t=${t}`));
  assert.match(home, new RegExp(`vote.asp\\?id=\\d+&v=up&b=home&t=${t}`));
  const t2 = await bob.token();
  assert.notEqual(t, t2, "every session has its own token");
});

await test("requests from another site's page change nothing", async () => {
  // Bob's cookie goes along, as Voyager sends it with any request to this server
  const cookies = bob.cookies();
  const id = postId("thumb me");
  const before = m.disk.snapshot();
  const forged = [
    ["POST", "/post.asp", { to: "ann", text: "forged wall post" }],
    ["POST", "/reply.asp", { id, text: "forged reply" }],
    ["POST", "/friend.asp", { u: "ann", do: "remove" }],
    ["POST", "/edit.asp", { name: "Pwned" }],
    ["POST", "/picture.asp", { avatar: "3" }],
    ["GET", `/vote.asp?id=${id}&v=down&b=home`],
    ["GET", "/logout.asp"],
  ];
  for (const wrongToken of ["", "0123456789ABCDEF", await ann.token()]) {
    for (const [method, url, form] of forged) {
      const body = form ? new URLSearchParams({ ...form, t: wrongToken }).toString() : "";
      const sep = url.includes("?") ? "&" : "?";
      const r = await m.request(method, method === "GET" ? url + sep + "t=" + wrongToken : url, { body, cookies });
      assert.equal(r.status, "302 Found", `${url} with token "${wrongToken}"`);
      assert.ok(r.headers.includes("Location: home.asp?why=That+did+not+come+from+a+SimBook+page%2C+so+nothing+was+changed."), url + " " + r.headers.join(" | "));
    }
  }
  assert.deepEqual(m.disk.snapshot().files, before.files, "nothing on disk changed");
  const r = ok(await bob.get("/home.asp"));
  assert.equal(r.url, "/home.asp", "bob is still signed in");
});

await test("the same request with the token goes through", async () => {
  const r = ok(await bob.post("/post.asp", { to: "ann", text: "real wall post" }));
  assert.match(r.body, /real wall post/);
});

await test("sessions saved before form tokens get one", async () => {
  m.write("C:\\BOOKDATA\\SESSIONS\\ABCDEF12.TXT", "cat");
  const r = await m.request("GET", "/home.asp", { cookies: "simbook=ABCDEF12" });
  assert.equal(r.status, "200 OK");
  const lines = m.read("C:\\BOOKDATA\\SESSIONS\\ABCDEF12.TXT").split("\n");
  assert.equal(lines[0], "cat");
  assert.match(lines[1], /^[0-9A-F]{16}$/);
  assert.ok(r.body.includes(`value="${lines[1]}"`));
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


// ---- deleting, notifications, pokes and the chunked log, on a machine of their own
const n = await fresh();
const al = await join(n, "alice", "Alice A");
const bo = await join(n, "bobby", "Bobby B");
const ca = await join(n, "carol", "Carol C");
ok(await al.post("/friend.asp", { u: "bobby", do: "add" }));
ok(await al.post("/friend.asp", { u: "carol", do: "add" }));
const nLog = () => logLines(n);
const nId = (text) => nLog().find((l) => l.endsWith("|" + text)).split("|")[0];
const unread = async (b) => (/notifications \((\d+)\)/.exec(ok(await b.get("/home.asp")).body) || [0, "0"])[1];

await test("notifications: friends, Wall posts, replies and thumbs, never your own", async () => {
  assert.equal(await unread(bo), "1"); // alice added bobby
  ok(await bo.post("/post.asp", { to: "alice", text: "hi alice" }));
  const id = nId("hi alice");
  ok(await ca.post("/reply.asp", { id, text: "me too" }));          // bobby: reply, alice: wallreply
  ok(await al.get(`/vote.asp?id=${id}&v=up&b=home`));               // bobby: up
  ok(await al.get(`/vote.asp?id=${id}&v=up&b=home`));               // taking it back: nothing
  ok(await bo.post("/reply.asp", { id, text: "talking to myself" })); // alice: wallreply; bobby: none
  assert.equal(await unread(al), "3"); // bobby wrote, carol replied, bobby replied
  assert.equal(await unread(bo), "3"); // alice added, carol replied, alice thumbed
  const r = ok(await bo.get("/notify.asp"));
  assert.match(r.body, /Carol C<\/b><\/a> replied to <a href="view.asp\?id=\d+">your post<\/a>/);
  assert.match(r.body, /Alice A<\/b><\/a> gave <a href="view.asp\?id=\d+">your post<\/a> a thumbs up/);
  assert.match(r.body, /Alice A<\/b><\/a> added you as a friend/);
  assert.equal((r.body.match(/bgcolor="#FFF9D7"/g) || []).length, 3, "all three are new");
  assert.equal(await unread(bo), "0", "looking marks them read");
  const again = ok(await bo.get("/notify.asp"));
  assert.ok(!again.body.includes('bgcolor="#FFF9D7"'));
  const al2 = ok(await al.get("/notify.asp")).body;
  assert.match(al2, /Bobby B<\/b><\/a> wrote on your <a href="view.asp\?id=\d+">Wall<\/a>/);
  assert.match(al2, /replied to <a href="view.asp\?id=\d+">a post on your Wall<\/a>/);
});

await test("notifications keep the newest hundred", async () => {
  const lines = [];
  for (let i = 1; i <= 100; i++) lines.push(`${i}|1996-07-04 12:00|friend|bobby|Bobby B|`);
  n.write("C:\\BOOKDATA\\NOTES\\CAROL.TXT", lines.join("\n") + "\n");
  ok(await al.get(`/vote.asp?id=${nId("hi alice")}&v=down&b=home`)); // not carol's post: nothing
  ok(await al.post("/post.asp", { to: "carol", text: "for carol" }));
  const kept = n.read("C:\\BOOKDATA\\NOTES\\CAROL.TXT").trim().split("\n");
  assert.equal(kept.length, 100);
  assert.match(kept[0], /^2\|/);
  assert.match(kept[99], /^101\|.*\|wall\|alice\|/);
});

await test("pokes: friends only, once, poke back or remove", async () => {
  let r = ok(await ca.get("/poke.asp?u=bobby&do=poke"));
  assert.match(r.body, /only poke your friends/);
  r = ok(await al.get("/poke.asp?u=bobby&do=poke&b=profile"));
  assert.equal(r.url.split("?")[0], "/profile.asp");
  assert.match(r.body, /You poked Bobby B/);
  r = ok(await al.get("/poke.asp?u=bobby&do=poke"));
  assert.match(r.body, /already poked Bobby B/);
  r = ok(await bo.get("/home.asp"));
  assert.match(r.body, /Alice A<\/b><\/a> poked you/);
  assert.match(ok(await bo.get("/notify.asp")).body, /Alice A<\/b><\/a> poked you/);
  r = ok(await bo.get("/poke.asp?u=alice&do=poke"));           // poke back
  assert.ok(!r.body.includes("poked you."), "bobby's poke box is empty again");
  r = ok(await al.get("/home.asp"));
  assert.match(r.body, /Bobby B<\/b><\/a> poked you/);
  r = ok(await al.get("/poke.asp?u=bobby&do=clear"));
  assert.ok(!r.body.includes("poked you."));
  assert.equal(n.read("C:\\BOOKDATA\\POKES\\ALICE.TXT"), "|");
});

await test("deleting a post: author or Wall owner, after asking, with everything on it", async () => {
  ok(await bo.post("/post.asp", { to: "alice", text: "delete me" }));
  const id = nId("delete me");
  ok(await ca.post("/reply.asp", { id, text: "a reply" }));
  ok(await ca.get(`/vote.asp?id=${id}&v=up&b=home`));
  // carol is neither author nor owner: no link, and the page sends her back
  assert.ok(!ok(await ca.get(`/view.asp?id=${id}`)).body.includes(`delete.asp?id=${id}"`));
  assert.equal(ok(await ca.get(`/delete.asp?id=${id}`)).url, `/view.asp?id=${id}`);
  ok(await ca.post("/delete.asp", { id }));
  assert.ok(nLog().some((l) => l.startsWith(id + "|")), "carol could not delete it");
  // alice owns the Wall: she is asked, then it goes
  assert.match(ok(await al.get(`/view.asp?id=${id}`)).body, new RegExp(`delete.asp\\?id=${id}"`));
  const ask = ok(await al.get(`/delete.asp?id=${id}`));
  assert.match(ask.body, /Delete this post\?/);
  assert.match(ask.body, /delete me/);
  const r = ok(await al.post("/delete.asp", { id }));
  assert.equal(r.url.split("?")[0], "/profile.asp");
  assert.match(r.body, /The post was deleted/);
  assert.ok(!nLog().some((l) => l.startsWith(id + "|")));
  assert.ok(!n.read("C:\\BOOKDATA\\WALLS\\ALICE.TXT").includes("delete me"));
  assert.ok(!n.exists(`C:\\BOOKDATA\\REPLIES\\${id}.TXT`) && !n.exists(`C:\\BOOKDATA\\VOTES\\${id}.TXT`));
  assert.ok(!ok(await bo.get("/home.asp")).body.includes("delete me"));
  assert.equal(ok(await bo.get(`/view.asp?id=${id}`)).url, "/home.asp");
});

await test("deleting a reply: its author or the Wall owner", async () => {
  ok(await bo.post("/post.asp", { to: "alice", text: "reply target" }));
  const id = nId("reply target");
  for (const [b, text] of [[ca, "carol says"], [bo, "bobby says"], [al, "alice says"]]) ok(await b.post("/reply.asp", { id, text }));
  const rid = (text) => n.read(`C:\\BOOKDATA\\REPLIES\\${id}.TXT`).split("\n").find((l) => l.endsWith("|" + text)).split("|")[0];
  // bobby wrote the post but not on his Wall: he may delete his own reply, not carol's
  assert.equal(ok(await bo.get(`/delete.asp?id=${id}&r=${rid("carol says")}`)).url, `/view.asp?id=${id}`);
  ok(await bo.post("/delete.asp", { id, r: rid("carol says") }));
  ok(await bo.post("/delete.asp", { id, r: rid("bobby says") }));
  ok(await al.post("/delete.asp", { id, r: rid("carol says") }));
  const left = n.read(`C:\\BOOKDATA\\REPLIES\\${id}.TXT`);
  assert.ok(!left.includes("carol says") && !left.includes("bobby says") && left.includes("alice says"));
  const view = ok(await ca.get(`/view.asp?id=${id}`)).body;
  assert.ok(view.includes("alice says") && !view.includes("&r="), "carol sees no delete links");
});

await test("an older SimBook's uploads are deleted by the installer; photo posts stay, as words", async () => {
  const old = await fresh();
  const ob = await join(old, "olduser", "Old User");
  ok(await ob.post("/post.asp", { to: "olduser", text: "my holiday" }));
  const id = logLines(old).find((l) => l.endsWith("|my holiday")).split("|")[0];
  // what the old SimBook left: a profile picture, a photo and an album, and a home page's own picture
  old.mkdir("C:\\WEB\\PICS"); old.mkdir("C:\\WEB\\PHOTOS");
  old.write("C:\\WEB\\PICS\\OLDUSER.PIC", "SIM95PIC 2 2\n00\n00\n");
  old.write("C:\\WEB\\PICS\\LOGO.PIC", "my home page's logo");
  old.write(`C:\\WEB\\PHOTOS\\${id}.PIC`, "SIM95PIC 2 2\n99\n99\n");
  old.mkdir("C:\\BOOKDATA\\ALBUMS");
  old.write("C:\\BOOKDATA\\ALBUMS\\OLDUSER.TXT", `|${id}|`);
  const said = await old.runScript(fs.readFileSync(path.join(root, "simbook/INSTALL.SPK"), "utf8"));
  assert.ok(said.some((l) => /deleted 1 uploaded pictures from C:\\WEB\\PICS/.test(l)), said.join("\n"));
  assert.ok(!old.exists("C:\\WEB\\PICS\\OLDUSER.PIC") && !old.exists(`C:\\WEB\\PHOTOS\\${id}.PIC`) && !old.exists("C:\\BOOKDATA\\ALBUMS\\OLDUSER.TXT"));
  assert.ok(!old.exists("C:\\WEB\\PHOTOS"), "an empty folder goes");
  assert.equal(old.read("C:\\WEB\\PICS\\LOGO.PIC"), "my home page's logo", "what isn't SimBook's stays");
  const feed = ok(await ob.get("/home.asp")).body;
  assert.match(feed, /my holiday/);
  assert.doesNotMatch(feed, /photos\/|added a photo/);
  assert.equal(ok(await ob.get("/photos.asp?u=olduser")).url, "/profile.asp?u=olduser", "old album links lead to the profile");
});

await test("the log rolls over to a new file every 500 posts", async () => {
  const r0 = Number(n.read("C:\\BOOKDATA\\NEXTID.TXT"));
  n.write("C:\\BOOKDATA\\NEXTID.TXT", "498");
  for (const t of ["p499", "p500", "p501", "p502"]) ok(await al.post("/post.asp", { to: "alice", text: t, back: "home" }));
  assert.match(n.read("C:\\BOOKDATA\\LOG\\0.TXT"), /\|p499\n.*\|p500\n$/s);
  assert.match(n.read("C:\\BOOKDATA\\LOG\\1.TXT"), /^501\|.*\|p501\n502\|.*\|p502\n$/s);
  const home = ok(await al.get("/home.asp")).body;
  assert.ok(["p499", "p500", "p501", "p502", "hi alice"].every((t) => home.includes(t)), "the feed reads both files");
  for (const id of ["499", "502"]) assert.match(ok(await al.get(`/view.asp?id=${id}`)).body, /p50[02]|p499/);
  ok(await al.post("/delete.asp", { id: "500" }));
  assert.ok(!n.read("C:\\BOOKDATA\\LOG\\0.TXT").includes("p500"));
  assert.ok(r0 < 498);
});

await test("the installer numbers replies saved by the first SimBook", async () => {
  const old = await fresh();
  old.mkdir("C:\\BOOKDATA");
  old.mkdir("C:\\BOOKDATA\\REPLIES");
  old.write("C:\\BOOKDATA\\REPLIES\\7.TXT", "1996-07-04 12:00|ann|Ann|old one\n1996-07-04 12:01|bob|Bob|old two\n");
  old.write("C:\\BOOKDATA\\REPLIES\\8.TXT", "1996-07-04 12:02|ann|Ann|old three\n");
  const said = await old.runScript(fs.readFileSync(path.join(root, "simbook/INSTALL.SPK"), "utf8"));
  assert.ok(said.includes("  numbered 3 replies"));
  assert.equal(old.read("C:\\BOOKDATA\\REPLIES\\7.TXT"), "1|1996-07-04 12:00|ann|Ann|old one\n2|1996-07-04 12:01|bob|Bob|old two\n");
  assert.equal(old.read("C:\\BOOKDATA\\NEXTRID.TXT"), "3");
  const again = await old.runScript(fs.readFileSync(path.join(root, "simbook/INSTALL.SPK"), "utf8"));
  assert.ok(!again.some((l) => l.includes("numbered")), "running it twice changes nothing");
  assert.equal(old.read("C:\\BOOKDATA\\REPLIES\\8.TXT"), "3|1996-07-04 12:02|ann|Ann|old three\n");
});

await test("the new actions refuse forged requests too", async () => {
  ok(await bo.post("/post.asp", { to: "alice", text: "keep me" }));
  const id = nId("keep me");
  const before = n.disk.snapshot().files;
  const cookies = al.cookies();
  for (const [method, url, form] of [
    ["POST", "/delete.asp", { id }],
    ["GET", "/poke.asp?u=bobby&do=poke"],
  ]) {
    const body = form ? new URLSearchParams(form).toString() : "";
    const r = await n.request(method, url, { body, cookies });
    assert.equal(r.status, "302 Found", url);
    assert.ok(r.headers.some((h) => h.startsWith("Location: home.asp?why=That+did+not+come")), url);
  }
  assert.deepEqual(n.disk.snapshot().files, before);
});

await test("every page stays under 64K even with the nastiest content allowed", async () => {
  const big = await fresh();
  const lt = (n) => "<".repeat(n); // each one becomes &lt;, four times longer
  const users = [];
  for (let i = 0; i < 120; i++) users.push("wst" + i);
  const books = {};
  for (const u of users) books[u] = await join(big, u, lt(100));
  const a = books.wst0;
  for (const u of users.slice(1, 40)) ok(await a.post("/friend.asp", { u, do: "add" }));
  ok(await a.post("/edit.asp", { name: lt(100), sex: lt(100), birthday: lt(100), hometown: lt(100), status: lt(100), interests: lt(900), music: lt(900), about: lt(900) }));
  for (let i = 0; i < 30; i++) ok(await books["wst" + (1 + i)].post("/post.asp", { to: "wst0", text: lt(1000) }));
  for (let i = 0; i < 30; i++) ok(await a.post("/post.asp", { to: "wst0", text: lt(1000), back: "home" }));
  // every one of those posts gets a pile of the longest replies
  const ids = logLines(big).map((l) => l.split("|")[0]).sort((a, b) => a - b);
  for (const id of ids.slice(-30)) for (let j = 0; j < 3; j++) ok(await a.post("/reply.asp", { id, text: lt(500) }));
  const one = ids[ids.length - 1];
  for (let j = 0; j < 60; j++) ok(await books["wst" + (1 + (j % 30))].post("/reply.asp", { id: one, text: lt(500) }));
  const sizes = [];
  for (const url of ["/home.asp", "/profile.asp?u=wst0", "/profile.asp?u=wst1", "/people.asp", "/edit.asp", "/picture.asp", "/view.asp?id=" + one, "/delete.asp?id=" + one, "/notify.asp"]) {
    const r = ok(await a.get(url));
    assert.equal(r.url, url, "not signed in");
    const pg = await page(r.body);
    if (pg && pg.el("text")) await pg.type("text", "x");
    sizes.push(`${url} ${r.raw.length}`);
    assert.ok(r.raw.length < MESSAGE_LIMIT - 8000, `${url} is ${r.raw.length} characters`);
  }
  console.log("      worst-case page sizes (limit 65536): " + sizes.join(", "));
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
  // Written the way the first SimBook stored posts, then moved by the installer
  big.write("C:\\BOOKDATA\\POSTS.TXT", lines.join("\n") + "\n");
  big.write("C:\\BOOKDATA\\WALLS\\USER0.TXT", lines.join("\n") + "\n");
  big.write("C:\\BOOKDATA\\NEXTID.TXT", "3000");
  const said = await big.runScript(fs.readFileSync(path.join(root, "simbook/INSTALL.SPK"), "utf8"));
  assert.ok(said.includes("  moved 3000 posts into C:\\BOOKDATA\\LOG"), said.join("\n"));
  assert.equal(big.list("C:\\BOOKDATA\\LOG").length, 6);
  assert.equal(logLines(big).length, 3000);
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

await test("changing your password: the old one first; other sign-ins end, this one stays", async () => {
  const pm = await fresh();
  const here = await join(pm, "pat", "Pat Doe", "oldpass");
  const elsewhere = browser(pm);
  ok(await elsewhere.post("/login.asp", { u: "pat", pw: "oldpass" }));
  assert.match(ok(await here.get("/edit.asp")).body, /<a href="password.asp">Change my password<\/a>/);
  let r = ok(await here.post("/password.asp", { old: "wrong", pw: "newpass", pw2: "newpass" }));
  assert.match(r.body, /That is not your password now/);
  r = ok(await here.post("/password.asp", { old: "oldpass", pw: "newpass", pw2: "other" }));
  assert.match(r.body, /The two new passwords are different/);
  r = ok(await here.post("/password.asp", { old: "oldpass", pw: "newpass", pw2: "newpass" }));
  assert.match(r.body, /Your password is changed/);
  assert.equal(ok(await here.get("/home.asp")).url, "/home.asp", "still signed in here");
  assert.equal(ok(await elsewhere.get("/home.asp")).url, "/index.asp", "signed out elsewhere");
  assert.equal(ok(await rawBrowser(pm).post("/login.asp", { u: "pat", pw: "oldpass" })).url, "/index.asp?e=login");
  assert.equal(ok(await rawBrowser(pm).post("/login.asp", { u: "pat", pw: "newpass" })).url, "/home.asp");
  // without the form token, nothing changes
  const before = pm.read("C:\\BOOKDATA\\USERS\\PAT.TXT");
  ok(await rawBrowser(pm).post("/password.asp", { old: "newpass", pw: "hacked", pw2: "hacked" }));
  assert.equal(pm.read("C:\\BOOKDATA\\USERS\\PAT.TXT"), before);
});

await test("a forgotten password: the machine's owner sets a new one", async () => {
  const pm = await fresh();
  pm.write("C:\\SYSTEM\\USERS.INI", "[user]\nname=Dab\npassword=Owner99\n");
  const old = await join(pm, "lee", "Lee Lost", "forgotten");
  assert.match(ok(await rawBrowser(pm).get("/index.asp")).body, /<a href="reset.asp">Forgot your password\?<\/a>/);
  const desk = rawBrowser(pm);
  let r = ok(await desk.post("/reset.asp", { u: "lee", pw: "found1", pw2: "found1", owner: "dab", opw: "wrong" }));
  assert.match(r.body, /not this machine's user name and password/);
  r = ok(await desk.post("/reset.asp", { u: "nobody", pw: "found1", pw2: "found1", owner: "dab", opw: "Owner99" }));
  assert.match(r.body, /There is no member called nobody here/);
  r = ok(await desk.post("/reset.asp", { u: "lee", pw: "abc", pw2: "abc", owner: "dab", opw: "Owner99" }));
  assert.match(r.body, /at least 4 characters/);
  r = ok(await desk.post("/reset.asp", { u: "LEE", pw: "found1", pw2: "found1", owner: "DAB", opw: "Owner99" }));
  assert.match(r.body, /lee has a new password/);
  assert.equal(ok(await old.get("/home.asp")).url, "/index.asp", "their old sign-in ended");
  assert.equal(ok(await rawBrowser(pm).post("/login.asp", { u: "lee", pw: "forgotten" })).url, "/index.asp?e=login");
  assert.equal(ok(await rawBrowser(pm).post("/login.asp", { u: "lee", pw: "found1" })).url, "/home.asp");
  // a machine with no owner password set: nobody can reset
  pm.write("C:\\SYSTEM\\USERS.INI", "[user]\nname=Dab\npassword=\n");
  r = ok(await desk.post("/reset.asp", { u: "lee", pw: "found2", pw2: "found2", owner: "dab", opw: "" }));
  assert.match(r.body, /not this machine's user name and password/);
});

await test("a forgotten password by e-mail: the link goes through ColdMail's spool, works once, for an hour", async () => {
  const pm = await fresh();
  const kim = await join(pm, "kim", "Kim Mail", "forgotten");
  // no ColdMail here: no e-mail, but you can still give an address
  assert.match(ok(await rawBrowser(pm).get("/reset.asp")).body, /has no mail server \(ColdMail\)/);
  let r = ok(await kim.post("/edit.asp", { name: "Kim Mail", email: "not an address" }));
  assert.match(r.body, /is not an e-mail address/);
  r = ok(await kim.post("/edit.asp", { name: "Kim Mail", email: "Kim@Bravo" }));
  assert.match(pm.read("C:\\BOOKDATA\\USERS\\KIM.TXT"), /^email=kim@bravo$/m);
  assert.match(ok(await kim.get("/edit.asp")).body, /value="kim@bravo"/);
  assert.doesNotMatch(ok(await rawBrowser(pm).get("/profile.asp?u=kim")).body, /kim@bravo/, "nobody else sees it");

  pm.mkdir("C:\\MAILDATA");
  pm.mkdir("C:\\MAILDATA\\SPOOL");
  const spool = () => pm.list("C:\\MAILDATA\\SPOOL").sort((a, b) => parseInt(a.name) - parseInt(b.name)).map((f) => pm.read(f.path));
  const desk = rawBrowser(pm);
  r = ok(await desk.post("/reset.asp", { do: "mail", u: "nobody" }));
  assert.match(r.body, /If nobody has an e-mail address on their profile, a link/);
  assert.equal(spool().length, 0);
  r = ok(await desk.post("/reset.asp", { do: "mail", u: "kim" }));
  assert.match(r.body, /If kim has an e-mail address on their profile, a link/);
  assert.equal(spool().length, 1);
  const letter = spool()[0];
  assert.match(letter, /^X-Sender: simbook@testbox\nX-Recipient: kim@bravo\n/);
  assert.match(letter, /\nSubject: Your SimBook password\n/);
  const link = /http:\/\/testbox(\/reset\.asp\?k=[0-9A-F]{24})/.exec(letter)[1];

  // a second request: the first link stops working
  ok(await desk.post("/reset.asp", { do: "mail", u: "kim" }));
  assert.match(ok(await desk.get(link)).body, /That reset link has been used/);
  const link2 = /http:\/\/testbox(\/reset\.asp\?k=[0-9A-F]{24})/.exec(spool()[1])[1];
  r = ok(await desk.get(link2));
  assert.match(r.body, /Pick a New Password for kim/);
  // a guessed link with the right id and the wrong secret doesn't work
  assert.match(ok(await desk.get(link2.slice(0, -1) + (link2.endsWith("0") ? "1" : "0"))).body, /That reset link has been used/);
  const k = link2.split("=")[1];
  r = ok(await desk.post("/reset.asp", { k, pw: "fresh1", pw2: "fresh2" }));
  assert.match(r.body, /The two new passwords are different/);
  r = ok(await desk.post("/reset.asp", { k, pw: "fresh1", pw2: "fresh1" }));
  assert.match(r.body, /Your password is changed/);
  assert.equal(ok(await kim.get("/home.asp")).url, "/index.asp", "their old sign-in ended");
  assert.equal(ok(await rawBrowser(pm).post("/login.asp", { u: "kim", pw: "fresh1" })).url, "/home.asp");
  assert.match(ok(await desk.get(link2)).body, /That reset link has been used/, "it works once");

  // an hour later, a link is no good
  ok(await desk.post("/reset.asp", { do: "mail", u: "kim" }));
  const link3 = /http:\/\/testbox(\/reset\.asp\?k=[0-9A-F]{24})/.exec(spool()[2])[1];
  const file = "C:\\BOOKDATA\\RESETS\\" + link3.split("=")[1].slice(0, 8) + ".TXT";
  const lines = pm.read(file).split("\n");
  pm.write(file, [lines[0], String(+lines[1] - 3601), lines[2]].join("\n"));
  assert.match(ok(await desk.get(link3)).body, /more than an hour old/);
  assert.ok(!pm.exists(file));
});

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
