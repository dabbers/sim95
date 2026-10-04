// leftpad(str, len, ch): str with ch (a space unless you say) in front, until it is len long
module.exports = function leftpad(str, len, ch) {
  str = String(str);
  ch = ch === undefined || ch === null || ch === "" ? " " : String(ch);
  while (str.length < len) str = ch + str;
  return str;
};
