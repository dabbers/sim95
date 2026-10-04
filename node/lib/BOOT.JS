// BOOT.JS - Node for SIM95: what runs first. It turns the browser's
// JavaScript engine into Node's: no window or document, but console,
// process, require, and the core modules in C:\NODE\LIB (FS.JS, HTTP.JS...).
// The SPARK half (NODE.SPK) hands every event to __dispatch below, and its
// natives are on __node.

var global = this;
global.global = global;
global.globalThis = global;
(function () {
  var browser = ["window", "self", "top", "parent", "document", "navigator", "screen", "history", "alert", "confirm",
    "prompt", "open", "XMLHttpRequest", "ActiveXObject", "fetch", "close", "focus", "blur", "scroll"];
  for (var i = 0; i < browser.length; i++) delete global[browser[i]];
})();

var __n = __node;
delete global.__node;

// ---------------------------------------------------------------- inspect

function __inspect(v, depth, seen) {
  if (depth === undefined) depth = 2;
  seen = seen || [];
  var t = typeof v;
  if (v === null) return "null";
  if (t === "undefined") return "undefined";
  if (t === "string") return seen.length ? "'" + v.split("\\").join("\\\\").split("'").join("\\'").split("\n").join("\\n") + "'" : v;
  if (t === "number" || t === "boolean") return String(v);
  if (t === "function") return v.name ? "[Function: " + v.name + "]" : "[Function (anonymous)]";
  if (v instanceof Error) return v.stack || (v.name + ": " + v.message);
  if (seen.indexOf(v) >= 0) return "[Circular]";
  var inner = seen.concat([v]);
  if (Array.isArray(v)) {
    if (depth < 0) return "[Array]";
    if (v.length === 0) return "[]";
    var items = v.map(function (x) { return __inspect(x, depth - 1, inner); });
    var flat = "[ " + items.join(", ") + " ]";
    return flat.length <= 72 ? flat : "[\n" + items.map(function (s) { return "  " + s.split("\n").join("\n  "); }).join(",\n") + "\n]";
  }
  if (depth < 0) return "[Object]";
  var keys = Object.keys(v);
  var name = v.constructor && v.constructor !== Object && v.constructor.name ? v.constructor.name + " " : "";
  if (keys.length === 0) return name + "{}";
  var parts = keys.map(function (k) {
    var key = /*plain names bare*/ __plainKey(k) ? k : "'" + k + "'";
    return key + ": " + __inspect(v[k], depth - 1, inner);
  });
  var one = name + "{ " + parts.join(", ") + " }";
  return one.length <= 72 ? one : name + "{\n" + parts.map(function (s) { return "  " + s.split("\n").join("\n  "); }).join(",\n") + "\n}";
}

