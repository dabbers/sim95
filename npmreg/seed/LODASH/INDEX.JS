// lodash for SIM95: the most-used parts of the utility belt.
const _ = {};
const by = (f) => (typeof f === "function" ? f : typeof f === "string" ? (o) => (o === null || o === undefined ? undefined : o[f]) : (o) => o);

// arrays
_.chunk = (a, n) => { n = n || 1; const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
_.compact = (a) => a.filter((x) => x);
_.uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
_.uniqBy = (a, f) => { const g = by(f), seen = []; return a.filter((x) => { const k = g(x); if (seen.indexOf(k) >= 0) return false; seen.push(k); return true; }); };
_.flatten = (a) => [].concat.apply([], a);
_.flattenDeep = (a) => a.reduce((acc, x) => acc.concat(Array.isArray(x) ? _.flattenDeep(x) : [x]), []);
_.difference = (a, b) => a.filter((x) => b.indexOf(x) < 0);
_.intersection = (a, b) => _.uniq(a.filter((x) => b.indexOf(x) >= 0));
_.union = function () { return _.uniq([].concat.apply([], Array.prototype.slice.call(arguments))); };
_.without = function (a) { const drop = Array.prototype.slice.call(arguments, 1); return a.filter((x) => drop.indexOf(x) < 0); };
_.zip = function () { const arrs = Array.prototype.slice.call(arguments); const n = Math.max.apply(null, arrs.map((x) => x.length)); return _.range(n).map((i) => arrs.map((x) => x[i])); };
_.head = _.first = (a) => a[0];
_.last = (a) => a[a.length - 1];
_.take = (a, n) => a.slice(0, n === undefined ? 1 : n);
_.drop = (a, n) => a.slice(n === undefined ? 1 : n);
_.range = (start, end, step) => {
  if (end === undefined) { end = start; start = 0; }
  step = step || (end < start ? -1 : 1);
  const out = [];
  for (let i = start; step > 0 ? i < end : i > end; i += step) out.push(i);
  return out;
};
_.shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; };
_.sample = (a) => a[Math.floor(Math.random() * a.length)];
_.sum = (a) => a.reduce((s, x) => s + x, 0);
_.sumBy = (a, f) => _.sum(a.map(by(f)));
_.mean = (a) => (a.length ? _.sum(a) / a.length : NaN);
_.max = (a) => (a.length ? Math.max.apply(null, a) : undefined);
_.min = (a) => (a.length ? Math.min.apply(null, a) : undefined);
_.maxBy = (a, f) => { const g = by(f); let best; a.forEach((x) => { if (best === undefined || g(x) > g(best)) best = x; }); return best; };
_.minBy = (a, f) => { const g = by(f); let best; a.forEach((x) => { if (best === undefined || g(x) < g(best)) best = x; }); return best; };

// collections
_.groupBy = (a, f) => { const g = by(f), out = {}; a.forEach((x) => { const k = g(x); (out[k] = out[k] || []).push(x); }); return out; };
_.countBy = (a, f) => { const g = by(f), out = {}; a.forEach((x) => { const k = g(x); out[k] = (out[k] || 0) + 1; }); return out; };
_.keyBy = (a, f) => { const g = by(f), out = {}; a.forEach((x) => { out[g(x)] = x; }); return out; };
_.sortBy = (a, f) => { const g = by(f); return a.map((x, i) => [g(x), i, x]).sort((p, q) => (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : p[1] - q[1])).map((p) => p[2]); };
_.partition = (a, f) => { const g = by(f), yes = [], no = []; a.forEach((x) => (g(x) ? yes : no).push(x)); return [yes, no]; };
_.times = (n, f) => _.range(n).map(f || ((i) => i));

