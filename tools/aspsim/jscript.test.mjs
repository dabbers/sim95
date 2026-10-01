// Tests for the browser's JavaScript engine (simxplorer/src/JSCRIPT.SPK), run on
// its own with a stand-in page (simxplorer/test/HOSTSTUB.SPK).
//   node tools/aspsim/jscript.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { machine } from "./sim.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok    " + name); }
  catch (e) { failures++; console.log("FAIL  " + name + "\n      " + (e.message || e).toString().split("\n").join("\n      ")); }
}

const engine = fs.readFileSync(path.join(root, "simxplorer/src/JSCRIPT.SPK"), "utf8") + "\n" + fs.readFileSync(path.join(root, "simxplorer/test/HOSTSTUB.SPK"), "utf8");
const main = `
SUB Main ()
    VAR n AS Integer
    VAR i AS Integer
    VAR src AS String
    VAR err AS String
    VAR line AS String
    n = Val(Input())
    FOR i = 1 TO n
        src = Input().Replace(Chr(1), Chr(10))
        hostLog.Clear()
        hostElems.Clear()
        hostElems.Add("name|Value|Bob")
        hostElems.Add("name|TagName|input")
        hostElems.Add("msg|Text|old")
        hostElems.Add("msg|TagName|span")
        JsReset()
        JsAddField(JsAddForm("f", 0), "name", "name")
        hostXhr.Clear()
        err = JsRun(src, 1)
        Answer()
        Print(err)
        Print(jsOut.Replace(Chr(10), Chr(1)))
        line = ""
        FOR EACH line IN hostLog
            Print("log:" + line.Replace(Chr(10), Chr(1)))
        NEXT
        Print("--end--")
    NEXT
END SUB

' Answers the page's requests, the way the browser reports them: readyState 2,
' 3 and 4. Hosts called nowhere fail (status 0); paths with "missing" are 404s.
SUB Answer ()
    VAR k AS Integer
    VAR p AS Array OF String
    VAR obj AS Integer
    VAR req AS Integer
    VAR e AS String
    VAR body AS String
    VAR st AS Integer
    VAR why AS String
    WHILE k < hostXhr.Count
        p = hostXhr[k].Split("|")
        req = Int(Val(p[0]))
        obj = Int(Val(p[1]))
        k = k + 1
        IF p[3].Contains("nowhere") THEN
            e = JsXhrUpdate(obj, req, 4, 0, "", "", "")
        ELSE
            st = 200
            why = "OK"
            IF p[3].Contains("missing") THEN
                st = 404
                why = "Not Found"
            END IF
            body = "reply to " + p[2] + " " + p[3] + " " + p[5]
            IF p[3].Contains(".json") THEN body = "{""n"": 42, ""list"": [1, 2], ""ok"": true}"
            e = JsXhrUpdate(obj, req, 2, st, why, "Content-Type: text/plain" + Chr(10) + "X-Echo: yes", "")
            IF e = "" THEN e = JsXhrUpdate(obj, req, 3, st, why, "Content-Type: text/plain" + Chr(10) + "X-Echo: yes", body)
            IF e = "" THEN e = JsXhrUpdate(obj, req, 4, st, why, "Content-Type: text/plain" + Chr(10) + "X-Echo: yes", body)
        END IF
        IF e <> "" THEN hostLog.Add("update:" + e)
    END WHILE
END SUB
`;
const m = await machine("ALPHA");

// Runs snippets in one go; each comes back as { err, out, log }.
async function js(...snippets) {
  const lines = await m.runScript(engine + main, { input: [String(snippets.length), ...snippets.map((s) => s.replace(/\n/g, "\x01"))] });
  const results = [];
  let i = 0;
  while (i < lines.length) {
    const r = { err: lines[i], out: lines[i + 1].replace(/\x01/g, "\n"), log: [] };
    i += 2;
    while (lines[i] !== "--end--") r.log.push(lines[i++].slice(4).replace(/\x01/g, "\n"));
    i++;
    results.push(r);
  }
  return results;
}
const out = async (src) => {
  const [r] = await js(src);
  assert.equal(r.err, "", src + "\n -> error " + r.err);
  return r.out;
};
const W = (expr) => `document.write(${expr})`;

