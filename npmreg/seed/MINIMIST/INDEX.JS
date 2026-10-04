// minimist(process.argv.slice(2), {string: [...], boolean: [...], alias: {...}, default: {...}})
function isNumber(x) {
  if (typeof x === "number") return true;
  if (x === "" || typeof x !== "string") return false;
  return !isNaN(Number(x)) && x.trim() === x;
}

module.exports = function minimist(args, opts) {
  opts = opts || {};
  const strings = [].concat(opts.string || []), bools = [].concat(opts.boolean || []);
  const alias = {};
  for (const k of Object.keys(opts.alias || {})) {
    const names = [].concat(opts.alias[k]);
    alias[k] = names;
    for (const n of names) alias[n] = [k].concat(names.filter((x) => x !== n));
  }
  const argv = { _: [] };
  for (const b of bools) argv[b] = false;
  const set = (key, val) => {
    if (strings.indexOf(key) < 0 && bools.indexOf(key) < 0 && isNumber(val)) val = Number(val);
    if (bools.indexOf(key) >= 0 && typeof val === "string") val = val !== "false";
    const keys = [key].concat(alias[key] || []);
    for (const k of keys) {
      if (argv[k] === undefined || typeof argv[k] === "boolean" || bools.indexOf(k) >= 0) argv[k] = val;
      else argv[k] = [].concat(argv[k], val);
    }
  };
  const takesValue = (key) => bools.indexOf(key) < 0;
  let i = 0;
  while (i < args.length) {
    const a = String(args[i]);
    if (a === "--") { argv._ = argv._.concat(args.slice(i + 1).map(String)); break; }
    if (a.substring(0, 2) === "--" && a.indexOf("=") > 0) {
      set(a.substring(2, a.indexOf("=")), a.substring(a.indexOf("=") + 1));
    } else if (a.substring(0, 5) === "--no-") {
      set(a.substring(5), false);
    } else if (a.substring(0, 2) === "--") {
      const key = a.substring(2), next = args[i + 1];
      if (next !== undefined && String(next).charAt(0) !== "-" && takesValue(key)) { set(key, next); i++; }
      else set(key, strings.indexOf(key) >= 0 ? "" : true);
    } else if (a.charAt(0) === "-" && a.length > 1 && !isNumber(a)) {
      const letters = a.substring(1);
      for (let j = 0; j < letters.length; j++) {
        const key = letters.charAt(j), rest = letters.substring(j + 1);
        if (rest !== "" && "0123456789".indexOf(rest.charAt(0)) >= 0) { set(key, rest); break; }
        if (j === letters.length - 1) {
          const next = args[i + 1];
          if (next !== undefined && String(next).charAt(0) !== "-" && takesValue(key)) { set(key, next); i++; }
          else set(key, strings.indexOf(key) >= 0 ? "" : true);
        } else set(key, true);
      }
    } else {
      argv._.push(isNumber(a) && strings.indexOf("_") < 0 ? Number(a) : a);
    }
    i++;
  }
  for (const k of Object.keys(opts.default || {})) if (argv[k] === undefined) set(k, opts.default[k]);
  return argv;
};
