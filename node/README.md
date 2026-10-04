# Node.js for SIM95

JavaScript outside the browser, as Node does it, on SIM95. Programs run in
Node's own window, with `console`, `require`, and Node's core modules:
servers and clients on SIM95's network, the disk, timers, and lines typed in
the window.

```
C:\MYFILES> node -v
v0.2.0
C:\MYFILES> node hello.js
C:\MYFILES> node                  (Node's prompt)
```

From **Sim Shell**, `node` works in the shell's folder. Node can also be
started from Files: `C:\PROGRAMS\NODE.SPK`, with the program as its argument.

## A web server in JavaScript

```js
const http = require('http');
let hits = 0;
http.createServer((req, res) => {
  hits++;
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<h1>Hello from Node</h1><p>${req.url} - visit ${hits}</p>`);
}).listen(8080, () => console.log('Open http://' + require('os').hostname() + ':8080/ in Voyager'));
```

## What's there

* **The language:** the engine is Simxplorer's, improved for Node:
  * `let`/`const`, arrow functions, template strings, classes (`extends`,
    `super`, static members, fields);
  * destructuring, spread and rest, default parameters;
  * `?.` and `??`, and `for...of`;
  * Promises (`then`, `catch`, `finally`, `all`, `race`);
  * `JSON`, and the usual `Object`, `Array` and `String` methods.
* **Globals:**
  * `console`, `process` (`argv`, `env`, `exit`, `exitCode`, `cwd`,
    `nextTick`, `on('exit')`, `on('uncaughtException')`, `stdout.write`);
  * `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`;
  * `require`, `module`, `exports`, `__filename`, `__dirname`.
* **Modules** (in `C:\NODE\LIB`, as JavaScript you can read):
  `events`, `fs`, `path`, `http`, `net`, `readline`, `util`, `os`, `url`,
  `querystring`, `assert`, `timers`, `dns`, `child_process`.
* **`require`** finds:
  * your own files (`./lib/greet`, `.JS` and `.JSN` added);
  * packages in a `NODE_MOD` folder here or above;
  * packages in `C:\NODE\MODULES`, where npm installs them.
* **Errors:** an uncaught one stops the program and says where:

  ```
  TypeError: bad thing
      at C:\MYFILES\BAD.JS:2
  ```

* **The prompt:**
  * keeps your `let`s and functions between lines;
  * lines that open a bracket continue on the next (`...`);
  * `.help` and `.exit`.

## SIM95's ways

* **File names are 8.3:** `node_modules` is `NODE_MOD`, and `package.json` is
  `PACKAGE.JSN`. Package names are 8 characters at most. Paths are
  `C:\DIR\FILE.JS`, and `/` works too.
* **Files are text:** there's no `Buffer`. `fs` reads and writes strings.
* **The network carries whole messages:** each `socket.write()` is one
  message, and each `'data'` event is one. A message is at most 64K.
  * HTTP is SIM95's HTTP/1.0: one request a connection. A response goes out
    in one message, or in pieces cut at line breaks (Voyager joins them
    back).
  * Voyager, Simxplorer and Node's `http.get` can all talk to a Node server.
* **Other programs** have windows of their own. `child_process.spawn` starts
  one, but there's no output to collect.
* **The window stays open** when the program ends, so you can read what it
  printed. The status bar gives the exit code.

## Limits, for now

* **Calls nest 24 deep at most** (`RangeError`-like "Out of stack space").
  The engine runs JavaScript by walking it, inside SPARK, which has a small
  call stack of its own. Events, timers and callbacks start fresh, so
  ordinary programs fit, but deep recursion doesn't.
* **It's slow:** an interpreter in an interpreter. Fine for servers, tools
  and games that wait for people; not for number crunching.
* **Not yet:** `async`/`await`, generators, regular expressions, getters and
  setters, `Buffer`, labelled `break`. These need the engine rewritten as a
  bytecode machine, which is the next big step, and which would lift the
  depth limit and speed it up too.

## How it's built

* `C:\PROGRAMS\NODE.SPK` is `src/NODEHOST.SPK` (the window, the event loop
  and the natives) joined to `simxplorer/src/JSCRIPT.SPK` (the engine).
* `lib/BOOT.JS` runs first: it takes the browser's globals away, and makes
  `console`, `process` and `require`. The modules are the other `.JS` files
  in `lib/`.
* **Events:** every event (a timer, a connection, a message, a typed line)
  waits in a queue. One at a time, each is handed to JavaScript, and the
  promise callbacks run after it.
* **Waits:** JavaScript never waits. A connect, a name lookup or reading a
  line is a job, done outside it, whose result comes back as an event. SPARK
  lets other handlers in during a wait, which would otherwise interrupt
  JavaScript halfway through.
* **Connects** are made one at a time, each on a socket of its own; see
  `SIM95-NOTES.md` for why.

Tests: `node tools/aspsim/node.test.mjs` installs Node on two machines and
covers:
* `-v`, `-e`, and arguments;
* `require`, the event loop, `fs`;
* an HTTP server used the way Voyager does, and `http.get`;
* a `net` echo server and client;
* errors, the prompt, and `readline`.
