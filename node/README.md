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

## npm

npm comes with Node. It gets packages from the network's registry,
`http://starthere/npm/` (see [`npmreg/`](../npmreg/)), and puts them in
`NODE_MOD`:

```
C:\MYFILES\APP> npm init -y
C:\MYFILES\APP> npm install express        (and what it needs)
C:\MYFILES\APP> npm install                (everything PACKAGE.JSN lists)
C:\MYFILES\APP> npm install -g cowsay      (for the whole machine, with its command)
C:\MYFILES\APP> cowsay hello
```

| Command | What it does |
|---|---|
| `npm install [pkg[@range]]` (`i`) | Packages into `NODE_MOD`, saved in `PACKAGE.JSN` (`-D` as dev, `--no-save`, `-g` for `C:\NODE\MODULES`) |
| `npm uninstall pkg`, `npm update`, `npm outdated`, `npm ls` | Take away, bring up to date, see what's old, see the tree |
| `npm search words`, `npm view pkg [field]` | Find packages, and read about one |
| `npm init [-y]`, `npm version patch` | Make a `PACKAGE.JSN`; move its version on |
| `npm adduser` (`login`), `whoami`, `logout` | An account on the registry |
| `npm publish`, `npm unpublish pkg@version` | Share the package in this folder |
| `npm run script`, `npm start`, `npm test` | The scripts in `PACKAGE.JSN` (a `node ...` one opens its own Node window) |
| `npm config set registry http://host/npm/` | Another registry (kept in `C:\NODE\NPMRC.TXT`) |

* **Ranges** are the usual ones: `^1.2.0`, `~1.2.0`, `1.x`, `>=1.0.0 <2.0.0`,
  `1.0.0 - 1.5.0`, `||`, `*` and `latest`.
* **Two versions of one package:** one goes at the top of `NODE_MOD`, and
  the other in the `NODE_MOD` of the package that needs it, as npm does.
* **Commands:** a global package's `bin` becomes a Sim Shell script in
  `C:\PROGRAMS` (`COWSAY.SH` runs `node C:\NODE\MODULES\COWSAY\CLI.JS`),
  so it works like any program.
* **How packages travel:** `npm publish` puts every file into one text
  bundle (`NPMPACK`). It cuts the bundle into parts of whole lines, 30K at
  most, so each fits in a network message, as Vapor does with its
  installers. It sends them one at a time, with a sum the installing machine
  checks. `NODE_MOD` and dot files are left out.
* `npm ... --verbose` shows where an error came from.

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
  `PACKAGE.JSN`. Package names are 1 to 8 of a-z, 0-9, `-` and `_`, since
  each is a folder. Paths are
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
* **It's slow:** an interpreter in an interpreter, roughly a millisecond a
  statement. Fine for servers, tools and games that wait for people; not for
  number crunching.
* **Not yet:** `async`/`await`, generators, regular expressions, getters and
  setters, `Buffer`, labelled `break`. These need the engine rewritten as a
  bytecode machine, which is the next big step, and which would lift the
  depth limit and speed it up too.

## How it's built

* `C:\PROGRAMS\NODE.SPK` is `src/NODEHOST.SPK` (the window, the event loop
  and the natives) joined to `simxplorer/src/JSCRIPT.SPK` (the engine).
* `C:\PROGRAMS\NPM.SPK` (`src/NPM.SPK`) starts Node with `lib/NPM.JS`, npm
  itself, which uses `lib/SEMVER.JS` for versions.
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

`node tools/aspsim/npm.test.mjs` sets up the registry and covers npm: search,
install with dependencies, `-g` commands, accounts, publishing in parts,
conflicting versions, updates, and an Express server.