function __plainKey(k) {
  if (k === "") return false;
  for (var i = 0; i < k.length; i++) {
    var c = k.charAt(i);
    var ok = (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || c === "$" || (i > 0 && c >= "0" && c <= "9");
    if (!ok) return false;
  }
  return true;
}

// util.format: %s %d %i %f %j %o %O %%, then the rest inspected
function __format() {
  var args = Array.prototype.slice.call(arguments);
  if (typeof args[0] !== "string") return args.map(function (a) { return __inspect(a); }).join(" ");
  var f = args.shift(), out = "", i = 0;
  while (i < f.length) {
    var c = f.charAt(i);
    if (c === "%" && i + 1 < f.length) {
      var k = f.charAt(i + 1);
      if (k === "%") { out += "%"; i += 2; continue; }
      if ("sdifjoOc".indexOf(k) >= 0) {
        if (k === "c") { args.shift(); i += 2; continue; }
        if (args.length === 0) { out += c + k; i += 2; continue; }
        var a = args.shift();
        if (k === "s") out += typeof a === "string" ? a : __inspect(a, 1);
        else if (k === "d" || k === "i") out += k === "i" ? String(parseInt(a)) : String(Number(a));
        else if (k === "f") out += String(parseFloat(a));
        else if (k === "j") out += JSON.stringify(a);
        else out += __inspect(a, 4);
        i += 2;
        continue;
      }
    }
    out += c;
    i++;
  }
  args.forEach(function (a) { out += " " + (typeof a === "string" ? a : __inspect(a)); });
  return out;
}

// ---------------------------------------------------------------- console and process

var console = {
  log: function () { __n.write(__format.apply(null, arguments) + "\n"); },
  info: function () { __n.write(__format.apply(null, arguments) + "\n"); },
  debug: function () { __n.write(__format.apply(null, arguments) + "\n"); },
  warn: function () { __n.write(__format.apply(null, arguments) + "\n"); },
  error: function () { __n.write(__format.apply(null, arguments) + "\n"); },
  dir: function (o) { __n.write(__inspect(o) + "\n"); },
  table: function (rows) { __n.write(__inspect(rows) + "\n"); },
  time: function (label) { __timers[label || "default"] = __n.info("now"); },
  timeEnd: function (label) {
    label = label || "default";
    __n.write(label + ": " + (__n.info("now") - (__timers[label] || 0)) + "ms\n");
    delete __timers[label];
  },
  assert: function (ok) { if (!ok) __n.write("Assertion failed" + (arguments.length > 1 ? ": " + __format.apply(null, Array.prototype.slice.call(arguments, 1)) : "") + "\n"); },
};
var __timers = {};
global.console = console;

var __listeners = {};
var __exiting = false;
var process = {
  title: "node",
  version: __n.info("version"),
  versions: { node: __n.info("version").substring(1), sim95: "1" },
  platform: "sim95",
  arch: "x86",
  pid: __n.info("pid"),
  argv: __n.args(),
  execPath: "C:\\PROGRAMS\\NODE.SPK",
  env: { HOME: "C:\\MYFILES", PATH: "C:\\PROGRAMS", HOSTNAME: __n.info("hostname"), NODE_PATH: "C:\\NODE\\MODULES" },
  exitCode: 0,
  cwd: function () { return __n.info("cwd"); },
  chdir: function (d) { __n.chdir(d); },
  exit: function (code) {
    if (code === undefined) code = process.exitCode || 0;
    process.exitCode = code;
    if (!__exiting) { __exiting = true; process.emit("exit", code); }
    __n.exit(code);
    throw { __exit: true };
  },
  nextTick: function (fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    Promise.resolve().then(function () { fn.apply(null, args); });
  },
  uptime: function () { return __n.info("now") / 1000; },
  hrtime: function (prev) {
    var ms = __n.info("now"), s = Math.floor(ms / 1000), ns = (ms % 1000) * 1000000;
    if (prev) { s -= prev[0]; ns -= prev[1]; if (ns < 0) { s--; ns += 1000000000; } }
    return [s, ns];
  },
  memoryUsage: function () { return { rss: 0, heapTotal: 0, heapUsed: 0 }; },
  on: function (e, fn) { (__listeners[e] = __listeners[e] || []).push(fn); return process; },
  once: function (e, fn) { return process.on(e, fn); },
  off: function (e, fn) { var l = __listeners[e] || []; if (l.indexOf(fn) >= 0) l.splice(l.indexOf(fn), 1); return process; },
  emit: function (e) {
    var args = Array.prototype.slice.call(arguments, 1), l = (__listeners[e] || []).slice();
    l.forEach(function (fn) { fn.apply(process, args); });
    return l.length > 0;
  },
  listenerCount: function (e) { return (__listeners[e] || []).length; },
  stdout: { write: function (s) { __n.write(String(s)); return true; }, isTTY: true, columns: 72 },
  stderr: { write: function (s) { __n.write(String(s)); return true; }, isTTY: true },
  stdin: { isTTY: true },
};
process.hrtime.bigint = function () { return __n.info("now") * 1000000; };
process.removeListener = process.off;
process.addListener = process.on;
global.process = process;

// Node's own timers: extra arguments, and setImmediate
(function () {
  var st = setTimeout, si = setInterval;
  global.setTimeout = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    return st(args.length ? function () { fn.apply(null, args); } : fn, ms || 0);
  };
  global.setInterval = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    return si(args.length ? function () { fn.apply(null, args); } : fn, ms || 1);
  };
  global.setImmediate = function (fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    return st(function () { fn.apply(null, args); }, 0);
  };
  global.clearImmediate = clearTimeout;
  global.queueMicrotask = function (fn) { Promise.resolve().then(fn); };
})();
if (!Promise.prototype.finally) {
  Promise.prototype.finally = function (f) {
    return this.then(function (v) { f(); return v; }, function (e) { f(); throw e; });
  };
}

