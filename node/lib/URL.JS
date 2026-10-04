// url - http://host:port/path?query#hash
const qs = require("querystring");
function parse(s, parseQuery) {
  const u = { protocol: null, slashes: false, auth: null, host: null, port: null, hostname: null, hash: null, search: null, query: null, pathname: null, path: null, href: s };
  let rest = String(s);
  const h = rest.indexOf("#");
  if (h >= 0) { u.hash = rest.substring(h); rest = rest.substring(0, h); }
  const q = rest.indexOf("?");
  if (q >= 0) { u.search = rest.substring(q); u.query = rest.substring(q + 1); rest = rest.substring(0, q); }
  const p = rest.indexOf("://");
  if (p >= 0) {
    u.protocol = rest.substring(0, p + 1).toLowerCase();
    u.slashes = true;
    rest = rest.substring(p + 3);
    const slash = rest.indexOf("/");
    u.host = (slash < 0 ? rest : rest.substring(0, slash)).toLowerCase();
    rest = slash < 0 ? "/" : rest.substring(slash);
    const c = u.host.indexOf(":");
    u.hostname = c < 0 ? u.host : u.host.substring(0, c);
    u.port = c < 0 ? null : u.host.substring(c + 1);
  }
  u.pathname = rest || (u.host ? "/" : rest);
  u.path = u.pathname + (u.search || "");
  if (parseQuery) u.query = qs.parse(u.query || "");
  return u;
}
class URLSearchParams {
  constructor(init) {
    this._list = [];
    if (typeof init === "string") {
      const o = qs.parse(init.charAt(0) === "?" ? init.substring(1) : init);
      for (const k of Object.keys(o)) [].concat(o[k]).forEach((v) => this._list.push([k, v]));
    } else if (init) for (const k of Object.keys(init)) this._list.push([k, String(init[k])]);
  }
  get(k) { const p = this._list.find((x) => x[0] === k); return p ? p[1] : null; }
  getAll(k) { return this._list.filter((x) => x[0] === k).map((x) => x[1]); }
  has(k) { return this._list.some((x) => x[0] === k); }
  set(k, v) { this.delete(k); this._list.push([k, String(v)]); }
  append(k, v) { this._list.push([k, String(v)]); }
  delete(k) { this._list = this._list.filter((x) => x[0] !== k); }
  forEach(fn) { this._list.forEach((p) => fn(p[1], p[0], this)); }
  entries() { return this._list.slice(); }
  keys() { return this._list.map((p) => p[0]); }
  toString() { return this._list.map((p) => qs.escape(p[0]) + "=" + qs.escape(p[1])).join("&"); }
}
class URL {
  constructor(s, base) {
    if (base !== undefined && String(s).indexOf("://") < 0) {
      // relative to base: /x from its host, x from its folder
      const b = parse(String(base));
      s = String(s).charAt(0) === "/" ? b.protocol + "//" + b.host + s : b.protocol + "//" + b.host + b.pathname.substring(0, b.pathname.lastIndexOf("/") + 1) + s;
    }
    const u = parse(s);
    if (!u.protocol) throw new TypeError("Invalid URL: " + s);
    this.href = s;
    this.protocol = u.protocol;
    this.host = u.host;
    this.hostname = u.hostname;
    this.port = u.port || "";
    this.pathname = u.pathname;
    this.search = u.search || "";
    this.hash = u.hash || "";
    this.origin = u.protocol + "//" + u.host;
    this.searchParams = new URLSearchParams(this.search);
  }
  toString() { return this.href; }
}
function format(u) {
  if (typeof u === "string") return u;
  return (u.protocol ? u.protocol + "//" : "") + (u.host || u.hostname || "") + (u.pathname || "/") + (u.search || (u.query && typeof u.query === "object" ? "?" + qs.stringify(u.query) : ""));
}
module.exports = { parse, format, URL, URLSearchParams };
global.URL = URL;
global.URLSearchParams = URLSearchParams;
