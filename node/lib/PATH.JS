// path - SIM95 paths: C:\DIR\FILE.TXT. Forward slashes are taken as \.
const sep = "\\";
function clean(p) { return String(p).split("/").join("\\"); }
function normalize(p) {
  p = clean(p);
  if (p === "") return ".";
  const drive = p.length >= 2 && p.charAt(1) === ":" ? p.substring(0, 2).toUpperCase() : "";
  let rest = drive ? p.substring(2) : p;
  const abs = rest.charAt(0) === "\\";
  const out = [];
  for (const part of rest.split("\\")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length && out[out.length - 1] !== "..") out.pop();
      else if (!abs) out.push("..");
      continue;
    }
    out.push(part);
  }
  let s = out.join("\\");
  if (abs) s = "\\" + s;
  s = drive + s;
  if (s === "") return ".";
  if (s === drive) return drive + "\\";
  return s;
}
function isAbsolute(p) { p = clean(p); return p.charAt(0) === "\\" || (p.length > 2 && p.charAt(1) === ":" && p.charAt(2) === "\\"); }
function join() {
  const parts = Array.prototype.slice.call(arguments).filter((x) => x !== "");
  return parts.length ? normalize(parts.join("\\")) : ".";
}
function resolve() {
  let p = "";
  for (let i = arguments.length - 1; i >= 0 && !isAbsolute(p); i--) p = arguments[i] + (p ? "\\" + p : "");
  if (!isAbsolute(p)) p = process.cwd() + (p ? "\\" + p : "");
  if (clean(p).charAt(0) === "\\") p = "C:" + p;
  p = normalize(p);
  return p.length > 3 && p.charAt(p.length - 1) === "\\" ? p.substring(0, p.length - 1) : p;
}
function dirname(p) {
  p = clean(p);
  const i = p.lastIndexOf("\\");
  if (i < 0) return ".";
  if (i === 0) return "\\";
  if (i === 2 && p.charAt(1) === ":") return p.substring(0, 3);
  return p.substring(0, i);
}
function basename(p, ext) {
  p = clean(p);
  while (p.length > 1 && p.charAt(p.length - 1) === "\\") p = p.substring(0, p.length - 1);
  let b = p.substring(p.lastIndexOf("\\") + 1);
  if (ext && b.length > ext.length && b.substring(b.length - ext.length).toUpperCase() === ext.toUpperCase()) b = b.substring(0, b.length - ext.length);
  return b;
}
function extname(p) {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i <= 0 ? "" : b.substring(i);
}
function relative(from, to) {
  const a = resolve(from).toUpperCase().split("\\").filter((x) => x), b = resolve(to).split("\\").filter((x) => x);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i].toUpperCase()) i++;
  return a.slice(i).map(() => "..").concat(b.slice(i)).join("\\");
}
function parse(p) {
  const base = basename(p), ext = extname(p);
  const dir = p.indexOf("\\") >= 0 || p.indexOf("/") >= 0 ? dirname(p) : "";
  return { root: isAbsolute(p) ? clean(p).substring(0, clean(p).indexOf("\\") + 1) : "", dir, base, ext, name: base.substring(0, base.length - ext.length) };
}
function format(o) { return (o.dir ? o.dir + "\\" : o.root || "") + (o.base || (o.name || "") + (o.ext || "")); }
const path = { sep, delimiter: ";", normalize, isAbsolute, join, resolve, dirname, basename, extname, relative, parse, format };
path.win32 = path;
path.posix = path;
module.exports = path;
