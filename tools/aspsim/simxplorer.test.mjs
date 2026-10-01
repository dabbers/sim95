// End-to-end tests for Simxplorer (simxplorer/src): the browser on ALPHA
// fetching real pages from BRAVO's web server, running their JavaScript.
//   node tools/aspsim/simxplorer.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Network } from "./network.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + String(e.message || e).split("\n").join("\n      ") + "\n      " + String(e.stack || "").split("\n").slice(1, 3).join("\n      ")); }
}

const net = new Network();
const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");
bravo.run("C:\\PROGRAMS\\HTTPD.SPK");

const page = (name, html) => bravo.write("C:\\WEB\\" + name.toUpperCase(), html);
page("index.htm", `<html><head><title>Bravo's Place</title></head><body>
<h1>Welcome</h1><p><a href="script.htm">Scripts</a> <a href="/forms.htm">Forms</a></p>
<img src="dot.pic"></body></html>`);
bravo.write("C:\\WEB\\DOT.PIC", "SIM95PIC 2 2\nC9\n9C\n");
page("script.htm", `<html><head><title>Scripted</title>
<script language="JavaScript">
<!--
function square(n) { return n * n; }
var visits = 0;
// -->
</script></head><body>
<p>Squares: <script>for (var i = 1; i <= 4; i++) document.write(square(i) + " ");</script></p>
<p id="agent"><script>document.write(navigator.appName)</script></p>
<span id="count">none yet</span>
<input type="button" value="Count" onclick="visits++; document.getElementById('count').innerText = 'clicked ' + visits">
<input type="button" value="Hello" onclick="alert('Hello from ' + location.hostname)">
<a href="index.htm" onclick="return confirm('Really leave?')">Leave</a>
<a href="javascript:void(document.title = 'Renamed')">Rename</a>
</body></html>`);
page("forms.htm", `<html><head><title>Sign the Guestbook</title>
<script>
function check(f) {
  if (f.who.value == "") { alert("Please type your name."); return false; }
  f.stamp.value = "js-was-here";
  return true;
}
</script></head><body>
<form name="book" action="sign.asp" method="post" onsubmit="return check(this)">
Name: <input name="who"> <input type="hidden" name="stamp" value="no-js">
<input type="checkbox" name="cool" value="yes" checked> Cool
<input type="submit" name="go" value="Sign">
</form>
<form name="find" action="sign.asp" method="get"><input name="q" value="cats"><input type="submit" value="Find"></form>
</body></html>`);
page("sign.asp", `<html><head><title>Signed</title></head><body>
<p id="method"><%= REQUEST.Method %></p><p id="who"><%= REQUEST.Form("who") %><%= REQUEST.Query("q") %></p>
<p id="stamp"><%= REQUEST.Form("stamp") %></p><p id="cool"><%= REQUEST.Form("cool") %></p><p id="go"><%= REQUEST.Form("go") %></p></body></html>`);
page("timer.htm", `<html><head><title>Timers</title></head><body onload="start()">
<span id="clock">0</span>
<script>
var ticks = 0, t;
function start() { t = setInterval(function () { ticks++; document.getElementById("clock").innerText = ticks; if (ticks == 3) clearInterval(t); }, 100); }
setTimeout("document.title = 'Later'", 200);
</script></body></html>`);
page("broken.htm", `<html><head><title>Broken</title></head><body>
<p>One</p>
<script>
var a = 1;
nosuchfunction();
</script>
<script>document.write("second script")</script>
</body></html>`);
page("cookie.htm", `<html><body><script>
document.cookie = "flavour=oatmeal; path=/";
document.write("cookie=" + document.cookie);
</script></body></html>`);
page("both.htm", `<html><head><title>Both</title>
<script type="spark">SUB Page_Load ()
    PAGE.Status = "Voyager was here"
END SUB</script>
<script language="JavaScript">document.title = "Simxplorer was here";</script>
</head><body onload="Page_Load"><p>Works in both browsers.</p></body></html>`);
page("change.htm", `<html><head><title>Changes</title></head><body>
<input id="shout" onchange="runs++; document.getElementById('runs').innerText = runs; document.getElementById('echo').innerText = this.value.toUpperCase()">
<span id="echo"></span> <span id="runs">0</span> <span id="order"></span>
<input type="button" value="Done" onclick="document.getElementById('order').innerText = document.getElementById('echo').innerText + ' then click'">
<script>var runs = 0;</script></body></html>`);
page("words.htm", `<html><head><title>Words</title></head><body>
<h1>Words</h1><p>One apple, two apples, three apples.</p>
<form><input name="note" value="apple pie"></form></body></html>`);
page("prompt.htm", `<html><head><title>Asking</title></head><body><script>
var n = prompt("What is your name?", "Bob");
document.write(n == null ? "You said nothing." : "Hi " + n + "!");
</script></body></html>`);
page("move.htm", `<html><head><meta http-equiv="refresh" content="0; url=index.htm"><title>Moving</title></head><body>Moved.</body></html>`);