// objects
_.pick = (o, keys) => { const out = {}; [].concat(keys).forEach((k) => { if (o[k] !== undefined) out[k] = o[k]; }); return out; };
_.omit = (o, keys) => { const out = {}; keys = [].concat(keys); Object.keys(o).forEach((k) => { if (keys.indexOf(k) < 0) out[k] = o[k]; }); return out; };
_.get = (o, p, dflt) => { const parts = Array.isArray(p) ? p : String(p).split("[").join(".").split("]").join("").split("."); let cur = o; for (const k of parts) { if (k === "") continue; if (cur === null || cur === undefined) return dflt; cur = cur[k]; } return cur === undefined ? dflt : cur; };
_.set = (o, p, v) => { const parts = String(p).split("."); let cur = o; parts.slice(0, -1).forEach((k) => { if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {}; cur = cur[k]; }); cur[parts[parts.length - 1]] = v; return o; };
_.has = (o, k) => o !== null && o !== undefined && Object.keys(o).indexOf(k) >= 0;
_.mapValues = (o, f) => { const out = {}; Object.keys(o).forEach((k) => { out[k] = f(o[k], k); }); return out; };
_.invert = (o) => { const out = {}; Object.keys(o).forEach((k) => { out[o[k]] = k; }); return out; };
_.cloneDeep = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
_.merge = function (target) {
  Array.prototype.slice.call(arguments, 1).forEach((src) => {
    Object.keys(src || {}).forEach((k) => {
      if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k]) && target[k] && typeof target[k] === "object") _.merge(target[k], src[k]);
      else target[k] = src[k];
    });
  });
  return target;
};
_.defaults = function (target) { Array.prototype.slice.call(arguments, 1).forEach((src) => Object.keys(src || {}).forEach((k) => { if (target[k] === undefined) target[k] = src[k]; })); return target; };
_.isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
_.isEmpty = (v) => v === null || v === undefined || (typeof v === "object" ? Object.keys(v).length === 0 : typeof v === "string" ? v.length === 0 : true);
_.isString = (v) => typeof v === "string";
_.isNumber = (v) => typeof v === "number";
_.isFunction = (v) => typeof v === "function";
_.isArray = Array.isArray;
_.isObject = (v) => v !== null && (typeof v === "object" || typeof v === "function");

// strings
const words = (s) => {
  const out = [];
  let cur = "";
  s = String(s);
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    const letter = c.toLowerCase() !== c.toUpperCase(), digit = "0123456789".indexOf(c) >= 0;
    if (!letter && !digit) { if (cur) out.push(cur); cur = ""; continue; }
    if (cur && c !== c.toLowerCase() && cur.charAt(cur.length - 1) === cur.charAt(cur.length - 1).toLowerCase() && letter) { out.push(cur); cur = ""; }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
};
_.words = words;
_.capitalize = (s) => { s = String(s); return s.charAt(0).toUpperCase() + s.substring(1).toLowerCase(); };
_.upperFirst = (s) => { s = String(s); return s.charAt(0).toUpperCase() + s.substring(1); };
_.camelCase = (s) => words(s).map((w, i) => (i === 0 ? w.toLowerCase() : _.capitalize(w))).join("");
_.kebabCase = (s) => words(s).map((w) => w.toLowerCase()).join("-");
_.snakeCase = (s) => words(s).map((w) => w.toLowerCase()).join("_");
_.startCase = (s) => words(s).map(_.upperFirst).join(" ");
_.repeat = (s, n) => String(s).repeat(n);
_.padStart = (s, n, ch) => String(s).padStart(n, ch === undefined ? " " : ch);
_.padEnd = (s, n, ch) => { let t = String(s); const len = t.length; ch = ch === undefined ? " " : String(ch); while (t.length < n) t += ch; return len >= n ? t : t.substring(0, n); };
_.truncate = (s, o) => { const n = (o && o.length) || 30, om = (o && o.omission) || "..."; s = String(s); return s.length <= n ? s : s.substring(0, n - om.length) + om; };
_.escape = (s) => String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split("\"").join("&quot;");

// functions and numbers
_.debounce = (f, wait) => { let t = null; return function () { const args = arguments, self = this; if (t) clearTimeout(t); t = setTimeout(() => { t = null; f.apply(self, args); }, wait || 0); }; };
_.throttle = (f, wait) => { let last = 0; return function () { const now = Date.now(); if (now - last >= wait) { last = now; return f.apply(this, arguments); } }; };
_.once = (f) => { let done = false, v; return function () { if (!done) { done = true; v = f.apply(this, arguments); } return v; }; };
_.memoize = (f) => { const cache = {}; return function (k) { if (!(k in cache)) cache[k] = f.apply(this, arguments); return cache[k]; }; };
_.clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
_.random = (lo, hi) => { if (hi === undefined) { hi = lo; lo = 0; } return lo + Math.floor(Math.random() * (hi - lo + 1)); };
_.inRange = (n, start, end) => { if (end === undefined) { end = start; start = 0; } return n >= Math.min(start, end) && n < Math.max(start, end); };
_.identity = (x) => x;
_.noop = () => {};

module.exports = _;
