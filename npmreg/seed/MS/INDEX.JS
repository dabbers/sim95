// ms("2 days") -> 172800000; ms(60000) -> "1m"; ms(60000, {long: true}) -> "1 minute"
const S = 1000, M = S * 60, H = M * 60, D = H * 24, W = D * 7, Y = D * 365.25;
const UNITS = {
  years: Y, year: Y, yrs: Y, yr: Y, y: Y, weeks: W, week: W, w: W, days: D, day: D, d: D,
  hours: H, hour: H, hrs: H, hr: H, h: H, minutes: M, minute: M, mins: M, min: M, m: M,
  seconds: S, second: S, secs: S, sec: S, s: S, milliseconds: 1, millisecond: 1, msecs: 1, msec: 1, ms: 1,
};

function parse(str) {
  str = String(str).trim().toLowerCase();
  if (str.length === 0 || str.length > 100) return undefined;
  let i = 0;
  if (str.charAt(0) === "-" || str.charAt(0) === "+") i = 1;
  while (i < str.length && ("0123456789.".indexOf(str.charAt(i)) >= 0)) i++;
  const num = parseFloat(str.substring(0, i));
  if (isNaN(num)) return undefined;
  const unit = str.substring(i).trim() || "ms";
  if (UNITS[unit] === undefined) return undefined;
  return num * UNITS[unit];
}

function plural(ms, abs, n, name) {
  return Math.round(ms / n) + " " + name + (abs >= n * 1.5 ? "s" : "");
}

function format(ms, long) {
  const abs = Math.abs(ms);
  if (long) {
    if (abs >= D) return plural(ms, abs, D, "day");
    if (abs >= H) return plural(ms, abs, H, "hour");
    if (abs >= M) return plural(ms, abs, M, "minute");
    if (abs >= S) return plural(ms, abs, S, "second");
    return ms + " ms";
  }
  if (abs >= D) return Math.round(ms / D) + "d";
  if (abs >= H) return Math.round(ms / H) + "h";
  if (abs >= M) return Math.round(ms / M) + "m";
  if (abs >= S) return Math.round(ms / S) + "s";
  return ms + "ms";
}

module.exports = function ms(val, options) {
  if (typeof val === "string" && val.length > 0) return parse(val);
  if (typeof val === "number" && isFinite(val)) return format(val, options && options.long);
  throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
};