// ---------------------------------------------------------------- require

var __core = {
  assert: "ASSERT", child_process: "CHILDPRO", dns: "DNS", events: "EVENTS", fs: "FS", http: "HTTP", net: "NET",
  os: "OS", path: "PATH", querystring: "QUERYSTR", readline: "READLINE", timers: "TIMERS", url: "URL", util: "UTIL",
};
var __cache = {};

function Module(id, filename) {
  this.id = id;
  this.filename = filename;
  this.exports = {};
  this.loaded = false;
  this.children = [];
}

function __dirOf(f) {
  var i = f.lastIndexOf("\\");
  if (i <= 2) return f.substring(0, 3);
  return f.substring(0, i);
}

function __isFile(p) { var s = __n.fsStat(p); return s !== null && s.charAt(0) === "f"; }
function __isDir(p) { var s = __n.fsStat(p); return s !== null && s.charAt(0) === "d"; }

function __tryFile(p) {
  if (__isFile(p)) return p;
  if (__isFile(p + ".JS")) return p + ".JS";
  if (__isFile(p + ".JSN")) return p + ".JSN";
  return null;
}

function __tryDir(d) {
  if (!__isDir(d)) return null;
  if (__isFile(d + "\\PACKAGE.JSN")) {
    var pkg = JSON.parse(__n.fsRead(d + "\\PACKAGE.JSN"));
    if (pkg.main) {
      var m = __tryFile(__n.fullpath(d + "\\" + pkg.main)) || __tryFile(__n.fullpath(d + "\\" + pkg.main + "\\INDEX"));
      if (m) return m;
    }
  }
  return __tryFile(d + "\\INDEX");
}

// The file a require means, from a module in dir.
function __resolve(request, dir) {
  var r = request;
  if (r.substring(0, 5) === "node:") r = r.substring(5);
  if (__core[r]) return "core:" + r;
  var rel = r.charAt(0) === "." || r.charAt(0) === "/" || r.charAt(0) === "\\" || r.charAt(1) === ":";
  if (rel) {
    var base = __n.fullpath(r.charAt(1) === ":" ? r : dir + "\\" + r);
    var found = __tryFile(base) || __tryDir(base);
    if (found) return found;
  } else {
    // a package: NODE_MOD folders from here up, then C:\NODE\MODULES
    var parts = r.split("/").join("\\").split("\\");
    var rest = parts.slice(1).join("\\");
    var d = dir;
    while (true) {
      var p = __n.fullpath(d + "\\NODE_MOD\\" + parts[0] + (rest ? "\\" + rest : ""));
      var hit = rest ? (__tryFile(p) || __tryDir(p)) : __tryDir(p);
      if (hit) return hit;
      var up = __dirOf(d);
      if (up === d) break;
      d = up;
    }
    var g = __n.fullpath("C:\\NODE\\MODULES\\" + parts[0] + (rest ? "\\" + rest : ""));
    var hit2 = rest ? (__tryFile(g) || __tryDir(g)) : __tryDir(g);
    if (hit2) return hit2;
  }
  var e = new Error("Cannot find module '" + request + "'");
  e.code = "MODULE_NOT_FOUND";
  throw e;
}

function __load(request, parent) {
  var dir = parent ? __dirOf(parent.filename) : __n.info("cwd");
  var file = __resolve(request, dir);
  if (__cache[file]) return __cache[file].exports;
  var name = file;
  if (file.substring(0, 5) === "core:") name = "C:\\NODE\\LIB\\" + __core[file.substring(5)] + ".JS";
  var m = new Module(file, name);
  __cache[file] = m;
  if (parent) parent.children.push(m);
  if (name.substring(name.length - 4) === ".JSN") {
    m.exports = JSON.parse(__n.fsRead(name));
  } else {
    var fn = __n.compile(__n.fsRead(name), name);
    fn.call(m.exports, m.exports, __requireFor(m), m, name, __dirOf(name));
  }
  m.loaded = true;
  return m.exports;
}

