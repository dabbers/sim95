// express for SIM95: app.get/post/put/delete/all/use, routes with :params,
// req.query/params/body, res.send/json/status/set/redirect/sendFile, and the
// static, json and urlencoded middleware. app.listen(port) serves it with http.
const http = require("http");
const fs = require("fs");
const qs = require("querystring");

const TYPES = { HTM: "text/html", HTML: "text/html", TXT: "text/plain", JS: "application/javascript", CSS: "text/css", JSN: "application/json", JSON: "application/json", SPK: "text/plain", ASP: "text/plain", MD: "text/plain", PIC: "image/x-sim95-pic" };

// "/users/:id" against "/users/7" -> {id: "7"}, or null; prefix: "/api" matches "/api/x" too
function match(pattern, path, prefix) {
  if (pattern === "*" || pattern === "/*") return {};
  const want = pattern.split("/").filter((x) => x !== ""), got = path.split("/").filter((x) => x !== "");
  if (prefix ? got.length < want.length : got.length !== want.length) return null;
  const params = {};
  for (let i = 0; i < want.length; i++) {
    const w = want[i];
    if (w.charAt(0) === ":") params[w.substring(1)] = decodeURIComponent(got[i]);
    else if (w !== "*" && w.toLowerCase() !== got[i].toLowerCase()) return null;
  }
  return params;
}

function enhance(req, res, app) {
  const u = req.url.indexOf("?");
  req.path = u < 0 ? req.url : req.url.substring(0, u);
  req.query = qs.parse(u < 0 ? "" : req.url.substring(u + 1));
  req.params = {};
  req.app = app;
  req.get = req.header = (k) => req.headers[String(k).toLowerCase()];
  req.ip = req.socket && req.socket.remoteAddress;
  res.locals = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.set = res.header = (k, v) => { if (typeof k === "object") Object.keys(k).forEach((x) => res.setHeader(x, k[x])); else res.setHeader(k, v); return res; };
  res.get = (k) => res.getHeader(k);
  res.type = (t) => { res.setHeader("Content-Type", t.indexOf("/") >= 0 ? t : TYPES[t.toUpperCase()] || "text/plain"); return res; };
  res.send = (body) => {
    if (body === undefined || body === null) body = "";
    if (typeof body === "number") { res.statusCode = body; body = http.STATUS_CODES[body] || String(body); }
    if (typeof body === "object") return res.json(body);
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "text/html");
    res.end(String(body));
    return res;
  };
  res.json = (obj) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); return res; };
  res.sendStatus = (code) => { res.statusCode = code; return res.type("txt").send(http.STATUS_CODES[code] || String(code)); };
  res.redirect = (a, b) => { const code = typeof a === "number" ? a : 302, to = typeof a === "number" ? b : a; res.statusCode = code; res.setHeader("Location", to); res.end("Redirecting to " + to); return res; };
  res.sendFile = (file) => {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.status(404).type("txt").send("Not Found"); return res; }
    const ext = file.substring(file.lastIndexOf(".") + 1).toUpperCase();
    res.setHeader("Content-Type", TYPES[ext] || "text/plain");
    res.end(fs.readFileSync(file));
    return res;
  };
}

function createApplication() {
  const stack = [];   // {method, path, prefix, fn}
  const settings = {};
  const app = function (req, res) { app.handle(req, res); };
  const add = (method, prefix) => function (path) {
    let fns = Array.prototype.slice.call(arguments, 1);
    if (typeof path === "function") { fns = Array.prototype.slice.call(arguments); path = "/"; }
    fns = [].concat.apply([], fns);
    if (method === "GET" && fns.length === 0) return settings[path];
    for (const fn of fns) stack.push({ method, path, prefix, fn });
    return app;
  };
  app.use = add(null, true);
  app.all = add(null, false);
  app.get = add("GET", false);
  app.post = add("POST", false);
  app.put = add("PUT", false);
  app.delete = add("DELETE", false);
  app.set = (k, v) => { settings[k] = v; return app; };
  app.locals = {};
  app.handle = (req, res) => {
    enhance(req, res, app);
    let i = 0, inside = false, again = false;
    const finalErr = (err) => {
      if (res.finished) return;
      res.statusCode = err.status || 500;
      res.setHeader("Content-Type", "text/html");
      res.end("<pre>" + (err.stack || err.message || String(err)) + "</pre>");
    };
    const next = (err) => {
      if (err && err !== "route") { finalErr(err); return; }
      // called while a handler runs: carry on from the loop, not deeper
      if (inside) { again = true; return; }
      run();
    };
    const run = () => {
      do {
        again = false;
        let layer = null, params = null;
        while (i < stack.length) {
          const l = stack[i++];
          if (l.method && l.method !== req.method && !(l.method === "GET" && req.method === "HEAD")) continue;
          params = match(l.path, req.path, l.prefix);
          if (params) { layer = l; break; }
        }
        if (!layer) {
          if (!res.finished) res.status(404).type("html").send("<pre>Cannot " + req.method + " " + req.path + "</pre>");
          return;
        }
        req.params = params;
        inside = true;
        try { layer.fn(req, res, next); } catch (e) { inside = false; finalErr(e); return; }
        inside = false;
      } while (again);
    };
    run();
  };
  app.listen = function () {
    const server = http.createServer(app);
    return server.listen.apply(server, arguments);
  };
  return app;
}

function readBody(req, done) {
  if (req._gotBody) { done(req._gotBody); return; }
  let text = "";
  req.on("data", (d) => (text += d));
  req.on("end", () => { req._gotBody = text; done(text); });
}

createApplication.static = (dir) => (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") { next(); return; }
  let rel = decodeURIComponent(req.path).split("/").filter((x) => x !== "" && x !== "..").join("\\");
  let file = dir + (rel ? "\\" + rel : "");
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file += "\\INDEX.HTM";
  if (!fs.existsSync(file)) { next(); return; }
  res.sendFile(file);
};
createApplication.json = () => (req, res, next) => {
  if ((req.headers["content-type"] || "").indexOf("json") < 0) { req.body = req.body || {}; next(); return; }
  readBody(req, (t) => { try { req.body = t ? JSON.parse(t) : {}; next(); } catch (e) { res.status(400).send("Bad JSON: " + e.message); } });
};
createApplication.urlencoded = () => (req, res, next) => {
  if ((req.headers["content-type"] || "").indexOf("urlencoded") < 0) { req.body = req.body || {}; next(); return; }
  readBody(req, (t) => { req.body = qs.parse(t); next(); });
};
createApplication.text = () => (req, res, next) => { readBody(req, (t) => { req.body = t; next(); }); };
createApplication.Router = () => {
  const r = createApplication();
  const router = function (req, res, next) { r.handle(req, res); };
  ["use", "get", "post", "put", "delete", "all"].forEach((m) => { router[m] = function () { r[m].apply(r, arguments); return router; }; });
  return router;
};

module.exports = createApplication;
