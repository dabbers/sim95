// Tests for Node for SIM95 (node/): the node command, require and the core
// modules, servers and clients on SIM95's network, errors, the prompt, and
// readline. Each program runs in Node's own window; what it prints is read
// from the window's console.
//   node tools/aspsim/node.test.mjs
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const net = new Network();
const wait = (fn, what, ms = 20000) => net.until(fn, ms, what);
const alpha = await net.boot("ALPHA");
const bravo = await net.boot("BRAVO");

async function install(m) {
  m.write("C:\\MYFILES\\INSTALL.SPK", fs.readFileSync(path.join(root, "node/INSTALL.SPK"), "utf8"));
  const pid = m.run("C:\\MYFILES\\INSTALL.SPK");
  await wait(() => !m.running(pid), "the installer", 90000);
  return m.output(pid);
}

// node, as Sim Shell starts it: --cwd first
function node(m, ...args) {
  const pid = m.run("C:\\PROGRAMS\\NODE.SPK", ["--cwd=C:\\MYFILES", ...args]);
  const w = {
    pid,
    win: () => m.widgets(pid, "Window")[0],
    con: () => m.widgets(pid, "Console")[0],
    text: () => w.con()?.text ?? "",
    status: () => String(w.win()?.get("Status") ?? ""),
    finished: () => /^Finished/.test(w.status()),
    async done(ms = 30000) {
      await wait(() => w.finished(), "the program to finish: " + w.text(), ms);
      return w.text();
    },
    async type(line) {
      await wait(() => w.con()?.reading, "the window to want a line: " + w.text());
      w.con().typeLine(line);
      await sleep(100);
    },
  };
  return w;
}

