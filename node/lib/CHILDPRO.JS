// child_process - other programs. SIM95 programs have windows of their own,
// so there is no output to collect: spawn starts one, and that's it.
const EventEmitter = require("events");
class ChildProcess extends EventEmitter {
  constructor(pid) { super(); this.pid = pid; this.killed = false; this.stdout = new EventEmitter(); this.stderr = new EventEmitter(); }
  kill() { __n.kill(this.pid); this.killed = true; this.emit("exit", null, "SIGTERM"); return true; }
}
function spawn(cmd, args) {
  let path = cmd;
  if (path.indexOf("\\") < 0 && path.indexOf(":") < 0) path = "C:\\PROGRAMS\\" + path.toUpperCase() + (path.indexOf(".") < 0 ? ".SPK" : "");
  return new ChildProcess(__n.spawn(path, (args || []).join(" ")));
}
function exec(cmd, opts, cb) {
  if (typeof opts === "function") cb = opts;
  const parts = cmd.split(" ").filter((x) => x);
  const child = spawn(parts[0], parts.slice(1));
  if (cb) setImmediate(() => cb(null, "", ""));
  return child;
}
module.exports = { spawn, exec, fork: spawn, ChildProcess };