function __requireFor(m) {
  var r = function (request) { return __load(request, m); };
  r.resolve = function (request) {
    var f = __resolve(request, __dirOf(m.filename));
    return f.substring(0, 5) === "core:" ? f.substring(5) : f;
  };
  r.cache = __cache;
  r.main = __main;
  return r;
}

var __main = null;
global.require = __requireFor(new Module(".", __n.info("cwd") + "\\[eval]"));
global.module = undefined;

// ---------------------------------------------------------------- events from the SPARK side

var __sockets = {};   // by id: net.Socket (net.js puts them here)
var __servers = {};   // by slot: net.Server
var __lookups = {};   // by id: callback(address)
var __lineFn = null;  // what the next typed line goes to

function __uncaught(e) {
  if (e && e.__exit) return;
  if (process.listenerCount("uncaughtException") > 0) { process.emit("uncaughtException", e); return; }
  if (__repl) { __n.write("Uncaught " + __inspect(e) + "\n"); return; }
  __n.write("\n" + (e && e.stack ? e.stack : "Uncaught " + __inspect(e)) + "\n");
  if (e && e.code === "MODULE_NOT_FOUND") __n.write("\nNode.js " + process.version + "\n");
  __n.exit(1);
}

function __dispatch(kind, a, b) {
  try {
    switch (kind) {
      case "exit":
        var code = process.exitCode || 0;
        if (!__exiting) { __exiting = true; process.emit("exit", code); }
        __n.exit(process.exitCode || code);
        break;
      case "main":
        if (!__isFile(a)) {
          var nf = new Error("Cannot find module '" + a + "'");
          nf.code = "MODULE_NOT_FOUND";
          throw nf;
        }
        var m = new Module(".", a);
        __main = m;
        __cache[a] = m;
        var fn = __n.compile(__n.fsRead(a), a);
        fn.call(m.exports, m.exports, __requireFor(m), m, a, __dirOf(a));
        m.loaded = true;
        break;
      case "eval": __n.eval(a); break;
      case "repl": __startRepl(); break;
      case "call": a(); break;
      case "code": __n.eval(a); break;
      case "accept": if (__servers[a]) __servers[a]._accept(b); break;
      case "listenerror": if (__servers[a]) __servers[a]._fail(b); break;
      case "data": if (__sockets[a]) __sockets[a]._data(b); break;
      case "close": if (__sockets[a]) __sockets[a]._closed(); break;
      case "connect": if (__sockets[a]) __sockets[a]._connected(); break;
      case "connerror": if (__sockets[a]) __sockets[a]._fail(b); break;
      case "resolved": var cb = __lookups[a]; delete __lookups[a]; if (cb) cb(b); break;
      case "line": var lf = __lineFn; __lineFn = null; if (lf) lf(a); break;
    }
  } catch (e) {
    __uncaught(e);
  }
}

// ---------------------------------------------------------------- the prompt

var __repl = false;
function __startRepl() {
  __repl = true;
  __n.write("Welcome to Node.js " + process.version + " on SIM95.\nType \".help\" for more information.\n");
  var more = "";
  function next() { __lineFn = take; __n.readLine(more ? "... " : "> "); }
  function take(line) {
    var code = more + line;
    if (!more && line.trim() === ".exit") { __n.exit(0); return; }
    if (!more && line.trim() === ".help") {
      __n.write(".exit     Leave the prompt\n.help     This\nAnything else is JavaScript, run here and now. require() finds\nmodules from " + process.cwd() + ".\n");
      next();
      return;
    }
    if (__opens(code) > 0) { more = code + "\n"; next(); return; }
    more = "";
    if (code.trim() === "") { next(); return; }
    try {
      var r = __n.eval(code);
      __n.write(__inspect(r, 2, [0]) + "\n");
      global._ = r;
    } catch (e) {
      __n.write("Uncaught " + __inspect(e) + "\n");
    }
    next();
  }
  next();
}

// how many more ( [ { a line opens than it closes, outside strings
function __opens(code) {
  var n = 0, q = "";
  for (var i = 0; i < code.length; i++) {
    var c = code.charAt(i);
    if (q) { if (c === "\\") i++; else if (c === q) q = ""; continue; }
    if (c === "'" || c === '"' || c === "`") q = c;
    else if (c === "(" || c === "[" || c === "{") n++;
    else if (c === ")" || c === "]" || c === "}") n--;
  }
  return n;
}