await test("installing: NODE.SPK, the modules in C:\\NODE\\LIB, and C:\\NODE\\MODULES", async () => {
  const installer = fs.readFileSync(path.join(root, "node/INSTALL.SPK"), "utf8");
  assert.match(installer, /^' VAPOR\|id=NODE\|name=Node\.js for SIM95\|kind=program\|version=[0-9a-f]{8}\|category=Programming\|run=C:\\PROGRAMS\\NODE\.SPK\|/);
  assert.match(await install(alpha), /Node is installed/);
  await install(bravo);
  for (const f of ["BOOT", "EVENTS", "FS", "HTTP", "NET", "PATH", "UTIL", "OS", "READLINE", "URL", "QUERYSTR", "ASSERT", "TIMERS", "DNS", "CHILDPRO"]) assert.ok(alpha.exists("C:\\NODE\\LIB\\" + f + ".JS"), f);
  assert.ok(alpha.exists("C:\\NODE\\MODULES"));
  assert.deepEqual(alpha.ui.dialogs, []);
});

await test("node -v, node -e, and a program's output, arguments and exit code", async () => {
  assert.equal(await node(alpha, "-v").done(), "v0.2.0\n");
  assert.equal(await node(alpha, "-e", "console.log(1", "+", "1,", "[1,", "2],", "{a:", "'x'},", "'%s=%d',", "'n',", "5)").done(), "2 [ 1, 2 ] { a: 'x' } %s=%d n 5\n");
  assert.equal(await node(alpha, "-e", "console.log('%s=%d', 'n', 5, 'more')").done(), "n=5 more\n");
  alpha.write("C:\\MYFILES\\ARGS.JS", "console.log(process.argv.slice(2).join('+'), process.cwd(), process.platform);\nprocess.exitCode = 3;\n");
  const w = node(alpha, "args.js", "one", "two");
  assert.equal(await w.done(), "one+two C:\\MYFILES sim95\n");
  assert.match(w.status(), /exit code 3/);
  assert.match(w.win().get("Title"), /^Node - ARGS\.JS/);
});

await test("require: your own files, JSON, packages in NODE_MOD and C:\\NODE\\MODULES, and the core modules", async () => {
  for (const d of ["C:\\MYFILES\\LIB", "C:\\MYFILES\\NODE_MOD", "C:\\MYFILES\\NODE_MOD\\SHOUT", "C:\\NODE\\MODULES\\PAD"]) alpha.mkdir(d);
  alpha.write("C:\\MYFILES\\LIB\\GREET.JS", "module.exports = (n) => `hi ${n}`;\n");
  alpha.write("C:\\MYFILES\\LIB\\DATA.JSN", '{"answer": 42}');
  alpha.write("C:\\MYFILES\\NODE_MOD\\SHOUT\\PACKAGE.JSN", '{"name": "shout", "main": "MAIN.JS"}');
  alpha.write("C:\\MYFILES\\NODE_MOD\\SHOUT\\MAIN.JS", "exports.shout = (s) => s.toUpperCase() + '!';\n");
  alpha.write("C:\\NODE\\MODULES\\PAD\\INDEX.JS", "module.exports = (s, n) => String(s).padStart(n, '.');\n");
  alpha.write("C:\\MYFILES\\REQ.JS", `
const greet = require('./lib/greet');
const data = require('./LIB/DATA.JSN');
const { shout } = require('shout');
const pad = require('pad');
const path = require('node:path'), util = require('util'), os = require('os'), qs = require('querystring'), url = require('url');
console.log(greet('Al'), data.answer, shout('hey'), pad(7, 3));
console.log(path.join('C:\\\\A\\\\B', '..', 'c.txt'), path.basename('C:\\\\X\\\\Y.JS', '.JS'), path.extname('a.txt'), path.resolve('x'));
console.log(util.format('%s:%d:%j', 'a', 2, {b: 1}), os.platform(), qs.stringify({a: 1, b: 'x y'}), url.parse('http://h:81/p?q=1').port);
console.log(require.resolve('pad'), require('./lib/greet') === greet);
try { require('nothing-here'); } catch (e) { console.log(e.code, e.message); }
`);
  assert.equal(await node(alpha, "req.js").done(), [
    "hi Al 42 HEY! ..7",
    "C:\\A\\c.txt Y .txt C:\\MYFILES\\x",
    'a:2:{"b":1} sim95 a=1&b=x%20y 81',
    "C:\\NODE\\MODULES\\PAD\\INDEX.JS true",
    "MODULE_NOT_FOUND Cannot find module 'nothing-here'",
    "",
  ].join("\n"));
});

await test("the event loop: timers, promises after the code, events, and the end when nothing's left", async () => {
  alpha.write("C:\\MYFILES\\LOOP.JS", `
const EventEmitter = require('events');
class Bell extends EventEmitter { ring(n) { this.emit('ring', n); } }
const bell = new Bell(), out = [];
bell.on('ring', (n) => out.push('ring' + n));
bell.once('ring', () => out.push('once'));
bell.ring(1); bell.ring(2);
setTimeout(() => out.push('timeout'), 30);
const iv = setInterval(() => { out.push('tick'); if (out.filter((x) => x === 'tick').length === 2) clearInterval(iv); }, 10);
setImmediate(() => out.push('immediate'));
process.nextTick(() => out.push('nextTick'));
Promise.resolve().then(() => out.push('promise'));
out.push('sync');
process.on('exit', (code) => console.log(out.join(' '), 'exit', code));
setTimeout(() => process.exit(0), 200);
`);
  assert.equal(await node(alpha, "loop.js").done(), "ring1 once ring2 sync nextTick promise immediate tick tick timeout exit 0\n");
});

await test("fs: write, read, append, list, stat, mkdir, rename, delete, and errors", async () => {
  alpha.write("C:\\MYFILES\\FILES.JS", `
const fs = require('fs');
fs.mkdirSync('C:\\\\MYFILES\\\\OUT\\\\DEEP', { recursive: true });
fs.writeFileSync('OUT\\\\A.TXT', 'one');
fs.appendFileSync('OUT\\\\A.TXT', ' two');
console.log(fs.readFileSync('OUT\\\\A.TXT', 'utf8'), fs.statSync('OUT\\\\A.TXT').size, fs.statSync('OUT').isDirectory());
fs.renameSync('OUT\\\\A.TXT', 'OUT\\\\B.TXT');
console.log(fs.readdirSync('OUT').join(','), fs.existsSync('OUT\\\\A.TXT'));
try { fs.readFileSync('NONE.TXT'); } catch (e) { console.log(e.code, e.message); }
fs.readFile('OUT\\\\B.TXT', 'utf8', (err, t) => console.log('callback', err, t));
fs.promises.readFile('NONE.TXT').catch((e) => console.log('promise', e.code));
fs.rmSync('OUT', { recursive: true });
console.log(fs.existsSync('OUT'));
`);
  assert.equal(await node(alpha, "files.js").done(), [
    "one two 7 true", "B.TXT,DEEP false",
    "ENOENT ENOENT: no such file or directory, open 'C:\\MYFILES\\NONE.TXT'", "false", "promise ENOENT", "callback null one two", "",
  ].join("\n"));
});

await test("http: a server Voyager can use, and http.get from another machine's web server", async () => {
  bravo.write("C:\\WEB\\HELLO.HTM", "<html>hello from BRAVO</html>");
  bravo.run("C:\\PROGRAMS\\HTTPD.SPK");
  await wait(async () => /200 OK/.test(await bravo.fetch("BRAVO", "/hello.htm").catch(() => "")), "BRAVO's web server");
  alpha.write("C:\\MYFILES\\WEB.JS", `
const http = require('http');
let hits = 0;
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => body += d);
  req.on('end', () => {
    hits++;
    if (hits === 3) server.close(() => console.log('closed'));
    if (req.url === '/missing') { res.statusCode = 404; res.end('no such page'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write('<h1>' + req.method + ' ' + req.url + '</h1>');
    res.end('<p>' + (req.headers['user-agent'] || '') + '|' + body + '</p>');
  });
});
server.listen(8080, () => console.log('listening'));
http.get('http://bravo/hello.htm', (res) => {
  let t = '';
  res.on('data', (c) => t += c);
  res.on('end', () => console.log(res.statusCode, res.headers['content-type'], t));
});
`);
  const w = node(alpha, "web.js");
  await wait(() => /listening/.test(w.text()), "listening: " + w.text());
  const get = async (req) => {
    const c = await bravo.stack.connect(0, "ALPHA", 8080);
    const parts = [];
    const closed = new Promise((r) => c.onClose(r));
    c.onMessage((t) => parts.push(t));
    c.send(req);
    await Promise.race([closed, sleep(8000)]);
    return parts.join("\n");
  };
  assert.equal(await get("GET /x?y=1 HTTP/1.0\nHost: alpha\nUser-Agent: Voyager/1.1 (SIM95)"),
    "HTTP/1.0 200 OK\nContent-Type: text/html\nContent-Length: 46\nServer: Node/v0.2.0 (SIM95)\n\n<h1>GET /x?y=1</h1><p>Voyager/1.1 (SIM95)|</p>");
  assert.match(await get("POST /form HTTP/1.0\nHost: alpha\nContent-Type: application/x-www-form-urlencoded\nContent-Length: 7\n\nname=Al"), /\n\n<h1>POST \/form<\/h1><p>\|name=Al<\/p>$/);
  assert.match(await get("GET /missing HTTP/1.0\nHost: alpha"), /^HTTP\/1\.0 404 Not Found\n[\s\S]*\n\nno such page$/);
  assert.equal(await w.done(), "listening\n200 text/html <html>hello from BRAVO</html>\nclosed\n");
});

await test("net: an echo server and a client, on two machines", async () => {
  bravo.write("C:\\MYFILES\\ECHO.JS", `
const net = require('net');
const server = net.createServer((sock) => {
  sock.on('data', (m) => { if (m === 'bye') { sock.end('see you'); server.close(); } else sock.write('echo: ' + m); });
});
server.listen(7007, () => console.log('echo server up'));
`);
  const srv = node(bravo, "echo.js");
  await wait(() => /echo server up/.test(srv.text()), "the echo server");
  alpha.write("C:\\MYFILES\\CLIENT.JS", `
const net = require('net');
const got = [];
const c = net.connect(7007, 'bravo', () => { c.write('hello'); c.write('again'); });
c.on('data', (m) => { got.push(m); if (got.length === 2) c.write('bye'); });
c.on('close', () => console.log(got.join(' | ')));
const bad = net.connect(7999, 'bravo');
bad.on('error', (e) => console.log('error', e.code));
`);
  assert.equal(await node(alpha, "client.js").done(), "error ECONNREFUSED\necho: hello | echo: again | see you\n");
  await srv.done();
});

await test("errors: an uncaught one stops the program with where it was; process.on('uncaughtException')", async () => {
  alpha.write("C:\\MYFILES\\BAD.JS", "function f() { return g(); }\nfunction g() { throw new TypeError('bad thing'); }\nconsole.log('before');\nf();\nconsole.log('never');\n");
  const w = node(alpha, "bad.js");
  assert.equal(await w.done(), "before\n\nTypeError: bad thing\n    at C:\\MYFILES\\BAD.JS:2\n");
  assert.match(w.status(), /exit code 1/);
  alpha.write("C:\\MYFILES\\SYNTAX.JS", "console.log('a'\n");
  assert.equal(await node(alpha, "syntax.js").done(), "\nC:\\MYFILES\\SYNTAX.JS:3\n\nSyntaxError: Expected ','\n");
  alpha.write("C:\\MYFILES\\CAUGHT.JS", "process.on('uncaughtException', (e) => console.log('caught', e.message));\nsetTimeout(() => { throw new Error('later'); }, 10);\n");
  assert.equal(await node(alpha, "caught.js").done(), "caught later\n");
  assert.match(await node(alpha, "nofile.js").done(), /Cannot find module/);
});

await test("the prompt: expressions, declarations kept, lines that continue, require, errors and .exit", async () => {
  const w = node(alpha);
  for (const line of ["1 + 2", "let x = [1, 2, 3]", "x.map(n => n * n)", "function sq(n) {", "  return n * n", "}", "sq(9)", "require('path').sep", "nope()", ".exit"]) await w.type(line);
  assert.equal(await w.done(), [
    "Welcome to Node.js v0.2.0 on SIM95.", 'Type ".help" for more information.',
    "> 1 + 2", "3", "> let x = [1, 2, 3]", "undefined", "> x.map(n => n * n)", "[ 1, 4, 9 ]",
    "> function sq(n) {", "...   return n * n", "... }", "undefined", "> sq(9)", "81",
    "> require('path').sep", "'\\\\'", "> nope()", "Uncaught Error: 'nope' is undefined", "    at REPL:1", "> .exit", "",
  ].join("\n"));
});

await test("readline: question and answer, and lines until close", async () => {
  alpha.write("C:\\MYFILES\\ASK.JS", `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Name? ', (name) => {
  console.log('Hello, ' + name + '!');
  let total = 0;
  rl.on('line', (line) => {
    if (line === 'done') { rl.close(); return; }
    total += Number(line);
  });
  rl.on('close', () => console.log('total', total));
});
`);
  const w = node(alpha, "ask.js");
  for (const line of ["Ann", "2", "40", "done"]) await w.type(line);
  assert.equal(await w.done(), "Name? Ann\nHello, Ann!\n2\n40\ndone\ntotal 42\n");
});

net.shutdown();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