await test("numbers print the way JavaScript prints them", async () => {
  const cases = [
    ["0.1 + 0.2", "0.30000000000000004"], ["1 / 3", "0.3333333333333333"], ["10 / 4", "2.5"], ["1 / 0", "Infinity"],
    ["-1 / 0", "-Infinity"], ["0 / 0", "NaN"], ["2 * 3", "6"], ["7 % 3", "1"], ["-7 % 3", "-1"], ["5.5 % 2", "1.5"],
    ["1e21", "1e+21"], ["123456789 * 1000", "123456789000"], ["0.000001", "0.000001"], ["1e-7", "1e-7"],
    ["'5' * '2'", "10"], ["'5' + 2", "52"], ["5 + 2 + '1'", "71"], ["'abc' * 1", "NaN"], ["+''", "0"],
    ["Math.round(2.5)", "3"], ["Math.round(-2.5)", "-2"], ["Math.max(1, 9, 3)", "9"], ["Math.floor(-1.5)", "-2"],
    ["(3.14159).toFixed(2)", "3.14"], ["(255).toString(16)", "ff"], ["parseInt('42px')", "42"], ["parseInt('ff', 16)", "255"],
    ["parseFloat('3.5e2xyz')", "350"], ["isNaN('x')", "true"], ["Math.PI", "3.141592653589793"], ["Math.pow(2, 10)", "1024"],
    ["Math.sqrt(2)", "1.4142135623730951"], ["2147483647 + 1", "2147483648"], ["9007199254740992", "9007199254740992"],
  ];
  const res = await js(...cases.map(([e]) => W(e)));
  const bad = cases.map(([e, want], i) => (res[i].out === want && !res[i].err ? null : `${e}: wanted ${want}, got ${res[i].out} ${res[i].err}`)).filter(Boolean);
  assert.deepEqual(bad, []);
});

await test("comparisons, typeof and truthiness", async () => {
  const cases = [
    ["1 == '1'", "true"], ["1 === '1'", "false"], ["null == undefined", "true"], ["null === undefined", "false"],
    ["NaN == NaN", "false"], ["'b' > 'a'", "true"], ["'10' < '9'", "true"], ["10 < '9'", "false"], ["typeof null", "object"],
    ["typeof x", "undefined"], ["typeof function(){}", "function"], ["typeof [1]", "object"], ["typeof 'a'", "string"],
    ["!!''", "false"], ["!!'0'", "true"], ["!!0", "false"], ["!![]", "true"], ["0 || 'yes'", "yes"], ["1 && 'two'", "two"],
    ["true + 1", "2"], ["[] + []", ""], ["[1,2] + ''", "1,2"], ["({}) + ''", "[object Object]"], ["null + 1", "1"], ["undefined + 1", "NaN"],
    ["1 ? 'a' : 'b'", "a"], ["'x' in {x: 1}", "true"], ["[] instanceof Array", "true"],
  ];
  const res = await js(...cases.map(([e]) => W(e)));
  const bad = cases.map(([e, want], i) => (res[i].out === want && !res[i].err ? null : `${e}: wanted ${want}, got ${res[i].out} ${res[i].err}`)).filter(Boolean);
  assert.deepEqual(bad, []);
});

await test("functions, closures, recursion and this", async () => {
  assert.equal(await out(`
function counter() { var n = 0; return function () { n++; return n; }; }
var a = counter(), b = counter();
a(); a();
document.write(a() + ',' + b());`), "3,1");
  assert.equal(await out(`function fact(n) { return n <= 1 ? 1 : n * fact(n - 1); } document.write(fact(10));`), "3628800");
  assert.equal(await out(`document.write(twice(4)); function twice(x) { return x * 2; }`), "8", "functions are hoisted");
  assert.equal(await out(`
function Dog(name) { this.name = name; }
Dog.prototype.speak = function () { return this.name + ' says woof'; };
var d = new Dog('Rex');
document.write(d.speak() + '|' + (d instanceof Dog));`), "Rex says woof|true");
  assert.equal(await out(`var fns = []; for (var i = 0; i < 3; i++) fns[i] = function () { return i; }; document.write(fns[0]());`), "3", "var is function-scoped");
  assert.equal(await out(`function f() { return arguments.length + ':' + arguments[1]; } document.write(f('a', 'b', 'c'));`), "3:b");
  assert.equal(await out(`var o = { n: 5, get: function () { return this.n; } }; document.write(o.get());`), "5");
  assert.equal(await out(`var add = function (a, b) { return a + b; }; document.write(add.call(null, 2, 3) + add.apply(null, [4, 5]));`), "14");
});

