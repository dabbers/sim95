// semver - versions (1.2.3, 1.2.3-beta.1) and the ranges package.json uses:
//   1.2.3  =1.2.3  >1.2.3  >=1.2.3  <2.0.0  <=1.9.9   (several: all must hold)
//   ^1.2.3 (same major)   ~1.2.3 (same minor)   1.x  1.2.*  1  *  ""  latest
//   1.2.3 - 2.0.0   and any of those joined with ||
// A prerelease (1.0.0-beta) only matches a range that names it.

function isDigits(s) {
  if (s === "") return false;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c < 48 || c > 57) return false; }
  return true;
}

// "v1.2.3-beta.1" -> {major, minor, patch, pre: "beta.1", version: "1.2.3-beta.1"}, or null
function parse(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && v.version) return v;
  v = String(v).trim();
  if (v.charAt(0) === "=" || v.charAt(0) === "v") v = v.substring(1).trim();
  let pre = "";
  const dash = v.indexOf("-");
  if (dash >= 0) { pre = v.substring(dash + 1); v = v.substring(0, dash); }
  const plus = pre.indexOf("+");
  if (plus >= 0) pre = pre.substring(0, plus);
  const bits = v.split(".");
  if (bits.length !== 3 || !bits.every(isDigits)) return null;
  const out = { major: parseInt(bits[0]), minor: parseInt(bits[1]), patch: parseInt(bits[2]), pre };
  out.version = out.major + "." + out.minor + "." + out.patch + (pre ? "-" + pre : "");
  return out;
}

function valid(v) { const p = parse(v); return p ? p.version : null; }

function comparePre(a, b) {
  if (a === b) return 0;
  if (a === "") return 1;
  if (b === "") return -1;
  const x = a.split("."), y = b.split(".");
  for (let i = 0; i < x.length && i < y.length; i++) {
    if (x[i] === y[i]) continue;
    const nx = isDigits(x[i]), ny = isDigits(y[i]);
    if (nx && ny) return parseInt(x[i]) < parseInt(y[i]) ? -1 : 1;
    if (nx) return -1;
    if (ny) return 1;
    return x[i] < y[i] ? -1 : 1;
  }
  return x.length < y.length ? -1 : x.length > y.length ? 1 : 0;
}

function compare(a, b) {
  const x = parse(a), y = parse(b);
  if (!x || !y) throw new TypeError("Invalid Version: " + (x ? b : a));
  if (x.major !== y.major) return x.major < y.major ? -1 : 1;
  if (x.minor !== y.minor) return x.minor < y.minor ? -1 : 1;
  if (x.patch !== y.patch) return x.patch < y.patch ? -1 : 1;
  return comparePre(x.pre, y.pre);
}
const gt = (a, b) => compare(a, b) > 0, lt = (a, b) => compare(a, b) < 0, eq = (a, b) => compare(a, b) === 0;
const gte = (a, b) => compare(a, b) >= 0, lte = (a, b) => compare(a, b) <= 0;

// "1.x" / "1.2" / "*" -> [major, minor, patch] with null for a wildcard, and the prerelease
function partial(s) {
  s = s.trim();
  if (s.charAt(0) === "v" || s.charAt(0) === "=") s = s.substring(1);
  let pre = "";
  const dash = s.indexOf("-");
  if (dash >= 0) { pre = s.substring(dash + 1); s = s.substring(0, dash); }
  const bits = s === "" ? [] : s.split(".");
  if (bits.length > 3) return null;
  const nums = [null, null, null];
  for (let i = 0; i < bits.length; i++) {
    const b = bits[i];
    if (b === "x" || b === "X" || b === "*") break;
    if (!isDigits(b)) return null;
    nums[i] = parseInt(b);
  }
  return { nums, pre };
}

const vs = (a, b, c, pre) => a + "." + b + "." + c + (pre ? "-" + pre : "");

