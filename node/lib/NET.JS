// net - servers and connections. SIM95's network carries whole messages:
// each write() is one message, and each 'data' event is one.
const EventEmitter = require("events");

class Socket extends EventEmitter {
  constructor(id) {
    super();
    this._id = id === undefined ? 0 : id;
    this.remoteAddress = undefined;
    this.remotePort = undefined;
    this.destroyed = false;
    this.connecting = false;
    this.writable = id !== undefined;
    this.bytesRead = 0;
    this.bytesWritten = 0;
    this.encoding = "utf8";
    if (id !== undefined) { __sockets[id] = this; this._peer(); }
  }
  _peer() {
    const p = __n.peer(this._id);
    if (p) { const i = p.lastIndexOf(":"); this.remoteAddress = p.substring(0, i); this.remotePort = parseInt(p.substring(i + 1)); }
  }
  connect(port, host, cb) {
    if (typeof port === "object") { cb = host; host = port.host; port = port.port; }
    if (typeof host === "function") { cb = host; host = undefined; }
    this._id = __n.connect(host || "localhost", port);
    __sockets[this._id] = this;
    this.connecting = true;
    if (cb) this.once("connect", cb);
    return this;
  }
  _connected() { this.connecting = false; this.writable = true; this._peer(); this.emit("connect"); this.emit("ready"); }
  _fail(why) {
    this.connecting = false;
    delete __sockets[this._id];
    const e = new Error(why.indexOf("refused") >= 0 ? "connect ECONNREFUSED " + why : why);
    e.code = why.indexOf("refused") >= 0 ? "ECONNREFUSED" : why.indexOf("Unknown host") >= 0 ? "ENOTFOUND" : "ETIMEDOUT";
    this.destroyed = true;
    this.emit("error", e);
    this.emit("close", true);
  }
  _data(message) { this.bytesRead += message.length; this.emit("data", message); }
  _closed() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.writable = false;
    delete __sockets[this._id];
    this.emit("end");
    this.emit("close", false);
  }
  write(data, enc, cb) {
    if (typeof enc === "function") cb = enc;
    const ok = __n.send(this._id, String(data));
    this.bytesWritten += String(data).length;
    if (cb) setImmediate(cb);
    return ok;
  }
  end(data, enc, cb) {
    if (typeof data === "function") { cb = data; data = undefined; }
    if (data !== undefined && data !== null) this.write(data);
    if (cb) this.once("close", cb);
    __n.end(this._id);
    return this;
  }
  destroy() { if (!this.destroyed) __n.end(this._id); return this; }
  setEncoding(e) { this.encoding = e; return this; }
  setTimeout() { return this; }
  setNoDelay() { return this; }
  setKeepAlive() { return this; }
  pause() { return this; }
  resume() { return this; }
  ref() { return this; }
  unref() { return this; }
  address() { return { address: __n.info("address"), family: "IPv4" }; }
}

class Server extends EventEmitter {
  constructor(opts, onConnection) {
    super();
    if (typeof opts === "function") onConnection = opts;
    if (onConnection) this.on("connection", onConnection);
    this._slot = -1;
    this.listening = false;
    this._port = 0;
  }
  listen(port, host, cb) {
    if (typeof port === "object" && port !== null) port = port.port;
    if (typeof host === "function") cb = host;
    if (cb) this.once("listening", cb);
    this._port = port || 0;
    try {
      this._slot = __n.listen(this._port);
    } catch (e) {
      const err = new Error("listen EADDRINUSE: address already in use :::" + this._port);
      err.code = "EADDRINUSE";
      setImmediate(() => this.emit("error", err));
      return this;
    }
    __servers[this._slot] = this;
    this.listening = true;
    setImmediate(() => this.emit("listening"));
    return this;
  }
  _accept(id) { this.emit("connection", new Socket(id)); }
  _fail(why) {
    this.listening = false;
    delete __servers[this._slot];
    const err = new Error(why.indexOf("in use") >= 0 ? "listen EADDRINUSE: address already in use :::" + this._port : why);
    err.code = why.indexOf("in use") >= 0 ? "EADDRINUSE" : "EACCES";
    this.emit("error", err);
  }
  close(cb) {
    if (this._slot >= 0) { __n.unlisten(this._slot); delete __servers[this._slot]; }
    this.listening = false;
    setImmediate(() => { this.emit("close"); if (cb) cb(); });
    return this;
  }
  address() { return { port: this._port, family: "IPv4", address: __n.info("address") }; }
  ref() { return this; }
  unref() { return this; }
}

function createServer(opts, onConnection) { return new Server(opts, onConnection); }
function connect(port, host, cb) {
  const s = new Socket();
  return s.connect(port, host, cb);
}
module.exports = { Socket, Server, createServer, connect, createConnection: connect, isIP: (s) => (String(s).split(".").length === 4 ? 4 : 0) };