await test("statements: loops, switch, for-in, labels of break and continue", async () => {
  assert.equal(await out(`var s = ''; for (var i = 0; i < 10; i++) { if (i == 2) continue; if (i == 5) break; s += i; } document.write(s);`), "0134");
  assert.equal(await out(`var i = 0, s = ''; while (i < 3) s += i++; do { s += 'x'; } while (false); document.write(s);`), "012x");
  assert.equal(await out(`
function name(n) { switch (n) { case 1: return 'one'; case 2: case 3: return 'few'; default: return 'many'; } }
var s = ''; switch (2) { case 1: s += 'a'; case 2: s += 'b'; case 3: s += 'c'; break; case 4: s += 'd'; }
document.write(name(1) + name(3) + name(9) + s);`), "onefewmanybc");
  assert.equal(await out(`var o = {a: 1, b: 2, c: 3}, k = ''; for (var p in o) k += p + o[p]; document.write(k);`), "a1b2c3");
  assert.equal(await out(`var a = [5, 6]; var k = ''; for (var i in a) k += i; document.write(k);`), "01");
});

await test("strings and their methods", async () => {
  for (const e of ["'a,b,,c'.split(',').length", "'abc'.split('').join('-')", "'Hello'.substr(1, 2)", "'abc'.charCodeAt(0)", "String.fromCharCode(72, 105)"]) {
    const [r] = await js(W(e));
    assert.equal(r.err, "", e);
  }
  assert.equal(await out(W(`'Hello'.length + 'Hello'.charAt(1) + 'Hello'.indexOf('l') + 'Hello'.lastIndexOf('l') + 'Hello'.substring(1, 3) + 'Hello'.toUpperCase()`)), "5e23elHELLO");
  assert.equal(await out(W(`'a,b,,c'.split(',').length + '|' + 'abc'.split('').join('-') + '|' + 'Hello'.substr(1, 2) + '|' + 'abc'.charCodeAt(0) + String.fromCharCode(72, 105)`)), "4|a-b-c|el|97Hi");
  assert.equal(await out(W(`'hi'.bold() + 'x'.link('a.htm') + 'big'.fontcolor('red')`)), '<B>hi</B><A HREF="a.htm">x</A><FONT COLOR="red">big</FONT>');
  assert.equal(await out(W(`escape('a b&c') + ' ' + unescape('%41%20')`)), "a%20b%26c A ");
  assert.equal(await out(W(`'  pad '.slice(-4) + '"' + 'tab\\there' + "'" + '\\u0041'`)), `pad "tab\there'A`);
});

await test("arrays and their methods", async () => {
  assert.equal(await out(`var a = [3, 1, 2]; a.push(10); a.sort(); document.write(a.join(' '));`), "1 10 2 3", "sorts as text");
  assert.equal(await out(`var a = [3, 1, 20]; a.sort(function (x, y) { return x - y; }); document.write(a + '|' + a.reverse());`), "1,3,20|20,3,1");
  assert.equal(await out(`var a = [1, 2, 3]; var x = a.pop(), y = a.shift(); a.unshift(0); document.write(x + y + '|' + a + '|' + a.length);`), "4|0,2|2");
  assert.equal(await out(`var a = [1, 2, 3, 4]; document.write(a.slice(1, 3) + '|' + a.concat([5], 6) + '|' + a.splice(1, 2) + '|' + a);`), "2,3|1,2,3,4,5,6|2,3|1,4");
  assert.equal(await out(`var a = new Array(3); a[5] = 'x'; document.write(a.length + '|' + a.indexOf('x') + '|' + new Array(1, 2));`), "6|5|1,2");
  assert.equal(await out(`var a = []; a.length = 0; a[a.length] = 'q'; var m = [[1, 2], [3, 4]]; document.write(a + m[1][0]);`), "q3");
});

await test("dates", async () => {
  assert.equal(await out(`var d = new Date(1996, 6, 4, 13, 5, 9); document.write(d.getFullYear() + '/' + d.getMonth() + '/' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds() + ' day ' + d.getDay());`), "1996/6/4 13:5:9 day 4");
  assert.equal(await out(`var d = new Date(1996, 0, 31); d.setDate(d.getDate() + 1); document.write(d.getMonth() + '/' + d.getDate());`), "1/1");
  assert.equal(await out(`var a = new Date(2000, 0, 1), b = new Date(2000, 0, 2); document.write((b - a) / 1000 / 60 / 60);`), "24");
  assert.match(await out(`document.write(new Date().getFullYear())`), /^20\d\d$/);
  assert.match(await out(`document.write(new Date(1996, 6, 4))`), /^Thu Jul 0?4 00:00:00 .*1996$/);
  assert.equal(await out(`document.write(isNaN(new Date('bogus').getTime()))`), "true");
});

