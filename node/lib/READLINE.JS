// readline - lines typed in Node's window.
const EventEmitter = require("events");
class Interface extends EventEmitter {
  constructor(opts) {
    super();
    this._prompt = (opts && opts.prompt) || "> ";
    this.closed = false;
    this._asking = null;
    this.terminal = true;
  }
  _read(prompt) {
    __lineFn = (line) => {
      if (this.closed) return;
      if (this._asking) { const cb = this._asking; this._asking = null; cb(line); }
      else this.emit("line", line);
      if (!this.closed && !this._asking && this.listenerCount("line") > 0 && this._looping) this._read("");
    };
    __n.readLine(prompt);
  }
  question(q, cb) {
    this._asking = cb;
    this._read(q);
  }
  setPrompt(p) { this._prompt = p; }
  getPrompt() { return this._prompt; }
  prompt() { this._looping = true; this._read(this._prompt); }
  write(s) { process.stdout.write(s); }
  close() {
    if (this.closed) return;
    this.closed = true;
    __lineFn = null;
    __n.stopReading();
    this.emit("close");
  }
  pause() { return this; }
  resume() { return this; }
  on(name, fn) {
    super.on(name, fn);
    // listening for lines starts the reading
    if (name === "line" && !this._looping) { this._looping = true; setImmediate(() => { if (!this._asking && !this.closed) this._read(""); }); }
    return this;
  }
}
function createInterface(opts) { return new Interface(opts); }
module.exports = { createInterface, Interface };
module.exports.promises = { createInterface: (o) => { const rl = createInterface(o); rl.question = ((q) => new Promise((ok) => Interface.prototype.question.call(rl, q, ok))); return rl; } };
