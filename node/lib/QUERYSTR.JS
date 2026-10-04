// querystring - a=1&b=two
// (a malformed %XX is left as it is, as Node does)
function unesc(s) { s = s.split("+").join(" "); try { return decodeURIComponent(s); } catch (e) { return unescape(s); } }
function esc(s) { return encodeURIComponent(String(s)); }
function parse(str, sep, eq) {
  sep = sep || "&";
  eq = eq || "=";
  const out = {};
  if (!str) return out;
  for (const part of String(str).split(sep)) {
    if (!part) continue;
    const i = part.indexOf(eq);
    const k = unesc(i < 0 ? part : part.substring(0, i)), v = i < 0 ? "" : unesc(part.substring(i + 1));
    if (out[k] === undefined) out[k] = v;
    else if (Array.isArray(out[k])) out[k].push(v);
    else out[k] = [out[k], v];
  }
  return out;
}
function stringify(o, sep, eq) {
  sep = sep || "&";
  eq = eq || "=";
  const parts = [];
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (Array.isArray(v)) v.forEach((x) => parts.push(esc(k) + eq + esc(x)));
    else parts.push(esc(k) + eq + esc(v === undefined || v === null ? "" : v));
  }
  return parts.join(sep);
}
module.exports = { parse, stringify, escape: esc, unescape: unesc, decode: parse, encode: stringify };