await test("errors look like Simxplorer's, and try/catch catches them", async () => {
  const [a, b, c, d, e, f] = await js("var x = 1;\nfoo();", "var o = null;\n\no.x = 1;", "var o = {};\no.nope();", "var x = 5;\nx();", "var x = (1;", "function f() { f(); }\nf();");
  assert.equal(a.err, "2|'foo' is undefined");
  assert.equal(b.err, "3|'o' is null or not an object");
  assert.equal(c.err, "2|Object doesn't support this property or method");
  assert.equal(d.err, "2|Function expected");
  assert.equal(e.err, "1|Expected ')'");
  assert.equal(f.err, "1|Out of stack space");
  assert.equal(await out(`try { nope(); } catch (e) { document.write(e.message + '|' + e.description); }`), "'nope' is undefined|'nope' is undefined");
  assert.equal(await out(`try { throw 'boom'; } catch (e) { document.write(e); } finally { document.write('!'); }`), "boom!");
  assert.equal(await out(`function f() { try { return 1; } finally { document.write('f'); } } document.write(f());`), "f1");
  const [g] = await js("throw new Error('custom');");
  assert.equal(g.err, "1|Exception thrown and not caught: custom");
});

await test("eval, and the page: forms, elements, alerts, location, cookies, timers", async () => {
  assert.equal(await out(`var x = 2; document.write(eval('x * 21') + eval('var y = 1; y + 1'))`), "44");
  let [r] = await js(`alert('Hi ' + document.forms[0].name.value); document.f.name.value = 'Ann'; var ok = confirm('Sure?'); var who = prompt('Name?', ''); window.status = 'ready';`);
  assert.equal(r.err, "");
  assert.deepEqual(r.log, ["alert:Hi Bob", "set:name.Value=Ann", "confirm:Sure?", "prompt:Name?", "status:ready"]);
  [r] = await js(`var m = document.getElementById('msg'); m.innerText = m.innerText + ' and new'; m.style.display = 'none'; document.write(document.getElementById('nothing'));`);
  assert.equal(r.err, "");
  assert.equal(r.out, "null");
  assert.deepEqual(r.log, ["set:msg.Text=old and new", "set:msg.Visible=False"]);
  assert.equal(await out(W(`location.hostname + '|' + location.pathname + '|' + location.search + '|' + location.hash + '|' + location.href`)), "bravo|/games/index.htm|?level=2|#top|http://bravo/games/index.htm?level=2#top");
  [r] = await js(`document.cookie = 'a=1; expires=never'; document.cookie = 'b=2'; document.write(document.cookie); document.title = 'Games';`);
  assert.equal(r.out, "a=1; b=2");
  [r] = await js(`var t = setTimeout('go()', 500); var i = setInterval(function () {}, 1000); clearTimeout(t); location.href = 'next.htm'; history.back(); window.open('pop.htm');`);
  assert.equal(r.err, "");
  assert.deepEqual(r.log, ["timeout:go():500:False", "timeout::1000:True", "cleartimeout:7", "navigate:next.htm", "history:-1", "open:pop.htm"]);
  assert.equal(await out(W(`navigator.appName + ' ' + (navigator.userAgent.indexOf('Simxplorer') > 0) + ' ' + typeof window + ' ' + (window.document == document)`)), "Simxplorer true object true");
});

await test("XMLHttpRequest: open, send, readyState 1 to 4, headers, and the answer", async () => {
  const [r] = await js(`
var x = new XMLHttpRequest(), seen = [];
x.onreadystatechange = function () { seen.push(this.readyState + ':' + x.status); if (x.readyState == 4) document.write(seen.join(' ') + '|' + x.responseText + '|' + x.statusText + '|' + x.getResponseHeader('x-echo') + '|' + x.getResponseHeader('Nope') + '|' + x.getAllResponseHeaders().split('\\r\\n').length); };
x.onload = function () { document.write('|loaded'); };
x.open('post', 'save.asp', true);
x.setRequestHeader('X-Thing', 'one');
x.send('a=1&b=2');
document.write('sent ' + x.readyState + '|');`);
  assert.equal(r.err, "");
  assert.deepEqual(r.log, ["xhr:POST save.asp [X-Thing: one;] a=1&b=2"]);
  assert.equal(r.out, "sent 1|1:0 2:200 3:200 4:200|reply to POST save.asp a=1&b=2|OK|yes|null|3|loaded");
});