// one comparator ("^1.2.3", ">=1.0.0", "1.x") -> [[op, version], ...]
function desugar(c) {
  let op = "";
  for (const o of [">=", "<=", ">", "<", "^", "~", "="]) if (c.substring(0, o.length) === o) { op = o; break; }
  if (c.substring(0, 2) === "~>") op = "~>";
  const p = partial(c.substring(op.length));
  if (!p) return null;
  const n = p.nums, M = n[0], m = n[1], P = n[2];
  if (op === "~>") op = "~";
  if (M === null) return op === "<" || op === ">" ? [["<", "0.0.0"]] : [];   // * : anything
  if (op === "^") {
    const lo = vs(M, m || 0, P || 0, p.pre);
    if (M > 0 || m === null) return [[">=", lo], ["<", vs(M + 1, 0, 0, "0")]];
    if (m > 0 || P === null) return [[">=", lo], ["<", vs(0, m + 1, 0, "0")]];
    return [[">=", lo], ["<", vs(0, 0, P + 1, "0")]];
  }
  if (op === "~") {
    const lo = vs(M, m || 0, P || 0, p.pre);
    if (m === null) return [[">=", lo], ["<", vs(M + 1, 0, 0, "0")]];
    return [[">=", lo], ["<", vs(M, m + 1, 0, "0")]];
  }
  if (P === null) {
    // a partial version: 1 or 1.2 (or 1.x)
    const lo = vs(M, m || 0, 0), hi = m === null ? vs(M + 1, 0, 0, "0") : vs(M, m + 1, 0, "0");
    if (op === "" || op === "=") return [[">=", lo], ["<", hi]];
    if (op === ">") return [[">=", hi]];
    if (op === ">=") return [[">=", lo]];
    if (op === "<") return [["<", vs(M, m || 0, 0, "0")]];
    if (op === "<=") return [["<", hi]];
  }
  return [[op === "" ? "=" : op, vs(M, m, P, p.pre)]];
}

// a range -> [[comparators], ...] (any one set may match), or null
function parseRange(range) {
  range = String(range === undefined || range === null ? "*" : range).trim();
  if (range === "" || range === "latest" || range === "*" || range === "x") return [[]];
  const sets = [];
  for (let alt of range.split("||")) {
    alt = alt.trim();
    const set = [];
    const hy = alt.indexOf(" - ");
    if (hy >= 0) {
      const a = desugar(">=" + alt.substring(0, hy).trim()), b = partial(alt.substring(hy + 3).trim());
      if (!a || !b) return null;
      a.forEach((x) => set.push(x));
      const n = b.nums;
      if (n[0] !== null) {
        if (n[1] === null) set.push(["<", vs(n[0] + 1, 0, 0, "0")]);
        else if (n[2] === null) set.push(["<", vs(n[0], n[1] + 1, 0, "0")]);
        else set.push(["<=", vs(n[0], n[1], n[2], b.pre)]);
      }
      sets.push(set);
      continue;
    }
    // ">= 1.2.3" may have a space after the operator
    const words = alt.split(" ").filter((w) => w !== "");
    const joined = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if ((w === ">" || w === ">=" || w === "<" || w === "<=" || w === "=" || w === "^" || w === "~") && i + 1 < words.length) { joined.push(w + words[i + 1]); i++; }
      else joined.push(w);
    }
    for (const w of joined) {
      const d = desugar(w);
      if (!d) return null;
      d.forEach((x) => set.push(x));
    }
    sets.push(set);
  }
  return sets;
}

function test(op, v, w) {
  const c = compare(v, w);
  if (op === "=") return c === 0;
  if (op === ">") return c > 0;
  if (op === ">=") return c >= 0;
  if (op === "<") return c < 0;
  if (op === "<=") return c <= 0;
  return false;
}

function validRange(range) { return parseRange(range) !== null; }

function satisfies(version, range) {
  const v = parse(version);
  if (!v) return false;
  const sets = parseRange(range);
  if (!sets) return false;
  return sets.some((set) => {
    if (!set.every((c) => test(c[0], v.version, c[1]))) return false;
    if (!v.pre) return true;
    // a prerelease only where the range names one of the same version
    return set.some((c) => { const w = parse(c[1]); return w.pre && w.pre !== "0" && w.major === v.major && w.minor === v.minor && w.patch === v.patch; });
  });
}

function maxSatisfying(versions, range) {
  let best = null;
  for (const v of versions) if (satisfies(v, range) && (best === null || gt(v, best))) best = v;
  return best;
}

function sort(list) { return list.slice().sort(compare); }

// "patch" / "minor" / "major" / "prerelease"
function inc(version, what) {
  const v = parse(version);
  if (!v) return null;
  if (what === "major") return (v.pre && v.minor === 0 && v.patch === 0) ? vs(v.major, 0, 0) : vs(v.major + 1, 0, 0);
  if (what === "minor") return (v.pre && v.patch === 0) ? vs(v.major, v.minor, 0) : vs(v.major, v.minor + 1, 0);
  if (what === "patch") return v.pre ? vs(v.major, v.minor, v.patch) : vs(v.major, v.minor, v.patch + 1);
  if (what === "prerelease") {
    if (!v.pre) return vs(v.major, v.minor, v.patch + 1, "0");
    const bits = v.pre.split(".");
    const last = bits[bits.length - 1];
    if (isDigits(last)) bits[bits.length - 1] = String(parseInt(last) + 1); else bits.push("0");
    return vs(v.major, v.minor, v.patch, bits.join("."));
  }
  return null;
}

module.exports = { parse, valid, compare, gt, lt, eq, gte, lte, satisfies, maxSatisfying, validRange, sort, inc,
  major: (v) => parse(v).major, minor: (v) => parse(v).minor, patch: (v) => parse(v).patch };
