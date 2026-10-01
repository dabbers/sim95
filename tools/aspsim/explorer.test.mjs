// End-to-end tests for Internet Explorer (explorer/src): the browser on ALPHA
// fetching real pages from BRAVO's web server, running their JavaScript.
//   node tools/aspsim/explorer.test.mjs
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
<script language="JavaScript">document.title = "IE was here";</script>
</head><body onload="Page_Load"><p>Works in both browsers.</p></body></html>`);
page("change.htm", `<html><head><title>Changes</title></head><body>
<input id="shout" onchange="runs++; document.getElementById('runs').innerText = runs; document.getElementById('echo').innerText = this.value.toUpperCase()">
<span id="echo"></span> <span id="runs">0</span> <span id="order"></span>
<input type="button" value="Done" onclick="document.getElementById('order').innerText = document.getElementById('echo').innerText + ' then click'">
<script>var runs = 0;</script></body></html>`);
page("prompt.htm", `<html><head><title>Asking</title></head><body><script>
var n = prompt("What is your name?", "Bob");
document.write(n == null ? "You said nothing." : "Hi " + n + "!");
</script></body></html>`);
page("move.htm", `<html><head><meta http-equiv="refresh" content="0; url=index.htm"><title>Moving</title></head><body>Moved.</body></html>`);

alpha.write("C:\\SYSTEM\\BOOKMARK.TXT", "Bravo|http://bravo/\n");

await test("the installer writes IEXPLORE.SPK and starts it", async () => {
  alpha.write("C:\\MYFILES\\INSTALL.SPK", fs.readFileSync(path.join(root, "explorer/INSTALL.SPK"), "utf8"));
  const pid = alpha.run("C:\\MYFILES\\INSTALL.SPK");
  await net.until(() => !alpha.running(pid), 60000, "the installer");
  assert.match(alpha.output(pid), /Internet Explorer is installed \(1 files\)\.\n  wrote|wrote C:\\PROGRAMS\\IEXPLORE.SPK[\s\S]*Internet Explorer is running/);
  assert.ok(alpha.read("C:\\PROGRAMS\\IEXPLORE.SPK") === fs.readFileSync(path.join(root, "explorer/src/JSCRIPT.SPK"), "utf8") + "\n" + fs.readFileSync(path.join(root, "explorer/src/BROWSER.SPK"), "utf8"), "explorer/INSTALL.SPK is out of date: node tools/build-installer.mjs explorer");
  const started = () => alpha.kernel.ps().find((p) => p.name === "IEXPLORE");
  await net.until(() => started() && alpha.widgets(started().pid, "HtmlView").length, 30000, "Internet Explorer");
  assert.deepEqual(alpha.errors, []);
  alpha.kernel.kill(started().pid);
  alpha.ui.dialogs.splice(0); // it went to http://alpha/, where nobody serves pages
});

const ie = alpha.run("C:\\PROGRAMS\\IEXPLORE.SPK", ["http://bravo/"]);
const win = () => alpha.widgets(ie, "Window")[0];
const view = () => alpha.widgets(ie, "HtmlView")[0];
const addressBox = () => alpha.widgets(ie, "TextBox")[0];
const title = () => win().get("Title");
const status = () => win().get("Status");
const el = (id) => view().elements.get(id);
const html = () => String(view().get("Html") ?? "");
const wait = (fn, what, ms = 8000) => net.until(fn, ms, what);
const loaded = (t) => wait(() => title() === t + " - Microsoft Internet Explorer" && status().startsWith("Done"), "the page " + t);
const dialogs = () => alpha.ui.dialogs.splice(0);
const fireScript = async (id) => { const e = el(id) || [...view().elements.values()].find((x) => x.Value === id); view().fire("onScript", "onclick", /onclick="([^"]*)"/.exec(e.attrs)[1]); };
// the js:N an element's onclick became, found by something in its tag
const onclickOf = (bit) => { const tag = html().split("<").find((t) => t.includes(bit) && /onclick="js:\d+"/.test(t)); assert.ok(tag, "no handler on " + bit); return /onclick="(js:\d+)"/.exec(tag)[1]; };
const onChangeOf = (id) => /onchange="(js:\d+)"/.exec(html().split("<").find((t) => t.includes(`id="${id}"`)))[1];
const button = (name) => alpha.button(ie, name);
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
  assert.match(html(), /<p id="agent">Microsoft Internet Explorer<\/p>/);
  assert.ok(!html().includes("square(n)"), "the script itself is not shown");
});

await test("onclick runs JavaScript that changes the page, and alert() shows a box", async () => {
  view().fire("onScript", "onclick", onclickOf('value="Count"'));
  await wait(() => el("count").Text === "clicked 1", "the first click");
  view().fire("onScript", "onclick", onclickOf('value="Count"'));
  await wait(() => el("count").Text === "clicked 2", "the second click");
  view().fire("onScript", "onclick", onclickOf('value="Hello"'));
  await wait(() => alpha.ui.dialogs.length === 1, "the alert");
  assert.deepEqual(dialogs().map((d) => [d.title, d.kind, d.text]), [["Microsoft Internet Explorer", "warn", "Hello from bravo"]]);
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

await test("a link's onclick can stop it; javascript: links run", async () => {
  const leave = onclickOf('href="index.htm"');
  alpha.ui.answers.push(false);
  view().fire("onScript", "onclick", leave);
  await wait(() => alpha.ui.dialogs.length === 1, "the confirm");
  assert.equal(dialogs()[0].text, "Really leave?");
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(addressBox().get("Text"), "http://bravo/script.htm", "stayed");
  view().fire("onNavigate", "javascript:void(document.title = 'Renamed')");
  await wait(() => title() === "Renamed - Microsoft Internet Explorer", "the new title");
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
  assert.match(html(), /<form name="book" method="post" action="iesubmit:0">/);
  view().fire("onSubmit", "iesubmit:0", "who=&stamp=no-js&cool=yes&go=Sign", "");
  await wait(() => alpha.ui.dialogs.length === 1, "the alert");
  assert.equal(dialogs()[0].text, "Please type your name.");
  const who = [...view().elements.values()].find((e) => /name="who"/.test(e.attrs)).Id;
  view().call("SetElement", who, "Value", "Ann & Bob");
  view().fire("onSubmit", "iesubmit:0", "who=Ann+%26+Bob&stamp=no-js&cool=yes&go=Sign", "");
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
  view().fire("onNavigate", "iesubmit:1?q=dogs");
  await loaded("Signed");
  assert.equal(el("method").Text, "GET");
  assert.equal(el("who").Text, "dogs");
  assert.equal(addressBox().get("Text"), "http://bravo/sign.asp?q=dogs");
});

await test("setTimeout, setInterval and body onload", async () => {
  await go("http://bravo/timer.htm");
  await wait(() => el("clock")?.Text === "3", "three ticks");
  await wait(() => title() === "Later - Microsoft Internet Explorer", "the timeout");
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(el("clock").Text, "3", "cleared");
});

await test("a script error says where, and No stops the page's scripts", async () => {
  alpha.ui.answers.push(false);
  await go("http://bravo/broken.htm");
  await loaded("Broken");
  const d = dialogs();
  assert.equal(d.length, 1);
  assert.equal(d[0].title, "Internet Explorer Script Error");
  assert.match(d[0].text, /Line:  5\nChar:  1\nError:  'nosuchfunction' is undefined\nCode:  0\nURL:  http:\/\/bravo\/broken.htm/);
  assert.ok(!html().includes("second script"), "no more scripts");
  assert.equal(status(), "Done, but with errors on page.");
});

await test("document.cookie lands in Voyager's cookie jar", async () => {
  await go("bravo/cookie.htm");
  await wait(() => /cookie=flavour=oatmeal/.test(html()), "the cookie");
  assert.match(alpha.read("C:\\SYSTEM\\COOKIES.TXT"), /^BRAVO\|flavour\|oatmeal$/m);
});

await test("a page with SPARK for Voyager and JavaScript for IE", async () => {
  await go("bravo/both.htm");
  await wait(() => title() === "IE was here - Microsoft Internet Explorer", "the JavaScript");
  assert.equal(status(), "Done (this page's SPARK scripts are for Voyager)");
  assert.deepEqual(dialogs(), [], "Page_Load is not taken for JavaScript");
});

await test("prompt() asks in a window of its own", async () => {
  await go("bravo/prompt.htm");
  await wait(() => alpha.widgets(ie, "Window").some((w) => w.get("Title") === "Explorer User Prompt"), "the prompt");
  const box = alpha.widgets(ie, "TextBox").find((t) => t.get("Text") === "Bob");
  assert.ok(box, "the default answer is filled in");
  box.set("Text", "Ann");
  alpha.button(ie, "OK").call("Click");
  await wait(() => /Hi Ann!/.test(html()), "the answer used");
  await go("bravo/prompt.htm");
  await wait(() => alpha.button(ie, "Cancel"), "the prompt again");
  alpha.button(ie, "Cancel").call("Click");
  await wait(() => /You said nothing\./.test(html()), "Cancel gives null");
});

await test("meta refresh moves on", async () => {
  await go("bravo/move.htm");
  await loaded("Bravo's Place");
});

await test("a machine that is not there: IE's box, and the page stays", async () => {
  alpha.ui.answers.push(false);
  await go("http://nowhere/");
  await wait(() => alpha.ui.dialogs.length === 1, "the box");
  const d = dialogs()[0];
  assert.match(d.text, /^Internet Explorer cannot open the Internet site http:\/\/nowhere\/\.\n\n/);
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
  assert.match(alpha.read("C:\\SYSTEM\\IEXPLORE.INI"), /search=http:\/\/bravo\/sign.asp\?q=%s/);
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

await test("SimBook in Internet Explorer: join, post, and its SPARK counter left to Voyager", async () => {
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
  await submit(0, { text: "Browsing with Internet Explorer 3!" });
  await wait(() => /Browsing with Internet Explorer 3!/.test(html()), "the post in the feed");
  assert.deepEqual(dialogs(), []);
  assert.deepEqual(alpha.errors, []);
});

await test("ELIZA-95 in Internet Explorer: the answer types itself out in JavaScript", async () => {
  delta.write("C:\\MYFILES\\INSTALL.SPK", fs.readFileSync(path.join(root, "eliza/INSTALL.SPK"), "utf8"));
  const pid = delta.run("C:\\MYFILES\\INSTALL.SPK");
  await net.until(() => !delta.running(pid), 30000, "ELIZA's installer");
  delta.run("C:\\PROGRAMS\\HTTPD.SPK");
  await go("delta");
  await wait(() => /name="say"/.test(html()) && status().startsWith("Done"), "ELIZA");
  await submit(0, { say: "build me a website about modems" });
  await wait(() => /_$/.test(el("answer")?.Text || ""), "the answer typing itself out (in JavaScript, for IE)");
  await wait(() => /^Done\. \(\d+ tokens\)$/.test(status()), "the typing to finish");
  assert.match(el("answer").Text, /import website/);
  assert.deepEqual(dialogs(), []);
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
