// cowsay.say({text, eyes, tongue, width}) or cowsay.say("text"): the cow, as a string
const wrap = require("wrap");

function bubble(lines) {
  const w = Math.max.apply(null, lines.map((l) => l.length));
  const out = [" " + "_".repeat(w + 2)];
  lines.forEach((l, i) => {
    const pad = l + " ".repeat(w - l.length);
    let a = "|", b = "|";
    if (lines.length === 1) { a = "<"; b = ">"; }
    else if (i === 0) { a = "/"; b = "\\"; }
    else if (i === lines.length - 1) { a = "\\"; b = "/"; }
    out.push(a + " " + pad + " " + b);
  });
  out.push(" " + "-".repeat(w + 2));
  return out.join("\n");
}

function say(o) {
  if (typeof o === "string") o = { text: o };
  const eyes = (o.eyes || "oo").substring(0, 2);
  const tongue = (o.tongue || "  ").substring(0, 2);
  return bubble(wrap(o.text || "Moo.", o.width || 36)) + "\n" +
    "        \\   ^__^\n" +
    "         \\  (" + eyes + ")\\_______\n" +
    "            (__)\\       )\\/\\\n" +
    "             " + tongue + " ||----w |\n" +
    "                ||     ||";
}

function think(o) {
  return say(o).split("\\   ^").join("o   ^").split(" \\  (").join(" o  (");
}

module.exports = { say, think };
