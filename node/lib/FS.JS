// fs - the disk. SIM95 files are text, with 8.3 names; paths are C:\DIR\FILE.
// The ...Sync calls do it now; the others call back (err, result) after.
class Stats {
  constructor(kind, size) { this._kind = kind; this.size = size; this.mtime = new Date(); this.mode = kind === "d" ? 16877 : 33188; }
  isFile() { return this._kind === "f"; }
  isDirectory() { return this._kind === "d"; }
  isSymbolicLink() { return false; }
}
function text(data) { return typeof data === "string" ? data : data === undefined || data === null ? "" : String(data); }
function notFound(p, op) {
  const e = new Error("ENOENT: no such file or directory, " + op + " '" + __n.fullpath(p) + "'");
  e.code = "ENOENT";
  e.errno = -2;
  e.syscall = op;
  e.path = __n.fullpath(p);
  return e;
}
const fs = {
  readFileSync(p) { return __n.fsRead(p); },
  writeFileSync(p, data) { __n.fsWrite(p, text(data)); },
  appendFileSync(p, data) { __n.fsAppend(p, text(data)); },
  existsSync(p) { return __n.fsStat(p) !== null; },
  statSync(p, opts) {
    const s = __n.fsStat(p);
    if (s === null) { if (opts && opts.throwIfNoEntry === false) return undefined; throw notFound(p, "stat"); }
    return new Stats(s.charAt(0), parseInt(s.substring(1)));
  },
  readdirSync(p, opts) {
    const names = __n.fsList(p).sort();
    if (opts && opts.withFileTypes) return names.map((n) => { const s = fs.statSync(p + "\\" + n); s.name = n; return s; });
    return names;
  },
  mkdirSync(p, opts) { __n.fsMkdir(p, !!(opts && opts.recursive)); },
  unlinkSync(p) { if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) throw notFound(p, "unlink"); __n.fsDelete(p); },
  rmdirSync(p, opts) {
    if (opts && opts.recursive) return fs.rmSync(p, { recursive: true });
    __n.fsDelete(p);
  },
  rmSync(p, opts) {
    if (!fs.existsSync(p)) { if (opts && opts.force) return; throw notFound(p, "rm"); }
    if (fs.statSync(p).isDirectory() && opts && opts.recursive) {
      for (const n of fs.readdirSync(p)) fs.rmSync(p + "\\" + n, opts);
    }
    __n.fsDelete(p);
  },
  renameSync(a, b) { __n.fsRename(a, b); },
  copyFileSync(a, b) { __n.fsWrite(b, __n.fsRead(a)); },
  accessSync(p) { if (!fs.existsSync(p)) throw notFound(p, "access"); },
  realpathSync(p) { return __n.fullpath(p); },
  watch() { return { close() {} }; },
  createWriteStream(p) {
    __n.fsWrite(p, "");
    return { write(s) { __n.fsAppend(p, text(s)); return true; }, end(s) { if (s !== undefined) __n.fsAppend(p, text(s)); }, on() { return this; } };
  },
  constants: { F_OK: 0, R_OK: 4, W_OK: 2 },
};
// the callback and promise kinds, from the Sync ones
const names = ["readFile", "writeFile", "appendFile", "stat", "readdir", "mkdir", "unlink", "rmdir", "rm", "rename", "copyFile", "access", "realpath"];
fs.promises = {};
for (const name of names) {
  const sync = fs[name + "Sync"];
  fs[name] = function () {
    const args = Array.prototype.slice.call(arguments);
    const cb = typeof args[args.length - 1] === "function" ? args.pop() : null;
    let err = null, result;
    try { result = sync.apply(fs, args); } catch (e) { err = e; }
    if (cb) setImmediate(() => (err ? cb(err) : cb(null, result)));
  };
  fs.promises[name] = function () {
    const args = Array.prototype.slice.call(arguments);
    return new Promise((ok, no) => { try { ok(sync.apply(fs, args)); } catch (e) { no(e); } });
  };
}
fs.exists = (p, cb) => setImmediate(() => cb(fs.existsSync(p)));
fs.Stats = Stats;
module.exports = fs;