alpha.write("C:\\SYSTEM\\BOOKMARK.TXT", "Bravo|http://bravo/\n");

await test("the installer writes SIMXPLOR.SPK and starts it", async () => {
  alpha.write("C:\\MYFILES\\INSTALL.SPK", fs.readFileSync(path.join(root, "simxplorer/INSTALL.SPK"), "utf8"));
  const pid = alpha.run("C:\\MYFILES\\INSTALL.SPK");
  await net.until(() => !alpha.running(pid), 60000, "the installer");
  assert.match(alpha.output(pid), /wrote C:\\WEB\\SXDEMO\\SNIFF.SPK[\s\S]*wrote C:\\PROGRAMS\\SIMXPLOR.SPK[\s\S]*Simxplorer is installed \(6 files\)\.[\s\S]*Simxplorer is running/);
  assert.equal(alpha.read("C:\\WEB\\SXDEMO\\BADGE.PIC"), fs.readFileSync(path.join(root, "simxplorer/WEB/BADGE.PIC"), "utf8"), "the demo comes too");
  assert.ok(alpha.read("C:\\PROGRAMS\\SIMXPLOR.SPK") === fs.readFileSync(path.join(root, "simxplorer/src/JSCRIPT.SPK"), "utf8") + "\n" + fs.readFileSync(path.join(root, "simxplorer/src/BROWSER.SPK"), "utf8"), "simxplorer/INSTALL.SPK is out of date: node tools/build-installer.mjs explorer");
  const started = () => alpha.kernel.ps().find((p) => p.name === "SIMXPLOR");
  await net.until(() => started() && alpha.widgets(started().pid, "HtmlView").length, 30000, "Simxplorer");
  assert.deepEqual(alpha.errors, []);
  alpha.kernel.kill(started().pid);
  alpha.ui.dialogs.splice(0); // it went to http://alpha/, where nobody serves pages
});

const ie = alpha.run("C:\\PROGRAMS\\SIMXPLOR.SPK", ["http://bravo/"]);
const win = () => alpha.widgets(ie, "Window")[0];
const view = () => alpha.widgets(ie, "HtmlView")[0];
const addressBox = () => alpha.widgets(ie, "TextBox")[0];
const title = () => win().get("Title");
const status = () => win().get("Status");
const el = (id) => view().elements.get(id);
const html = () => String(view().get("Html") ?? "");
const wait = (fn, what, ms = 8000) => net.until(fn, ms, what);
const loaded = (t) => wait(() => title() === t + " - Simxplorer" && status().startsWith("Done"), "the page " + t);
const dialogs = () => alpha.ui.dialogs.splice(0);
const fireScript = async (id) => { const e = el(id) || [...view().elements.values()].find((x) => x.Value === id); view().fire("onScript", "onclick", /onclick="([^"]*)"/.exec(e.attrs)[1]); };
// the js:N an element's onclick became, found by something in its tag
const onclickOf = (bit) => { const tag = html().split("<").find((t) => t.includes(bit) && /onclick="js:\d+"/.test(t)); assert.ok(tag, "no handler on " + bit); return /onclick="(js:\d+)"/.exec(tag)[1]; };
const onChangeOf = (id) => /onchange="(js:\d+)"/.exec(html().split("<").find((t) => t.includes(`id="${id}"`)))[1];
// the toolbar is drawn on a canvas: press and let go over button i
const toolbar = () => alpha.widgets(ie, "Canvas")[0];
const tool = (i) => { toolbar().fire("onMouseDown", 2 + i * 58 + 25, 20, 1); toolbar().fire("onMouseUp", 2 + i * 58 + 25, 20, 1); };
const TOOLS = { Back: 0, Forward: 1, Stop: 2, Refresh: 3, Home: 4, Search: 5, Favorites: 6, History: 7, Mail: 8 };
const button = (name) => ({ call: () => tool(TOOLS[name]) });
const menu = (item) => alpha.widgets(ie, "Menu")[0].fire("onSelect", item);
await net.until(() => alpha.widgets(ie, "HtmlView").length > 0 || alpha.errors.length, 30000, "the window");
const go = async (url) => { addressBox().set("Text", url); addressBox().fire("onEnter"); };