await test("XMLHttpRequest: 404, a failed request is status 0, and several at once", async () => {
  let [r] = await js(`
var a = new XMLHttpRequest(), b = new XMLHttpRequest(), c = new XMLHttpRequest();
function done(name, x) { return function () { if (x.readyState == 4) document.write(name + '=' + x.status + ' '); }; }
a.onreadystatechange = done('a', a); b.onreadystatechange = done('b', b); c.onreadystatechange = done('c', c);
c.onerror = function () { document.write('c failed '); };
a.open('GET', 'one.txt'); b.open('GET', 'missing.txt'); c.open('GET', 'http://nowhere/x.txt');
a.send(); b.send(null); c.send();`);
  assert.equal(r.err, "");
  assert.equal(r.out, "a=200 b=404 c=0 c failed ");
  assert.equal(r.log.filter((l) => l.startsWith("xhr:")).length, 3);
  [r] = await js(`var x = new XMLHttpRequest(); x.open('GET', 'a.txt', false);`);
  assert.match(r.err, /^1\|Simxplorer cannot wait for the network/);
  [r] = await js(`var x = new XMLHttpRequest(); x.onreadystatechange = function () { document.write(x.readyState); }; x.open('GET', 'a.txt'); x.send(); x.abort(); document.write('/' + x.readyState);`);
  assert.equal(r.out, "1/0", "an aborted request says nothing more");
  assert.deepEqual(r.log, ["xhr:GET a.txt [] ", "xhrabort:1"]);
  [r] = await js(`var x = new XMLHttpRequest(); x.send();`);
  assert.equal(r.err, "1|Unspecified error", "send before open");
});

await test("ActiveXObject makes IE's XMLHTTP, and nothing else", async () => {
  const [a, b, c] = await js(
    `var x = new ActiveXObject("Microsoft.XMLHTTP"); x.onreadystatechange = function () { if (x.readyState == 4) document.write(x.responseText); }; x.open("GET", "ie.txt", true); x.send();`,
    `var y = new ActiveXObject("Msxml2.XMLHTTP"); document.write(typeof y.send);`,
    `try { new ActiveXObject("Excel.Application"); } catch (e) { document.write(e.message); } var z = new ActiveXObject("Word.Document");`);
  assert.equal(a.out, "reply to GET ie.txt ");
  assert.equal(b.out, "function");
  assert.equal(c.out, "Automation server can't create object");
  assert.equal(c.err, "1|Automation server can't create object");
});

await test("fetch() with then, chaining, arrow functions, json and catch", async () => {
  const [a, b, c] = await js(
    `fetch('news.txt').then(r => r.text()).then(t => document.write(t + '!'));`,
    `fetch('data.json').then(function (r) { document.write(r.status + ' ' + r.ok + ' ' + r.headers.get('X-Echo') + ' '); return r.json(); }).then(function (d) { document.write(d.n + d.list[1]); });`,
    `fetch('http://nowhere/').then(function () { document.write('no'); }).catch(function (e) { document.write('caught: ' + e.message); });
     fetch('save.asp', {method: 'POST', body: 'x=1', headers: {'X-Y': 'z'}}).then(function () { throw new Error('inside'); }).then(null, function (e) { document.write(' and ' + e.message); });`);
  assert.equal(a.err, "");
  assert.equal(a.out, "reply to GET news.txt !");
  assert.equal(b.out, "200 true yes 44");
  assert.equal(c.out, "caught: Failed to fetch http://nowhere/ and inside");
  assert.ok(c.log.includes("xhr:POST save.asp [X-Y: z;] x=1"), c.log.join("\n"));
  assert.equal(await out(`var o = { n: 3, f: function () { var g = () => this.n * 2; return g(); } }; var add = (a, b) => a + b; document.write('' + o.f() + add(1, 2) + [1, 2].length);`), "632");
});

await test("browser detection: navigator and document.all", async () => {
  assert.equal(await out(W(`navigator.appName + '|' + navigator.appCodeName + '|' + navigator.appVersion + '|' + navigator.userAgent + '|' + navigator.platform`)),
    "Simxplorer|Mozilla|2.0 (compatible; Simxplorer 3.02; SIM95)|Mozilla/2.0 (compatible; Simxplorer 3.02; SIM95)|SIM95");
  assert.equal(await out(`if (document.all) document.write(document.all.msg.innerText + ' ' + document.all['name'].value + ' ' + document.all.item('msg').tagName + ' ' + document.all.nothing + ' ' + document.all.item('nothing'));`), "old Bob span undefined null");
  assert.equal(await out(W(`typeof XMLHttpRequest + ' ' + (window.ActiveXObject ? 'ie' : 'other')`)), "function ie");
});

await test("a runaway script asks whether to stop", async () => {
  const [r] = await js("var i = 0; while (true) i++;");
  assert.equal(r.err.split("|")[1], "@aborted");
  assert.ok(r.log.includes("slow"));
});

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
