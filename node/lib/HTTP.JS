// http - web servers and requests, on SIM95's web: HTTP/1.0, one connection
// a request. A request comes in one message; a response goes back the same
// way (Voyager joins what it gets with line breaks, so a big one is cut at
// lines), and the connection closes.
const net = require("net");
const EventEmitter = require("events");
const urlLib = require("url");

const STATUS_CODES = {
  200: "OK", 201: "Created", 204: "No Content", 301: "Moved Permanently", 302: "Found", 304: "Not Modified",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed",
  409: "Conflict", 500: "Internal Server Error", 501: "Not Implemented", 503: "Service Unavailable",
};
const CHUNK = 60000;

// "HEAD\nName: value\n\nbody" -> {first, headers, body}
function split(raw) {
  raw = raw.split("\r").join("");
  let i = raw.indexOf("\n\n");
  const head = i < 0 ? raw : raw.substring(0, i), body = i < 0 ? "" : raw.substring(i + 2);
  const lines = head.split("\n");
  const headers = {};
  for (let k = 1; k < lines.length; k++) {
    const c = lines[k].indexOf(":");
    if (c > 0) headers[lines[k].substring(0, c).trim().toLowerCase()] = lines[k].substring(c + 1).trim();
  }
  return { first: lines[0], headers, body };
}

function sendCut(socket, text) {
  // in pieces at line breaks, since each message arrives with one added
  while (text.length > CHUNK) {
    let cut = text.lastIndexOf("\n", CHUNK);
    if (cut <= 0) cut = CHUNK;
    socket.write(text.substring(0, cut));
    text = text.substring(text.charAt(cut) === "\n" ? cut + 1 : cut);
  }
  socket.write(text);
}

class IncomingMessage extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.headers = {};
    this.httpVersion = "1.0";
    this.method = null;
    this.url = null;
    this.statusCode = null;
    this.statusMessage = null;
    this._body = "";
  }
  setEncoding() { return this; }
  _deliver() {
    setImmediate(() => {
      if (this._body !== "") this.emit("data", this._body);
      this.emit("end");
      this.emit("close");
    });
  }
}

class ServerResponse extends EventEmitter {
  constructor(socket, req) {
    super();
    this.socket = socket;
    this.req = req;
    this.statusCode = 200;
    this.statusMessage = "";
    this._headers = {};
    this._names = {};
    this._body = [];
    this.headersSent = false;
    this.finished = false;
    this.writableEnded = false;
  }
  setHeader(name, value) { this._headers[name.toLowerCase()] = value; this._names[name.toLowerCase()] = name; return this; }
  getHeader(name) { return this._headers[name.toLowerCase()]; }
  getHeaders() { return Object.assign({}, this._headers); }
  hasHeader(name) { return this._headers[name.toLowerCase()] !== undefined; }
  removeHeader(name) { delete this._headers[name.toLowerCase()]; }
  writeHead(code, message, headers) {
    if (typeof message === "object") { headers = message; message = ""; }
    this.statusCode = code;
    if (message) this.statusMessage = message;
    if (headers) for (const k of Object.keys(headers)) this.setHeader(k, headers[k]);
    return this;
  }
  write(chunk, enc, cb) {
    if (typeof enc === "function") cb = enc;
    if (chunk !== undefined && chunk !== null) this._body.push(String(chunk));
    if (cb) setImmediate(cb);
    return true;
  }
  end(chunk, enc, cb) {
    if (typeof chunk === "function") { cb = chunk; chunk = undefined; }
    if (typeof enc === "function") cb = enc;
    if (this.finished) return this;
    if (chunk !== undefined && chunk !== null) this._body.push(String(chunk));
    const body = this._body.join("");
    if (this._headers["content-type"] === undefined) this.setHeader("Content-Type", "text/html");
    this.setHeader("Content-Length", body.length);
    if (this._headers["server"] === undefined) this.setHeader("Server", "Node/" + process.version + " (SIM95)");
    let head = "HTTP/1.0 " + this.statusCode + " " + (this.statusMessage || STATUS_CODES[this.statusCode] || "OK");
    for (const k of Object.keys(this._headers)) [].concat(this._headers[k]).forEach((v) => (head += "\n" + this._names[k] + ": " + v));
    this.headersSent = true;
    this.finished = true;
    this.writableEnded = true;
    sendCut(this.socket, head + "\n\n" + body);
    this.socket.end();
    this.emit("finish");
    if (cb) setImmediate(cb);
    return this;
  }
}