await test("it opens a page, with its title, address and pictures", async () => {
  await loaded("Bravo's Place");
  assert.equal(addressBox().get("Text"), "http://bravo/");
  assert.match(html(), /<h1>Welcome<\/h1>/);
  view().fire("onImage", "dot.pic");
  await wait(() => view().images?.get("dot.pic"), "the picture");
  assert.equal(view().images.get("dot.pic"), "SIM95PIC 2 2\nC9\n9C\n");
  assert.match(alpha.read("C:\\SYSTEM\\HISTORY.TXT"), /\|Bravo's Place\|http:\/\/bravo\/\n/);
  assert.deepEqual(alpha.errors, []);
  assert.deepEqual(dialogs(), []);
});

await test("scripts write into the page as it loads", async () => {
  view().fire("onNavigate", "script.htm");
  await loaded("Scripted");
  assert.match(html(), /Squares: 1 4 9 16 <\/p>/);
  assert.match(html(), /<p id="agent">Simxplorer<\/p>/);
  assert.ok(!html().includes("square(n)"), "the script itself is not shown");
});

await test("onclick runs JavaScript that changes the page, and alert() shows a box", async () => {
  view().fire("onScript", "onclick", onclickOf('value="Count"'));
  await wait(() => el("count").Text === "clicked 1", "the first click");
  view().fire("onScript", "onclick", onclickOf('value="Count"'));
  await wait(() => el("count").Text === "clicked 2", "the second click");
  view().fire("onScript", "onclick", onclickOf('value="Hello"'));
  await wait(() => alpha.ui.dialogs.length === 1, "the alert");
  assert.deepEqual(dialogs().map((d) => [d.title, d.kind, d.text]), [["Simxplorer", "warn", "Hello from bravo"]]);
});

await test("a text box's onchange waits for the typing to stop, as leaving the box did", async () => {
  await go("bravo/change.htm");
  await loaded("Changes");
  const box = onChangeOf("shout");
  for (const text of ["h", "he", "hello"]) { view().call("SetElement", "shout", "Value", text); view().fire("onScript", "onchange", box); }
  await wait(() => el("echo").Text === "HELLO", "the handler");
  assert.equal(el("runs").Text, "1", "once, not three times");
  view().call("SetElement", "shout", "Value", "bye");
  view().fire("onScript", "onchange", box);
  view().fire("onScript", "onclick", onclickOf('value="Done"'));
  await wait(() => el("order").Text === "BYE then click", "change before click");
  await go("bravo/script.htm");
  await loaded("Scripted");
});

await test("the menus: Find on this page, Edit, and Search the Web (Ctrl+E)", async () => {
  await go("bravo/words.htm");
  await loaded("Words");
  const field = [...view().elements.values()].find((e) => /name="note"/.test(e.attrs)).Id;
  view().call("SetElement", field, "Value", "typed by hand");
  menu("Find (on This Page)...");
  const findWin = () => alpha.widgets(ie, "Window").find((w) => w.get("Title") === "Find");
  await wait(() => findWin()?.get("Visible"), "the Find window");
  const findBox = alpha.widgets(ie, "TextBox").find((t) => t.parent === findWin());
  findBox.set("Text", "apple");
  alpha.button(ie, "Find Next").call("Click");
  await wait(() => /\(1 of 3\)/.test(status()), "the first apple");
  assert.match(html(), /One <b><u><font color="#CC0000">apple<\/font><\/u><\/b>, two/);
  assert.equal(view().elements.get(field).Value, "typed by hand", "what was typed survives");
  menu("Find Next");
  await wait(() => /\(2 of 3\)/.test(status()), "the second");
  assert.match(html(), /two <b><u><font color="#CC0000">apple<\/font><\/u><\/b>s/);
  menu("Find Next");
  menu("Find Next");
  await wait(() => alpha.ui.dialogs.length === 1, "the end");
  assert.equal(dialogs()[0].text, "Finished searching the page.");
  assert.ok(!/CC0000/.test(html()), "the mark goes");
  findBox.set("Text", "pear");
  menu("Find Next");
  await wait(() => alpha.ui.dialogs.length === 1, "not found");
  assert.equal(dialogs()[0].text, 'Simxplorer could not find "pear" on this page.');
  menu("Select All");
  await new Promise((r) => setTimeout(r, 100));
  menu("Copy");
  await wait(() => alpha.exists("C:\\SYSTEM\\CLIPBRD.TXT") || alpha.errors.length, "the clipboard").catch((e) => { throw new Error(e.message + JSON.stringify(alpha.ui.dialogs) + alpha.running(ie) + alpha.errors); });
  assert.deepEqual(alpha.errors, []);
  assert.match(alpha.read("C:\\SYSTEM\\CLIPBRD.TXT"), /^Words\nOne apple, two apples, three apples\.$/);
  alpha.write("C:\\SYSTEM\\CLIPBRD.TXT", "bravo/forms.htm");
  menu("Paste");
  await wait(() => addressBox().get("Text") === "bravo/forms.htm", "the paste");
  menu("Search the Web...");
  await wait(() => alpha.widgets(ie, "Window").some((w) => w.get("Title") === "Search the Web"), "the search box");
  alpha.widgets(ie, "TextBox").find((t) => t.parent?.get?.("Title") === "Search the Web").set("Text", "chess openings");
  alpha.button(ie, "OK").call("Click");
  await wait(() => /about:search\?chess\+openings/.test(addressBox().get("Text")), "the search");
});

await test("the toolbar: greyed-out buttons do nothing", async () => {
  await go("bravo/script.htm");
  await loaded("Scripted");
  tool(TOOLS.Forward);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(addressBox().get("Text"), "http://bravo/script.htm");
  tool(TOOLS.Back);
  await wait(() => addressBox().get("Text") !== "http://bravo/script.htm", "Back");
  tool(TOOLS.Forward);
  await loaded("Scripted");
});

await test("a link's onclick can stop it; javascript: links run", async () => {
  const leave = onclickOf('href="index.htm"');
  alpha.ui.answers.push(false);
  view().fire("onScript", "onclick", leave);
  await wait(() => alpha.ui.dialogs.length === 1, "the confirm");
  assert.equal(dialogs()[0].text, "Really leave?");
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(addressBox().get("Text"), "http://bravo/script.htm", "stayed");
  view().fire("onNavigate", "javascript:void(document.title = 'Renamed')");
  await wait(() => title() === "Renamed - Simxplorer", "the new title");
  alpha.ui.answers.push(true);
  view().fire("onScript", "onclick", leave);
  await loaded("Bravo's Place");
  dialogs();
});

await test("Back and Forward", async () => {
  button("Back").call("Click");
  await loaded("Scripted");
  button("Forward").call("Click");
  await loaded("Bravo's Place");
});

await test("onsubmit checks a form, can change it, and the form goes by POST", async () => {
  await go("bravo/forms.htm");
  await loaded("Sign the Guestbook");
  assert.match(html(), /<form name="book" method="post" action="sxsubmit:0">/);
  view().fire("onSubmit", "sxsubmit:0", "who=&stamp=no-js&cool=yes&go=Sign", "");
  await wait(() => alpha.ui.dialogs.length === 1, "the alert");
  assert.equal(dialogs()[0].text, "Please type your name.");
  const who = [...view().elements.values()].find((e) => /name="who"/.test(e.attrs)).Id;
  view().call("SetElement", who, "Value", "Ann & Bob");
  view().fire("onSubmit", "sxsubmit:0", "who=Ann+%26+Bob&stamp=no-js&cool=yes&go=Sign", "");
  await loaded("Signed");
  assert.equal(el("method").Text, "POST");
  assert.equal(el("who").Text, "Ann & Bob");
  assert.equal(el("stamp").Text, "js-was-here", "the script's change to a hidden field went");
  assert.equal(el("cool").Text, "yes");
  assert.equal(el("go").Text, "Sign", "and the button that was pressed");
});

await test("a GET form without script goes as the view sent it", async () => {
  button("Back").call("Click");
  await loaded("Sign the Guestbook");
  view().call("SetElement", [...view().elements.values()].find((e) => /name="q"/.test(e.attrs)).Id, "Value", "dogs");
  view().fire("onNavigate", "sxsubmit:1?q=dogs");
  await loaded("Signed");
  assert.equal(el("method").Text, "GET");
  assert.equal(el("who").Text, "dogs");
  assert.equal(addressBox().get("Text"), "http://bravo/sign.asp?q=dogs");
});

await test("setTimeout, setInterval and body onload", async () => {
  await go("http://bravo/timer.htm");
  await wait(() => el("clock")?.Text === "3", "three ticks");
  await wait(() => title() === "Later - Simxplorer", "the timeout");
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(el("clock").Text, "3", "cleared");
});

await test("a script error says where, and No stops the page's scripts", async () => {
  alpha.ui.answers.push(false);
  await go("http://bravo/broken.htm");
  await loaded("Broken");
  const d = dialogs();
  assert.equal(d.length, 1);
  assert.equal(d[0].title, "Simxplorer Script Error");
  assert.match(d[0].text, /Line:  5\nChar:  1\nError:  'nosuchfunction' is undefined\nCode:  0\nURL:  http:\/\/bravo\/broken.htm/);
  assert.ok(!html().includes("second script"), "no more scripts");
  assert.equal(status(), "Done, but with errors on page.");
});

await test("document.cookie lands in Voyager's cookie jar", async () => {
  await go("bravo/cookie.htm");
  await wait(() => /cookie=flavour=oatmeal/.test(html()), "the cookie");
  assert.match(alpha.read("C:\\SYSTEM\\COOKIES.TXT"), /^BRAVO\|flavour\|oatmeal$/m);
});

// ---------------------------------------------------------------- XMLHttpRequest
page("echo.asp", `<% RESPONSE.ContentType = "text/plain"
RESPONSE.SetCookie("served", "yes")
RESPONSE.Write(REQUEST.Method + ";q=" + REQUEST.Query("q") + ";say=" + REQUEST.Form("say") + ";cookie=" + REQUEST.Cookie("flavour") + ";ua=" + REQUEST.Header("User-Agent") + ";x=" + REQUEST.Header("X-Custom")) %>`);
page("slow.asp", `<% SYS.Sleep(1500)
RESPONSE.ContentType = "text/plain"
RESPONSE.Write("slow") %>`);
page("data.txt", "line one\nline two\n");
page("xhr.htm", `<html><head><title>Background</title></head><body>
<span id="get"></span>|<span id="post"></span>|<span id="miss"></span>|<span id="gone"></span>|<span id="order"></span>|<span id="ie"></span>|<span id="file"></span>
<script language="JavaScript">
function show(id, t) { document.getElementById(id).innerText = t; }
var states = [], order = [];
var g = new XMLHttpRequest();
g.onreadystatechange = function () {
  states.push(this.readyState);
  if (g.readyState == 4) show("get", states.join(",") + " " + g.status + " " + g.statusText + " " + g.getResponseHeader("content-type") + " " + g.responseText);
};
g.open("GET", "echo.asp?q=hello", true);
g.send(null);
var p = new XMLHttpRequest();
p.onreadystatechange = function () { if (p.readyState == 4) show("post", p.responseText); };
p.open("POST", "/echo.asp", true);
p.setRequestHeader("X-Custom", "abc");
p.send("say=hi+there");
var m = new XMLHttpRequest();
m.onreadystatechange = function () { if (m.readyState == 4) show("miss", m.status + " " + m.statusText); };
m.open("GET", "nothing-here.htm", true);
m.send();
var n = new XMLHttpRequest();
n.onerror = function () { show("gone", "error " + n.readyState + " " + n.status + " [" + n.responseText + "]"); };
n.open("GET", "http://nosuchhost/x.htm", true);
n.send();
function race(url) {
  var r = new XMLHttpRequest();
  r.onreadystatechange = function () { if (r.readyState == 4) { order.push(r.responseText.split(";")[0]); show("order", order.join(" then ")); } };
  r.open("GET", url, true);
  r.send();
}
race("slow.asp");
race("echo.asp?q=fast");
var ie = new ActiveXObject("Microsoft.XMLHTTP");
ie.onreadystatechange = function () { if (ie.readyState == 4) show("ie", ie.responseText.split("\\n")[0]); };
ie.open("GET", "http://bravo/data.txt", true);
ie.send();
</script></body></html>`);

await test("XMLHttpRequest: GET and POST in the background, with cookies and the User-Agent", async () => {
  await go("bravo/cookie.htm");
  await wait(() => /cookie=flavour=oatmeal/.test(html()), "the cookie page");
  await go("bravo/xhr.htm");
  await loaded("Background");
  await wait(() => el("get")?.Text, "the GET");
  assert.equal(el("get").Text, "1,2,3,4 200 OK text/plain GET;q=hello;say=;cookie=oatmeal;ua=Mozilla/2.0 (compatible; Simxplorer 3.02; SIM95);x=");
  await wait(() => el("post")?.Text, "the POST");
  assert.equal(el("post").Text, "POST;q=;say=hi there;cookie=oatmeal;ua=Mozilla/2.0 (compatible; Simxplorer 3.02; SIM95);x=abc");
  assert.match(alpha.read("C:\\SYSTEM\\COOKIES.TXT"), /^BRAVO\|served\|yes$/m, "a request's Set-Cookie is kept");
  assert.equal(addressBox().get("Text"), "http://bravo/xhr.htm", "the page stayed put");
  assert.equal(title(), "Background - Simxplorer");
});

await test("XMLHttpRequest: 404, an unknown host (status 0), several at once, and ActiveXObject", async () => {
  await wait(() => el("miss")?.Text && el("gone")?.Text && el("ie")?.Text, "the rest");
  assert.equal(el("miss").Text, "404 Not Found");
  assert.equal(el("gone").Text, "error 4 0 []");
  assert.equal(el("ie").Text, "line one");
  await wait(() => /then/.test(el("order")?.Text || ""), "both racers");
  assert.equal(el("order").Text, "GET then slow", "the quick one, sent second, came back first");
  assert.deepEqual(dialogs(), []);
  assert.deepEqual(alpha.errors, []);
});

await test("the Live Page: a clock and a counter kept up by XMLHttpRequest, a POST, the badge", async () => {
  bravo.putTree(path.join(root, "simxplorer/WEB"), "C:\\WEB\\SXDEMO");
  await go("bravo/sxdemo/");
  await loaded("The Live Page");
  assert.match(html(), /served to Simxplorer 3\.02/);
  await wait(() => /Updated [3-9] times without reloading/.test(el("state")?.Text || ""), "three updates", 15000);
  assert.match(el("clock").Text, /^\d\d:\d\d:\d\d$/);
  assert.ok(Number(el("hits").Text) >= 3, "the server's count: " + el("hits").Text);
  assert.equal(addressBox().get("Text"), "http://bravo/sxdemo/");
  view().call("SetElement", "said", "Value", "hello world");
  view().fire("onScript", "onclick", onclickOf('value="Send"'));
  await wait(() => el("echo")?.Text, "the answer to the POST");
  assert.match(el("echo").Text, /^\d\d:\d\d:\d\d Simxplorer 3\.02 said: HELLO WORLD!$/);
  view().fire("onImage", "badge.pic");
  await wait(() => view().images?.get("badge.pic"), "the badge");
  assert.match(view().images.get("badge.pic"), /^SIM95PIC 88 31\n/);
  assert.deepEqual(dialogs(), []);
  await go("bravo/script.htm");
  await loaded("Scripted");
  // the old page's requests are let go
  const hits = Number(bravo.read("C:\\WEB\\SXDEMO\\HITS.TXT"));
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(Number(bravo.read("C:\\WEB\\SXDEMO\\HITS.TXT")) <= hits + 1, "the clock stopped asking");
});

await test("SNIFF.SPK: Voyager is told to get Simxplorer; server pages can tell who asked", async () => {
  const VOYAGER = "Voyager/1.1 (SIM95)", SX = "Mozilla/2.0 (compatible; Simxplorer 3.02; SIM95)";
  let r = await bravo.request("GET", "/sxdemo/", { headers: { "User-Agent": VOYAGER } });
  assert.match(r.body, /<title>Simxplorer required<\/title>/);
  assert.match(r.body, /This page requires Simxplorer 3\.0 or higher - <a href="\/sxdemo\/getsx\.htm"><font color="#00FF00">Download it now!<\/font><\/a>/);
  assert.match(r.body, /You are using <b>Voyager 1\.1<\/b>/);
  assert.ok(!/XMLHttpRequest\(\)/.test(r.body), "no script for Voyager");
  r = await bravo.request("GET", "/sxdemo/", { headers: { "User-Agent": SX } });
  assert.match(r.body, /<title>The Live Page<\/title>/);
  // over the network, as Voyager would see it (this fetch says it is "test")
  assert.match(await bravo.fetch("BRAVO", "/sxdemo/"), /This page requires Simxplorer 3\.0 or higher/);
  bravo.mkdir("C:\\WEB\\SHOP");
  bravo.write("C:\\WEB\\SHOP\\WHO.ASP", `<%@ import file="../SXDEMO/SNIFF.SPK" %><%= IsSimxplorer() %>|<%= IsVoyager() %>|<%= BrowserName() %>|<%= BrowserVersion() %>|<%= NeedsSimxplorer("3.0") = "" %>|<%= NeedsSimxplorer("4.0") = "" %>`);
  const who = async (ua) => (await bravo.request("GET", "/shop/who.asp", { headers: ua ? { "User-Agent": ua } : {} })).body.trim();
  assert.equal(await who(SX), "True|False|Simxplorer|3.02|True|False");
  assert.equal(await who(VOYAGER), "False|True|Voyager|1.1|False|False");
  assert.equal(await who("Mozilla/4.0 (compatible; MSIE 5.0; Windows 98)"), "False|False|Mozilla|4.0|False|False");
  assert.equal(await who(""), "False|False|Unknown||False|False");
  // with a Vapor store that has Simxplorer, the link goes there
  bravo.mkdir("C:\\WEB\\VAPOR");
  bravo.write("C:\\WEB\\VAPOR\\CATALOG.TXT", "SIMXPLOR|Simxplorer|9|1000|ok|Internet|A browser\n");
  r = await bravo.request("GET", "/sxdemo/", { headers: { "User-Agent": VOYAGER } });
  assert.match(r.body, /<a href="\/vapor\/#apps">/);
  bravo.remove("C:\\WEB\\VAPOR\\CATALOG.TXT");
});

await test("a page with SPARK for Voyager and JavaScript for Simxplorer", async () => {
  await go("bravo/both.htm");
  await wait(() => title() === "Simxplorer was here - Simxplorer" && status().startsWith("Done"), "the JavaScript");
  assert.equal(status(), "Done (this page's SPARK scripts are for Voyager)");
  assert.deepEqual(dialogs(), [], "Page_Load is not taken for JavaScript");
});

await test("prompt() asks in a window of its own", async () => {
  await go("bravo/prompt.htm");
  await wait(() => alpha.widgets(ie, "Window").some((w) => w.get("Title") === "Simxplorer User Prompt"), "the prompt");
  const box = alpha.widgets(ie, "TextBox").find((t) => t.get("Text") === "Bob");
  assert.ok(box, "the default answer is filled in");
  box.set("Text", "Ann");
  alpha.widgets(ie, "Button").find((b) => b.get("Text") === "OK" && b.parent?.get?.("Title") === "Simxplorer User Prompt").call("Click");
  await wait(() => /Hi Ann!/.test(html()), "the answer used");
  await go("bravo/prompt.htm");
  const promptButton = (text) => alpha.widgets(ie, "Button").find((b) => b.get("Text") === text && b.parent?.get?.("Title") === "Simxplorer User Prompt");
  await wait(() => promptButton("Cancel"), "the prompt again");
  promptButton("Cancel").call("Click");
  await wait(() => /You said nothing\./.test(html()), "Cancel gives null");
});

await test("meta refresh moves on", async () => {
  await go("bravo/move.htm");
  await loaded("Bravo's Place");
});

await test("a machine that is not there: its box, and the page stays", async () => {
  alpha.ui.answers.push(false);
  await go("http://nowhere/");
  await wait(() => alpha.ui.dialogs.length === 1, "the box");
  const d = dialogs()[0];
  assert.match(d.text, /^Simxplorer cannot open the Internet site http:\/\/nowhere\/\.\n\n/);
  assert.equal(addressBox().get("Text"), "http://nowhere/");
  assert.match(html(), /Welcome/);
  assert.deepEqual(alpha.errors, []);
  // and it still works afterwards
  await go("bravo/script.htm");
  await loaded("Scripted");
});

await test("AutoSearch, Favorites, History and Options are pages of its own", async () => {
  await go("? chess clubs");
  await wait(() => /about:search\?chess\+clubs/.test(addressBox().get("Text")) && /You were looking for/.test(html()), "the search page");
  assert.match(html(), /You were looking for <b>chess clubs<\/b>/);
  view().fire("onNavigate", "about:options?home=bravo&search=http%3A%2F%2Fbravo%2Fsign.asp%3Fq%3D%25s&mail=");
  await wait(() => /Your settings have been saved/.test(html()), "the options");
  assert.match(alpha.read("C:\\SYSTEM\\SIMXPLOR.INI"), /search=http:\/\/bravo\/sign.asp\?q=%s/);
  await go("find knights");
  await loaded("Signed");
  assert.equal(el("who").Text, "knights");
  button("Favorites").call("Click");
  await wait(() => /<a href="http:\/\/bravo\/">Bravo<\/a>/.test(html()), "Voyager's bookmarks, imported");
  button("History").call("Click");
  await wait(() => /Signed/.test(html()) && /History/.test(html()), "the history");
  // with a search engine set, a dead site gets AskSim's cached copy offered
  alpha.ui.answers.push(true);
  await go("http://gone/old.htm");
  await wait(() => addressBox().get("Text") === "http://bravo/cache.asp?url=http%3A%2F%2Fgone%2Fold.htm", "the cached copy");
  assert.match(dialogs()[0].text, /AskSim may have kept a copy of this page/);
});

// Sends form n the way GUI_HtmlView does: the fields' current values, and the
// button that was pressed. Values to type go in typed (by field name).
async function submit(n, typed = {}, button) {
  const forms = html().split(/<form\b/i).slice(1);
  const form = forms[n].split(/<\/form>/i)[0];
  const attr = (t, a) => (new RegExp(`\\s${a}="([^"]*)"`, "i").exec(t) || [])[1];
  const pairs = [];
  for (const m of form.matchAll(/<(input|textarea|select)\b([^>]*)>/gi)) {
    const t = m[2], name = attr(t, "name"), id = attr(t, "id"), type = (attr(t, "type") || "text").toLowerCase();
    if (!name) continue;
    if (name in typed && view().elements.has(id)) view().call("SetElement", id, "Value", typed[name]);
    const live = view().elements.get(id);
    if (type === "submit" || type === "button") { if (name === button) pairs.push([name, attr(t, "value") || ""]); continue; }
    if ((type === "checkbox" || type === "radio") && !(live ? live.Checked : / checked/i.test(t))) continue;
    pairs.push([name, live ? live.Value : (attr(t, "value") || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"')]);
  }
  const body = pairs.map(([k, v]) => encodeURIComponent(k).replace(/%20/g, "+") + "=" + encodeURIComponent(v).replace(/%20/g, "+")).join("&");
  const action = /action="([^"]*)"/.exec(html().split(/<form\b/i)[n + 1])[1];
  if (/method="post"/i.test(html().split(/<form\b/i)[n + 1].split(">")[0])) view().fire("onSubmit", action, body, "");
  else view().fire("onNavigate", action + "?" + body);
}

const charlie = await net.boot("CHARLIE");
const delta = await net.boot("DELTA");

await test("SimBook in Simxplorer: join, post, and its SPARK counter left to Voyager", async () => {
  charlie.write("C:\\MYFILES\\INSTALL.SPK", fs.readFileSync(path.join(root, "simbook/INSTALL.SPK"), "utf8"));
  let pid = charlie.run("C:\\MYFILES\\INSTALL.SPK");
  await net.until(() => !charlie.running(pid), 30000, "SimBook's installer");
  charlie.run("C:\\PROGRAMS\\HTTPD.SPK");
  await go("charlie");
  await wait(() => /Welcome to SimBook/.test(html()) && status().startsWith("Done"), "SimBook");
  await submit(1, { name: "Ann Example", u: "ann", pw: "secret1", pw2: "secret1" });
  await wait(() => /Edit My Profile/.test(html()), "the profile page new members get");
  assert.match(html(), /onchange="Limits_Check"/, "Voyager's SPARK handler is left alone");
  view().fire("onNavigate", "home.asp");
  await wait(() => /What are you doing right now\?/.test(html()), "the home page");
  assert.match(alpha.read("C:\\SYSTEM\\COOKIES.TXT"), /^CHARLIE\|/m, "logged in by cookie");
  assert.match(status(), /SPARK scripts are for Voyager/);
  await submit(0, { text: "Browsing with Simxplorer 3!" });
  await wait(() => /Browsing with Simxplorer 3!/.test(html()), "the post in the feed");
  assert.deepEqual(dialogs(), []);
  assert.deepEqual(alpha.errors, []);
});

await test("ELIZA-95 in Simxplorer: the answer types itself out in JavaScript", async () => {
  delta.write("C:\\MYFILES\\INSTALL.SPK", fs.readFileSync(path.join(root, "eliza/INSTALL.SPK"), "utf8"));
  const pid = delta.run("C:\\MYFILES\\INSTALL.SPK");
  await net.until(() => !delta.running(pid), 30000, "ELIZA's installer");
  delta.run("C:\\PROGRAMS\\HTTPD.SPK");
  await go("delta");
  await wait(() => /name="say"/.test(html()) && status().startsWith("Done"), "ELIZA");
  await submit(0, { say: "build me a website about modems" });
  await wait(() => /_$/.test(el("answer")?.Text || ""), "the answer typing itself out (in JavaScript, for Simxplorer)");
  await wait(() => /^Done\. \(\d+ tokens\)$/.test(status()), "the typing to finish");
  assert.match(el("answer").Text, /import website/);
  assert.deepEqual(dialogs(), []);
});

await test("a SimMovie opens in SimPlayer, and the browser stays where it was", async () => {
  page("smoke.smv", "SIMMOVIE 1\ntitle=Smoke\nwidth=40\nheight=30\nfps=5\nframes=1\n.\n*X0\n");
  page("movies.htm", '<html><head><title>Movies</title></head><body><a href="smoke.smv">Smoke</a></body></html>');
  if (alpha.exists("C:\\PROGRAMS\\PLAYER.SPK")) alpha.remove("C:\\PROGRAMS\\PLAYER.SPK");
  await go("http://bravo/movies.htm");
  await loaded("Movies");
  // no player: say where to get one
  await go("http://bravo/smoke.smv");
  await loaded("SimPlayer required");
  assert.match(html(), /This is a SimMovie/);
  // with a player: it gets the address, and the page stays
  alpha.write("C:\\PROGRAMS\\PLAYER.SPK", 'SUB Main ()\n    FS.Write("C:\\MYFILES\\PLAYED.TXT", SYS.Args[0])\nEND SUB\n');
  await go("http://bravo/movies.htm");
  await loaded("Movies");
  await go("http://bravo/smoke.smv");
  await wait(() => alpha.exists("C:\\MYFILES\\PLAYED.TXT"), "SimPlayer to start");
  assert.equal(alpha.read("C:\\MYFILES\\PLAYED.TXT"), "http://bravo/smoke.smv");
  await wait(() => /Opened http:\/\/bravo\/smoke.smv in SimPlayer/.test(status()), "the status: " + status());
  assert.equal(title(), "Movies - Simxplorer");
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
