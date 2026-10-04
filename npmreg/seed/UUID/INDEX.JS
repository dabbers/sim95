// v4(): a random UUID; validate(s): is s one?
const HEX = "0123456789abcdef";
function v4() {
  const pattern = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern.charAt(i);
    const r = Math.floor(Math.random() * 16);
    out += c === "x" ? HEX.charAt(r) : c === "y" ? HEX.charAt(8 + (r % 4)) : c;
  }
  return out;
}
function validate(s) {
  if (typeof s !== "string" || s.length !== 36) return false;
  for (let i = 0; i < 36; i++) {
    const c = s.charAt(i).toLowerCase();
    if (i === 8 || i === 13 || i === 18 || i === 23) { if (c !== "-") return false; }
    else if (HEX.indexOf(c) < 0) return false;
  }
  return true;
}
module.exports = { v4, validate, NIL: "00000000-0000-0000-0000-000000000000" };