class Server extends net.Server {
  constructor(opts, handler) {
    super();
    if (typeof opts === "function") handler = opts;
    if (handler) this.on("request", handler);
    this.on("connection", (socket) => {
      let got = false;
      socket.on("data", (raw) => {
        if (got) return;
        got = true;
        const p = split(raw);
        const req = new IncomingMessage(socket);
        const parts = p.first.split(" ");
        req.method = (parts[0] || "GET").toUpperCase();
        req.url = parts[1] || "/";
        req.httpVersion = (parts[2] || "HTTP/1.0").replace("HTTP/", "");
        req.headers = p.headers;
        req._body = p.body;
        const res = new ServerResponse(socket, req);
        this.emit("request", req, res);
        req._deliver();
      });
    });
  }
}

function createServer(opts, handler) { return new Server(opts, handler); }

class ClientRequest extends EventEmitter {
  constructor(opts, cb) {
    super();
    if (typeof opts === "string") opts = urlLib.parse(opts);
    else if (opts && opts.href && opts.searchParams) opts = urlLib.parse(opts.href);
    this.method = (opts.method || "GET").toUpperCase();
    this.host = opts.hostname || opts.host || "localhost";
    if (this.host.indexOf(":") >= 0) this.host = this.host.substring(0, this.host.indexOf(":"));
    this.port = parseInt(opts.port || 80);
    this.path = opts.path || opts.pathname || "/";
    this._headers = Object.assign({}, opts.headers || {});
    this._body = [];
    if (cb) this.once("response", cb);
  }
  setHeader(k, v) { this._headers[k] = v; }
  getHeader(k) { return this._headers[k]; }
  write(chunk) { this._body.push(String(chunk)); return true; }
  setTimeout() { return this; }
  abort() { if (this._socket) this._socket.destroy(); }
  destroy() { this.abort(); }
  end(chunk) {
    if (chunk !== undefined) this._body.push(String(chunk));
    const body = this._body.join("");
    let head = this.method + " " + this.path + " HTTP/1.0\nHost: " + this.host + (this.port !== 80 ? ":" + this.port : "");
    if (!Object.keys(this._headers).some((k) => k.toLowerCase() === "user-agent")) head += "\nUser-Agent: Node/" + process.version + " (SIM95)";
    for (const k of Object.keys(this._headers)) head += "\n" + k + ": " + this._headers[k];
    if (body !== "" || this.method === "POST" || this.method === "PUT") {
      if (!Object.keys(this._headers).some((k) => k.toLowerCase() === "content-type")) head += "\nContent-Type: application/x-www-form-urlencoded";
      head += "\nContent-Length: " + body.length + "\n\n" + body;
    }
    const got = [];
    const s = net.connect(this.port, this.host, () => s.write(head));
    this._socket = s;
    s.on("data", (m) => got.push(m));
    s.on("error", (e) => this.emit("error", e));
    s.on("close", (failed) => {
      if (failed) return;
      const p = split(got.join("\n"));
      const res = new IncomingMessage(s);
      const parts = p.first.split(" ");
      res.httpVersion = (parts[0] || "HTTP/1.0").replace("HTTP/", "");
      res.statusCode = parseInt(parts[1]) || 0;
      res.statusMessage = parts.slice(2).join(" ");
      res.headers = p.headers;
      res._body = p.body;
      this.emit("response", res);
      res._deliver();
    });
    return this;
  }
}

function request(opts, cb) { return new ClientRequest(opts, cb); }
function get(opts, cb) { const r = request(opts, cb); r.end(); return r; }

module.exports = { createServer, Server, request, get, IncomingMessage, ServerResponse, ClientRequest, STATUS_CODES, METHODS: ["GET", "POST", "PUT", "DELETE", "HEAD"] };
